import { Server, Socket } from 'socket.io';
import { roomManager } from '../room.manager.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseFile } from 'music-metadata';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const musicTimers: Map<string, NodeJS.Timeout> = new Map();

const getTrackDuration = async (filename: string): Promise<number> => {
  try {
    const musicDir = path.join(__dirname, '../../public/music');
    const filePath = path.join(musicDir, filename);
    const metadata = await parseFile(filePath);
    return metadata.format.duration || 0;
  } catch (e) {
    console.error(`❌ [getTrackDuration] Error for ${filename}:`, e);
    return 0;
  }
};

const advanceTrack = async (io: Server, roomId: string) => {
  const room = roomManager.getRoom(roomId);
  if (!room || !room.musicState || !room.musicState.poll) return;

  const pollVotes = room.musicState.poll.votes;
  let winningIndex = 0;
  
  if (Object.keys(pollVotes).length > 0) {
    // Tính toán trọng số dựa trên điểm tích lũy
    const sortedParticipants = Array.from(room.participants.entries())
      .map(([id, p]) => ({ id, points: p.points || 0 }))
      .sort((a, b) => b.points - a.points);
    
    const weights: { [id: string]: number } = {};
    sortedParticipants.forEach((p, idx) => {
      if (idx === 0) weights[p.id] = 3;      // Top 1: 3 điểm vote
      else if (idx === 1) weights[p.id] = 2; // Top 2: 2 điểm vote
      else weights[p.id] = 1;                // Còn lại: 1 điểm vote
    });

    const weightedCounts: { [key: number]: number } = {};
    for (const [voterId, optionIdx] of Object.entries(pollVotes)) {
      const weight = weights[voterId] || 1;
      weightedCounts[optionIdx] = (weightedCounts[optionIdx] || 0) + weight;
    }
    
    let maxWeightedVotes = -1;
    for (const [idx, count] of Object.entries(weightedCounts)) {
      if (count > maxWeightedVotes) {
        maxWeightedVotes = count;
        winningIndex = parseInt(idx);
      }
    }
  } else {
    const optionsCount = room.musicState.poll.options.length;
    winningIndex = optionsCount > 0 ? Math.floor(Math.random() * optionsCount) : 0;
  }

  const nextTrack = room.musicState.poll.options[winningIndex];
  let finalTrack = nextTrack;
  
  if (!nextTrack) {
    const playlist = getPlaylist();
    finalTrack = playlist[0] || null;
  }

  if (finalTrack) {
    const nextDuration = await getTrackDuration(finalTrack);
    room.musicState = {
      currentTrack: finalTrack,
      isPlaying: true,
      startTime: Date.now(),
      duration: nextDuration,
      poll: {
        options: generatePoll(finalTrack),
        votes: {},
        endTime: Date.now() + (nextDuration > 0 ? (nextDuration - 15) * 1000 : 300000)
      }
    };
    
    io.to(roomId).emit('music:sync', room.musicState);
    
    // Set timer for next track
    if (nextDuration > 0) {
      const timer = musicTimers.get(roomId);
      if (timer) clearTimeout(timer);
      
      const newTimer = setTimeout(() => {
        advanceTrack(io, roomId);
      }, (nextDuration + 2) * 1000);
      musicTimers.set(roomId, newTimer);
    }
  }
};

const getPlaylist = () => {
  try {
    // Relative to this file (server/src/sockets/meeting.handler.ts),
    // music is at ../../public/music
    const musicDir = path.join(__dirname, '../../public/music');
    
    if (!fs.existsSync(musicDir)) {
      console.log('❌ [getPlaylist] Music directory does not exist:', musicDir);
      return [];
    }
    
    const files = fs.readdirSync(musicDir).filter(f => f.toLowerCase().endsWith('.mp3'));
    return files;
  } catch (e) {
    console.error("❌ [getPlaylist] Error reading music directory:", e);
    return [];
  }
};

