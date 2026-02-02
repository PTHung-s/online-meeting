import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  LayoutContextProvider,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { useMeetingStore } from '../store/useMeetingStore';
import { socket } from '../services/socket';
import type { Message } from '../types';
import {
  PhoneOff,
  Settings,
  Eye,
  Upload,
  X,
  AlertTriangle,
  History,
  Users,
  Info,
  Activity,
  MessageSquare,
  Bot,
  HelpCircle,
  Music
} from 'lucide-react';
import PeerCodeViewer from '../components/PeerCodeViewer';
import { MeetingWorkspace } from '../components/MeetingWorkspace';
import { UserList, RoomStats, RoomInfo, MediaControls, DigitalClock } from '../components/MeetingComponents';
import CustomChat from '../components/CustomChat';
import AIAssistant from '../components/AIAssistant';
import QuizManager from '../components/QuizManager';
import MusicPlayer from '../components/MusicPlayer';
import MusicPoll from '../components/MusicPoll';

import SidebarTemplate from '../components/SidebarTemplate';
import AssignmentManager from '../components/AssignmentManager';

const MeetingPage: React.FC = () => {
  const {
    roomId,
    roomName,
    lkToken,
    lkServerUrl, // Added
    reset,
    showPeerViewer,
    isMicEnabled,
    isCameraEnabled,
    addPeer,
    removePeer,
    updatePeerState,
    updatePeerCode,
    removePeerCode,
    showDebug,
    setShowDebug,
    setShowPeerViewer,
    isHost,
    peers,
    unreadMessageCount
  } = useMeetingStore();
  
  const [copied, setCopied] = useState(false);
  const [selectedHistorySocketId, setSelectedHistorySocketId] = useState<string | null>(null);
  const { activeTab, setActiveTab } = useMeetingStore();
  const [showAssignmentManager, setShowAssignmentManager] = useState(false);
  const [lastMessagePreview, setLastMessagePreview] = useState<Message | null>(null);
  const previewTimerRef = useRef<any>(null);

  // --- Socket.io Listeners for Peer Synchronization ---
  useEffect(() => {
    socket.on('peer:joined', ({ socketId, name, ...rest }) => {
      console.log('Peer joined event received:', name, socketId);
      addPeer({ 
        socketId, 
        name, 
        isMuted: false, 
        isCameraOff: false, 
        isActive: true, 
        isConnected: true,
        ...rest 
      });
    });

    socket.on('peer:left', ({ socketId }) => {
      console.log('Peer left event received for:', socketId);
      removePeer(socketId);
      removePeerCode(socketId);
    });

    socket.on('chat:message', (msg: Message) => {
      if (msg.senderId !== socket.id) {
        const store = useMeetingStore.getState();
        store.addMessage(msg);
        
        // Show notification if not in chat tab
        if (store.activeTab !== 'chat') {
          // Subtle "Digital Chime" notification sound
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
          audio.volume = 0.5; // Slightly lower volume for better UX
          audio.play().catch(e => console.log('Notification sound suppressed:', e));
          
          setLastMessagePreview(msg);
          if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
          previewTimerRef.current = setTimeout(() => setLastMessagePreview(null), 5000);
        }
      }
    });

    socket.on('chat:history', (history: Message[]) => {
      useMeetingStore.getState().setMessages(history);
    });

    socket.on('peer:update-state', ({ socketId, state }) => {
      updatePeerState(socketId, state);
    });

    socket.on('code:sync', ({ socketId, code, language, isTargeted }) => {
      // Sử dụng getState() để lấy giá trị mới nhất, tránh stale closure
      const current = useMeetingStore.getState();
      if (current.isHost || isTargeted) {
        updatePeerCode(socketId, code, language);
      }
    });

    socket.on('code:response', ({ socketId, code, language }) => {
      updatePeerCode(socketId, code, language);
    });

    socket.on('user:violation', ({ socketId, type, violations, pasteCount }) => {
      const store = useMeetingStore.getState();
      store.updatePeerViolations(socketId, violations);
      if (pasteCount !== undefined && store.updatePeerPasteCount) {
        store.updatePeerPasteCount(socketId, pasteCount);
      }
      console.warn(`User ${socketId} violation: ${type}. Total: ${violations}`);
    });

    socket.on('user:copy', ({ socketId, copyCount }) => {
      useMeetingStore.getState().updatePeerCopyCount(socketId, copyCount);
    });

    socket.on('peer:update-points', ({ points }) => {
      useMeetingStore.getState().updatePeerPoints(points);
    });

    socket.on('user:activity-stats', ({ socketId, activityStats }) => {
      useMeetingStore.getState().updatePeerActivityStats(socketId, activityStats);
    });

    socket.on('user:violation-reason', ({ socketId, type, reason, timestamp }) => {
      useMeetingStore.getState().addPeerViolationHistory(socketId, { type, reason, timestamp });
    });

    socket.on('assignment:add', ({ assignment }) => {
      useMeetingStore.getState().addAssignment(assignment);
    });

    socket.on('assignment:delete', ({ assignmentId }) => {
      useMeetingStore.getState().removeAssignment(assignmentId);
    });

    socket.on('assignment:reorder', ({ assignments }) => {
      useMeetingStore.getState().updateAssignments(assignments);
    });

    socket.on('quiz:started', ({ quiz }) => {
      console.log('MeetingPage: Received quiz:started event', quiz.title);
      useMeetingStore.getState().setActiveQuiz(quiz);
    });

    socket.on('quiz:submitted', ({ response }) => {
      if (useMeetingStore.getState().isHost) {
        useMeetingStore.getState().addQuizResponse(response);
      }
    });

    socket.on('quiz:ended', () => {
      useMeetingStore.getState().setActiveQuiz(null);
    });

    // Adaptive Quiz events
    socket.on('adaptive:started', ({ session }) => {
      const store = useMeetingStore.getState();
      store.setActiveAdaptive(session);
      store.setActiveTab('quiz');
    });
    socket.on('adaptive:question', ({ question, questionIndex }) => {
      useMeetingStore.getState().setAdaptiveCurrentQuestion(question, questionIndex);
    });
    socket.on('adaptive:answer-received', ({ count, total }) => {
      useMeetingStore.getState().setAdaptiveAnswerProgress({ count, total });
    });
    socket.on('adaptive:answer-confirmed', ({ isCorrect }) => {
      useMeetingStore.getState().setAdaptiveMyResult(isCorrect);
    });
    socket.on('adaptive:question-stats', ({ questionResult, scores }) => {
      const store = useMeetingStore.getState();
      store.addAdaptiveQuestionResult(questionResult);
      store.setAdaptiveScores(scores);
      store.setAdaptiveCurrentQuestion(null, store.adaptiveQuestionIndex);
    });
    socket.on('adaptive:ended', ({ rankings }) => {
      const store = useMeetingStore.getState();
      store.setAdaptiveRankings(rankings);
      store.setActiveAdaptive(null);
    });
    socket.on('adaptive:countdown', ({ seconds }) => {
      useMeetingStore.getState().setAdaptiveCountdown(seconds);
    });
    socket.on('adaptive:auto-next', () => {
      // Handled by AdaptiveQuizManager component
      window.dispatchEvent(new CustomEvent('adaptive:auto-next'));
    });

    socket.on('room:hostChanged', ({ hostId }) => {
      useMeetingStore.getState().setHostId(hostId);
    });

    // Request chat history
    if (roomId) {
      socket.emit('chat:history', { roomId });
    }

    return () => {
      socket.off('peer:joined');
      socket.off('peer:left');
      socket.off('chat:message');
      socket.off('chat:history');
      socket.off('peer:update-state');
      socket.off('code:sync');
      socket.off('code:response');
      socket.off('user:violation');
      socket.off('user:copy');
      socket.off('user:activity-stats');
      socket.off('user:violation-reason');
      socket.off('assignment:add');
      socket.off('assignment:delete');
      socket.off('assignment:reorder');
      socket.off('quiz:started');
      socket.off('quiz:submitted');
      socket.off('quiz:ended');
      socket.off('adaptive:started');
      socket.off('adaptive:question');
      socket.off('adaptive:answer-received');
      socket.off('adaptive:answer-confirmed');
      socket.off('adaptive:question-stats');
      socket.off('adaptive:ended');
      socket.off('adaptive:countdown');
      socket.off('adaptive:auto-next');
      socket.off('room:hostChanged');
    };
  }, [addPeer, removePeer, updatePeerState, updatePeerCode, removePeerCode]);

  // --- Proctoring Logic ---
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [reasonType, setReasonType] = useState('');
  const [reasonInput, setReasonInput] = useState('');
  const lastViolationEmitTime = useRef(0);

  useEffect(() => {
    if (!roomId) return; 

    const handleViolation = (type: string) => {
      if (isHost) return; 
      
      const now = Date.now();
      // Chặn mọi violation gửi liên tiếp trong vòng 1s (trừ paste) để tránh x2/x3 do browser events
      if (type !== 'external-paste' && now - lastViolationEmitTime.current < 1000) return;
      if (type !== 'external-paste') lastViolationEmitTime.current = now;

      if (document.visibilityState === 'hidden' || !document.hasFocus()) {
        socket.emit('user:violation', { roomId, type });
        setReasonType(type);
      }
    };

    const handleFocus = () => {
      if (!isHost && reasonType) {
        setShowReasonModal(true);
      }
    };

    const handleCopy = () => {
      if (!isHost) {
        const text = window.getSelection()?.toString();
        // Chỉ lưu nếu có text thực sự (để tránh ghi đè nội dung từ Monaco nếu click ra ngoài)
        if (text && text.trim()) {
          (window as any)._lastInternalCopy = text;
        }
        socket.emit('user:copy', { roomId });
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
      if (isHost) return;
      
      const now = Date.now();
      const lastPaste = (window as any)._lastPasteTime || 0;
      if (now - lastPaste < 200) return; 
      (window as any)._lastPasteTime = now;

      const pastedText = (e.clipboardData?.getData('text') || "");
      const internalCopy = ((window as any)._lastInternalCopy || "");

      const normalize = (s: string) => s.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();

      if (pastedText.trim() && normalize(pastedText) !== normalize(internalCopy)) {
        socket.emit('user:violation', { roomId, type: 'external-paste' });
        console.warn("External content paste detected");
      }
    };

const updateMyActiveState = (active: boolean) => {
      if (!roomId) return;
      socket.emit('peer:update-state', { roomId, state: { isActive: active } });
      const myId = socket.id || useMeetingStore.getState().lkToken?.split(':')[0]; // Fallback if socket.id temporarily missing
      if (myId) updatePeerState(myId, { isActive: active });
    };

    const onVisibilityChange = () => {
      const active = document.visibilityState === 'visible';
      updateMyActiveState(active);
      
      if (document.visibilityState === 'hidden') {
        handleViolation('tab-switch');
      } else if (document.visibilityState === 'visible') {
        handleFocus();
      }
    };

    const onBlur = () => {
      updateMyActiveState(false);
      // Đợi 1 chút để xem có phải là đổi tab không. 
      // Nếu đổi tab, visibilitychange sẽ bắn 'tab-switch' và set cooldown.
      setTimeout(() => {
        if (document.visibilityState === 'visible') {
          handleViolation('focus-lost');
        }
      }, 150);
    };

    const onFocus = () => {
      // Only set active true if tab is actually visible
      if (document.visibilityState === 'visible') {
        updateMyActiveState(true);
      }
      // handleFocus(); // Không cần gọi ở đây vì visibilitychange 'visible' đã lo, 
                         // hoặc window.focus chỉ nên gọi nếu tab đã visible
      if (document.visibilityState === 'visible') {
        handleFocus();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    window.addEventListener('copy', handleCopy as any);
    window.addEventListener('paste', handlePaste as any);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('copy', handleCopy as any);
      window.removeEventListener('paste', handlePaste as any);
    };
  }, [roomId, isHost, reasonType]);

  // Initial active state sync - separate from proctoring logic to avoid re-triggering
  useEffect(() => {
    if (roomId && socket.connected) {
      socket.emit('peer:update-state', { roomId, state: { isActive: true } });
    }
  }, [roomId]);

  const submitReason = () => {
    if (!reasonInput.trim()) return;
    socket.emit('user:violation-reason', { roomId, type: reasonType, reason: reasonInput });
    setReasonInput('');
    setReasonType('');
    setShowReasonModal(false);
  };
  
  const serverUrl = useMemo(() => {
    const rawUrl = lkServerUrl || 'your-project.livekit.cloud';
    return 'wss://' + rawUrl.replace('https://', '').replace('wss://', '');
  }, [lkServerUrl]);

  const handleCopyLink = () => {
    const link = `${window.location.origin}?room=${roomId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeave = () => {
    socket.emit('room:leave', { roomId });
    socket.disconnect();
    reset();
    window.location.href = '/';
  };

  if (!lkToken) {
    return (
      <div className="h-screen flex flex-col items-center justify-center text-white bg-[#202124] gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <p className="text-lg font-medium text-gray-400 italic">Đang bảo mật kết nối cuộc họp...</p>
      </div>
    );
  }

  return (
    <LiveKitRoom
      video={isCameraEnabled}
      audio={isMicEnabled}
      token={lkToken}
      serverUrl={serverUrl}
      connect={true}
      data-lk-theme="default"
      className="h-full w-full"
      onDisconnected={handleLeave}
    >
      <LayoutContextProvider>
        <div className="h-screen bg-[#202124] text-white font-sans overflow-hidden flex flex-col">
          {/* Top toolbar */}
          <div className="flex-none flex items-center justify-between px-6 py-3 bg-[#1a1b1e] border-b border-white/5 relative z-40">
            <div className="flex items-center gap-6">
              <button
                onClick={handleLeave}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-all font-bold text-sm shadow-lg shadow-red-500/25 active:scale-95"
              >
                <PhoneOff size={18} />
                <span>Rời khỏi</span>
              </button>
              
              <div className="flex items-center gap-3">
                <h2 className="text-white font-semibold text-sm truncate max-w-[200px]">
                  {roomName || 'Cuộc họp học tập'}
                </h2>
                <div className="flex items-center gap-1.5 bg-green-500/10 px-2 py-1 rounded-md border border-green-500/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-[10px] text-green-500 font-bold uppercase tracking-wider">Live</span>
                </div>
                <DigitalClock />
              </div>
            </div>

            {/* Central Tools */}
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
              <MediaControls />

              <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 gap-1">
                <button
                  onClick={() => setActiveTab(activeTab === 'ai' ? null : 'ai')}
                  className={`p-2 rounded-lg transition-all ${activeTab === 'ai' ? 'bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg shadow-blue-500/20 text-white' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}
                  title="Trợ lý AI"
                >
                  <Bot size={18} />
                </button>
                <button
                  onClick={() => setActiveTab(activeTab === 'quiz' ? null : 'quiz')}
                  className={`p-2 rounded-lg transition-all ${activeTab === 'quiz' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}
                  title="Trắc nghiệm"
                >
                  <HelpCircle size={18} />
                </button>
                <button
                  onClick={() => setActiveTab(activeTab === 'music' ? null : 'music')}
                  className={`p-2 rounded-lg transition-all ${activeTab === 'music' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}
                  title="Nhạc học tập"
                >
                   <Music size={18} />
                </button>
                <button
                  onClick={() => setActiveTab(activeTab === 'chat' ? null : 'chat')}
                  className={`p-2 rounded-lg transition-all relative ${activeTab === 'chat' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}
                  title="Trò chuyện"
                >
                  <MessageSquare size={18} />
                  {unreadMessageCount > 0 && activeTab !== 'chat' && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-[#1a1b1e] animate-bounce">
                      {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab(activeTab === 'users' ? null : 'users')}
                  className={`p-2 rounded-lg transition-all ${activeTab === 'users' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}
                  title="Thành viên"
                >
                  <Users size={18} />
                </button>
                <button
                  onClick={() => setActiveTab(activeTab === 'info' ? null : 'info')}
                  className={`p-2 rounded-lg transition-all ${activeTab === 'info' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}
                  title="Thông tin cuộc họp"
                >
                  <Info size={18} />
                </button>
                <button
                  onClick={() => setActiveTab(activeTab === 'stats' ? null : 'stats')}
                  className={`p-2 rounded-lg transition-all ${activeTab === 'stats' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}
                  title="Trạng thái kết nối"
                >
                  <Activity size={18} />
                </button>
              </div>

              <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 gap-1">
                {isHost && (
                  <>
                    <button
                      onClick={() => setShowPeerViewer(!showPeerViewer)}
                      className={`p-2 rounded-lg transition-all ${showPeerViewer ? 'bg-purple-600 text-white' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}
                      title="Xem code học viên (Pop-out)"
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      onClick={() => setShowAssignmentManager(true)}
                      className={`p-2 rounded-lg transition-all ${useMeetingStore.getState().assignments.length > 0 ? 'bg-orange-600 text-white' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}
                      title="Quản lý đề bài"
                    >
                      <Upload size={18} />
                    </button>
                  </>
                )}
              </div>

              <button
                onClick={() => setShowDebug(!showDebug)}
                className={`p-2 bg-white/5 rounded-xl border border-white/5 transition-all ${showDebug ? 'text-green-400 border-green-500/50' : 'text-gray-400 hover:bg-white/10'}`}
                title="Debug Toolbar"
              >
                <Settings size={18} />
              </button>
            </div>

            <div className="flex items-center gap-4">
              {/* Vị trí cũ của nút Rời khỏi đã được chuyển sang bên trái */}
            </div>
          </div>

          <div className="flex-1 min-h-0 flex overflow-hidden">
             <MeetingWorkspace onShowHistory={setSelectedHistorySocketId} />
          </div>
          
          {showPeerViewer && <PeerCodeViewer onClose={() => setShowPeerViewer(false)} />}
          
          <AssignmentManager 
            visible={showAssignmentManager} 
            onClose={() => setShowAssignmentManager(false)} 
            roomId={roomId || ''} 
          />
        </div>

        {/* Header Tools Sidebar (Users, Info, Stats, Chat) */}
        {activeTab === 'users' && (
          <SidebarTemplate
            title="Danh sách thành viên"
            icon={Users}
            onClose={() => setActiveTab(null)}
          >
            <UserList onShowHistory={(id) => { setSelectedHistorySocketId(id); setActiveTab(null); }} />
          </SidebarTemplate>
        )}

        {activeTab === 'info' && (
          <SidebarTemplate
            title="Thông tin cuộc họp"
            icon={Info}
            onClose={() => setActiveTab(null)}
          >
            <RoomInfo roomId={roomId || ''} roomName={roomName || ''} handleCopyLink={handleCopyLink} copied={copied} />
          </SidebarTemplate>
        )}

        {activeTab === 'stats' && (
          <SidebarTemplate
            title="Trạng thái hệ thống"
            icon={Activity}
            onClose={() => setActiveTab(null)}
          >
            <RoomStats />
          </SidebarTemplate>
        )}

        {activeTab === 'chat' && (
          <SidebarTemplate
            title="Trò chuyện"
            icon={MessageSquare}
            onClose={() => setActiveTab(null)}
            width="w-96"
          >
            <CustomChat />
          </SidebarTemplate>
        )}

        {activeTab === 'ai' && (
          <SidebarTemplate
            title="Trợ lý AI Pro"
            icon={Bot}
            onClose={() => setActiveTab(null)}
            width="w-[450px]"
          >
            <AIAssistant />
          </SidebarTemplate>
        )}

        {activeTab === 'quiz' && (
          <SidebarTemplate
            title="Trắc nghiệm trực tuyến"
            icon={HelpCircle}
            onClose={() => setActiveTab(null)}
            width="w-[450px]"
          >
            <QuizManager />
          </SidebarTemplate>
        )}

        {activeTab === 'music' && (
          <MusicPoll onClose={() => setActiveTab(null)} />
        )}

        {/* Modal: Student submits reason for violation */}
        {showReasonModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#1a1b1e] border border-white/10 rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in duration-300">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-red-500/10 rounded-2xl text-red-500">
                  <AlertTriangle size={32} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Yêu cầu xác nhận</h3>
                  <p className="text-gray-400 text-sm">Hệ thống phát hiện bạn vừa rời khỏi tab hoặc mất tập trung.</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <p className="text-sm font-medium text-gray-300">Vui lòng cho biết lý do để Host ghi nhận:</p>
                <textarea
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                  placeholder="Tôi chuyển sang tab khác để tra cứu..."
                  rows={3}
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                />
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => {
                    setReasonInput('Do vô tình chuyển tab');
                    submitReason();
                  }}
                  className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 text-gray-400 rounded-xl font-bold transition-all"
                >
                  Bỏ qua
                </button>
                <button
                  onClick={submitReason}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-600/25 active:scale-95"
                >
                  Xác nhận lí do
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Host views history for a participant */}
        {selectedHistorySocketId && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-[#1a1b1e] border border-white/10 rounded-3xl w-full max-w-2xl p-0 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="p-6 border-b border-white/10 flex items-center justify-between bg-[#1a1b1e]">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl">
                    <History size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Lịch sử hoạt động</h3>
                    <p className="text-gray-500 text-[10px] uppercase tracking-widest font-bold">
                      Học viên: {peers.find(p => p.socketId === selectedHistorySocketId)?.name || selectedHistorySocketId}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedHistorySocketId(null)}
                  className="p-2 hover:bg-white/5 rounded-full text-gray-500 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-6 max-h-[60vh] overflow-y-auto bg-[#1e1e1e] custom-scrollbar">
                {(() => {
                  const history = peers.find(p => p.socketId === selectedHistorySocketId)?.violationHistory || [];
                  if (history.length === 0) return <p className="text-center text-gray-500 py-10 font-bold italic">Không có bản ghi vi phạm nào.</p>;
                  
                  return (
                    <div className="space-y-4">
                      {history.slice().sort((a, b: any) => b.timestamp - a.timestamp).map((h, idx) => (
                        <div key={idx} className="bg-[#2d2d2d] p-4 rounded-2xl border border-white/5 shadow-sm flex gap-4 transition-all hover:border-white/10">
                          <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                            h.type === 'blur' || h.type === 'visibility' || h.type === 'tab-switch' || h.type === 'focus-lost' 
                            ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'
                          }`}>
                            <AlertTriangle size={18} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-gray-200">
                                {h.type === 'blur' && 'Mất tiêu điểm (Blur)'}
                                {h.type === 'visibility' && 'Rời sang tab khác'}
                                {h.type === 'tab-switch' && 'Rời sang tab khác'}
                                {h.type === 'focus-lost' && 'Mất tiêu điểm (Window blur)'}
                              </span>
                              <span className="text-[10px] text-gray-500 font-mono bg-black/20 px-2 py-0.5 rounded">
                                {new Date(h.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="text-sm text-gray-400 italic font-medium">" {h.reason || 'Không cung cấp lí do'} "</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              <div className="p-6 border-t border-white/10 bg-[#1a1b1e] text-right">
                <button 
                  onClick={() => setSelectedHistorySocketId(null)}
                  className="px-8 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold transition-all border border-white/5"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Message Preview Toast */}
        {lastMessagePreview && activeTab !== 'chat' && (
          <div 
            onClick={() => setActiveTab('chat')}
            className="fixed bottom-24 right-6 z-[300] bg-[#1a1b1e] border border-blue-500/30 rounded-2xl shadow-2xl p-4 flex gap-4 w-72 animate-in slide-in-from-right-10 duration-500 cursor-pointer hover:border-blue-500 transition-all group"
          >
            <div className="shrink-0 w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
               <MessageSquare size={20} />
            </div>
            <div className="flex-1 min-w-0">
               <div className="flex items-center justify-between mb-1">
                 <span className="font-bold text-sm text-white truncate">{lastMessagePreview.senderName}</span>
                 <span className="text-[10px] text-gray-500 italic">vừa xong</span>
               </div>
               <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed font-medium">
                 {lastMessagePreview.text}
               </p>
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); setLastMessagePreview(null); }}
              className="absolute -top-2 -right-2 w-6 h-6 bg-[#2d2e32] border border-white/10 rounded-full flex items-center justify-center text-gray-400 hover:text-white shadow-xl"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <RoomAudioRenderer />
        <MusicPlayer />
      </LayoutContextProvider>
    </LiveKitRoom>
  );
};

export default MeetingPage;
