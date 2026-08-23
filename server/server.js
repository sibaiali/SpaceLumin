/**
 * Lumin Flow: Production Multiplayer Server
 * Cluster mode + Rate limiting + Room overflow
 */

const cluster = require('cluster');
const os = require('os');

// ========================================
// CLUSTER MODE: Utilize all CPU cores
// ========================================
if (cluster.isMaster) {
    const numCPUs = os.cpus().length;
    console.log(`[Master] Starting ${numCPUs} workers...`);

    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        console.log(`[Master] Worker ${worker.process.pid} died. Spawning replacement...`);
        cluster.fork();
    });

} else {
    // Worker process
    const express = require('express');
    const http = require('http');
    const { Server } = require('socket.io');
    const cors = require('cors');
    const { createAdapter } = require('@socket.io/cluster-adapter');
    const { setupWorker } = require('@socket.io/sticky');

    const app = express();
    app.use(cors());

    // Health check endpoint
    app.get('/health', (req, res) => {
        res.json({ status: 'ok', worker: process.pid });
    });

    const server = http.createServer(app);
    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    // ========================================
    // RATE LIMITING: Prevent DDOS
    // ========================================
    const connectionCounts = new Map();
    const RATE_LIMIT_WINDOW = 60000; // 1 minute
    const MAX_CONNECTIONS_PER_IP = 10;
    const MAX_MESSAGES_PER_SECOND = 30;

    io.use((socket, next) => {
        const ip = socket.handshake.address;
        const now = Date.now();

        // Check connection rate
        if (!connectionCounts.has(ip)) {
            connectionCounts.set(ip, { count: 0, lastReset: now });
        }

        const record = connectionCounts.get(ip);
        if (now - record.lastReset > RATE_LIMIT_WINDOW) {
            record.count = 0;
            record.lastReset = now;
        }

        record.count++;

        if (record.count > MAX_CONNECTIONS_PER_IP) {
            console.warn(`[RateLimit] Blocked IP: ${ip}`);
            return next(new Error('Rate limit exceeded'));
        }

        // Per-socket message rate limiting
        socket.messageCount = 0;
        socket.lastMessageReset = now;

        next();
    });

    // ========================================
    // GAME STATE
    // ========================================
    const rooms = new Map();
    const TICK_RATE = 50;
    const MAX_PLAYERS_PER_ROOM = 10;

    class PlayerRoom {
        constructor(roomId) {
            this.roomId = roomId;
            this.players = new Map();
            this.enemyDNA = null;
            this.sector = 1;
            this.createdAt = Date.now();
            this.mirrorIndex = 0;
        }

        addPlayer(socketId, playerData) {
            this.players.set(socketId, {
                id: socketId,
                name: playerData.name || `Player${this.players.size + 1}`,
                x: 0, y: 0, rotation: 0,
                color: playerData.color || 0x22d3ee,
                score: 0, sector: 1,
                lastUpdate: Date.now()
            });
        }

        updatePlayer(socketId, state) {
            const player = this.players.get(socketId);
            if (player) {
                player.x = state.x;
                player.y = state.y;
                player.rotation = state.rotation;
                player.score = state.score || player.score;
                player.lastUpdate = Date.now();
            }
        }

        removePlayer(socketId) {
            this.players.delete(socketId);
        }

        isFull() {
            return this.players.size >= MAX_PLAYERS_PER_ROOM;
        }

        getState() {
            const players = [];
            this.players.forEach((p, id) => {
                players.push({
                    id, name: p.name,
                    x: p.x, y: p.y, rotation: p.rotation,
                    color: p.color, score: p.score
                });
            });
            return { roomId: this.roomId, players, enemyDNA: this.enemyDNA, sector: this.sector };
        }
    }

    // ========================================
    // ROOM OVERFLOW: Auto-spawn mirror rooms
    // ========================================
    function getAvailableRoom(baseRoomId) {
        let roomId = baseRoomId;
        let mirrorIndex = 0;

        while (rooms.has(roomId) && rooms.get(roomId).isFull()) {
            mirrorIndex++;
            roomId = `${baseRoomId}_mirror${mirrorIndex}`;
            console.log(`[RoomOverflow] Room full, trying ${roomId}`);
        }

        if (!rooms.has(roomId)) {
            const room = new PlayerRoom(roomId);
            room.mirrorIndex = mirrorIndex;
            rooms.set(roomId, room);
            console.log(`[Server] Created room: ${roomId}`);
        }

        return roomId;
    }

    // ========================================
    // SOCKET.IO EVENTS
    // ========================================
    io.on('connection', (socket) => {
        console.log(`[Worker ${process.pid}] Player connected: ${socket.id}`);
        let currentRoom = null;

        // Message rate limiting middleware
        const rateLimitMessage = () => {
            const now = Date.now();
            if (now - socket.lastMessageReset > 1000) {
                socket.messageCount = 0;
                socket.lastMessageReset = now;
            }
            socket.messageCount++;
            return socket.messageCount <= MAX_MESSAGES_PER_SECOND;
        };

        socket.on('joinRoom', (data) => {
            const baseRoomId = data.roomId || 'default';
            const roomId = getAvailableRoom(baseRoomId);

            const room = rooms.get(roomId);
            room.addPlayer(socket.id, data);
            socket.join(roomId);
            currentRoom = roomId;

            socket.emit('roomJoined', {
                playerId: socket.id,
                roomState: room.getState()
            });

            socket.to(roomId).emit('playerJoined', {
                playerId: socket.id,
                name: data.name
            });
        });

        socket.on('playerUpdate', (state) => {
            if (!rateLimitMessage()) return;
            if (currentRoom && rooms.has(currentRoom)) {
                rooms.get(currentRoom).updatePlayer(socket.id, state);
            }
        });

        socket.on('syncDNA', (dnaData) => {
            if (!rateLimitMessage()) return;
            if (currentRoom && rooms.has(currentRoom)) {
                const room = rooms.get(currentRoom);
                room.enemyDNA = dnaData;
                socket.to(currentRoom).emit('dnaSync', dnaData);
            }
        });

        socket.on('emote', (emoteId) => {
            if (!rateLimitMessage()) return;
            if (currentRoom) {
                socket.to(currentRoom).emit('playerEmote', {
                    playerId: socket.id,
                    emoteId
                });
            }
        });

        socket.on('disconnect', () => {
            if (currentRoom && rooms.has(currentRoom)) {
                const room = rooms.get(currentRoom);
                room.removePlayer(socket.id);
                socket.to(currentRoom).emit('playerLeft', { playerId: socket.id });

                if (room.players.size === 0) {
                    rooms.delete(currentRoom);
                    console.log(`[Server] Deleted empty room: ${currentRoom}`);
                }
            }
        });
    });

    // State broadcast
    setInterval(() => {
        rooms.forEach((room, roomId) => {
            io.to(roomId).emit('stateSync', room.getState());
        });
    }, TICK_RATE);

    // ========================================
    // START SERVER
    // ========================================
    const PORT = process.env.PORT || 3001;
    server.listen(PORT, () => {
        console.log(`[Worker ${process.pid}] Listening on port ${PORT}`);
    });
}
