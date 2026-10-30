# UNA Chat - Laboratorio 5

Repositorio: https://github.com/Dani-develop/una-chat-lab5-seguridad

Chat publicado: https://una-chat-lab5-seguridad.onrender.com

La continuación del laboratorio incorpora despliegue en Render y pruebas previas
con GitHub Actions. La configuración, la explicación del bloqueo por pruebas y
las dos ejecuciones verificadas están en
[Despliegue con GitHub Actions y Render](docs/despliegue-render.md).

Laboratorio de Seguridad Informática, Universidad Nacional, Campus Nicoya.
Proyecto desarrollado a partir del ZIP proporcionado para el laboratorio.

## Ejecutar el chat

Requisitos: Node.js 20 o superior y npm.

```sh
npm ci
npm start
```

Abrir http://127.0.0.1:3000 en uno o varios navegadores. El mismo proceso Node.js
sirve el frontend y el backend Socket.IO, como en el proyecto original. No existe
un segundo servidor de frontend que deba iniciarse por separado.

Enviar texto normal o una URL completa de imagen, video directo o YouTube.
Para probar sin depender de servicios externos:

```text
http://127.0.0.1:3000/media/prueba.png
http://127.0.0.1:3000/media/flower.webm
```

Las imágenes admiten JPG, JPEG, PNG, GIF, WebP, BMP y AVIF. Los videos directos
admiten MP4, WebM y OGV. Para YouTube se admiten enlaces watch, embed, shorts y
youtu.be con identificador válido. Los enlaces deben ocupar todo el mensaje.
El navegador muestra un aviso si el archivo no está disponible o no es decodificable.

## Qué se corrigió

1. En el original, `is_valid_url_image` e `is_valid_yt_video` usaban `phone` en vez
   de `url`, lo cual generaba un `ReferenceError`. Las pruebas originales daban
   **2 aprobadas y 3 fallidas**. Se conservaron esos cinco casos en la suite unitaria.
2. `validateMessage` devolvía el contenido original ante errores y el frontend
   usaba `.html()` para insertarlo. El script del enunciado ejecutaba un `alert`.
3. `validarMensaje` ahora comprueba JSON, tipos, límites, nombre, color y contenido.
   Rechaza HTML y scripts y descarta campos adicionales. Se mantiene el alias
   `validateMessage` para compatibilidad, sin generar etiquetas HTML.
4. Las URLs se analizan completas con `URL`, una lista de protocolos HTTP(S),
   extensiones de archivo y dominios exactos de YouTube. Se rechazan credenciales,
   caracteres peligrosos, esquemas activos, URLs parciales y extensiones engañosas.
   Los IDs de YouTube se transforman a una URL canónica en youtube-nocookie.com.
5. El frontend crea elementos con `createElement`, asigna texto con `textContent`
   y genera `img`, `video` o `iframe` según el tipo validado por el servidor.
   No inserta HTML recibido por Socket.IO. También se aplican CSP y `nosniff`.
6. El servidor informa el rechazo al emisor y no retransmite el contenido inválido.

La validación reconoce la sintaxis y el tipo permitido por URL; la carga real y
la decodificación del contenido las comprueba el navegador. El backend no descarga
URLs remotas. Las pruebas E2E verifican `naturalWidth`, `readyState`, duración y
avance de reproducción sobre medios locales reales.

## Tres suites de pruebas

```sh
# Unitarias: lógica pura de una-lib, incluidos los 5 casos originales
npm test

# Integración: Socket.IO y backend reales; Supertest para los endpoints HTTP
npm run test:integration
# Equivalente solicitado por el enunciado:
npx jest tests/integration --runInBand --env=node

# Instalar el navegador de Playwright una vez
npx playwright install chromium

# E2E: frontend + backend reales, navegador visible
npx playwright test --project=chromium --headed

# Ver el reporte HTML de Playwright
npx playwright show-report

# Las tres suites en secuencia (E2E sin ventana)
npm run test:all
```

Playwright inicia automáticamente el backend en el puerto 3100, usa esa misma URL
para el frontend y cierra el servidor al terminar. No debe haber otro proceso
escuchando en 3100. Integración utiliza un puerto efímero y cierra sus dos clientes
y su servidor. Jest excluye `tests/e2e` y la copia original.

