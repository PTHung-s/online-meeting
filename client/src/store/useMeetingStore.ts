import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Peer, Message, MusicState } from '../types';
import type { AiMessage, AiAttachment } from '../types/ai';
import type { Quiz, QuizResponse, QuizStats } from '../types/quiz';

interface MeetingState {
  roomId: string | null;
  roomName: string | null;
  userName: string | null;
  localStream: MediaStream | null;
  lkToken: string | null;
  lkServerUrl: string | null; // Added
  peers: Peer[];
  messages: Message[];
  isHost: boolean;
  hostId: string | null;
  pinnedPeerId: string | null;
  syncedPin: { identity: string; source: any } | null;
  activeTab: 'chat' | 'info' | 'users' | 'ai' | 'quiz' | 'stats' | 'music' | null;
  setActiveTab: (tab: 'chat' | 'info' | 'users' | 'ai' | 'quiz' | 'stats' | 'music' | null) => void;
  
  // AI Assistant State
  aiMessages: AiMessage[];
  aiInput: string;
  aiAttachments: AiAttachment[];
  setAiInput: (input: string) => void;
  addAiMessage: (msg: AiMessage) => void;
  setAiMessages: (msgs: AiMessage[]) => void;
  clearAiMessages: () => void;
  attachToAi: (content: string, label: string, type: AiAttachment['type'], fileData?: string, mimeType?: string) => void;
  removeAiAttachment: (id: string) => void;
  clearAiAttachments: () => void;
  
  // Quiz State
  activeQuiz: Quiz | null;
  quizResponses: QuizResponse[];
  quizStats: QuizStats | null;
  setActiveQuiz: (quiz: Quiz | null) => void;
  addQuizResponse: (response: QuizResponse) => void;
  setQuizResponses: (responses: QuizResponse[]) => void;
  setQuizStats: (stats: QuizStats | null) => void;

  // Persistence for Quiz Creation
  draftQuiz: Partial<Quiz>;
  setDraftQuiz: (quiz: Partial<Quiz>) => void;

  // Code Editor State
  isCodeEditorOpen: boolean;
  codeEditorWidth: number;
  code: string;
  selectedLanguage: { name: string; version: string };
  output: string;
  isRunning: boolean;
  stdin: string;
  
  // Peer Code State (for admin to view others' code)
  peerCodes: Map<string, { 
    code: string; 
    language: { name: string; version: string };
    activityStats?: Array<{ timestamp: number; added: number; deleted: number }>;
  }>;
  peerCursors: Map<string, { lineNumber: number; column: number; selection?: any }>;
  viewingPeerCode: string | null;
  
  setRoom: (id: string, name: string, userName?: string) => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setLkToken: (token: string | null) => void;
  setLkServerUrl: (url: string | null) => void; // Added
  addPeer: (peer: Peer) => void;
  removePeer: (socketId: string) => void;
  updatePeerStream: (socketId: string, stream: MediaStream) => void;
  updatePeerState: (socketId: string, state: Partial<{ isMuted: boolean, isCameraOff: boolean, isActive: boolean }>) => void;
  addMessage: (msg: Message) => void;
  setMessages: (msgs: Message[]) => void;
  unreadMessageCount: number;
  resetUnreadMessages: () => void;
  setPeers: (peers: Peer[]) => void;
  setIsHost: (isHost: boolean) => void;
  setHostId: (hostId: string | null) => void;
  setPinnedPeerId: (id: string | null) => void;
  setSyncedPin: (pin: { identity: string; source: any } | null) => void;
  
  // Code Editor Actions
  toggleCodeEditor: () => void;
  setCodeEditorWidth: (width: number) => void;
  setCode: (code: string) => void;
  setSelectedLanguage: (language: { name: string; version: string }) => void;
  setOutput: (output: string) => void;
  setIsRunning: (isRunning: boolean) => void;
  setStdin: (stdin: string) => void;
  
