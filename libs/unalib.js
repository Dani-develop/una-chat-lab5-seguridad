'use strict';

const IMAGE_EXT = /\.(?:jpe?g|png|gif|webp|bmp|avif)$/i;
const VIDEO_EXT = /\.(?:mp4|webm|ogv)$/i;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const MAX_MESSAGE = 2000;

// Se valida la URL completa. Nunca se descarga contenido desde el backend.
function parseMediaUrl(value) {
  if (typeof value !== 'string' || !value || value.length > MAX_MESSAGE) return null;
  let decoded;
  try { decoded = decodeURIComponent(value); } catch { return null; }
  if (/[\s\u0000-\u001f\u007f<>"'`\\]/u.test(value + decoded)) return null;
  let url;
  try { url = new URL(value); } catch { return null; }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
  if (!/^https?:\/\//i.test(value)) return null;

  const host = url.hostname.toLowerCase();
  let id = null;
  if (host === 'youtu.be') {
    id = url.pathname.slice(1);
  } else if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)) {
    if (url.pathname === '/watch' && url.searchParams.getAll('v').length === 1) {
      id = url.searchParams.get('v');
    } else {
      id = url.pathname.match(/^\/(?:embed|shorts)\/([A-Za-z0-9_-]{11})$/)?.[1];
    }
  }
  if (id && YOUTUBE_ID.test(id)) {
    return { tipo: 'youtube', url: `https://www.youtube-nocookie.com/embed/${id}`, id };
  }
  // Un dominio YouTube con ruta inválida no se interpreta como un archivo directo.
  if (['youtu.be', 'youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(host)) return null;
  const pathname = decodeURIComponent(url.pathname);
  if (IMAGE_EXT.test(pathname)) return { tipo: 'imagen', url: url.href };
  if (VIDEO_EXT.test(pathname)) return { tipo: 'video', url: url.href };
  return null;
}

function reject(error) { return { ok: false, error }; }

function validarMensaje(raw) {
  if (typeof raw !== 'string' || !raw || raw.length > 12000) {
    return reject('Formato de mensaje inválido.');
  }
  let data;
  try { data = JSON.parse(raw); } catch { return reject('El mensaje debe ser JSON válido.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      typeof data.mensaje !== 'string' ||
      (data.nombre !== undefined && typeof data.nombre !== 'string') ||
      (data.color !== undefined && typeof data.color !== 'string')) {
    return reject('Los campos del mensaje no son válidos.');
  }
  const mensaje = data.mensaje.trim();
  const nombre = (data.nombre || '').trim() || 'Anónimo';
  const color = data.color || '#155e75';
  if (!mensaje || mensaje.length > MAX_MESSAGE || nombre.length > 40) {
    return reject('Mensaje vacío o demasiado largo (máximo 2000 caracteres; nombre: 40).');
  }
  if (/[<>\u0000-\u001f\u007f]/u.test(nombre + mensaje)) {
    return reject('No se permite código HTML ni scripts en el chat.');
  }
  if (!/^#[0-9a-f]{6}$/i.test(color)) return reject('El color no es válido.');
  const media = parseMediaUrl(mensaje);
  if (media) return { ok: true, nombre, color, mensaje, ...media };
  // Un enlace debe ocupar todo el mensaje y apuntar a un medio permitido.
  if (/(?:[a-z][a-z\d+.-]*:\s*|\/\/|www\.)/i.test(mensaje)) {
    return reject('Solo se permiten URLs HTTP(S) de imágenes, videos o YouTube válidos.');
  }
  return { ok: true, nombre, color, mensaje, tipo: 'texto' };
}

module.exports = {
  validarMensaje,
  // Compatibilidad con el nombre original; no produce HTML.
  validateMessage: raw => JSON.stringify(validarMensaje(raw)),
  parseMediaUrl,
  is_valid_phone: phone => typeof phone === 'string' && /^[+]*[(]?[0-9]{1,4}[)]?[-\s./0-9]*$/.test(phone),
  is_valid_url_image: url => parseMediaUrl(url)?.tipo === 'imagen',
  is_valid_url_video: url => parseMediaUrl(url)?.tipo === 'video',
  is_valid_yt_video: url => parseMediaUrl(url)?.tipo === 'youtube',
  getYTVideoId: url => {
    const media = parseMediaUrl(url);
    return media?.tipo === 'youtube' ? media.id : null;
  }
};
