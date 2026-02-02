import { Room, RoomInfo } from './types.js';
import { nanoid } from 'nanoid';

export class RoomManager {
  private rooms: Map<string, Room> = new Map();

  createRoom(name: string, password?: string, hostName?: string): string {
    const roomId = nanoid(8);
    this.rooms.set(roomId, {
      id: roomId,
      name,
      password: password || '',
      hostId: '',
      hostName: hostName || '', // Set at creation time by the creator
      participants: new Map(),
      createdAt: Date.now(),
      messages: [],
      pinned: '',
      forcePin: false,
      assignments: [],
      activeQuiz: null,
      quizResponses: [],
      aiHistory: new Map(),
      musicState: {
        currentTrack: null,
        isPlaying: false,
        startTime: 0,
        poll: null
      }
    });
    return roomId;
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  deleteRoom(roomId: string): boolean {
    return this.rooms.delete(roomId);
  }

  listRooms(): RoomInfo[] {
    return Array.from(this.rooms.entries()).map(([roomId, r]) => ({
      id: roomId,
      name: r.name,
      hostName: r.hostName || '',
      locked: Boolean(r.password),
      size: Array.from(r.participants.values()).filter(p => p.isConnected).length,
      createdAt: r.createdAt,
    }));
  }

  addParticipant(roomId: string, socketId: string, name: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    // Check if a participant with this name already exists (Reconnect logic)
    let oldSocketId = '';
    let existingData: any = null;

    for (const [sId, p] of room.participants.entries()) {
      if (p.name === name) {
        oldSocketId = sId;
        existingData = p;
        break;
      }
    }

    if (existingData) {
      // Transfer state to new socketId
      room.participants.delete(oldSocketId);
      room.participants.set(socketId, {
        ...existingData,
        points: existingData.points || 0,
        violations: existingData.violations || 0,
        pasteCount: existingData.pasteCount || 0,
        isActive: true,
        isConnected: true
      });
      
      // If this name was the host, update hostId
      if (room.hostName === name) {
        room.hostId = socketId;
      }
    } else {
      // New participant
      room.participants.set(socketId, { 
        name,
        isMuted: false,
        isCameraOff: false,
        isActive: true,
        isConnected: true,
        points: 0,
        violations: 0,
        pasteCount: 0,
        violationHistory: [],
        activityStats: []
      });

      // Host is determined by matching hostName set at room creation
      if (room.hostName && room.hostName === name) {
        room.hostId = socketId;
      } else if (!room.hostName && !room.hostId) {
        // Fallback: if no hostName was set, first person becomes host
        room.hostId = socketId;
        room.hostName = name;
      }
    }

    return true;
  }

  updateParticipantState(roomId: string, socketId: string, state: Partial<{ isMuted: boolean, isCameraOff: boolean, isActive: boolean }>): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    const participant = room.participants.get(socketId);
    if (!participant) return false;
    room.participants.set(socketId, { ...participant, ...state });
    return true;
  }

  updateParticipantViolation(roomId: string, socketId: string): number {
    const room = this.rooms.get(roomId);
    if (!room) return 0;
    const participant = room.participants.get(socketId);
    if (!participant) return 0;
    
    participant.violations = (participant.violations || 0) + 1;
    return participant.violations;
  }

  updateParticipantCopyCount(roomId: string, socketId: string, isExternal: boolean = false): { copyCount: number, pasteCount: number } {
    const room = this.rooms.get(roomId);
    if (!room) return { copyCount: 0, pasteCount: 0 };
    const participant = room.participants.get(socketId);
    if (!participant) return { copyCount: 0, pasteCount: 0 };
    
    if (isExternal) {
      participant.pasteCount = (participant.pasteCount || 0) + 1;
    } else {
      participant.copyCount = (participant.copyCount || 0) + 1;
    }
    return { 
      copyCount: participant.copyCount || 0, 
      pasteCount: participant.pasteCount || 0 
    };
  }

  addParticipantViolationHistory(roomId: string, socketId: string, type: string, reason: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    const participant = room.participants.get(socketId);
    if (!participant) return false;
    
    if (!participant.violationHistory) {
      participant.violationHistory = [];
    }
    participant.violationHistory.push({ type, reason, timestamp: Date.now() });
    return true;
  }

  addAssignment(roomId: string, assignment: { id: string; data: string; type: 'image' | 'pdf'; name: string }): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    room.assignments.push(assignment);
    return true;
  }

  deleteAssignment(roomId: string, assignmentId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    room.assignments = room.assignments.filter(a => a.id !== assignmentId);
    return true;
  }

  updateAssignmentsOrder(roomId: string, assignments: any[]): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    room.assignments = assignments;
    return true;
  }

  removeParticipant(roomId: string, socketId: string): string | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    
    const participant = room.participants.get(socketId);
    if (participant) {
      participant.isActive = false;
    }
    
    // We don't automatically change host anymore because host is name-based
    // the host role stays with the name even if disconnected
    
    return null;
  }

  isRoomEmpty(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return true;
    return Array.from(room.participants.values()).every(p => !p.isConnected);
  }
}

export const roomManager = new RoomManager();
