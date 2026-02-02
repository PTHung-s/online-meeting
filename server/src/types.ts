export interface Participant {
  name: string;
  isMuted?: boolean;
  isCameraOff?: boolean;
  isActive?: boolean;
  code?: string;
  language?: { name: string; version: string };
  violations?: number;
  copyCount?: number;
  pasteCount?: number;
  points?: number;
  isConnected?: boolean;
  violationHistory?: Array<{ type: string; reason: string; timestamp: number }>;
  activityStats: Array<{ timestamp: number; added: number; deleted: number }>;
}

export interface Message {
  senderId: string;
  senderName: string;
  text: string;
  time: number;
}

export interface Assignment {
  id: string;
  data: string;
  type: 'image' | 'pdf';
  name: string;
}

export interface Room {
  id: string;
  name: string;
  password?: string;
  hostId: string;
  hostName?: string;
  participants: Map<string, Participant>;
  createdAt: number;
  messages: Message[];
  pinned?: string;
  forcePin: boolean;
  assignments: Assignment[];
  activeQuiz?: any;
  quizResponses?: any[];
  activeAdaptive?: {
    id: string;
    title: string;
    status: 'active' | 'ended';
    createdAt: number;
    currentQuestion?: any;
    questionIndex: number;
    questionHistory: any[];
    responses: Map<string, { selectedOption: number; isCorrect: boolean }>;
    scores: Map<string, number>;
  } | null;
  aiHistory?: Map<string, any[]>;
  musicState?: MusicState;
}

export interface MusicState {
  currentTrack: string | null;
  isPlaying: boolean;
  startTime: number;
  duration?: number;
  poll: MusicPoll | null;
}

export interface MusicPoll {
  options: string[];
  votes: { [identity: string]: number };
  endTime: number;
}

export interface RoomInfo {
  id: string;
  name: string;
  hostName: string;
  locked: boolean;
  size: number;
  createdAt: number;
}
