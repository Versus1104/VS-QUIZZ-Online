'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const WebSocket = require('ws');

const PORT = Number(process.env.PORT) || 3000;
const GAME_FILE = path.join(__dirname, 'VS_QUIZZ_v32.html');
const MAX_PAYLOAD = 16 * 1024;
const MAX_PLAYERS = 20;
const rooms = new Map();

function send(socket, message) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function broadcast(room, message, excludedSocket = null) {
  for (const client of room.clients) {
    if (client !== excludedSocket) send(client, message);
  }
}

function getPeers(room) {
  return Array.from(room.players.values(), player => ({ id: player.id, name: player.name }));
}

function makeRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    const bytes = crypto.randomBytes(6);
    code = Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('');
  } while (rooms.has(code));
  return code;
}

const server = http.createServer((request, response) => {
  // Only serve the game at / and a small health endpoint. No user-supplied file paths.
  const pathname = String(request.url || '/').split('?')[0];
  if (pathname === '/health') {
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    response.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }
  if (pathname !== '/') {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }
  fs.readFile(GAME_FILE, (error, data) => {
    if (error) {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Could not load game file');
      return;
    }
    response.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    });
    response.end(data);
  });
});

const websocketServer = new WebSocket.Server({ server, path: '/ws', maxPayload: MAX_PAYLOAD });

websocketServer.on('connection', socket => {
  socket.id = crypto.randomUUID();
  socket.roomCode = null;
  socket.role = null;
  socket.playerName = null;
  socket.alive = true;

  socket.on('pong', () => { socket.alive = true; });
  socket.on('message', raw => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (!message || typeof message.type !== 'string') return;

    if (message.type === 'create-room') {
      if (socket.roomCode && rooms.has(socket.roomCode)) {
        send(socket, { type: 'error', message: 'Deja ești într-o cameră.' });
        return;
      }
      const code = makeRoomCode();
      const room = {
        code,
        host: socket,
        players: new Map(),
        clients: new Set([socket]),
        question: null,
        boardState: null,
        buzzed: false,
        started: false
      };
      rooms.set(code, room);
      socket.roomCode = code;
      socket.role = 'host';
      send(socket, { type: 'room-created', room: code });
      return;
    }

    if (message.type === 'join-room') {
      const code = String(message.room || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
      const name = String(message.name || '').trim().slice(0, 24);
      const room = rooms.get(code);
      if (!room) return send(socket, { type: 'error', message: 'Camera nu există sau gazda nu este conectată.' });
      if (!name) return send(socket, { type: 'error', message: 'Introdu un nume valid.' });
      if (room.players.size >= MAX_PLAYERS) return send(socket, { type: 'error', message: 'Camera este plină (maximum 20 jucători online).' });
      if (Array.from(room.players.values()).some(player => player.name.toLowerCase() === name.toLowerCase())) {
        return send(socket, { type: 'error', message: 'Numele este deja folosit în această cameră.' });
      }
      socket.roomCode = code;
      socket.role = 'player';
      socket.playerName = name;
      room.clients.add(socket);
      room.players.set(socket.id, { id: socket.id, name, socket });
      send(socket, { type: 'joined', room: code, name });
      // Give late joiners the latest shared board and any currently open question.
      if (room.boardState) send(socket, room.boardState);
      if (room.question) send(socket, room.question);
      send(room.host, { type: 'player-joined', name, count: room.players.size });
      send(room.host, { type: 'peers', players: getPeers(room) });
      return;
    }

    const room = rooms.get(socket.roomCode);
    if (!room) return;

    if (message.type === 'buzz' && socket.role === 'player') {
      if (!room.question || room.buzzed) return;
      room.buzzed = true;
      const player = room.players.get(socket.id);
      if (!player) return;
      broadcast(room, { type: 'buzz-locked', id: socket.id, name: player.name });
      return;
    }

    if (message.type === 'suggest-tile' && socket.role === 'player' && message.room === room.code) {
      const player = room.players.get(socket.id);
      if (!player || !room.started) return;
      send(room.host, {
        type: 'suggestion',
        player: player.name,
        key: String(message.key || '').slice(0, 60),
        round: Number(message.round),
        ci: Number(message.ci),
        q: Number(message.q),
        category: String(message.category || '').slice(0, 100),
        value: Number(message.value) || 0
      });
      return;
    }

    if (socket.role !== 'host' || message.room !== room.code) return;

    if (message.type === 'question') {
      room.question = {
        ...message,
        type: 'question',
        category: String(message.category || '').slice(0, 100),
        value: Number(message.value) || 0,
        question: String(message.question || '').slice(0, 2000)
      };
      room.buzzed = false;
      room.started = true;
      broadcast(room, { ...message, type: 'question' });
    } else if (message.type === 'question-closed') {
      room.question = null;
      room.buzzed = false;
      broadcast(room, message);
    } else if (message.type === 'game-started') {
      room.started = true;
      broadcast(room, message);
    } else if (message.type === 'board-state') {
      room.boardState = message;
      broadcast(room, message);
    } else if ([
      'answer-result', 'scores', 'game-ended', 'suggestion-result',
      'wheel-spin-start', 'wheel-spin-result', 'special-event'
    ].includes(message.type)) {
      broadcast(room, message);
    } else if (message.type === 'host-close') {
      broadcast(room, { type: 'error', message: 'Gazda a închis camera.' });
      for (const client of room.clients) {
        try { client.close(); } catch { /* ignore a closed connection */ }
      }
      rooms.delete(room.code);
    }
  });

  socket.on('close', () => {
    const code = socket.roomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;
    room.clients.delete(socket);
    if (socket.role === 'player') {
      room.players.delete(socket.id);
      send(room.host, { type: 'peers', players: getPeers(room) });
      send(room.host, { type: 'player-left', name: socket.playerName, count: room.players.size });
    } else if (socket.role === 'host') {
      for (const client of room.clients) {
        send(client, { type: 'error', message: 'Gazda s-a deconectat. Camera s-a închis.' });
        try { client.close(); } catch { /* ignore a closed connection */ }
      }
      rooms.delete(code);
    }
  });
});

const heartbeat = setInterval(() => {
  for (const socket of websocketServer.clients) {
    if (socket.alive === false) {
      socket.terminate();
      continue;
    }
    socket.alive = false;
    socket.ping();
  }
}, 30000);

websocketServer.on('close', () => clearInterval(heartbeat));
server.listen(PORT, '0.0.0.0', () => {
  console.log(`VS_QUIZZ v32 online server listening on port ${PORT}`);
});
