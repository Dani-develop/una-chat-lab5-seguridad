# Despliegue de UNA Chat con GitHub Actions y Render

Esta continuación utiliza el chat seguro del laboratorio 5. El pipeline ejecuta
las pruebas unitarias, de integración y de navegador antes de permitir que Render
publique el mismo commit. El objetivo es evitar publicar una revisión que no
cumple las pruebas.

## Enlaces

- Chat público: https://una-chat-lab5-seguridad.onrender.com
- Repositorio: https://github.com/Dani-develop/una-chat-lab5-seguridad
- Workflow: https://github.com/Dani-develop/una-chat-lab5-seguridad/blob/main/.github/workflows/deploy.yml
- Ejecuciones: https://github.com/Dani-develop/una-chat-lab5-seguridad/actions/workflows/deploy.yml
- Servicio: https://dashboard.render.com/web/srv-dbhruqs9v7es738vrmfg

Se conserva `main`: el enunciado permite usarla en lugar de `master` siempre que
coincidan la rama de Render y la del workflow.

## Configuración de Render

El servicio es una instancia **Free** en Oregon, con Node.js 24, la rama `main`
y el repositorio de este proyecto. La raíz queda vacía; `package.json` está en
la raíz del repositorio.

| Parámetro | Valor |
| --- | --- |
| Build Command | `npm ci --omit=dev` |
| Start Command | `npm start` |
| NODE_VERSION | `24` |
| NODE_ENV | `production` |
| HOST | `0.0.0.0` |
| Auto-Deploy | Off |

`server.js` respeta `PORT`, proporcionado por Render. También detecta
`RENDER=true` y escucha en `0.0.0.0` si no se configuró `HOST`. En desarrollo
local conserva `127.0.0.1` por defecto. El frontend y Socket.IO se sirven desde
el mismo proceso Node.js; los clientes utilizan la conexión HTTPS/WSS del sitio.

`render.yaml` documenta la infraestructura y propone `/health` como comprobación
HTTP de salud. El servicio creado directamente usa inicialmente la comprobación
TCP predeterminada; `/health` también está disponible para verificación externa.
No hay que crear otro servicio para el mismo chat al consultar el Blueprint.

El plan Free puede entrar en reposo. La primera visita después del reposo puede
tardar en responder. Los mensajes se transmiten en tiempo real y no se almacenan
como historial persistente.

## Secreto requerido

En Render, abrir **Settings → Deploy Hook** y copiar su URL completa. En el
repositorio de GitHub, abrir **Settings → Secrets and variables → Actions →
New repository secret** y guardarla con el nombre:

```text
RENDER_DEPLOY_HOOK_URL
```

El valor se guarda únicamente como secreto de GitHub. No debe aparecer en Git,
archivos de entrega, logs ni capturas. `render.yaml` no lo necesita: el hook es
utilizado por el job de GitHub, no por el proceso del chat.

## Cómo se impide un despliegue con pruebas fallidas

`.github/workflows/deploy.yml` se activa en cada push a `main`, en pull requests
hacia `main` y mediante ejecución manual. Su job `pruebas` llama al workflow
reutilizable `.github/workflows/tests.yml`, que hace lo siguiente:

1. Obtiene el commit de la ejecución y prepara Node.js 24.
2. Instala las dependencias con `npm ci`, incluidas las de desarrollo.
3. Ejecuta `npm test` y `npm run test:integration`.
4. Instala Chromium y ejecuta `npm run test:e2e`.
5. Conserva resultados JSON, capturas y el reporte HTML como artefacto, incluso
   cuando alguna prueba falla.

El job `deploy` declara `needs: pruebas`. GitHub lo omite si `pruebas` termina en
error. No se utiliza `continue-on-error` para las pruebas ni `always()` para
autorizar el despliegue; `always()` solo conserva los artefactos. Además, el job
solo despliega desde `main` y nunca desde un pull request.

`scripts/deploy-render.js` recibe el hook por una variable de entorno, verifica
que pertenezca a `https://api.render.com` y añade `ref=GITHUB_SHA`. De ese modo
solicita la publicación del commit que acaba de pasar las pruebas. Un error de
red o respuesta HTTP distinta de 200/202 hace fallar el job sin imprimir la clave.

