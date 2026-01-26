import { nanoid } from 'nanoid';
export class RoomManager {
    rooms = new Map();
    createRoom(name, password) {
        const roomId = nanoid(8);
        this.rooms.set(roomId, {
            id: roomId,
            name,
            password: password || '',
            hostId: '',
            participants: new Map(),
            createdAt: Date.now(),
            messages: [],
            pinned: '',
            forcePin: false,
        });
        return roomId;
    }
    getRoom(roomId) {
        return this.rooms.get(roomId);
    }
    deleteRoom(roomId) {
        return this.rooms.delete(roomId);
    }
    listRooms() {
        return Array.from(this.rooms.entries()).map(([roomId, r]) => ({
            id: roomId,
            name: r.name,
            locked: Boolean(r.password),
            size: r.participants.size,
            createdAt: r.createdAt,
        }));
    }
    addParticipant(roomId, socketId, name) {
        const room = this.rooms.get(roomId);
        if (!room)
            return false;
        room.participants.set(socketId, { name });
        if (!room.hostId) {
            room.hostId = socketId;
        }
        return true;
    }
    removeParticipant(roomId, socketId) {
        const room = this.rooms.get(roomId);
        if (!room)
            return null;
        room.participants.delete(socketId);
        if (room.hostId === socketId) {
            const next = room.participants.keys().next();
            room.hostId = next && !next.done ? next.value : '';
            return room.hostId;
        }
        return null;
    }
}
export const roomManager = new RoomManager();
