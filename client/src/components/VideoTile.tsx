import React, { useEffect, useRef } from 'react';
import { MicOff } from 'lucide-react';

interface VideoTileProps {
  stream: MediaStream | null;
  name: string;
  isLocal?: boolean;
  isMuted?: boolean;
  isCameraOff?: boolean;
}

const VideoTile: React.FC<VideoTileProps> = ({ stream, name, isLocal, isMuted, isCameraOff }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      console.log(`Setting stream for ${name}:`, stream.id, "tracks:", stream.getTracks().length);
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().catch(e => console.warn("Auto-play blocked", e));
      };
    }
  }, [stream, name]);

  // Priority for camera off: explicit prop, then track check
  const showAvatar = isCameraOff || !stream || stream.getVideoTracks().length === 0 || !stream.getVideoTracks()[0].enabled;

  return (
    <div className="relative bg-[#3c4043] rounded-lg overflow-hidden aspect-video flex items-center justify-center border-2 border-transparent hover:border-blue-500 transition-all group shadow-lg">
      <video
        ref={videoRef}
        autoPlay
        muted={isLocal}
        playsInline
        className={`w-full h-full object-cover ${isLocal && !isCameraOff ? 'scale-x-[-1]' : ''} ${showAvatar ? 'hidden' : 'block'}`}
      />
      
      {showAvatar && (
        <div className="w-20 h-20 rounded-full bg-[#8ab4f8] flex items-center justify-center text-3xl font-bold text-[#202124] transition-all duration-300">
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      
      <div className="absolute bottom-3 left-3 bg-black/40 backdrop-blur-md px-3 py-1 rounded-md text-sm font-medium flex items-center gap-2">
        {isMuted && <MicOff size={14} className="text-red-500" />}
        <span className="truncate max-w-[120px]">{name} {isLocal && '(Bạn)'}</span>
      </div>
      
      {/* Speaking Indicator Shadow would go here */}
    </div>
  );
};

export default VideoTile;
