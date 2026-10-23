'use strict';

// Captura un visor que recibe stdout/stderr del proceso real en ejecución.
// No dibuja resultados ficticios ni imita una ventana de terminal.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createServer } = require('node:http');
const { chromium } = require('@playwright/test');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'evidencias');
const escape = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Ejecutar este generador con npm run evidence.');

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const state = { title: '', command: '', log: '', status: 'En ejecución' };
  const reportFiles = require('express').static(path.join(root, 'playwright-report'));
  const viewer = createServer((req, res) => {
    if (req.url.startsWith('/report/')) {
      req.url = req.url.slice('/report'.length);
      return reportFiles(req, res, () => { res.statusCode = 404; res.end('Archivo no encontrado'); });
    }
    if (req.url === '/state') {
      res.setHeader('content-type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify(state));
    }
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(`<!doctype html><html lang="es"><meta charset="utf-8"><title>UNA Chat - registro de pruebas</title>
      <style>body{margin:0;padding:30px;background:#eef3f5;color:#18333d;font:16px system-ui}main{max-width:1300px;margin:auto}h1{font-size:28px;margin:8px 0}header{background:white;padding:22px;border:1px solid #cad8de;border-radius:9px}p{margin:8px 0}.label{font-size:12px;letter-spacing:1px;color:#155e75}pre{background:#12232e;color:#e0edf5;border-radius:9px;padding:24px;font:15px/1.5 Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere}.status{font-weight:bold;color:#12643f}</style>
      <main><header><div class="label">LABORATORIO 5 · UNA CHAT</div><h1 id="title"></h1><p id="command"></p><p class="status" id="status"></p><p>Registro real de stdout y stderr. Fecha local: <span id="date"></span></p></header><pre id="log"></pre></main>
      <script>async function update(){const s=await(await fetch('/state')).json();for(const k of ['title','command','status','log'])document.getElementById(k).textContent=s[k];document.getElementById('date').textContent=new Date().toLocaleString('es-CR',{timeZone:'America/Costa_Rica'});}update();setInterval(update,150);</script></html>`);
  });
  await new Promise(resolve => viewer.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto(`http://127.0.0.1:${viewer.address().port}`);
    const jobs = [
      ['02-pruebas-unitarias', 'Evidencia 2 · Pruebas unitarias', 'npm test -- --json --outputFile=evidencias/resultados-unitarias.json', [npmCli, 'test', '--', '--json', '--outputFile=evidencias/resultados-unitarias.json']],
      ['03-pruebas-integracion', 'Evidencia 3 · Pruebas de integración', 'npm run test:integration -- --json --outputFile=evidencias/resultados-integracion.json', [npmCli, 'run', 'test:integration', '--', '--json', '--outputFile=evidencias/resultados-integracion.json']],
      ['04-pruebas-e2e', `Evidencia 4 · Playwright / Chromium${process.env.PLAYWRIGHT_CHANNEL === 'chrome' ? ' (Chrome instalado)' : ''}`, 'npm run test:e2e:headed', [npmCli, 'run', 'test:e2e:headed']]
    ];
    const summary = [];
    for (const [name, title, command, args] of jobs) {
      Object.assign(state, { title, command: '$ ' + command, log: '', status: 'En ejecución' });
      const started = new Date().toISOString();
      const code = await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, args, { cwd: root, env: { ...process.env, FORCE_COLOR: '0' }, windowsHide: true });
        child.on('error', reject);
        for (const stream of [child.stdout, child.stderr]) {
          stream.setEncoding('utf8');
          stream.on('data', data => { state.log += data; process.stdout.write(data); });
        }
        child.on('close', resolve);
      });
      state.log = state.log.replace(/\u001b\[[0-9;]*[A-Za-z]/g, '');
      state.status = `Finalizado · código de salida ${code}`;
      fs.writeFileSync(path.join(output, `${name}.txt`), `${state.command}\nInicio UTC: ${started}\n\n${state.log}\n${state.status}\n`);
      // Se conserva además el visor con el registro para consulta fuera de la captura.
      fs.writeFileSync(path.join(output, `${name}.html`), `<!doctype html><meta charset="utf-8"><title>${escape(title)}</title><h1>${escape(title)}</h1><p>${escape(state.command)}</p><pre>${escape(state.log)}</pre><p>${escape(state.status)}</p>`);
      await page.reload();
      await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Finalizado'));
      await page.screenshot({ path: path.join(output, `${name}.jpg`), type: 'jpeg', quality: 95, fullPage: true });
      summary.push({ title, command, executed: [process.execPath, ...args], channel: process.env.PLAYWRIGHT_CHANNEL || 'bundled-chromium', started, exitCode: code });
      if (code !== 0) throw new Error(`${title}: falló con código ${code}`);
    }
    fs.writeFileSync(path.join(output, 'ejecuciones.json'), JSON.stringify(summary, null, 2) + '\n');
    await page.goto(`http://127.0.0.1:${viewer.address().port}/report/index.html`);
    await page.waitForFunction(() => document.body.innerText.includes('chat.spec.js') && document.body.innerText.includes('Passed'));
    await page.screenshot({ path: path.join(output, '04d-reporte-playwright.jpg'), type: 'jpeg', quality: 95, fullPage: true });
    console.log('Capturas y registros guardados en evidencias/.');
  } finally {
    await browser?.close();
    await new Promise(resolve => viewer.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
