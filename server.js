'use strict';

const path = require('node:path');
const express = require('express');
const { createServer } = require('node:http');
const { Server } = require('socket.io');
const validation = require('./libs/unalib');
const EVENT = 'Evento-Mensaje-Server';

function createChatServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, { maxHttpBufferSize: 16384 });
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', [
      "default-src 'self'", "script-src 'self'", "style-src 'self'",
      "connect-src 'self' ws: wss:", "img-src 'self' http: https:",
      "media-src 'self' http: https:", "frame-src https://www.youtube-nocookie.com",
      "object-src 'none'", "base-uri 'none'", "form-action 'self'", "frame-ancestors 'none'"
    ].join('; '));
    next();
  });
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use(express.static(path.join(__dirname, 'public')));
  io.on('connection', socket => {
    socket.on(EVENT, (raw, acknowledge) => {
      const result = validation.validarMensaje(raw);
      if (result.ok) io.emit(EVENT, JSON.stringify(result));
      else socket.emit('chat error', result.error);
      if (typeof acknowledge === 'function') acknowledge(result);
    });
  });
  return { app, httpServer, io, close: () => new Promise(resolve => io.close(resolve)) };
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '127.0.0.1';
  const chat = createChatServer();
  chat.httpServer.listen(port, host, () => console.log(`UNA Chat: http://${host}:${port}`));
  const shutdown = () => chat.close().then(() => process.exit(0));
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

module.exports = { createChatServer, EVENT };
