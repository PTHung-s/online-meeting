export interface Peer {
  socketId: string;
  name: string;
  stream?: MediaStream;
  isMuted?: boolean;
  isCameraOff?: boolean;
  code?: string;
  language?: { name: string; version: string };
  violations?: number;
  copyCount?: number;
  pasteCount?: number;
  points?: number;
  isActive?: boolean;
  violationHistory?: Array<{ type: string; reason: string; timestamp: number }>;
  activityStats?: Array<{ timestamp: number; added: number; deleted: number }>;
}

export interface Message {
  senderId: string;
  senderName: string;
  text: string;
  time: number;
}

export interface RoomInfo {
  id: string;
  name: string;
  locked: boolean;
  size: number;
  createdAt: number;
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
