const validation = require('../../libs/unalib');
const message = (mensaje, extra = {}) => JSON.stringify({ nombre: 'Daniela', mensaje, color: '#155e75', ...extra });

describe('Pruebas originales del ZIP (mismos cinco casos)', () => {
  test('teléfono válido 8297-8547', () => expect(validation.is_valid_phone('8297-8547')).toBe(true));
  test('teléfono inválido 8297p-8547', () => expect(validation.is_valid_phone('8297p-8547')).toBe(false));
  test.each(['http://image.com/image.jpg', 'http://image.com/image.gif'])('imagen válida %s', url => {
    expect(validation.is_valid_url_image(url)).toBe(true);
  });
  test('YouTube válido del proyecto original', () => {
    expect(validation.is_valid_yt_video('https://www.youtube.com/watch?v=qYwlqx-JLok')).toBe(true);
  });
});

describe('URLs completas de imágenes y videos', () => {
  test.each([
    ['https://example.com/foto.PNG?version=2', 'imagen'],
    ['http://localhost:3100/media/prueba.png', 'imagen'],
    ['https://example.com/foto.webp', 'imagen'],
    ['https://example.com/clip.mp4?token=abc', 'video'],
    ['https://example.com/clip.webm', 'video'],
    ['https://example.com/clip.ogv', 'video'],
    ['https://youtu.be/qYwlqx-JLok?t=5', 'youtube'],
    ['https://www.youtube.com/embed/qYwlqx-JLok', 'youtube'],
    ['https://www.youtube.com/shorts/qYwlqx-JLok', 'youtube']
  ])('acepta %s como %s', (url, tipo) => {
    const result = validation.validarMensaje(message(url));
    expect(result).toMatchObject({ ok: true, tipo });
    expect(result.url).toMatch(/^https?:\/\//);
  });
  test.each([
    'https://example.com/index.html', 'https://example.com/script.svg',
    'https://example.com/foto.png.exe', 'https://example.com/foto.png/extra',
    'https://example.com/index.html?foto=x.png',
    'javascript:alert(1)', 'data:image/png;base64,AAAA', 'file:///tmp/foto.png',
    'ftp://example.com/foto.jpg', '//example.com/foto.jpg',
    'www.example.com/foto.jpg', 'https://user:password@example.com/foto.png',
    'https://example.com/foto.png" onerror="alert(1)',
    'https://example.com/foto.png%22%20onerror=alert(1)',
    'https://example.com/%3Cscript%3E.png', 'https://example.com/foto%0a.png',
    'https:\\example.com\\foto.png', 'https://example.com/%ZZ.png',
    'https://www.youtube.com/watch?v=incorrecto',
    'https://www.youtube.com.evil.example/watch?v=qYwlqx-JLok',
    'https://www.youtube.com/watch?v=qYwlqx-JLok&v=otro',
    'https://youtu.be/qYwlqx-JLok/extra', 'Mira https://example.com/foto.png'
  ])('rechaza URL no permitida: %s', url => {
    expect(validation.parseMediaUrl(url)).toBeNull();
    expect(validation.validarMensaje(message(url)).ok).toBe(false);
  });
  test.each([null, undefined, 23, {}, [], ''])('no lanza excepciones con %p', value => {
    expect(validation.parseMediaUrl(value)).toBeNull();
  });
  test('el iframe usa dominio e ID canónicos', () => {
    expect(validation.validarMensaje(message('https://youtu.be/qYwlqx-JLok'))).toMatchObject({
      url: 'https://www.youtube-nocookie.com/embed/qYwlqx-JLok', id: 'qYwlqx-JLok'
    });
    expect(validation.getYTVideoId('https://example.com/no')).toBeNull();
  });
});

describe('Validación de mensajes y prevención de inyección', () => {
  test('acepta texto normal en español y elimina campos no autorizados', () => {
    expect(validation.validarMensaje(message('¡Hola, UNA!', { admin: true }))).toEqual({
      ok: true, nombre: 'Daniela', mensaje: '¡Hola, UNA!', color: '#155e75', tipo: 'texto'
    });
  });
  test('nombre vacío usa Anónimo', () => {
    expect(validation.validarMensaje(message('Hola', { nombre: '  ' })).nombre).toBe('Anónimo');
  });
  test.each([
    "<script>alert('Inyección de script');</script>",
    '<img src=x onerror=alert(1)>', '<svg onload=alert(1)>',
    '<iframe src="javascript:alert(1)"></iframe>', '<ScRiPt>alert(1)</ScRiPt>'
  ])('bloquea HTML y script: %s', payload => {
    expect(validation.validarMensaje(message(payload))).toMatchObject({ ok: false });
  });
  test('bloquea inyección en nombre y color', () => {
    expect(validation.validarMensaje(message('Hola', { nombre: '<img src=x onerror=alert(1)>' })).ok).toBe(false);
    expect(validation.validarMensaje(message('Hola', { color: "red' onmouseover='alert(1)" })).ok).toBe(false);
  });
  test.each([null, undefined, {}, 1, '', '{', 'null', '[]', '"texto"', '{"mensaje":4}', '{"mensaje":""}'])('rechaza entrada inválida %p', raw => {
    expect(validation.validarMensaje(raw).ok).toBe(false);
  });
  test('limita mensaje, nombre y tamaño del JSON', () => {
    expect(validation.validarMensaje(message('a'.repeat(2001))).ok).toBe(false);
    expect(validation.validarMensaje(message('Hola', { nombre: 'a'.repeat(41) })).ok).toBe(false);
    expect(validation.validarMensaje('x'.repeat(12001)).ok).toBe(false);
  });
  test('mantiene alias validateMessage sin generar HTML', () => {
    expect(JSON.parse(validation.validateMessage(message('Hola')))).toMatchObject({ ok: true, tipo: 'texto' });
  });
});
