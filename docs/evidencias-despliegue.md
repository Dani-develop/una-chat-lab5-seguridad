# Evidencias del despliegue de UNA Chat

Verificación: 30/10/2026 13:03 (Costa Rica, UTC−6).

Chat público: https://una-chat-lab5-seguridad.onrender.com

Workflow: https://github.com/Dani-develop/una-chat-lab5-seguridad/blob/main/.github/workflows/deploy.yml

## Ejecución con pruebas aprobadas y despliegue

- Ejecución: [40982309641, intento 2](https://github.com/Dani-develop/una-chat-lab5-seguridad/actions/runs/40982309641/attempts/2).
- Commit probado: `c2deb23bc70685863ea9c3ee818527c9283747be`.
- Unitarias: 84 aprobadas.
- Integración: 12 aprobadas.
- E2E: 6 aprobadas, 0 fallidas.
- Ambos jobs de Actions: `success`.
- Render: `dep-dbieh9mk1f9s73eka8n0`, estado `live`, mismo SHA.
- Trigger informado por Render: `deploy_hook`.
- Finalización en Render: `2026-10-30T18:58:20.994181Z` (UTC).
- Después del despliegue: 6 E2E aprobadas contra la URL pública.

## Ejecución con una prueba fallida y despliegue bloqueado

- Ejecución: [41111384372, intento 1](https://github.com/Dani-develop/una-chat-lab5-seguridad/actions/runs/41111384372/attempts/1).
- Mismo commit: `c2deb23bc70685863ea9c3ee818527c9283747be`.
- Entrada manual: `demostrar_fallo=true`.
- Unitarias: 84 aprobadas y 1 fallida.
- Jest ejecutó una aserción incorrecta: esperaba `false` para un mensaje válido y recibió `true`.
- Job de pruebas: `failure`; job de despliegue: `skipped`.
- El historial de Render conservó `dep-dbieh9mk1f9s73eka8n0` como último despliegue.

## Cómo revisar los archivos

Los archivos que se describen a continuación están en `entrega-despliegue.zip`.

Las imágenes 01 y 02 son resúmenes generados a partir de las respuestas reales
de la API de GitHub y de Render; no son capturas de sus interfaces.
Los JSON originales, los registros descargados de los jobs y los artefactos
de Jest y Playwright permiten verificar los resultados. Los enlaces de cada
ejecución conducen al intento concreto usado como evidencia.

`verificacion-del-chat/` y `reporte-playwright/` muestran las pruebas posteriores
contra el servicio publicado, incluida la comunicación entre dos sesiones.
La prueba fallida de demostración solo existió en el runner temporal de Actions.
