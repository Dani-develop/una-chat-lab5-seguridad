'use strict';

const socket = io();
const form = document.querySelector('#chat-form');
const messages = document.querySelector('#messages');
const input = document.querySelector('#m');
const error = document.querySelector('#error');
const button = form.querySelector('button');

socket.on('connect', () => {
  document.querySelector('#connection').textContent = 'Conectado al servidor';
  button.disabled = false;
});
socket.on('disconnect', () => {
  document.querySelector('#connection').textContent = 'Sin conexión. Reintentando…';
  button.disabled = true;
});
socket.on('chat error', message => { error.textContent = message; });

form.addEventListener('submit', event => {
  event.preventDefault();
  error.textContent = '';
  button.disabled = true;
  const submitted = input.value;
  socket.timeout(5000).emit('Evento-Mensaje-Server', JSON.stringify({
    nombre: document.querySelector('#nombre').value,
    mensaje: submitted,
    color: '#155e75'
  }), (timeout, result) => {
    button.disabled = !socket.connected;
    if (timeout) error.textContent = 'El servidor no respondió. Intenta de nuevo.';
    else if (!result.ok) error.textContent = result.error;
    else if (input.value === submitted) input.value = '';
    input.focus();
  });
});

// Solo se usan nodos DOM y textContent; nunca innerHTML, eval ni plantillas HTML.
socket.on('Evento-Mensaje-Server', raw => {
  let data;
  try { data = JSON.parse(raw); } catch { return; }
  if (!data.ok) return;
  const item = document.createElement('li');
  const author = document.createElement('strong');
  author.textContent = data.nombre;
  item.append(author);
  const text = document.createElement('p');
  text.textContent = data.mensaje;
  item.append(text);
  let media;
  if (data.tipo === 'imagen') {
    media = document.createElement('img');
    media.alt = `Imagen enviada por ${data.nombre}`;
  } else if (data.tipo === 'video') {
    media = document.createElement('video');
    media.controls = true;
    media.preload = 'auto';
    media.setAttribute('aria-label', `Video enviado por ${data.nombre}`);
  } else if (data.tipo === 'youtube') {
    media = document.createElement('iframe');
    media.title = `Video de YouTube enviado por ${data.nombre}`;
    media.allowFullscreen = true;
    media.referrerPolicy = 'no-referrer';
    media.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
  }
  if (media) {
    media.src = data.url;
    if (data.tipo !== 'youtube') media.addEventListener('error', () => {
      const notice = document.createElement('small');
      notice.textContent = 'No se pudo cargar este medio. Comprueba que la URL sea accesible.';
      item.append(notice);
    }, { once: true });
    item.append(media);
  }
  messages.append(item);
  item.scrollIntoView({ block: 'nearest' });
});
