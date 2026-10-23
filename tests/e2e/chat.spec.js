const { test, expect } = require('@playwright/test');
const path = require('node:path');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('status')).toHaveText('Conectado al servidor');
  await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill('Prueba E2E');
});

async function send(page, mensaje) {
  await page.getByRole('textbox', { name: 'Mensaje o URL de un medio' }).fill(mensaje);
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
}

test('imagen: se muestra y termina de cargar', async ({ page, baseURL }) => {
  await send(page, `${baseURL}/media/prueba.png`);
  const image = page.getByRole('img', { name: 'Imagen enviada por Prueba E2E' });
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(image).toHaveJSProperty('naturalWidth', 640);
  await page.screenshot({ path: path.resolve('evidencias/04a-imagen-cargada.jpg'), type: 'jpeg', quality: 90, fullPage: true });
});

test('video: carga metadatos y reproduce contenido real', async ({ page, baseURL }) => {
  await send(page, `${baseURL}/media/flower.webm`);
  const video = page.locator('#messages video');
  await expect(video).toBeVisible();
  await expect(video).toHaveAttribute('controls', '');
  await expect.poll(() => video.evaluate(element => element.readyState)).toBeGreaterThanOrEqual(2);
  await expect.poll(() => video.evaluate(element => Number.isFinite(element.duration) && element.duration > 0)).toBe(true);
  await video.evaluate(element => { element.muted = true; return element.play(); });
  await expect.poll(() => video.evaluate(element => element.currentTime)).toBeGreaterThan(0);
  await video.evaluate(element => element.pause());
  await page.screenshot({ path: path.resolve('evidencias/04b-video-cargado.jpg'), type: 'jpeg', quality: 90, fullPage: true });
});

test('script del enunciado: rechazo sin alert ni ejecución', async ({ page }) => {
  const dialogs = [];
  const errors = [];
  page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.dismiss(); });
  page.on('pageerror', error => errors.push(error.message));
  await send(page, "<script>alert('Inyección de script');</script>");
  await expect(page.getByRole('alert')).toContainText('No se permite código HTML ni scripts');
  await expect(page.locator('#messages li')).toHaveCount(0);
  await expect(page.locator('#messages script')).toHaveCount(0);
  expect(dialogs).toEqual([]);
  expect(errors).toEqual([]);
  await page.screenshot({ path: path.resolve('evidencias/04c-script-bloqueado.jpg'), type: 'jpeg', quality: 90, fullPage: true });
});

test('inyección por nombre y atributo también se rechaza', async ({ page }) => {
  const dialogs = [];
  page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.dismiss(); });
  await page.getByRole('textbox', { name: 'Nombre', exact: true }).fill('<img src=x onerror=alert(1)>');
  await send(page, 'Hola');
  await expect(page.getByRole('alert')).toContainText('No se permite código HTML');
  await expect(page.locator('#messages li')).toHaveCount(0);
  expect(dialogs).toEqual([]);
});

test('URL no multimedia: rechazo visible', async ({ page }) => {
  await send(page, 'https://example.com/pagina.html');
  await expect(page.getByRole('alert')).toContainText('Solo se permiten URLs HTTP(S)');
  await expect(page.locator('#messages li')).toHaveCount(0);
});

test('dos navegadores reciben el mensaje desde el backend real', async ({ page, browser, baseURL }) => {
  const other = await browser.newContext();
  try {
    const recipient = await other.newPage();
    await recipient.goto(baseURL);
    await expect(recipient.getByRole('status')).toHaveText('Conectado al servidor');
    await send(page, 'Hola desde el primer navegador');
    await expect(recipient.locator('#messages li')).toContainText('Hola desde el primer navegador');
    await expect(page.locator('#messages li')).toContainText('Hola desde el primer navegador');
  } finally { await other.close(); }
});
