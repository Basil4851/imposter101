import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import { nanoid } from "nanoid";
import { Room, Player, ClientMessage, ServerMessage } from "./src/types.js";
import { WORD_CATEGORIES } from "./src/constants.js";

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = 3000;

// In-memory store for rooms
const rooms: Record<string, Room> = {};
// Map to track which player (by socket) belongs to which room
const socketToPlayer = new Map<WebSocket, { roomId: string; playerId: string }>();

function broadcast(roomCode: string) {
  const room = rooms[roomCode];
  if (!room) return;

  wss.clients.forEach((client) => {
    const info = socketToPlayer.get(client);
    if (info && info.roomId === roomCode && client.readyState === WebSocket.OPEN) {
      const message: ServerMessage = { type: 'ROOM_UPDATED', room };
      client.send(JSON.stringify(message));
    }
  });
}

function sendToSocket(ws: WebSocket, message: ServerMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

wss.on("connection", (ws) => {
  ws.on("message", (data) => {
    try {
      const message: ClientMessage = JSON.parse(data.toString());

      switch (message.type) {
        case 'CREATE_ROOM': {
          const roomCode = nanoid(4).toUpperCase();
          const playerId = nanoid(8);
          const newRoom: Room = {
            code: roomCode,
            players: [{ id: playerId, name: message.playerName, isHost: true, role: null }],
            state: 'lobby',
            category: Object.keys(WORD_CATEGORIES)[0],
            word: null,
            imposterCount: 1,
            imposterIds: []
          };
          rooms[roomCode] = newRoom;
          socketToPlayer.set(ws, { roomId: roomCode, playerId });
          sendToSocket(ws, { type: 'JOIN_SUCCESS', playerId, room: newRoom });
          break;
        }

        case 'JOIN_ROOM': {
          const room = rooms[message.roomCode.toUpperCase()];
          if (!room) {
            sendToSocket(ws, { type: 'ERROR', message: 'Room not found' });
            return;
          }
          if (room.state !== 'lobby') {
            sendToSocket(ws, { type: 'ERROR', message: 'Game already in progress' });
            return;
          }
          if (room.players.some(p => p.name === message.playerName)) {
            sendToSocket(ws, { type: 'ERROR', message: 'Name already taken in this room' });
            return;
          }

          const playerId = nanoid(8);
          room.players.push({ id: playerId, name: message.playerName, isHost: false, role: null });
          socketToPlayer.set(ws, { roomId: room.code, playerId });
          sendToSocket(ws, { type: 'JOIN_SUCCESS', playerId, room });
          broadcast(room.code);
          break;
        }

        case 'UPDATE_CONFIG': {
          const info = socketToPlayer.get(ws);
          if (!info) return;
          const room = rooms[info.roomId];
          const player = room?.players.find(p => p.id === info.playerId);
          if (!room || !player?.isHost) return;

          room.category = message.category;
          room.imposterCount = Math.max(1, Math.min(message.imposterCount, room.players.length - 1));
          broadcast(room.code);
          break;
        }

        case 'START_ROUND': {
          const info = socketToPlayer.get(ws);
          if (!info) return;
          const room = rooms[info.roomId];
          const player = room?.players.find(p => p.id === info.playerId);
          if (!room || !player?.isHost) return;

          if (room.players.length < 3) {
            sendToSocket(ws, { type: 'ERROR', message: 'Need at least 3 players' });
            return;
          }

          // Randomly select word
          const words = WORD_CATEGORIES[room.category];
          room.word = words[Math.floor(Math.random() * words.length)];

          // Randomly select imposters
          const playerIds = room.players.map(p => p.id);
          const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
          room.imposterIds = shuffled.slice(0, room.imposterCount);

          // Assign roles to player objects
          room.players.forEach(p => {
            p.role = room.imposterIds.includes(p.id) ? 'imposter' : 'citizen';
          });

          room.state = 'playing';
          broadcast(room.code);
          break;
        }

        case 'END_ROUND': {
          const info = socketToPlayer.get(ws);
          if (!info) return;
          const room = rooms[info.roomId];
          const player = room?.players.find(p => p.id === info.playerId);
          if (!room || !player?.isHost) return;

          room.state = 'lobby';
          room.word = null;
          room.imposterIds = [];
          room.players.forEach(p => p.role = null);
          broadcast(room.code);
          break;
        }
      }
    } catch (err) {
      console.error("Error processing message:", err);
    }
  });

  ws.on("close", () => {
    const info = socketToPlayer.get(ws);
    if (info) {
      const room = rooms[info.roomId];
      if (room) {
        room.players = room.players.filter(p => p.id !== info.playerId);
        if (room.players.length === 0) {
          delete rooms[info.roomId];
        } else {
          // If host left, assign a new host
          if (!room.players.some(p => p.isHost)) {
            room.players[0].isHost = true;
          }
          broadcast(room.code);
        }
      }
      socketToPlayer.delete(ws);
    }
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