const generatePoll = (exclude?: string | null) => {
  const playlist = getPlaylist();
  return playlist
    .filter(t => t !== exclude)
    .sort(() => Math.random() - 0.5)
    .slice(0, 4);
};

export const registerMeetingHandlers = (io: Server, socket: Socket) => {
  socket.on('room:list', () => {
    socket.emit('room:list', roomManager.listRooms());
  });

  socket.on('room:join', async ({ roomId, name, password }, cb) => {
    console.log(`User ${socket.id} (${name}) attempting to join room: ${roomId}`);
    const room = roomManager.getRoom(roomId);
    if (!room) {
      console.log(`Join failed: Room ${roomId} not found`);
      return cb && cb({ error: 'Phòng không tồn tại' });
    }
    if (room.password && room.password !== (password || '')) {
      return cb && cb({ error: 'Sai mật khẩu' });
    }

    await socket.join(roomId);
    
    // Check if this is a reconnection (existing name) BEFORE adding participant
    const existingParticipant = Array.from(room.participants.values()).find(p => p.name === name);
    const oldSocketId = Array.from(room.participants.entries()).find(([_, p]) => p.name === name)?.[0];

    // If reconnection, notify everyone to remove the old socket FIRST
    if (oldSocketId && oldSocketId !== socket.id) {
      console.log(`[Server] User ${name} reconnected. Replacing socket ${oldSocketId} with ${socket.id}`);
      io.to(roomId).emit('peer:left', { socketId: oldSocketId });
      // Small delay to ensure peer:left is processed before peer:joined
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Now add the participant (this will transfer state from old to new socket)
    roomManager.addParticipant(roomId, socket.id, name);
    const participant = room.participants.get(socket.id);

    // Notify others about the new/updated peer
    socket.to(roomId).emit('peer:joined', { 
      socketId: socket.id, 
      name,
      ...(participant || {})
    });
    
    io.to(roomId).emit('room:hostChanged', { hostId: room.hostId });

    console.log(`[Server] Sending join response for ${name}:`);
    console.log(`  - Has code: ${!!participant?.code}`);
    console.log(`  - Has language: ${!!participant?.language}`);
    console.log(`  - Has AI history: ${room.aiHistory?.has(name)} (${room.aiHistory?.get(name)?.length || 0} messages)`);

    cb && cb({
      ok: true,
      host: socket.id === room.hostId,
      hostId: room.hostId,
      ownState: participant ? {
        code: participant.code || '',
        language: participant.language || { name: 'python', version: '3.10.0' },
        violations: participant.violations,
        copyCount: participant.copyCount,
        pasteCount: participant.pasteCount,
        points: participant.points || 0,
        violationHistory: participant.violationHistory || []
      } : null,
      peers: Array.from(room.participants.entries())
        .filter(([_, p]) => p.isConnected)
        .map(([id, p]) => ({ 
          socketId: id, 
          name: p.name,
          isMuted: p.isMuted,
          isCameraOff: p.isCameraOff,
          isActive: p.isActive,
          isConnected: p.isConnected,
          code: p.code,
          language: p.language,
          violations: p.violations,
          pasteCount: p.pasteCount,
          points: p.points,
          copyCount: p.copyCount,
          violationHistory: p.violationHistory || []
        })),
      messages: room.messages.slice(-200),
      pinned: room.pinned || '',
      forcePin: !!room.forcePin,
      assignments: room.assignments || [],
      activeQuiz: room.activeQuiz,
      quizResponses: room.quizResponses || [],
      aiHistory: (room.aiHistory && name) ? room.aiHistory.get(name) : []
    });
  });

  socket.on('peer:update-state', ({ roomId, state }) => {
    roomManager.updateParticipantState(roomId, socket.id, state);
    socket.to(roomId).emit('peer:update-state', {
      socketId: socket.id,
      state
    });
  });

  socket.on('user:violation', ({ roomId, type }) => {
    roomManager.updateParticipantState(roomId, socket.id, { isActive: false });
    
    let violationCount = 0;
    let pasteCount = 0;

    if (type === 'external-paste') {
      // Chỉ tăng đếm paste ngoại, không tính vào violation rời tab
      const stats = roomManager.updateParticipantCopyCount(roomId, socket.id, true);
      pasteCount = stats.pasteCount;
      const room = roomManager.getRoom(roomId);
      violationCount = room?.participants.get(socket.id)?.violations || 0;
    } else {
      // Tăng violation cho rời tab, focus lost...
      violationCount = roomManager.updateParticipantViolation(roomId, socket.id);
      const room = roomManager.getRoom(roomId);
      pasteCount = room?.participants.get(socket.id)?.pasteCount || 0;
    }

    // Notify all about violation AND state change
    io.to(roomId).emit('user:violation', {
      socketId: socket.id,
      type,
      violations: violationCount,
      pasteCount: pasteCount
    });
    
    io.to(roomId).emit('peer:update-state', {
      socketId: socket.id,
      state: { isActive: false }
    });
  });

  socket.on('user:copy', ({ roomId }) => {
    const stats = roomManager.updateParticipantCopyCount(roomId, socket.id, false);
    io.to(roomId).emit('user:copy', {
      socketId: socket.id,
      copyCount: stats.copyCount
    });
  });

  socket.on('user:activity-stats', ({ roomId, added, deleted, timestamp }) => {
    const room = roomManager.getRoom(roomId);
    if (!room) return;
    
    const participant = room.participants.get(socket.id);
    if (!participant) return;

    if (!participant.activityStats) {
      participant.activityStats = [];
    }

    participant.activityStats.push({ timestamp, added, deleted });
    
    // Broadcast to host
    io.to(room.hostId).emit('user:activity-stats', { 
      socketId: socket.id, 
      activityStats: participant.activityStats 
    });
  });

  socket.on('user:violation-reason', ({ roomId, type, reason }) => {
    roomManager.addParticipantViolationHistory(roomId, socket.id, type, reason);
    io.to(roomId).emit('user:violation-reason', {
      socketId: socket.id,
      type,
      reason,
      timestamp: Date.now()
    });
  });

  socket.on('room:delete', ({ roomId }, cb) => {
    const room = roomManager.getRoom(roomId);
    if (!room) return cb && cb({ error: 'Phòng không tồn tại' });
    if (socket.id !== room.hostId) return cb && cb({ error: 'Chỉ host mới được xóa phòng' });

    io.to(roomId).emit('room:deleted');
    roomManager.deleteRoom(roomId);
    io.emit('room:list', roomManager.listRooms());
    cb && cb({ ok: true });
  });

  socket.on('room:pin', ({ roomId, peerId }) => {
    const room = roomManager.getRoom(roomId);
    if (!room || socket.id !== room.hostId) return;
    room.pinned = peerId || '';
    io.to(roomId).emit('room:pin', { peerId: room.pinned });
  });

  socket.on('room:forcePin', ({ roomId, active }, cb) => {
    const room = roomManager.getRoom(roomId);
    if (!room || socket.id !== room.hostId) return cb && cb({ error: 'Deny' });
    room.forcePin = !!active;
    io.to(roomId).emit('room:forcePin', { active: room.forcePin });
    cb && cb({ ok: true });
  });

  socket.on('assignment:add', ({ roomId, assignment }) => {
    const room = roomManager.getRoom(roomId);
    if (!room || socket.id !== room.hostId) return;
    
    roomManager.addAssignment(roomId, assignment);
    io.to(roomId).emit('assignment:add', { assignment });
  });

  socket.on('assignment:delete', ({ roomId, assignmentId }) => {
    const room = roomManager.getRoom(roomId);
    if (!room || socket.id !== room.hostId) return;
    
    roomManager.deleteAssignment(roomId, assignmentId);
    io.to(roomId).emit('assignment:delete', { assignmentId });
  });

  socket.on('assignment:reorder', ({ roomId, assignments }) => {
    const room = roomManager.getRoom(roomId);
    if (!room || socket.id !== room.hostId) return;
    
    roomManager.updateAssignmentsOrder(roomId, assignments);
    io.to(roomId).emit('assignment:reorder', { assignments });
  });

  socket.on('quiz:start', ({ roomId, quiz }) => {
    const room = roomManager.getRoom(roomId);
    if (!room || socket.id !== room.hostId) return;
    room.activeQuiz = quiz;
    room.quizResponses = [];
    io.to(roomId).emit('quiz:started', { quiz });
  });

  socket.on('quiz:submit', ({ roomId, response }) => {
    const room = roomManager.getRoom(roomId);
    if (!room) return;
    if (!room.quizResponses) room.quizResponses = [];
    room.quizResponses.push(response);
    io.to(room.hostId).emit('quiz:submitted', { response });
  });

  socket.on('quiz:end', ({ roomId }) => {
    const room = roomManager.getRoom(roomId);
    if (!room || socket.id !== room.hostId) return;
    
    // Xử lý cộng điểm dựa trên kết quả trắc nghiệm
    if (room.quizResponses && room.quizResponses.length > 0) {
      // Sắp xếp học sinh theo điểm số (giảm dần) và thời gian (tăng dần)
      const sortedResults = [...room.quizResponses].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.timeTaken - b.timeTaken;
      });

      // Cộng điểm dựa trên thứ hạng
      sortedResults.forEach((res, index) => {
        const participant = room.participants.get(res.userId);
        if (participant) {
          let pointsToAdd = 0;
          if (index === 0) pointsToAdd = 3;      // Top 1
          else if (index === 1) pointsToAdd = 2; // Top 2
          else if (index === 2) pointsToAdd = 1; // Top 3
          
          // Người top cuối (nếu có ít nhất 2 người tham gia)
          if (index === sortedResults.length - 1 && sortedResults.length >= 2) {
            pointsToAdd = -1;
          }

          participant.points = (participant.points || 0) + pointsToAdd;
        }
      });

      // Gửi danh sách cập nhật cho cả phòng
      io.to(roomId).emit('peer:update-points', {
        points: Array.from(room.participants.entries()).map(([id, p]) => ({
          socketId: id,
          points: p.points || 0
        }))
      });
    }

    room.activeQuiz = null;
    io.to(roomId).emit('quiz:ended');
  });

  socket.on('room:remoteFullscreen', ({ roomId, tileId, active }, cb) => {
    const room = roomManager.getRoom(roomId);
    if (!room || socket.id !== room.hostId) return cb && cb({ error: 'Deny' });
    socket.to(roomId).emit('room:remoteFullscreen', { active: !!active, senderId: socket.id, tileId });
    cb && cb({ ok: true });
  });

  socket.on('room:pin-sync', async ({ roomId, action, participantIdentity, source }) => {
    const room = roomManager.getRoom(roomId);
    if (!room) {
      return;
    }

    // Store sync state in room for new joiners
    if (action === 'pin') {
      room.pinned = `${participantIdentity}:${source}`;
    } else {
      room.pinned = '';
    }

    // BROADCAST TO EVERYONE
    io.to(roomId).emit('room:pin-sync', { 
      action, 
      participantIdentity, 
      source,
      timestamp: Date.now()
    });
    
    // Send a private ACK to the sender
    socket.emit('room:pin-sync-ack', { ok: true, action });
  });

  socket.on('room:screenShare', ({ roomId, active }, cb) => {
    const room = roomManager.getRoom(roomId);
    if (!room || !room.participants.has(socket.id)) return cb && cb({ error: 'Deny' });
    socket.to(roomId).emit('room:screenShare', { senderId: socket.id, active: !!active });
    cb && cb({ ok: true });
  });

  // Code sync events
  socket.on('code:sync', ({ roomId, targetSocketId, code, language }) => {
    const room = roomManager.getRoom(roomId);
    if (!room || !room.participants.has(socket.id)) return;
    
    // If Admin is syncing to a specific student
    if (targetSocketId) {
      const targetParticipant = room.participants.get(targetSocketId);
      if (targetParticipant) {
        targetParticipant.code = code;
        targetParticipant.language = language;
      }
      io.to(targetSocketId).emit('code:sync', {
        socketId: socket.id,
        code,
        language,
        isTargeted: true // Mark as direct update
      });
      return;
    }

    // Normal broadcast
    const participant = room.participants.get(socket.id);
    if (participant) {
      participant.code = code;
      participant.language = language;
    }
    
    // If not targeted, don't broadcast to everyone anymore
    // socket.to(roomId).emit('code:sync', { ... });
  });

  socket.on('code:delta', ({ roomId, targetSocketId, changes, language }) => {
    const room = roomManager.getRoom(roomId);
    if (!room || !room.participants.has(socket.id)) return;

    if (targetSocketId) {
      io.to(targetSocketId).emit('code:delta', {
        socketId: socket.id,
        changes,
        language,
        isTargeted: true
      });
    } else {
      // If not targeted, don't broadcast to everyone
      // socket.to(roomId).emit('code:delta', { ... });
    }
  });

  socket.on('cursor:sync', ({ roomId, targetSocketId, cursor }) => {
    const room = roomManager.getRoom(roomId);
    if (!room || !room.participants.has(socket.id)) return;

    if (targetSocketId) {
      io.to(targetSocketId).emit('cursor:sync', {
        socketId: socket.id,
        cursor
      });
    } else {
      // If not targeted, don't broadcast to everyone
      // socket.to(roomId).emit('cursor:sync', { ... });
    }
  });

  socket.on('code:request', ({ roomId, targetSocketId }) => {
    const room = roomManager.getRoom(roomId);
    if (!room || !room.participants.has(socket.id)) return;
    
    const targetParticipant = room.participants.get(targetSocketId);
    if (targetParticipant) {
      socket.emit('code:response', {
        socketId: targetSocketId,
        code: targetParticipant.code || '',
        language: targetParticipant.language || { name: 'python', version: '3.10.0' }
      });
    }
  });

  // Chat events
  socket.on('chat:send', ({ roomId, message }) => {
    const room = roomManager.getRoom(roomId);
    if (!room || !room.participants.has(socket.id)) return;
    
    // Add message to room history
    room.messages.push(message);
    
    // Keep only last 200 messages
    if (room.messages.length > 200) {
      room.messages = room.messages.slice(-200);
    }
    
    // Broadcast message to all participants in room
    io.to(roomId).emit('chat:message', message);
  });

  socket.on('chat:history', ({ roomId }) => {
    const room = roomManager.getRoom(roomId);
    if (!room) return;
    
    // Send chat history to the requesting client
    socket.emit('chat:history', room.messages);
  });

  socket.on('music:request-sync', ({ roomId }) => {
    const room = roomManager.getRoom(roomId);
    if (room && room.musicState) {
      socket.emit('music:sync', room.musicState);
    }
  });

  socket.on('music:toggle', async ({ roomId, isPlaying }) => {
    const room = roomManager.getRoom(roomId);
    if (!room || socket.id !== room.hostId) return;

    if (!room.musicState) {
      const playlist = getPlaylist();
      const firstTrack = playlist[0] || null;
      const duration = firstTrack ? await getTrackDuration(firstTrack) : 0;
      
      room.musicState = {
        currentTrack: firstTrack,
        isPlaying: isPlaying,
        startTime: Date.now(),
        duration,
        poll: firstTrack ? {
          options: generatePoll(firstTrack),
          votes: {},
          endTime: Date.now() + (duration > 0 ? (duration - 15) * 1000 : 300000)
        } : null
      };

      if (isPlaying && duration > 0) {
        const timer = setTimeout(() => advanceTrack(io, roomId), (duration + 2) * 1000);
        musicTimers.set(roomId, timer);
      }
    } else {
      room.musicState.isPlaying = isPlaying;
      if (isPlaying) {
        room.musicState.startTime = Date.now();
        
        if (!room.musicState.currentTrack) {
          const playlist = getPlaylist();
          if (playlist.length > 0) {
            room.musicState.currentTrack = playlist[0];
            const duration = await getTrackDuration(room.musicState.currentTrack);
            room.musicState.duration = duration;
            room.musicState.poll = {
              options: generatePoll(room.musicState.currentTrack),
              votes: {},
              endTime: Date.now() + (duration > 0 ? (duration - 15) * 1000 : 300000)
            };
            
            if (duration > 0) {
              const timer = musicTimers.get(roomId);
              if (timer) clearTimeout(timer);
              musicTimers.set(roomId, setTimeout(() => advanceTrack(io, roomId), (duration + 2) * 1000));
            }
          }
        } else if (room.musicState.duration) {
          // Resuming existing track
          const timer = musicTimers.get(roomId);
          if (timer) clearTimeout(timer);
          musicTimers.set(roomId, setTimeout(() => advanceTrack(io, roomId), (room.musicState.duration + 2) * 1000));
        }
      } else {
        // Paused
        const timer = musicTimers.get(roomId);
        if (timer) {
          clearTimeout(timer);
          musicTimers.delete(roomId);
        }
      }
    }
    io.to(roomId).emit('music:sync', room.musicState);
  });

  socket.on('music:vote', ({ roomId, optionIndex }) => {
    const room = roomManager.getRoom(roomId);
    if (!room || !room.musicState || !room.musicState.poll) return;

    // Check if within 15s of end
    const now = Date.now();
    const duration = room.musicState.duration || 0;
    const startTime = room.musicState.startTime;
    
    if (duration > 0 && now > (startTime + (duration - 15) * 1000)) {
        return; 
    }

    room.musicState.poll.votes[socket.id] = optionIndex;
    io.to(roomId).emit('music:poll-update', { votes: room.musicState.poll.votes });
  });

  socket.on('music:next-track', async ({ roomId }) => {
    const room = roomManager.getRoom(roomId);
    if (!room || !room.musicState) return;

    // Only host or auto-next can trigger. 
    // Participant can trigger ONLY if finished
    const now = Date.now();
    const duration = room.musicState.duration || 0;
    const isFinished = duration > 0 && now > (room.musicState.startTime + duration * 1000);
    
    if (socket.id !== room.hostId && !isFinished) return;

    // Clear existing timer if manual skip
    const existingTimer = musicTimers.get(roomId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      musicTimers.delete(roomId);
    }

    await advanceTrack(io, roomId);
  });

  socket.on('rtc:signal', ({ to, signal }) => {
    io.to(to).emit('rtc:signal', { from: socket.id, signal });
  });

  socket.on('disconnecting', () => {
    // We use a Set because socket.rooms changes during the loop
    const roomsToProcess = new Set(socket.rooms);
    for (const roomId of roomsToProcess) {
      if (roomId === socket.id) continue;
      const room = roomManager.getRoom(roomId);
      if (room) {
        socket.to(roomId).emit('peer:left', { socketId: socket.id });
        
        roomManager.removeParticipant(roomId, socket.id);
        
        // Wait 1 minute before checking if room is empty to delete it
        setTimeout(() => {
          if (roomManager.isRoomEmpty(roomId)) {
            console.log(`[Server] Room ${roomId} has been empty for 1 minute. Deleting...`);
            roomManager.deleteRoom(roomId);
          }
        }, 60000); 
      }
    }
  });
};
