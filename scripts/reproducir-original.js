'use strict';

// Ejecutar exclusivamente la copia vulnerable local para documentar el antes.
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { chromium } = require('@playwright/test');
const root = path.resolve(__dirname, '..');
const hold = process.argv.includes('--hold');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  let browser;
  const server = spawn(process.execPath, ['server.js'], {
    cwd: path.join(root, 'original/antes'),
    env: { ...process.env, PORT: '3200' }, stdio: 'ignore', windowsHide: true
  });
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      let attempts = 0;
      const poll = async () => {
        try { const response = await fetch('http://127.0.0.1:3200'); if (response.ok) return resolve(); } catch {}
        if (++attempts >= 50) return reject(new Error('El servidor original no arrancó.'));
        setTimeout(poll, 200);
      };
      poll();
    });
    browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined, headless: !hold, args: ['--window-size=1280,850'] });
    const page = await browser.newPage({ viewport: { width: 1240, height: 720 } });
    const dialogs = [];
    page.on('dialog', async dialog => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      console.log(`ALERT REAL DETECTADO: ${dialog.message()}`);
      if (hold) {
        console.log('Esperando captura de la ventana del navegador; crear tmp/continuar-original para continuar.');
        const stopAt = Date.now() + 300000;
        while (!fs.existsSync(path.join(root, 'tmp/continuar-original')) && Date.now() < stopAt) await wait(250);
      }
      await dialog.accept();
    });
    await page.goto('http://127.0.0.1:3200');
    await page.waitForFunction(() => typeof window.$ === 'function' && typeof window.io === 'function');
    await page.locator('#nombre').fill('Prueba original');
    await page.locator('#m').fill("<script>alert('Inyección de script');</script>");
    await page.getByRole('button', { name: 'Send', exact: true }).click({ timeout: 310000 });
    // Espera a que termine el manejador del diálogo antes de cerrar el navegador.
    const deadline = Date.now() + 310000;
    while (hold && !fs.existsSync(path.join(root, 'tmp/continuar-original')) && Date.now() < deadline) await wait(250);
    await page.waitForFunction(() => document.querySelectorAll('#messages li').length === 1, undefined, { timeout: 310000 });
    if (!dialogs.some(dialog => dialog.message === 'Inyección de script')) throw new Error('No se observó el alert esperado.');
    await page.screenshot({ path: path.join(root, 'evidencias/01b-chat-original.jpg'), type: 'jpeg', fullPage: true });
    const result = { fecha: new Date().toISOString(), url: page.url(), payload: "<script>alert('Inyección de script');</script>", dialogs, vulnerable: true };
    fs.writeFileSync(path.join(root, 'evidencias/resultado-original.json'), JSON.stringify(result, null, 2) + '\n');
    console.log('CONFIRMADO: el script del enunciado se ejecuta en la versión original.');
  } finally {
    await browser?.close();
    server.kill();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
