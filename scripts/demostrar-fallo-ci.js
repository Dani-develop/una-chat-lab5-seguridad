'use strict';

// Solo crea el archivo en el checkout temporal del runner, o al invocarlo a mano.
// Es una aserción Jest real e intencionalmente incorrecta sobre un mensaje válido.
const fs = require('node:fs');
const path = require('node:path');
const destination = path.resolve(__dirname, '../tests/unit/pipeline-demo.test.js');
const source = [
  "const { validarMensaje } = require('../../libs/unalib');",
  "test('Demostración: una prueba fallida debe bloquear Render', () => {",
  "  const result = validarMensaje(JSON.stringify({ nombre: 'CI', mensaje: 'Hola desde CI', color: '#155e75' }));",
  '  expect(result.ok).toBe(false); // La respuesta correcta es true: este caso DEBE fallar.',
  '});', ''
].join('\n');
fs.writeFileSync(destination, source, { flag: 'wx' });
console.log('Prueba fallida creada. npm test debe terminar con código 1; el job deploy debe quedar skipped.');
