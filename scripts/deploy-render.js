'use strict';

// El hook permanece en el entorno del job; nunca se imprime ni se guarda en Git.
function buildDeployUrl(hook, sha) {
  if (!/^[a-f0-9]{40}$/i.test(sha || '')) throw new Error('GITHUB_SHA debe identificar un commit completo.');
  let url;
  try { url = new URL(hook); } catch { throw new Error('Configura el secreto RENDER_DEPLOY_HOOK_URL.'); }
  if (url.origin !== 'https://api.render.com' || url.username || url.password ||
      !/^\/deploy\/srv-[a-z0-9]+$/.test(url.pathname) || !url.searchParams.get('key') || url.hash) {
    throw new Error('El secreto no contiene un Deploy Hook válido de Render.');
  }
  url.searchParams.set('ref', sha);
  return url;
}

async function triggerDeploy({ hook, sha, request = fetch }) {
  const url = buildDeployUrl(hook, sha);
  let response;
  try {
    response = await request(url, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(30000) });
  } catch {
    throw new Error('No se pudo contactar Render. Revisa la conectividad del job.');
  }
  if (![200, 202].includes(response.status)) {
    // No imprimir el cuerpo: una respuesta ajena podría repetir el secreto.
    throw new Error(`Render rechazó la solicitud (HTTP ${response.status}).`);
  }
  return { status: response.status, sha };
}

if (require.main === module) {
  triggerDeploy({ hook: process.env.RENDER_DEPLOY_HOOK_URL, sha: process.env.GITHUB_SHA })
    .then(result => {
      console.log(`Render aceptó la solicitud (HTTP ${result.status}) para el commit ${result.sha}.`);
      console.log('Confirmar en Render el estado Live y el mismo commit; aceptar el hook no confirma el fin del despliegue.');
    })
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { buildDeployUrl, triggerDeploy };
