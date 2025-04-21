import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import { GameRoom, generateRoomCode } from './room.js';

dotenv.config();

const ROOM_CODE_LENGTH = 6;
const app = express();
const httpServer = createServer(app);

const allowedOrigins = [
  'http://localhost:5173',
  'https://multiplayer-r3f.vercel.app',
  'https://multiplayer.strategyfox.in'
];

// Environment variables with defaults
const PORT = process.env.PORT || 3001;

// Configure CORS for regular HTTP requests
app.use(cors({
  origin:function(origin,callback) {
    if(!origin) return callback(null,true);

    if(allowedOrigins.includes(origin)){
      return callback(null,true);
    }
    else{
      return callback(new Error('Not allowed by CORS.'))
    }
  },
  methods: ['GET', 'POST'],
  credentials: true
}));

// Configure Socket.IO with CORS
const io = new Server(httpServer, {
  cors: {
    origin:function(origin,callback) {
      if(!origin) return callback(null,true);
  
      if(allowedOrigins.includes(origin)){
        return callback(null,true);
      }
      else{
        return callback(new Error('Not allowed by CORS.'))
      }
    },    
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  path: '/socket.io',
});

app.use(express.json());

// Optional static file serving (can be removed if not needed)
if (process.env.SERVE_STATIC === 'true') {
  app.use(express.static('dist'));
  const indexPath = path.join(process.cwd(), 'dist', 'index.html');
  app.get('/', (req, res) => {
    res.sendFile(indexPath);
  });
}

// Chat Namespace
const chatNameSpace = io.of('/chat');
const gameRooms = new Map();

chatNameSpace.on('connection', (socket) => {
  socket.userData = {
    name: '',
  };
  console.log(`${socket.id} has connected to chat namespace`);

  socket.on('setName', (name) => {
    socket.userData.name = name;
  });

  socket.on('generateCode', (roomCode) => {
    socket.join(roomCode);
  });

  socket.on('sendMessage', ({ message, roomName }) => {
    console.log(`Message from ${socket.id} in room ${roomName}: ${message}`);
    chatNameSpace.to(roomName).except(socket.id).emit('broadcastMessage', {
      id: socket.id,
      message: message,
      name: socket.userData.name,
    });
  });

  // In your chatNameSpace on 'connection'
  socket.on("joinVoiceRoom", (roomCode) => {
    socket.join(roomCode);

    // Tell all in the room about this new peer:
    socket.to(roomCode).emit("newVoicePeer", socket.id);

    // Send existing peers to newly joined user:
    const existingPeers = [...chatNameSpace.adapter.rooms.get(roomCode) || []]
        .filter((id) => id !== socket.id);
    socket.emit("existingVoicePeers", existingPeers);
  });

  socket.on('disconnect', () => {
    console.log(`${socket.id} has disconnected from chat`);
  });
});

// Update Namespace - simplified to only handle room management and wishlist
const updateNameSpace = io.of('/update');

updateNameSpace.on('connection', (socket) => {
  console.log(`[Server] New connection to update namespace: ${socket.id}`);

  socket.userData = {
    name: `Player${Math.floor(Math.random() * 1000)}`,
    roomCode: '',
  };

  socket.on('setID', () => {
    updateNameSpace.emit('setID', socket.id);
  });

  socket.on('setName', (name) => {
    socket.userData.name = name;
  });

  socket.on('joinRoom', (roomCode) => {
    console.log(`[Server] Attempting to join room ${roomCode} by socket ${socket.id}`);
    if (!gameRooms.has(roomCode)) {
      console.log(`[Server] Room ${roomCode} does not exist`);
      socket.emit('invalidRoomCode', 'Not a valid room code.');
      return;
    }
    console.log(`[Server] Room ${roomCode} exists, adding player ${socket.id}`);
    socket.userData.roomCode = roomCode;
    gameRooms.get(roomCode).addPlayer(socket);
    socket.join(roomCode);
    socket.emit('generateCode', roomCode);

    // Send current wishlist if it exists
    if (gameRooms.get(roomCode).wishlist && gameRooms.get(roomCode).wishlist.length > 0) {
      socket.emit('wishlistUpdated', gameRooms.get(roomCode).wishlist);
    }
  });

  socket.on('createRoom', () => {
    console.log(`[Server] Received createRoom request from socket ${socket.id}`);
    let newCode = generateRoomCode(ROOM_CODE_LENGTH);
    while (gameRooms.has(newCode)) {
      newCode = generateRoomCode(ROOM_CODE_LENGTH);
    }
    console.log(`[Server] Generated new room code: ${newCode}`);
    socket.userData.roomCode = newCode;
    gameRooms.set(newCode, new GameRoom(newCode));
    gameRooms.get(newCode).addPlayer(socket);
    console.log(`[Server] Room ${newCode} was created by socket ${socket.id}`);
    socket.join(newCode);
    console.log(`[Server] Emitting generateCode event to socket ${socket.id} with code ${newCode}`);
    socket.emit('generateCode', newCode);
  });

  socket.on('updateWishlist', (wishlist) => {
    // Check if the socket is part of a room
    if (!socket.userData.roomCode) {
      console.log(`Socket ${socket.id} is not in a room. Ignoring wishlist update.`);
      return;
    }
    const roomCode = socket.userData.roomCode;

    // If using the gameRooms map to track rooms:
    if (gameRooms.has(roomCode)) {
      const room = gameRooms.get(roomCode);
      // Store the wishlist within the room object
      room.wishlist = wishlist;

      // Emit the updated wishlist only to participants in the room
      updateNameSpace.to(roomCode).emit('wishlistUpdated', wishlist);
    }
  });

  socket.on('disconnecting', () => {
    const roomCode = socket?.userData?.roomCode;
    if (roomCode) {
      const room = gameRooms.get(roomCode);
      room.removePlayer(socket);
      if (room.numPlayers === 0) {
        gameRooms.delete(roomCode);
        console.log(roomCode + ' no longer exists');
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`${socket.id} has disconnected from update namespace`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});