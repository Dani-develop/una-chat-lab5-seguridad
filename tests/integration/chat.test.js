const { io: connect } = require('socket.io-client');
const request = require('supertest');
const validation = require('../../libs/unalib');
const { createChatServer, EVENT } = require('../../server');

const rawMessage = (mensaje, extra = {}) => JSON.stringify({ nombre: 'Integración', mensaje, color: '#155e75', ...extra });

describe('Backend real + una-lib + Socket.IO real', () => {
  let chat, sender, receiver, spy;
  const broadcasts = [];

  beforeAll(async () => {
    chat = createChatServer();
    await new Promise(resolve => chat.httpServer.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${chat.httpServer.address().port}`;
    [sender, receiver] = await Promise.all([0, 1].map(() => new Promise((resolve, reject) => {
      const client = connect(url, { transports: ['websocket'], forceNew: true, reconnection: false });
      client.once('connect', () => resolve(client));
      client.once('connect_error', reject);
    })));
    receiver.on(EVENT, raw => broadcasts.push(JSON.parse(raw)));
  });
  beforeEach(() => {
    // Spy sin mockImplementation: ejecuta realmente la librería de producción.
    spy = jest.spyOn(validation, 'validarMensaje');
  });
  afterAll(async () => {
    sender?.disconnect();
    receiver?.disconnect();
    if (chat) await chat.close();
  });
  const send = raw => sender.timeout(3000).emitWithAck(EVENT, raw);

  test.each([
    ['https://example.com/foto.jpg', 'imagen'],
    ['https://example.com/video.webm', 'video'],
    ['https://www.youtube.com/watch?v=qYwlqx-JLok', 'youtube'],
    ['Hola desde otro cliente', 'texto']
  ])('acepta y transmite %s', async (mensaje, tipo) => {
    const raw = rawMessage(mensaje);
    const broadcast = new Promise(resolve => receiver.once(EVENT, value => resolve(JSON.parse(value))));
    const result = await send(raw);
    expect(result).toMatchObject({ ok: true, tipo, mensaje });
    expect(await broadcast).toEqual(result);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(raw);
  });
  test.each([
    'https://example.com/pagina.html',
    "<script>alert('Inyección de script');</script>",
    '<img src=x onerror=alert(1)>',
    'javascript:alert(1)'
  ])('rechaza y no difunde %s', async mensaje => {
    const before = broadcasts.length;
    const errorEvent = new Promise(resolve => sender.once('chat error', resolve));
    const raw = rawMessage(mensaje);
    const result = await send(raw);
    expect(result.ok).toBe(false);
    expect(await errorEvent).toBe(result.error);
    expect(spy).toHaveBeenCalledWith(raw);
    // Una barrera válida en el mismo transporte asegura que se procesaron los eventos previos.
    const barrier = new Promise(resolve => receiver.once(EVENT, resolve));
    await send(rawMessage('Barrera de sincronización'));
    await barrier;
    expect(broadcasts.slice(before)).toHaveLength(1);
    expect(broadcasts.at(-1).mensaje).toBe('Barrera de sincronización');
  });
  test('JSON malformado no cae en un retorno inseguro', async () => {
    expect(await send('{bad json')).toMatchObject({ ok: false });
    expect(spy).toHaveBeenCalledWith('{bad json');
  });
  test('rechaza código en el nombre aunque el mensaje sea normal', async () => {
    expect(await send(rawMessage('Hola', { nombre: '<script>alert(1)</script>' }))).toMatchObject({ ok: false });
  });
  test('servidor continúa disponible después de un rechazo', async () => {
    await send(rawMessage('data:text/html,alert(1)'));
    expect(await send(rawMessage('Todavía conectado'))).toMatchObject({ ok: true, tipo: 'texto' });
  });
  test('Supertest verifica HTML real y políticas HTTP', async () => {
    const response = await request(chat.app).get('/').expect(200).expect('Content-Type', /html/);
    expect(response.text).toContain('UNA Chat');
    expect(response.headers['content-security-policy']).toContain("script-src 'self'");
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    await request(chat.app).get('/health').expect(200, { ok: true });
  });
});