  // Peer Code Actions
  updatePeerCode: (socketId: string, code: string, language: { name: string; version: string }) => void;
  updatePeerActivityStats: (socketId: string, stats: Array<{ timestamp: number; added: number; deleted: number }>) => void;
  updatePeerViolations: (socketId: string, violations: number) => void;
  updatePeerCopyCount: (socketId: string, copyCount: number) => void;
  updatePeerPasteCount: (socketId: string, pasteCount: number) => void;
  updatePeerPoints: (pointsData: Array<{ socketId: string, points: number }>) => void;
  addPeerViolationHistory: (socketId: string, history: { type: string; reason: string; timestamp: number }) => void;
  setViewingPeerCode: (socketId: string | null) => void;
  removePeerCode: (socketId: string) => void;
  updatePeerCursor: (socketId: string, cursor: { lineNumber: number; column: number; selection?: any }) => void;
  removePeerCursor: (socketId: string) => void;
  
  // Sidebar State & Actions
  showDebug: boolean;
  setShowDebug: (show: boolean) => void;
  showPeerViewer: boolean;
  setShowPeerViewer: (show: boolean) => void;

  // Music State
  musicState: MusicState;
  setMusicState: (state: Partial<MusicState>) => void;
  musicProgress: { currentTime: number; duration: number };
  setMusicProgress: (progress: { currentTime: number; duration: number }) => void;
  isMusicPollOpen: boolean;
  setIsMusicPollOpen: (open: boolean) => void;
  musicVolume: number;
  setMusicVolume: (volume: number) => void;
  
  // Media State
  isMicEnabled: boolean;
  isCameraEnabled: boolean;
  setMicEnabled: (enabled: boolean) => void;
  setCameraEnabled: (enabled: boolean) => void;
  
  // Assignment State
  assignments: Array<{ id: string; data: string; type: 'image' | 'pdf'; name: string }>;
  currentAssignmentIndex: number;
  setAssignments: (assignments: Array<{ id: string; data: string; type: 'image' | 'pdf'; name: string }>) => void;
  addAssignment: (assignment: { id: string; data: string; type: 'image' | 'pdf'; name: string }) => void;
  removeAssignment: (id: string) => void;
  updateAssignments: (assignments: Array<{ id: string; data: string; type: 'image' | 'pdf'; name: string }>) => void;
  setCurrentAssignmentIndex: (index: number) => void;
  
  reset: () => void;
}