En el equipo donde se produjeron las evidencias, Chromium descargado presentó
un error de configuración en paralelo de Windows al abrir una ventana. Se usó
el Chrome instalado con el motor Chromium, dentro del proyecto `chromium` de
Playwright. Para reproducir esa ejecución en PowerShell:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npx playwright test --project=chromium --headed
# Para volver al Chromium de Playwright:
Remove-Item Env:PLAYWRIGHT_CHANNEL
```

No se simulan Socket.IO ni las respuestas multimedia en las pruebas E2E. En
integración, `jest.spyOn` observa la llamada a `validarMensaje` sin reemplazar su
implementación; además se verifica la respuesta y la difusión a otro cliente.

El workflow de pruebas también se puede ejecutar manualmente y es reutilizado
por `.github/workflows/deploy.yml` antes de cada despliegue. En la verificación
inicial del 23 de octubre, GitHub impidió iniciar el job por un bloqueo de
facturación de la cuenta. Los resultados históricos de `evidencias/` corresponden
a la ejecución local de esa fecha; no se atribuyen a GitHub Actions.

## Resultados y evidencias

Ejecución del 23 de octubre de 2026:

| Suite | Resultado |
| --- | --- |
| Unitarias | 65 aprobadas |
| Integración | 12 aprobadas |
| End-to-end | 6 aprobadas |

En `evidencias/`:

| Archivo | Contenido |
| --- | --- |
| `01-inyeccion-original.jpg` | Captura proporcionada por el usuario con el alert real del original; convertida de PNG a JPG sin cambiar su contenido. |
| `02-pruebas-unitarias.jpg` | Captura del visor del registro real de Jest: 65 pruebas aprobadas. |
| `03-pruebas-integracion.jpg` | Captura del visor del registro real de Jest: 12 pruebas aprobadas. |
| `04-pruebas-e2e.jpg` | Captura del registro real de Playwright: 6 pruebas aprobadas en modo visible. |
| `04a-imagen-cargada.jpg` | Imagen cargada en el frontend real. |
| `04b-video-cargado.jpg` | Video después de cargar y comenzar a reproducirse. |
| `04c-script-bloqueado.jpg` | Rechazo visible del script en la versión corregida. |
| `04d-reporte-playwright.jpg` | Captura del reporte HTML oficial de Playwright. |
| `resultado-original.json` | Payload y diálogo observados al reproducir la vulnerabilidad. |
| `resultados-*.json` | Resultados estructurados de Jest y Playwright. |
| `02-*.txt`, `03-*.txt`, `04-*.txt` | Transcripciones de stdout y stderr de los procesos ejecutados. |

Las capturas de las suites muestran un visor que recibe la salida de los procesos
reales; no son capturas de una terminal nativa. Sus registros de texto y JSON se
incluyen para comprobar los resultados. El generador puede ejecutarse con:

```sh
npm run evidence
```

En Windows, configurar `PLAYWRIGHT_CHANNEL=chrome` si se requiere la alternativa
descrita arriba. El generador actualiza las evidencias 2, 3 y 4 y las capturas del
chat; la captura del diálogo original se toma por separado.

## Reproducir la vulnerabilidad original

`original/antes/` conserva el código de partida vulnerable para comparar el antes
y el después. No es el servidor de la aplicación corregida. Para ejecutar la
reproducción controlada en el equipo local:

```sh
cd original/antes
npm ci
cd ../..
npm run reproduce:original
```

El script inicia temporalmente el original en el puerto 3200, envía exactamente
`<script>alert('Inyección de script');</script>`, observa el diálogo real y guarda
el resultado. También cierra navegador y servidor. Las dependencias CDN de la
versión original requieren conexión a Internet.

## Entrega

El cierre del enunciado indica entregar **JPG y repositorio.txt**, aunque una línea
anterior menciona PDF. Este proyecto sigue la indicación final: subir los cuatro
JPG principales y `repositorio.txt` a ProfeLink. Se pueden agregar las capturas
del chat y del reporte oficial como evidencia complementaria. El código y las tres suites están en el
repositorio enlazado. La entrega en ProfeLink la realiza el estudiante.

## Documentación consultada

- [Socket.IO: pruebas con servidor y clientes reales](https://socket.io/docs/v4/testing/)
- [Jest: configuración y exclusiones](https://jestjs.io/docs/configuration)
- [Playwright: manejo de diálogos](https://playwright.dev/docs/dialogs)
- [Origen de los medios de prueba](public/media/FUENTES.md)
