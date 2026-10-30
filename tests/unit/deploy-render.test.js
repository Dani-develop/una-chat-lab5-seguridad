const { buildDeployUrl, triggerDeploy } = require('../../scripts/deploy-render');
const hook = 'https://api.render.com/deploy/srv-ejemplodelab?key=secreto-de-prueba';
const sha = 'a'.repeat(40);

describe('Solicitud segura al Deploy Hook de Render', () => {
  test('envía el SHA exacto y conserva la clave en la URL', () => {
    const url = buildDeployUrl(hook, sha);
    expect(url.searchParams.get('ref')).toBe(sha);
    expect(url.searchParams.get('key')).toBe('secreto-de-prueba');
  });
  test('reemplaza un ref anterior para no desplegar otro commit', () => {
    const url = buildDeployUrl(hook + '&ref=main', sha);
    expect(url.searchParams.getAll('ref')).toEqual([sha]);
  });
  test.each([undefined, '', 'not-a-url', 'http://api.render.com/deploy/srv-test?key=x',
    'https://api.render.com.evil.example/deploy/srv-test?key=x',
    'https://api.render.com/deploy/srv-test', 'https://api.render.com/otra-ruta?key=x'])('rechaza hook inválido %p', value => {
    expect(() => buildDeployUrl(value, sha)).toThrow();
  });
  test.each([undefined, '', 'main', 'abcd', 'z'.repeat(40)])('rechaza SHA inválido %p', value => {
    expect(() => buildDeployUrl(hook, value)).toThrow('GITHUB_SHA');
  });
  test.each([200, 202])('acepta HTTP %i sin afirmar que el despliegue está Live', async status => {
    const request = jest.fn().mockResolvedValue({ status });
    await expect(triggerDeploy({ hook, sha, request })).resolves.toEqual({ status, sha });
    expect(request.mock.calls[0][0].searchParams.get('ref')).toBe(sha);
    expect(request.mock.calls[0][1]).toMatchObject({ method: 'GET', redirect: 'error' });
  });
  test('un rechazo HTTP hace fallar el job sin exponer el hook', async () => {
    const request = jest.fn().mockResolvedValue({ status: 401 });
    await expect(triggerDeploy({ hook, sha, request })).rejects.toThrow('HTTP 401');
  });
  test('no filtra secretos en errores de red', async () => {
    const request = jest.fn().mockRejectedValue(new Error('Fallo al consultar ' + hook));
    try { await triggerDeploy({ hook, sha, request }); throw new Error('No rechazó el error'); }
    catch (error) {
      expect(error.message).toContain('No se pudo contactar Render');
      expect(error.message).not.toContain('secreto-de-prueba');
      expect(error.message).not.toContain(hook);
    }
  });
  test('no realiza solicitudes cuando falta el secreto', async () => {
    const request = jest.fn();
    await expect(triggerDeploy({ hook: undefined, sha, request })).rejects.toThrow('RENDER_DEPLOY_HOOK_URL');
    expect(request).not.toHaveBeenCalled();
  });
});