export const useMeetingStore = create<MeetingState>()(persist((set) => ({
  roomId: null,
  roomName: null,
  userName: null,
  localStream: null,
  lkToken: null,
  lkServerUrl: null, // Added
  peers: [],
  messages: [],
  isHost: false,
  hostId: null,
  pinnedPeerId: null,
  syncedPin: null,
  
  // AI Assistant Initial State
  aiMessages: [],
  aiInput: '',
  aiAttachments: [],
  setAiInput: (input: string) => set({ aiInput: input }),
  addAiMessage: (msg: AiMessage) => set((state) => ({ 
    aiMessages: [...state.aiMessages, { ...msg, id: msg.id || Date.now().toString() + Math.random() }] 
  })),
  setAiMessages: (msgs: AiMessage[]) => set({ aiMessages: msgs }),
  clearAiMessages: () => set({ aiMessages: [] }),
  attachToAi: (content: string, label: string, type: AiAttachment['type'], fileData?: string, mimeType?: string) => set((state) => {
    // Nếu nội dung trống thì không đính kèm
    if (!content || !content.trim()) return { activeTab: 'ai' };

    // Tránh trùng lặp nội dung giống hệt nhau
    const isDuplicate = state.aiAttachments.some((a: AiAttachment) => a.content === content && a.type === type && a.fileData === fileData);
    if (isDuplicate) return { activeTab: 'ai' };

    const newAttachment: AiAttachment = {
      id: `${type}-${Date.now()}`,
      label,
      content,
      type,
      fileData,
      mimeType
    };
    
    return { 
      aiAttachments: [...state.aiAttachments, newAttachment],
      activeTab: 'ai' 
    };
  }),
  removeAiAttachment: (id: string) => set((state) => ({
    aiAttachments: state.aiAttachments.filter((a: AiAttachment) => a.id !== id)
  })),
  clearAiAttachments: () => set({ aiAttachments: [] }),

  // Quiz Actions
  activeQuiz: null,
  quizResponses: [],
  quizStats: null,
  setActiveQuiz: (quiz) => set({ activeQuiz: quiz, quizResponses: [], quizStats: null }),
  addQuizResponse: (response) => set((state) => ({ 
    quizResponses: [...state.quizResponses, response] 
  })),
  setQuizResponses: (responses) => set({ quizResponses: responses }),
  setQuizStats: (stats) => set({ quizStats: stats }),

  // Draft Quiz Persistence
  draftQuiz: { title: '', questions: [] },
  setDraftQuiz: (quiz) => set({ draftQuiz: quiz }),

  // Code Editor Initial State
  isCodeEditorOpen: false,
  codeEditorWidth: 50,
  code: '// Write your code here\n',
  selectedLanguage: { name: 'python', version: '3.10.0' },
  output: '',
  isRunning: false,
  stdin: '',
  
  // Peer Code Initial State
  peerCodes: new Map(),
  peerCursors: new Map(),
  viewingPeerCode: null,
  
  // Sidebar State
  activeTab: null,
  showDebug: false,
  showPeerViewer: false,
  
  // Media State
  isMicEnabled: true,
  isCameraEnabled: true,

  // Assignment State
  assignments: [],
  currentAssignmentIndex: 0,

  setRoom: (id, name, userName) => set({ roomId: id, roomName: name, userName: userName }),
  setLocalStream: (stream) => set({ localStream: stream }),
  setLkToken: (token) => set({ lkToken: token }), 
  setLkServerUrl: (url) => set({ lkServerUrl: url }), // Added
  addPeer: (peer) => set((state) => {
    // Check if peer already exists by socketId OR by name (for reconnection)
    const existsBySocket = state.peers.find(p => p.socketId === peer.socketId);
    const existsByName = state.peers.find(p => p.name === peer.name);
    
    if (existsBySocket) {
      console.log('🔄 Peer exists, updating state:', peer.socketId);
      return { 
        peers: state.peers.map(p => p.socketId === peer.socketId ? { ...p, ...peer } : p) 
      };
    }
    
    // If same name exists with different socketId, remove the old one first
    let updatedPeers = state.peers;
    if (existsByName && existsByName.socketId !== peer.socketId) {
      console.log('🔄 Removing old peer with same name:', existsByName.name, existsByName.socketId);
      updatedPeers = state.peers.filter(p => p.name !== peer.name);
    }
    
    // If peer comes with code
    if (peer.code) {
      const newPeerCodes = new Map(state.peerCodes);
      newPeerCodes.set(peer.socketId, { 
        code: peer.code, 
        language: peer.language || state.selectedLanguage 
      });
      return { peers: [...updatedPeers, peer], peerCodes: newPeerCodes };
    }
    
    return { peers: [...updatedPeers, peer] };
  }),
  removePeer: (socketId) => set((state) => ({
    peers: state.peers.filter((p) => p.socketId !== socketId)
  })),
  updatePeerStream: (socketId, stream) => set((state) => ({
    peers: state.peers.map((p) => p.socketId === socketId ? { ...p, stream } : p)
  })),
  updatePeerState: (socketId, peerState) => set((state) => ({
    peers: state.peers.map((p) => p.socketId === socketId ? { ...p, ...peerState } : p)
  })),
  unreadMessageCount: 0,
  addMessage: (msg) => set((state) => ({ 
    messages: [...state.messages, msg],
    unreadMessageCount: state.activeTab !== 'chat' ? state.unreadMessageCount + 1 : 0
  })),
  setMessages: (msgs) => set({ messages: msgs }),
  resetUnreadMessages: () => set({ unreadMessageCount: 0 }),
  setPeers: (peers) => set((state) => {
    // Also populate peerCodes if peers have code data
    const newPeerCodes = new Map(state.peerCodes);
    
    peers.forEach(p => {
      if (p.code) {
        newPeerCodes.set(p.socketId, { 
          code: p.code, 
          language: p.language || state.selectedLanguage 
        });
      }
    });
    return { peers, peerCodes: newPeerCodes };
  }),
  setIsHost: (isHost) => set({ isHost }),
  setHostId: (hostId) => set({ hostId }),
  setPinnedPeerId: (id) => set({ pinnedPeerId: id }),
  setSyncedPin: (syncedPin) => set({ syncedPin }),
  
  // Code Editor Actions
  toggleCodeEditor: () => set((state) => ({ isCodeEditorOpen: !state.isCodeEditorOpen })),
  setCodeEditorWidth: (width) => set({ codeEditorWidth: Math.max(20, Math.min(80, width)) }),
  setCode: (code) => set({ code }),
  setSelectedLanguage: (language) => set({ selectedLanguage: language }),
  setOutput: (output) => set({ output }),
  setIsRunning: (isRunning) => set({ isRunning }),
  setStdin: (stdin) => set({ stdin }),
  
  // Peer Code Actions
  updatePeerCode: (socketId, code, language) => set((state) => {
    const newPeerCodes = new Map(state.peerCodes);
    newPeerCodes.set(socketId, { code, language });
    return { 
      peerCodes: newPeerCodes,
      peers: state.peers.map((p) => p.socketId === socketId ? { ...p, code, language } : p)
    };
  }),
  updatePeerActivityStats: (socketId, activityStats) => set((state) => {
    const newPeerCodes = new Map(state.peerCodes);
    const peerData = newPeerCodes.get(socketId);
    if (peerData) {
      newPeerCodes.set(socketId, { ...peerData, activityStats });
    }
    return {
      peerCodes: newPeerCodes,
      peers: state.peers.map((p) => p.socketId === socketId ? { ...p, activityStats } : p)
    };
  }),
  updatePeerViolations: (socketId, violations) => set((state) => ({
    peers: state.peers.map((p) => p.socketId === socketId ? { ...p, violations } : p)
  })),
  updatePeerCopyCount: (socketId, copyCount) => set((state) => ({
    peers: state.peers.map((p) => p.socketId === socketId ? { ...p, copyCount } : p)
  })),
  updatePeerPasteCount: (socketId, pasteCount) => set((state) => ({
    peers: state.peers.map((p) => p.socketId === socketId ? { ...p, pasteCount } : p)
  })),
  updatePeerPoints: (pointsData) => set((state) => ({
    peers: state.peers.map((p) => {
      const update = pointsData.find(d => d.socketId === p.socketId);
      return update ? { ...p, points: update.points } : p;
    })
  })),
  addPeerViolationHistory: (socketId, history) => set((state) => ({
    peers: state.peers.map((p) => p.socketId === socketId ? { ...p, violationHistory: [...(p.violationHistory || []), history] } : p)
  })),
  setViewingPeerCode: (socketId) => set({ viewingPeerCode: socketId }),
  removePeerCode: (socketId) => set((state) => {
    const newPeerCodes = new Map(state.peerCodes);
    newPeerCodes.delete(socketId);
    return { peerCodes: newPeerCodes, viewingPeerCode: state.viewingPeerCode === socketId ? null : state.viewingPeerCode };
  }),

  // Peer Cursor Actions
  updatePeerCursor: (socketId: string, cursor: any) => set((state) => {
    const newCursors = new Map(state.peerCursors);
    newCursors.set(socketId, cursor);
    return { peerCursors: newCursors };
  }),
  removePeerCursor: (socketId: string) => set((state) => {
    const newCursors = new Map(state.peerCursors);
    newCursors.delete(socketId);
    return { peerCursors: newCursors };
  }),
  
  // Sidebar Actions
  setActiveTab: (tab) => set((state) => ({ 
    activeTab: tab,
    unreadMessageCount: tab === 'chat' ? 0 : state.unreadMessageCount
  })),
  setShowDebug: (show) => set({ showDebug: show }),
  setShowPeerViewer: (show) => set({ showPeerViewer: show }),

  // Music State
  musicState: {
    currentTrack: null,
    isPlaying: false,
    startTime: 0,
    poll: null
  },
  setMusicState: (state) => set((prev) => ({ 
    musicState: { ...prev.musicState, ...state } 
  })),
  musicProgress: { currentTime: 0, duration: 0 },
  setMusicProgress: (progress) => set({ musicProgress: progress }),
  isMusicPollOpen: false,
  setIsMusicPollOpen: (open) => set({ isMusicPollOpen: open }),
  musicVolume: 0.3, 
  setMusicVolume: (volume) => set({ musicVolume: volume }),
  
  // Media Actions
  setMicEnabled: (enabled) => set({ isMicEnabled: enabled }),
  setCameraEnabled: (enabled) => set({ isCameraEnabled: enabled }),

  // Assignment Actions
  setAssignments: (assignments) => set({ assignments }),
  addAssignment: (assignment) => set((state) => ({ 
    assignments: [...state.assignments, assignment],
    currentAssignmentIndex: state.assignments.length // Switch to newly added
  })),
  removeAssignment: (id) => set((state) => {
    const newAssignments = state.assignments.filter(a => a.id !== id);
    let newIndex = state.currentAssignmentIndex;
    if (newIndex >= newAssignments.length) {
      newIndex = Math.max(0, newAssignments.length - 1);
    }
    return { assignments: newAssignments, currentAssignmentIndex: newIndex };
  }),
  updateAssignments: (assignments) => set({ assignments }),
  setCurrentAssignmentIndex: (index) => set({ currentAssignmentIndex: index }),
  
  reset: () => set({
    roomId: null,
    roomName: null,
    localStream: null,
    lkToken: null,
    peers: [],
    messages: [],
    isHost: false,
    pinnedPeerId: null,
    syncedPin: null,
    isCodeEditorOpen: false,
    codeEditorWidth: 50,
    code: '// Write your code here\n',
    selectedLanguage: { name: 'python', version: '3.10.0' },
    output: '',
    isRunning: false,
    peerCodes: new Map(),
    peerCursors: new Map(),
    viewingPeerCode: null,
    activeTab: null,
    showDebug: false,
    showPeerViewer: false,
    isMicEnabled: true,
    isCameraEnabled: true,
    assignments: [],
    currentAssignmentIndex: 0,
    aiMessages: [],
    aiInput: '',
    aiAttachments: [],
    draftQuiz: { title: '', questions: [] }
  })
}), {
  name: 'meeting-storage',
  storage: createJSONStorage(() => localStorage),
  partialize: (state) => ({
    userName: state.userName,
    code: state.code,
    selectedLanguage: state.selectedLanguage,
    messages: state.messages,
    aiMessages: state.aiMessages,
    aiAttachments: state.aiAttachments,
    draftQuiz: state.draftQuiz,
    stdin: state.stdin,
  }),
  merge: (persistedState: any, currentState: MeetingState) => {
    // Merge persisted data with current state
    return {
      ...currentState,
      ...persistedState,
      // Don't restore these volatile states
      roomId: currentState.roomId,
      roomName: currentState.roomName,
      localStream: currentState.localStream,
      peers: currentState.peers,
      isHost: currentState.isHost,
    } as MeetingState;
  },
}));
