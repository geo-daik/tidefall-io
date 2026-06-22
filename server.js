const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const server = http.createServer((req, res) => {
  let filePath = path.join(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const type = ext === '.html' ? 'text/html; charset=utf-8'
      : ext === '.js' ? 'text/javascript; charset=utf-8'
      : ext === '.css' ? 'text/css; charset=utf-8'
      : 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
});

const wss = new WebSocket.Server({ server });
const rooms = new Map();

function safeSend(ws, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function roomClients(room) {
  return rooms.get(room) || new Set();
}

function broadcast(room, data, except = null) {
  for (const client of roomClients(room)) {
    if (client !== except) safeSend(client, data);
  }
}

function leaveRoom(ws) {
  if (!ws.room) return;
  const set = rooms.get(ws.room);
  if (set) {
    set.delete(ws);
    broadcast(ws.room, { type: 'peerLeave', id: ws.id, count: set.size });
    if (set.size === 0) rooms.delete(ws.room);
  }
  ws.room = null;
}

wss.on('connection', ws => {
  ws.id = Math.random().toString(36).slice(2, 10);
  ws.name = 'Player';
  ws.room = null;
  ws.state = {};

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === 'join') {
      const room = String(msg.room || 'reef').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 18) || 'reef';
      const name = String(msg.name || 'Player').slice(0, 18);
      const set = roomClients(room);

      if (set.size >= 2 && !set.has(ws)) {
        safeSend(ws, { type: 'roomFull', room });
        return;
      }

      leaveRoom(ws);
      ws.room = room;
      ws.name = name;
      ws.state = { id: ws.id, name };

      if (!rooms.has(room)) rooms.set(room, new Set());
      rooms.get(room).add(ws);

      const players = [...roomClients(room)].map(client => ({
        id: client.id,
        name: client.name,
        ...(client.state || {})
      }));

      safeSend(ws, { type: 'joined', id: ws.id, room, count: roomClients(room).size, players });
      broadcast(room, { type: 'peerJoin', count: roomClients(room).size, player: { id: ws.id, name } }, ws);
      return;
    }

    if (!ws.room) return;

    if (msg.type === 'playerUpdate') {
      ws.state = { id: ws.id, name: ws.name, ...(msg.player || {}) };
      broadcast(ws.room, { type: 'playerUpdate', id: ws.id, player: ws.state }, ws);
      return;
    }

    if (msg.type === 'playerShot') {
      broadcast(ws.room, {
        type: 'playerShot',
        id: ws.id,
        x: msg.x,
        y: msg.y,
        angle: msg.angle,
        weapon: msg.weapon
      }, ws);
      return;
    }
  });

  ws.on('close', () => leaveRoom(ws));
  ws.on('error', () => leaveRoom(ws));
});

server.listen(PORT, () => {
  console.log(`Tidefall.io 2-player lobby server running at http://localhost:${PORT}`);
});
