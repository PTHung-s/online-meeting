import React from 'react';
import { 
  Mic, MicOff, 
  Video, VideoOff, 
  ScreenShare, 
  PhoneOff, 
  MessageSquare, 
  Users,
  Info 
} from 'lucide-react';

interface ControlBarProps {
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  roomId: string | null;
  onToggleMic: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onLeave: () => void;
  onToggleChat: () => void;
  onToggleInfo: () => void;
}

const ControlBar: React.FC<ControlBarProps> = ({
  isMuted,
  isVideoOff,
  isScreenSharing,
  roomId,
  onToggleMic,
  onToggleVideo,
  onToggleScreenShare,
  onLeave,
  onToggleChat,
  onToggleInfo,
}) => {
  return (
    <div className="h-20 bg-[#202124] flex items-center justify-between px-6 z-10">
      <div className="flex items-center gap-4 text-sm font-medium">
        <button
          onClick={onLeave}
          className="p-3 bg-red-500 hover:bg-red-600 rounded-2xl text-white shadow-lg shadow-red-500/20 mr-2"
          title="Thoát cuộc họp"
        >
          <PhoneOff size={20} />
        </button>
        <span className="text-white">
          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 
        </span>
        <span className="text-gray-400">|</span>
        <span className="select-all cursor-pointer hover:bg-white/10 px-2 rounded transition-colors text-gray-300">{roomId}</span>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMic}
          className={`p-3 rounded-full ${isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-[#3c4043] hover:bg-[#4a4e51]'}`}
        >
          {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>
        <button
          onClick={onToggleVideo}
          className={`p-3 rounded-full ${isVideoOff ? 'bg-red-500 hover:bg-red-600' : 'bg-[#3c4043] hover:bg-[#4a4e51]'}`}
        >
          {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
        </button>
        <button
          onClick={onToggleScreenShare}
          className={`p-3 rounded-full ${isScreenSharing ? 'bg-green-600/20 text-green-500 hover:bg-green-600/30' : 'bg-[#3c4043] hover:bg-[#4a4e51]'}`}
        >
          <ScreenShare size={20} />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={onToggleInfo} className="p-3 hover:bg-[#3c4043] rounded-full">
          <Info size={20} />
        </button>
        <button onClick={onToggleChat} className="p-3 hover:bg-[#3c4043] rounded-full">
          <MessageSquare size={20} />
        </button>
        <button className="p-3 hover:bg-[#3c4043] rounded-full">
          <Users size={20} />
        </button>
      </div>
    </div>
  );
};

export default ControlBar;
