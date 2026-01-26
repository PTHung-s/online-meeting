import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { roomManager } from './room.manager.js';
import { registerMeetingHandlers } from './sockets/meeting.handler.js';
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
app.use(cors());
app.use(express.json());
app.get('/api/rooms', (req, res) => {
    res.json({ rooms: roomManager.listRooms() });
});
app.post('/api/rooms', (req, res) => {
    const { name, password } = req.body || {};
    if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'Tên phòng là bắt buộc' });
    }
    const roomId = roomManager.createRoom(name, password);
    io.emit('room:list', roomManager.listRooms());
    res.json({ id: roomId });
});
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    registerMeetingHandlers(io, socket);
});
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