Un workflow verde confirma que el hook aceptó la solicitud. Todavía hay que
comprobar en Render el estado **Live**, el SHA del commit y el funcionamiento del
chat. HTTP 202 puede indicar que el despliegue quedó en cola.

## Evidencia de ejecución exitosa

Con el secreto configurado y GitHub Actions habilitado para la cuenta:

1. Abrir **Actions → Desplegar chat en Render → Run workflow**.
2. Elegir `main` y dejar `demostrar_fallo` desmarcado.
3. Comprobar las tres suites aprobadas y el job de despliegue en verde.
4. Esperar el estado Live en Render y verificar el mismo SHA.
5. Abrir el chat en dos ventanas, enviar un mensaje y comprobar que llega a ambas.
6. Guardar capturas de Actions y Render sin mostrar el Deploy Hook.

## Evidencia de prueba fallida y despliegue bloqueado

Repetir la ejecución manual con `demostrar_fallo` marcado. Ese input ejecuta
`scripts/demostrar-fallo-ci.js`, que crea una prueba Jest temporal en el runner.
La prueba comprueba intencionalmente una expectativa incorrecta: afirma que un
mensaje de texto válido debería ser rechazado. La librería devuelve `true`,
Jest falla y termina con código 1.

La prueba es real y se ejecuta con la suite unitaria. No se finge un resultado
con `exit 1`, no se cambia el código del chat publicado y no se confirma una
prueba rota en `main`. El archivo generado está excluido de Git y desaparece con
el checkout temporal del runner.

La captura debe mostrar la aserción fallida y el job `deploy` omitido
(`skipped`). Revisar también el historial de Render para comprobar que esa
ejecución no inició un despliegue nuevo. Una ejecución fallida por configuración
o por bloqueo de la cuenta no sustituye esta evidencia.

## Verificación local y del sitio público

El 29 de octubre de 2026 se comprobaron localmente 84 pruebas unitarias, 12 de
integración y 6 E2E. También se verificaron las 6 E2E contra la URL pública de
Render: carga de imagen, reproducción real de video, rechazo de script y nombre
malicioso, rechazo de URL no permitida y comunicación entre dos navegadores.
La demostración local de la prueba incorrecta produjo una prueba fallida y
código de salida 1; ese resultado local no sustituye las capturas de Actions.

Para comprobar el sitio publicado en PowerShell:

```powershell
$env:CHAT_BASE_URL = 'https://una-chat-lab5-seguridad.onrender.com'
$env:EVIDENCE_DIR = 'ci-results/capturas-render'
$env:PLAYWRIGHT_JSON_OUTPUT_FILE = 'ci-results/e2e-render.json'
npm run test:e2e
Remove-Item Env:CHAT_BASE_URL
Remove-Item Env:EVIDENCE_DIR
Remove-Item Env:PLAYWRIGHT_JSON_OUTPUT_FILE
```

Cuando se define `CHAT_BASE_URL`, Playwright prueba esa URL y no inicia el
servidor local. Para pruebas locales, omitir esa variable. Las capturas del
laboratorio anterior se conservan separadas de los resultados de esta continuación.

## Investigación y fuentes

La instalación del job de pruebas utiliza dependencias de desarrollo porque Jest,
Socket.IO Client, Supertest y Playwright son herramientas de validación. Render
utiliza `--omit=dev` porque el servicio publicado solo necesita Express y Socket.IO.
Separar los jobs permite comprobar explícitamente la dependencia entre validar y
desplegar, y conservar resultados aunque se bloquee la publicación.

- [GitHub Actions y condiciones de ejecución](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-jobs-with-conditions)
- [Render Deploy Hooks y commits específicos](https://render.com/docs/deploy-hooks)
- [Render y verificación de despliegues](https://render.com/docs/deploys)
- [Instancias Free de Render](https://render.com/docs/free)
- [Referencia de render.yaml](https://render.com/docs/blueprint-spec)
- [Uso gratuito de ejecutores estándar en repositorios públicos](https://docs.github.com/en/actions/concepts/billing-and-usage)
