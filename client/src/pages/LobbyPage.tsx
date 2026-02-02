import React, { useState, useEffect, useRef } from 'react';
import { socket } from '../services/socket';
import { useMeetingStore } from '../store/useMeetingStore';
import { Camera, Mic, MicOff, VideoOff, Users, Lock } from 'lucide-react';

const LobbyPage: React.FC = () => {
  const [roomName, setRoomName] = useState('');
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const { setRoom, setIsHost, setPeers, setLkToken, setLkServerUrl, setMicEnabled, setCameraEnabled } = useMeetingStore();
  
  const [rooms, setRooms] = useState<Array<{ id: string; name: string; hostName: string; locked: boolean; size: number }>>([]);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Auto-fill room ID from URL if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomIdParam = params.get('room');
    if (roomIdParam) {
      setRoomName(roomIdParam);
    }
  }, []);

  // Fetch room list on mount and listen for updates
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const res = await fetch(`${window.location.origin}/api/rooms`);
        const data = await res.json();
        setRooms(data.rooms || []);
      } catch (e) {
        console.error('Failed to fetch rooms:', e);
      }
    };
    fetchRooms();

    if (!socket.connected) socket.connect();
    socket.on('room:list', (roomList) => setRooms(roomList || []));
    return () => { socket.off('room:list'); };
  }, []);

  useEffect(() => {
    let stream: MediaStream | null = null;
    const startPreview = async () => {
      const tryGetMedia = async (constraints: MediaStreamConstraints) => {
        try {
          return await navigator.mediaDevices.getUserMedia(constraints);
        } catch (e) {
          return null;
        }
      };

      try {
        console.log("Attempting preview media...");
        // 1. Gửi cấu hình đầy đủ
        stream = await tryGetMedia({
          video: !isVideoOff ? { width: 1280, height: 720 } : false,
          audio: !isMuted
        });

        // 2. Fallback sang chỉ Audio (nếu Video lỗi)
        if (!stream && !isVideoOff) {
          console.warn("Camera failed, trying audio only...");
          stream = await tryGetMedia({ video: false, audio: !isMuted });
        }

        // 3. Fallback sang chỉ Video (nếu Audio lỗi)
        if (!stream && !isMuted) {
          console.warn("Mic failed, trying video only...");
          stream = await tryGetMedia({ video: !isVideoOff, audio: false });
        }

        if (stream) {
          setPreviewStream(stream);
        } else {
          setPreviewStream(null);
          console.warn("All media devices acquisition failed.");
        }
      } catch (err) {
        console.error("Critical error in startPreview:", err);
      }
    };
    startPreview();
    return () => {
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [isVideoOff, isMuted]);

  useEffect(() => {
    if (videoRef.current && previewStream) {
      videoRef.current.srcObject = previewStream;
    }
  }, [previewStream]);

  const handleCreateRoom = async () => {
    if (!roomName || !userName) return alert('Vui lòng nhập tên phòng và tên của bạn');
    
    const res = await fetch(`${window.location.origin}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: roomName, password, hostName: userName })
    });
    
    if (!res.ok) {
      const text = await res.text();
      console.error('Server error response:', text);
      alert(`Lỗi Server (${res.status}): ${text}`);
      return;
    }

    const data = await res.json();
    if (data.id) {
      joinRoom(data.id, roomName);
    }
  };

  const handleJoinByInput = () => {
    if (!userName) return alert('Vui lòng nhập tên của bạn');
    if (!roomName) return alert('Vui lòng nhập mã phòng');
    
    // Tự động tách ID nếu người dùng dán cả link
    let finalRoomId = roomName;
    try {
      if (roomName.includes('?room=')) {
        const url = new URL(roomName.startsWith('http') ? roomName : `http://${roomName}`);
        const idFromUrl = url.searchParams.get('room');
        if (idFromUrl) finalRoomId = idFromUrl;
      } else if (roomName.includes('/')) {
        // Trường hợp dán link dạng path (nếu có)
        const parts = roomName.split('/');
        finalRoomId = parts[parts.length - 1] || roomName;
      }
    } catch (e) {
      console.error("Lỗi phân tách Room ID:", e);
    }

    joinRoom(finalRoomId.trim(), 'Cuộc họp');
  };

  const joinRoom = async (id: string, name: string) => {
    try {
      // 1. Kết nối Socket.io trước để lấy socket.id đồng bộ với LiveKit identity
      if (!socket.connected) {
        console.log('Connecting socket to get stable ID...');
        socket.connect();
        
        // Chờ kết nối thành công
        await new Promise((resolve) => {
          if (socket.id) resolve(true);
          socket.once('connect', () => resolve(true));
        });
      }

      const uniqueIdentity = socket.id || `${userName}_${Math.random().toString(36).substring(7)}`;
      
      // 2. Fetch LiveKit Token với identity là socket.id
      const tokenRes = await fetch(`${window.location.origin}/api/token?room=${id}&identity=${encodeURIComponent(uniqueIdentity)}&name=${encodeURIComponent(userName)}`);
      const tokenData = await tokenRes.json();
      
      if (!tokenData.token) {
        throw new Error('Failed to get LiveKit token');
      }

      setLkToken(tokenData.token);
      setLkServerUrl(tokenData.serverUrl); // Added
      setRoom(id, name, userName);
      
      // Save to localStorage for persistence across reloads
      localStorage.setItem('userName', userName);
      
      // Lưu trạng thái Mic/Camera vào Store để giữ nguyên khi vào phòng
      setMicEnabled(!isMuted);
      setCameraEnabled(!isVideoOff);

      // 3. Kết nối Socket.io để đồng bộ các tính năng khác
      if (!socket.connected) {
        console.log('Connecting socket...');
        socket.connect();
      }
      
      console.log('Emitting room:join:', { roomId: id, name: userName });
      socket.emit('room:join', { roomId: id, name: userName, password }, (res: any) => {
        console.log('room:join response:', res);
        if (res.ok) {
           const store = useMeetingStore.getState();
           setIsHost(res.host);
           if (res.hostId) store.setHostId(res.hostId);
           setPeers(res.peers || []);
           
           // Merge server messages with local messages (keep newer ones)
           if (res.messages && res.messages.length > 0) {
             const serverMessages = res.messages;
             // Use server messages as they are authoritative
             store.setMessages(serverMessages);
           }
           
           // Reconnect: Restore own state if available
           if (res.ownState && res.ownState.code) {
             // Only restore if local code is default/empty
             const localCode = store.code;
             if (localCode === '// Write your code here\n' || !localCode || localCode.trim() === '') {
               console.log('✅ Restoring code from server:', res.ownState.code.substring(0, 50));
               store.setCode(res.ownState.code);
               if (res.ownState.language) {
                 store.setSelectedLanguage(res.ownState.language);
               }
             } else {
               console.log('ℹ️ Using local code from localStorage');
               }
             
             // Always sync current code to server after joining
             setTimeout(() => {
               const currentCode = useMeetingStore.getState().code;
               const currentLang = useMeetingStore.getState().selectedLanguage;
               if (currentCode && currentCode !== '// Write your code here\n') {
                 console.log('🔄 Syncing current code to server');
                 socket.emit('code:sync', { 
                   roomId: id, 
                   code: currentCode,
                   language: currentLang
                 });
               }
             }, 800);
           }

           // Apply initial assignments if exist
           if (res.assignments && res.assignments.length > 0) {
             console.log('Applying initial assignments:', res.assignments.length);
             useMeetingStore.getState().setAssignments(res.assignments);
           }

           if (res.activeQuiz) {
             console.log('Applying active quiz:', res.activeQuiz.title);
             useMeetingStore.getState().setActiveQuiz(res.activeQuiz);
             // Override the clear behavior of setActiveQuiz if we want to keep previous responses
             if (res.quizResponses) {
               useMeetingStore.getState().setQuizResponses(res.quizResponses);
             }
           }

           if (res.activeAdaptive) {
             const store = useMeetingStore.getState();
             store.setActiveAdaptive({ id: res.activeAdaptive.id, title: res.activeAdaptive.title, status: res.activeAdaptive.status, createdAt: res.activeAdaptive.createdAt });
             if (res.activeAdaptive.currentQuestion) {
               store.setAdaptiveCurrentQuestion(res.activeAdaptive.currentQuestion, res.activeAdaptive.questionIndex);
             }
             if (res.activeAdaptive.questionHistory) {
               store.setAdaptiveQuestionResults(res.activeAdaptive.questionHistory);
             }
             if (res.activeAdaptive.scores) {
               store.setAdaptiveScores(res.activeAdaptive.scores);
             }
           }
           
           if (res.pinned) {
             const [identity, source] = res.pinned.split(':');
             console.log('Applying initial synced pin:', { identity, source });
             // Try to use as-is, if it looks like a number, convert it
             const finalSource = isNaN(Number(source)) ? source : Number(source);
             useMeetingStore.getState().setSyncedPin({ identity, source: finalSource });
           }

           if (res.aiHistory && res.aiHistory.length > 0) {
             console.log('✅ Restoring AI History:', res.aiHistory.length, 'messages');
             store.setAiMessages(res.aiHistory);
           } else {
             console.log('⚠️ No AI History to restore');
           }
        } else {
           alert(res.error || 'Lỗi tham gia phòng');
        }
      });

    } catch (err) {
      console.error("Error joining room:", err);
      alert("Không thể tham gia phòng. Vui lòng thử lại.");
    }
  };

  const handleJoinRoom = (roomId: string, roomDisplayName: string) => {
    if (!userName) return alert('Vui lòng nhập tên của bạn');
    joinRoom(roomId, roomDisplayName);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <div>
          <h1 className="text-4xl font-normal mb-4">Cuộc họp video chuyên nghiệp.</h1>
          <p className="text-gray-400 text-lg mb-8">
            Bản clone Google Meet bằng React và TypeScript.
          </p>

          <div className="space-y-4">
            <input
              type="text"
              placeholder="Tên của bạn"
              className="w-full bg-[#3c4043] border-none rounded p-3 focus:ring-2 focus:ring-blue-500 outline-none"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
            />
            <input
              type="text"
              placeholder="Mã phòng (Để tham gia) hoặc Tên phòng (Để tạo)"
              className="w-full bg-[#3c4043] border-none rounded p-3 focus:ring-2 focus:ring-blue-500 outline-none"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
            />
            <input
              type="password"
              placeholder="Mật khẩu phòng (Dành cho host)"
              className="w-full bg-[#3c4043] border-none rounded p-3 focus:ring-2 focus:ring-blue-500 outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="flex gap-4">
              <button
                onClick={handleCreateRoom}
                className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded font-medium flex-1"
              >
                Tạo phòng mới
              </button>
              <button
                onClick={handleJoinByInput}
                className="border border-gray-600 hover:bg-gray-800 px-6 py-2 rounded font-medium flex-1 text-blue-400"
              >
                Tham gia bằng mã
              </button>
            </div>
          </div>

          {/* Room List */}
          {rooms.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-medium mb-3 text-gray-300">Danh sách phòng</h2>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className="flex items-center justify-between bg-[#3c4043] rounded-lg p-3 hover:bg-[#4a4d50] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{room.name}</span>
                        {room.locked && <Lock size={14} className="text-yellow-400 shrink-0" />}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-400 mt-1">
                        <span>Host: {room.hostName || 'N/A'}</span>
                        <span className="flex items-center gap-1">
                          <Users size={12} /> {room.size} online
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleJoinRoom(room.id, room.name)}
                      className="ml-3 bg-green-600 hover:bg-green-700 px-4 py-1.5 rounded text-sm font-medium shrink-0"
                    >
                      Tham gia
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-[#1a1c1e] aspect-video rounded-xl border border-gray-700 flex flex-col items-center justify-center relative overflow-hidden">
          {previewStream && !isVideoOff ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-gray-500 mb-4 items-center flex flex-col">
              <div className="w-20 h-20 bg-gray-600 rounded-full mb-4 flex items-center justify-center">
                <Camera size={40} className="text-gray-400" />
              </div>
              <span>{isVideoOff ? 'Máy ảnh đang tắt' : 'Đang chuẩn bị máy ảnh...'}</span>
            </div>
          )}

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4 z-10">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-3 rounded-full border border-gray-600 ${isMuted ? 'bg-red-500 border-none' : 'hover:bg-gray-700'}`}
            >
              {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
            </button>
            <button
              onClick={() => setIsVideoOff(!isVideoOff)}
              className={`p-3 rounded-full border border-gray-600 ${isVideoOff ? 'bg-red-500 border-none' : 'hover:bg-gray-700'}`}
            >
              {isVideoOff ? <VideoOff size={20} /> : <Camera size={20} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LobbyPage;
