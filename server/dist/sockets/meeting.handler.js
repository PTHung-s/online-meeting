import { roomManager } from '../room.manager.js';
export const registerMeetingHandlers = (io, socket) => {
    socket.on('room:list', () => {
        socket.emit('room:list', roomManager.listRooms());
    });
    socket.on('room:join', async ({ roomId, name, password }, cb) => {
        const room = roomManager.getRoom(roomId);
        if (!room)
            return cb && cb({ error: 'Phòng không tồn tại' });
        if (room.password && room.password !== (password || '')) {
            return cb && cb({ error: 'Sai mật khẩu' });
        }
        await socket.join(roomId);
        roomManager.addParticipant(roomId, socket.id, name);
        // Notify others
        socket.to(roomId).emit('peer:joined', { socketId: socket.id, name });
        io.to(roomId).emit('room:hostChanged', { hostId: room.hostId });
        cb && cb({
            ok: true,
            host: socket.id === room.hostId,
            peers: Array.from(room.participants.entries())
                .filter(([id]) => id !== socket.id)
                .map(([id, p]) => ({ socketId: id, name: p.name })),
            messages: room.messages.slice(-200),
            pinned: room.pinned || '',
            forcePin: !!room.forcePin
        });
    });
    socket.on('room:delete', ({ roomId }, cb) => {
        const room = roomManager.getRoom(roomId);
        if (!room)
            return cb && cb({ error: 'Phòng không tồn tại' });
        if (socket.id !== room.hostId)
            return cb && cb({ error: 'Chỉ host mới được xóa phòng' });
        io.to(roomId).emit('room:deleted');
        roomManager.deleteRoom(roomId);
        io.emit('room:list', roomManager.listRooms());
        cb && cb({ ok: true });
    });
    socket.on('room:pin', ({ roomId, peerId }) => {
        const room = roomManager.getRoom(roomId);
        if (!room || socket.id !== room.hostId)
            return;
        room.pinned = peerId || '';
        io.to(roomId).emit('room:pin', { peerId: room.pinned });
    });
    socket.on('chat:send', ({ roomId, text }) => {
        const room = roomManager.getRoom(roomId);
        if (!room || !room.participants.has(socket.id))
            return;
        const trimmed = text?.trim();
        if (!trimmed)
            return;
        const sender = room.participants.get(socket.id);
        const msg = {
            senderId: socket.id,
            senderName: sender?.name || 'Ẩn danh',
            text: trimmed.slice(0, 2000),
            time: Date.now()
        };
        room.messages.push(msg);
        if (room.messages.length > 500)
            room.messages.shift();
        io.to(roomId).emit('chat:new', msg);
    });
    socket.on('rtc:signal', ({ to, signal }) => {
        io.to(to).emit('rtc:signal', { from: socket.id, signal });
    });
    socket.on('disconnecting', () => {
        for (const roomId of socket.rooms) {
            if (roomId === socket.id)
                continue;
            const room = roomManager.getRoom(roomId);
            if (room) {
                socket.to(roomId).emit('peer:left', { socketId: socket.id });
                const newHostId = roomManager.removeParticipant(roomId, socket.id);
                if (newHostId) {
                    io.to(roomId).emit('room:hostChanged', { hostId: newHostId });
                }
                if (room.participants.size === 0) {
                    roomManager.deleteRoom(roomId);
                }
            }
        }
    });
};
