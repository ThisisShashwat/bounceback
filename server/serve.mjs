import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const ROOT_DIR = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.ttf': 'font/ttf',
  '.json': 'application/json',
};

const rooms = new Map();

function dropStalePlayers(room, now) {
  let dropped = false;
  for (const [id, player] of room.players.entries()) {
    if (now - player.lastSeen >= 10000) {
      room.players.delete(id);
      dropped = true;
    }
  }
  if (dropped) {
    room.startAt = null;
  }
}

function handleOptions(res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': '86400',
  });
  res.end();
}

function handleLink(req, res) {
  let bodyStr = '';
  req.setEncoding('utf8');
  req.on('data', chunk => {
    bodyStr += chunk;
    if (bodyStr.length > 1e6) {
      req.destroy();
    }
  });

  req.on('end', () => {
    let body;
    try {
      body = JSON.parse(bodyStr);
    } catch {
      res.writeHead(400, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify({ error: 'invalid json' }));
      return;
    }

    if (!body || typeof body !== 'object' || Array.isArray(body) || !body.id) {
      res.writeHead(400, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify({ error: 'missing id' }));
      return;
    }

    const roomId = String(body.room || 'haven');
    const playerId = String(body.id);
    const now = Date.now();

    let room = rooms.get(roomId);
    if (!room) {
      room = { players: new Map(), startAt: null };
      rooms.set(roomId, room);
    }

    dropStalePlayers(room, now);

    let player = room.players.get(playerId);
    if (!player) {
      if (room.players.size >= 2) {
        res.writeHead(409, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(JSON.stringify({ error: 'room full' }));
        return;
      }

      let role = 'A';
      if (room.players.size === 1) {
        const existing = room.players.values().next().value;
        role = existing.role === 'A' ? 'B' : 'A';
      }

      player = {
        id: playerId,
        role,
        ready: Boolean(body.ready),
        state: body.state !== undefined ? body.state : null,
        lastSeen: now,
      };
      room.players.set(playerId, player);
    } else {
      player.ready = Boolean(body.ready);
      player.state = body.state !== undefined ? body.state : null;
      player.lastSeen = now;
    }

    const playersList = Array.from(room.players.values());
    const bothOver = playersList.length === 2 && playersList.every(p => p.state && p.state.phase === 'over');
    if (bothOver) {
      room.startAt = null;
    }

    const bothReady = playersList.length === 2 && playersList.every(p => p.ready);
    if (room.startAt === null && bothReady && !bothOver) {
      room.startAt = now + 4000;
    }

    let rival = null;
    for (const p of playersList) {
      if (p.id !== playerId) {
        rival = {
          ready: p.ready,
          state: p.state,
          age: Math.max(0, now - p.lastSeen),
        };
        break;
      }
    }

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify({
      now,
      you: player.role,
      startAt: room.startAt,
      rival,
    }));
  });
}

function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Access-Control-Allow-Origin': '*' });
    res.end('Method Not Allowed');
    return;
  }

  const normalized = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.join(ROOT_DIR, normalized);
  const relative = path.relative(ROOT_DIR, filePath);

  const publicFile = /^(index\.html|style\.css|(src|assets)[\\/].+)$/.test(relative);
  if (relative.startsWith('..') || path.isAbsolute(relative) || !publicFile) {
    res.writeHead(403, { 'Access-Control-Allow-Origin': '*' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Access-Control-Allow-Origin': '*',
    });

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    stream.on('error', () => {
      if (!res.headersSent) {
        res.writeHead(500, { 'Access-Control-Allow-Origin': '*' });
        res.end();
      }
    });
  });
}

function requestListener(req, res) {
  if (req.method === 'OPTIONS') {
    handleOptions(res);
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    res.writeHead(400, { 'Access-Control-Allow-Origin': '*' });
    res.end('Bad Request');
    return;
  }

  if (pathname.includes('..')) {
    res.writeHead(403, { 'Access-Control-Allow-Origin': '*' });
    res.end('Forbidden');
    return;
  }

  if (pathname === '/link') {
    if (req.method === 'POST') {
      handleLink(req, res);
      return;
    }
    res.writeHead(405, {
      'Allow': 'POST, OPTIONS',
      'Access-Control-Allow-Origin': '*',
    });
    res.end('Method Not Allowed');
    return;
  }

  serveStatic(req, res, pathname);
}

function getNetworkUrls(port) {
  const urls = [`http://localhost:${port}`];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        urls.push(`http://${iface.address}:${port}`);
      }
    }
  }
  return urls;
}

function start() {
  const portArg = process.argv[2];
  const parsedPort = portArg ? parseInt(portArg, 10) : 8787;
  const port = Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort < 65536 ? parsedPort : 8787;

  const server = http.createServer(requestListener);

  setInterval(() => {
    const now = Date.now();
    for (const [roomId, room] of rooms.entries()) {
      dropStalePlayers(room, now);
      if (room.players.size === 0) {
        rooms.delete(roomId);
      }
    }
  }, 5000).unref();

  server.listen(port, () => {
    const urls = getNetworkUrls(port);
    console.log(urls.join(' '));
  });
}

start();
