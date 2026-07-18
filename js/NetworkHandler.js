/**
 * NetworkHandler.js - Multiplayer Client
 * Socket.io client with interpolation for smooth opponent movement
 */

class NetworkHandler {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.playerId = null;
        this.roomId = null;

        // Other players (with interpolation state)
        this.remotePlayers = new Map();

        // Interpolation settings
        this.LERP_FACTOR = 0.15; // Smooth 15% per frame

        // Network stats
        this.ping = 0;
        this.lastPingTime = 0;

        // Callbacks
        this.onPlayerJoined = null;
        this.onPlayerLeft = null;
        this.onDNASync = null;
        this.onEmote = null;
    }

    // ========================================
    // CONNECTION
    // ========================================
    connect(serverUrl, playerData) {
        if (typeof io === 'undefined') {
            console.warn('[Network] Socket.io not loaded');
            return false;
        }

        this.socket = io(serverUrl);

        this.socket.on('connect', () => {
            this.connected = true;
            console.log('[Network] Connected to server');

            // Join room
            this.socket.emit('joinRoom', {
                roomId: playerData.roomId || 'default',
                name: playerData.name || 'Player',
                color: playerData.color || 0x22d3ee
            });
        });

        this.socket.on('roomJoined', (data) => {
            this.playerId = data.playerId;
            this.roomId = data.roomState.roomId;
            console.log(`[Network] Joined room: ${this.roomId}`);

            // Initialize remote players
            data.roomState.players.forEach(p => {
                if (p.id !== this.playerId) {
                    this.addRemotePlayer(p);
                }
            });

            // Sync DNA if exists
            if (data.roomState.enemyDNA && this.onDNASync) {
                this.onDNASync(data.roomState.enemyDNA);
            }
        });

        this.socket.on('playerJoined', (data) => {
            console.log(`[Network] Player joined: ${data.name}`);
            if (this.onPlayerJoined) this.onPlayerJoined(data);
        });

        this.socket.on('playerLeft', (data) => {
            this.removeRemotePlayer(data.playerId);
            if (this.onPlayerLeft) this.onPlayerLeft(data);
        });

        // ========================================
        // STATE SYNC (50ms from server)
        // ========================================
        this.socket.on('stateSync', (state) => {
            state.players.forEach(p => {
                if (p.id !== this.playerId) {
                    this.updateRemotePlayer(p);
                }
            });
        });

        // DNA sync from other players
        this.socket.on('dnaSync', (dna) => {
            console.log('[Network] Received DNA sync');
            if (this.onDNASync) this.onDNASync(dna);
        });

        // Emotes
        this.socket.on('playerEmote', (data) => {
            if (this.onEmote) this.onEmote(data);
        });

        // Ping measurement
        this.socket.on('pong', () => {
            this.ping = Date.now() - this.lastPingTime;
        });

        // Start ping interval
        setInterval(() => {
            if (this.connected) {
                this.lastPingTime = Date.now();
                this.socket.emit('ping');
            }
        }, 2000);

        this.socket.on('disconnect', () => {
            this.connected = false;
            console.log('[Network] Disconnected');
        });

        return true;
    }

    // ========================================
    // REMOTE PLAYER MANAGEMENT
    // ========================================
    addRemotePlayer(playerData) {
        this.remotePlayers.set(playerData.id, {
            id: playerData.id,
            name: playerData.name,
            x: playerData.x,
            y: playerData.y,
            targetX: playerData.x,
            targetY: playerData.y,
            rotation: playerData.rotation,
            targetRotation: playerData.rotation,
            color: playerData.color,
            score: playerData.score,
            mesh: null // Created by Game.js
        });
    }

    updateRemotePlayer(playerData) {
        const remote = this.remotePlayers.get(playerData.id);
        if (remote) {
            // Set target for interpolation
            remote.targetX = playerData.x;
            remote.targetY = playerData.y;
            remote.targetRotation = playerData.rotation;
            remote.score = playerData.score;
        } else {
            this.addRemotePlayer(playerData);
        }
    }

    removeRemotePlayer(playerId) {
        this.remotePlayers.delete(playerId);
    }

    // ========================================
    // INTERPOLATION UPDATE (call every frame)
    // ========================================
    update(dt) {
        this.remotePlayers.forEach(remote => {
            // Lerp position
            remote.x += (remote.targetX - remote.x) * this.LERP_FACTOR;
            remote.y += (remote.targetY - remote.y) * this.LERP_FACTOR;

            // Lerp rotation
            let rotDiff = remote.targetRotation - remote.rotation;
            // Handle 360° wrap
            if (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
            if (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
            remote.rotation += rotDiff * this.LERP_FACTOR;

            // Update mesh if exists
            if (remote.mesh) {
                remote.mesh.position.x = remote.x;
                remote.mesh.position.y = remote.y;
                remote.mesh.rotation.z = remote.rotation;
            }
        });
    }

    // ========================================
    // SEND STATE TO SERVER
    // ========================================
    sendState(state) {
        if (this.connected && this.socket) {
            this.socket.emit('playerUpdate', {
                x: state.x,
                y: state.y,
                rotation: state.rotation,
                score: state.score,
                sector: state.sector
            });
        }
    }

    syncDNA(dna) {
        if (this.connected && this.socket) {
            this.socket.emit('syncDNA', dna);
        }
    }

    sendEmote(emoteId) {
        if (this.connected && this.socket) {
            this.socket.emit('emote', emoteId);
        }
    }

    // ========================================
    // GETTERS
    // ========================================
    getRemotePlayers() {
        return Array.from(this.remotePlayers.values());
    }

    getPing() {
        return this.ping;
    }

    isConnected() {
        return this.connected;
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.connected = false;
        }
    }
}

// Global instance
const networkHandler = new NetworkHandler();
