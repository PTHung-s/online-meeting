import React, { useMemo } from 'react';
import {
  VideoTrack,
  useTracks,
  usePinnedTracks,
  useLayoutContext,
  useMaybeTrackRefContext,
  TrackLoop,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Pin, PinOff, History } from 'lucide-react';
import { useMeetingStore } from '../store/useMeetingStore';
import { socket } from '../services/socket';

interface ParticipantTileWithPinProps {
  trackRef?: any;
  pinnedTracks: any[];
  layoutContext: any;
  isHost: boolean;
  roomId: string;
  onShowHistory?: (socketId: string) => void;
}

const ParticipantTileWithPin = ({ trackRef, pinnedTracks, layoutContext, isHost, roomId, onShowHistory }: ParticipantTileWithPinProps) => {
  const trackFromContext = useMaybeTrackRefContext();
  const currentTrackRef = trackRef || trackFromContext;

  const isPinned = pinnedTracks.some(
    (t) => t?.participant?.sid === currentTrackRef?.participant?.sid && t?.source === currentTrackRef?.source
  );
  
  const p = currentTrackRef?.participant;
  const isCameraEnabled = p?.isCameraEnabled && currentTrackRef.source === Track.Source.Camera;
  const isScreenShare = currentTrackRef?.source === Track.Source.ScreenShare;
  
  const hostId = useMeetingStore(state => state.hostId);
  const peers = useMeetingStore(state => state.peers);
  const isParticipantHost = p?.identity === hostId;

  // Selective store access for performance
  const peer = useMemo(() => {
    if (!p?.identity) return undefined;
    const foundById = peers.find(peer => peer.socketId === p.identity);
    if (foundById) return foundById;
    return peers.find(peer => p.identity.includes(peer.socketId) || peer.socketId.includes(p.identity));
  }, [p?.identity, peers]);

  const rank = useMemo(() => {
    if (!peer || (peer.points || 0) <= 0) return null;
    const sorted = [...peers].sort((a, b) => (b.points || 0) - (a.points || 0));
    const index = sorted.findIndex(p => p.socketId === peer.socketId);
    if (index === 0) return { icon: '🥇', color: 'from-yellow-400 to-yellow-600' };
    if (index === 1) return { icon: '🥈', color: 'from-gray-300 to-gray-500' };
    if (index === 2) return { icon: '🥉', color: 'from-orange-400 to-orange-600' };
    return null;
  }, [peer, peers]);

  const handlePinAction = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!layoutContext?.pin?.dispatch) return;
    if (isPinned) {
      layoutContext.pin.dispatch({ msg: 'clear_pin' });
      if (isHost) socket.emit('room:pin-sync', { roomId, action: 'unpin' });
    } else {
      layoutContext.pin.dispatch({ msg: 'set_pin', trackReference: currentTrackRef });
      if (isHost && currentTrackRef?.participant?.identity) {
        socket.emit('room:pin-sync', { roomId, action: 'pin', participantIdentity: currentTrackRef.participant.identity, source: currentTrackRef.source });
      }
    }
  };

  const showProctoringOverlay = !isScreenShare && !isCameraEnabled && !isParticipantHost;

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden bg-[#121316] group border border-white/5 shadow-2xl transition-all duration-300">
      {currentTrackRef?.publication?.track ? (
        <VideoTrack 
          trackRef={currentTrackRef} 
          className={`w-full h-full object-cover ${p?.isLocal && currentTrackRef.source === Track.Source.Camera ? 'scale-x-[-1]' : ''}`} 
        />
      ) : (
        <div className="absolute inset-0 bg-[#0d0e10]" />
      )}

      {showProctoringOverlay && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#1a1b1e] to-[#0d0e10] z-[10] p-2 text-center overflow-hidden">
          {/* Top Indicators */}
          <div className="absolute top-1.5 inset-x-1.5 flex justify-between items-start pointer-events-none">
            {/* LP Badge */}
            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-yellow-500/10 border border-yellow-500/30 rounded-md backdrop-blur-md shadow-lg pointer-events-auto">
              <span className="text-[7px] sm:text-[9px] font-black text-yellow-500">LP</span>
              <span className="text-[9px] sm:text-xs font-black text-yellow-500">{peer?.points || 0}</span>
            </div>

            {/* Rank Medal */}
            {rank && (
              <div className={`flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-gradient-to-br ${rank.color} shadow-lg text-xs sm:text-base ring-1 ring-white/20 pointer-events-auto`}>
                {rank.icon}
              </div>
            )}
          </div>

          <div className="relative mb-1 sm:mb-2 shrink-0">
            <div className={`w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-sm sm:text-xl font-black border-2 shadow-2xl transition-all duration-500 ${
              peer?.isActive 
                ? 'bg-blue-600/10 text-blue-400 border-blue-500/30' 
                : 'bg-white/5 text-white/20 border-white/5'
            }`}>
              {(peer?.name || p?.name || p?.identity || "?").charAt(0).toUpperCase()}
            </div>
            <div 
              className={`absolute bottom-0 right-0 w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 rounded-full border-[1.5px] sm:border-2 border-[#121316] transition-all duration-500 ${
                peer?.isActive === true 
                  ? 'bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.6)]' 
                  : 'bg-gray-500'
              }`}
            />
          </div>

          <div className="space-y-1 w-full flex-1 flex flex-col justify-center min-h-0">
            <div className="shrink-0">
              <p className="text-white font-black text-[10px] sm:text-sm tracking-tight truncate px-1 sm:px-2">
                {peer?.name || p?.name || p?.identity?.split('_')[0]}
              </p>
            </div>

            <div className="flex justify-center flex-wrap gap-1 w-full px-1">
              <div className="bg-red-500/5 hover:bg-red-500/10 transition-colors border border-red-500/20 px-1 py-0.5 sm:px-2 sm:py-1 rounded-md flex flex-col items-center flex-1 min-w-[50px] max-w-[75px] group/stat pointer-events-auto" title="Số lần rời khỏi Tab">
                <span className="text-[5px] sm:text-[7px] uppercase tracking-wider text-red-400/60 font-black group-hover/stat:text-red-400 truncate w-full">Viol.</span>
                <span className="text-[10px] sm:text-sm text-red-500 font-black leading-none mt-0.5">{peer?.violations || 0}</span>
              </div>
              <div className="bg-amber-500/5 hover:bg-amber-500/10 transition-colors border border-amber-500/20 px-1 py-0.5 sm:px-2 sm:py-1 rounded-md flex flex-col items-center flex-1 min-w-[50px] max-w-[75px] group/stat pointer-events-auto" title="Số lần Paste nội dung từ bên ngoài (Cheating)">
                <span className="text-[5px] sm:text-[7px] uppercase tracking-wider text-amber-400/60 font-black group-hover/stat:text-amber-500 truncate w-full">Past.</span>
                <span className="text-[10px] sm:text-sm text-amber-500 font-black leading-none mt-0.5">{peer?.pasteCount || 0}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="absolute top-1.5 right-1.5 z-[30] opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        {isHost && !p?.isLocal && (
          <button
            onClick={() => onShowHistory?.(p?.identity || '')}
            className="p-1 rounded-lg bg-black/60 text-white hover:bg-purple-600 border border-white/10"
            title="Xem lịch sử vi phạm"
          >
            <History size={12} />
          </button>
        )}
        <button
          onClick={handlePinAction}
          className={`p-1 rounded-lg text-white border border-white/10 ${isPinned ? 'bg-blue-600' : 'bg-black/60 hover:bg-blue-500'}`}
          title={isPinned ? "Bỏ ghim" : "Ghim màn hình"}
        >
          {isPinned ? <PinOff size={12} /> : <Pin size={12} />}
        </button>
      </div>

      {/* Video Overlay Info */}
      {(isCameraEnabled || isScreenShare) && (
        <div className="absolute bottom-1.5 left-1.5 right-1.5 z-[20] flex justify-between items-end pointer-events-none">
          <div className="px-2 py-1 bg-black/40 backdrop-blur-xl rounded-lg text-[10px] text-white/95 border border-white/10 flex items-center gap-2 shadow-xl">
            <div className="flex items-center gap-1.5">
              <div 
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                  peer?.isActive === true ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.7)]' : 'bg-gray-500'
                }`} 
              />
              <span className="truncate max-w-[100px] font-bold tracking-tight">{peer?.name || p?.name || p?.identity.split('_')[0]}</span>
            </div>

            <div className="w-px h-2.5 bg-white/20" />

            <div className="flex items-center gap-0.5">
              <span className="text-[8px] font-black text-yellow-500/80">LP</span>
              <span className="font-black text-yellow-500">{peer?.points || 0}</span>
            </div>

            {isScreenShare && (
              <span className="ml-0.5 text-[8px] bg-red-500 px-1 py-0.5 rounded-md uppercase font-black tracking-wider text-white shadow-lg">Live</span>
            )}
          </div>

          {rank && (
            <div className={`flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br ${rank.color} shadow-lg text-xs ring-1 ring-white/20 mb-0.5`}>
              {rank.icon}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const GLOBAL_VIDEO_STYLES = `
  .custom-scrollbar::-webkit-scrollbar { width: 4px; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 4px; }

  video { transform: none !important; }
  .lk-participant-media-video[data-lk-local-participant="true"][data-lk-source="camera"] { transform: rotateY(180deg) !important; }
  [data-lk-source="screen_share"] video { transform: none !important; }

  .lk-participant-tile, .lk-video-container {
    aspect-ratio: auto !important; height: 100% !important; width: 100% !important;
  }

  .lk-grid-layout > * {
    position: relative !important;
  }

  video { object-fit: contain !important; background-color: #000; }
  [data-lk-source="screen_share"] video { object-fit: contain !important; }

  .lk-participant-tile .lk-participant-placeholder,
  .lk-participant-tile .lk-participant-metadata,
  .lk-participant-tile .lk-participant-name,
  .lk-participant-tile .lk-connection-quality,
  .lk-participant-tile .lk-focus-toggle,
  .lk-participant-tile .lk-participant-metadata-item,
  .lk-participant-tile .lk-audio-visualizer,
  .lk-participant-metadata,
  .lk-participant-placeholder {
    display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important;
  }

  .lk-grid-layout {
    background-color: transparent !important;
    gap: 0.75rem !important;
    padding: 0.75rem !important;
    height: 100% !important;
    width: 100% !important;
    border: none !important;
  }

  @media (min-width: 768px) {
    .lk-grid-layout {
      gap: 1.5rem !important;
      padding: 1.5rem !important;
    }
  }

  .lk-grid-layout > * {
    background: transparent !important;
    border: none !important;
  }

  /* Hide LiveKit default pagination and navigation if it somehow appears */
  .lk-pagination-control, .lk-pagination-indicator, .lk-grid-layout > button {
    display: none !important;
  }

  /* Flexible Grid for Participants */
  .flexible-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 160px), 1fr));
    grid-auto-rows: min-content;
    gap: 0.4rem;
    padding: 0.4rem;
    width: 100%;
    height: 100%;
    overflow-y: auto;
  }

  @media (min-width: 768px) {
    .flexible-grid {
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 0.5rem;
      padding: 0.5rem;
    }
  }

  /* Aspect ratio maintenance for grid items */
  .flexible-grid-item {
    aspect-ratio: 16 / 10;
    min-height: 120px;
    width: 100%;
    position: relative;
  }
`;

export const VideoLayout = ({ onShowHistory }: { onShowHistory?: (socketId: string) => void }) => {
  const isHost = useMeetingStore(state => state.isHost);
  const roomId = useMeetingStore(state => state.roomId);
  
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  const pinnedTracks = usePinnedTracks();
  const layoutContext = useLayoutContext();

  const otherTracks = useMemo(() => {
    if (pinnedTracks.length > 0 && pinnedTracks[0]) {
      return tracks.filter(t => 
        !(t.participant.sid === pinnedTracks[0].participant.sid && t.source === pinnedTracks[0].source)
      );
    }
    return tracks;
  }, [tracks, pinnedTracks]);

  return (
    <div className="relative flex-1 bg-[#0d0e10] h-full overflow-hidden">
      <style>{GLOBAL_VIDEO_STYLES}</style>
      
      <div className="h-full w-full">
        {pinnedTracks.length > 0 && pinnedTracks[0] ? (
          <div className="flex h-full w-full gap-6 p-6">
            <div className="flex-[3] relative rounded-[2rem] overflow-hidden bg-black shadow-2xl border border-white/5 group">
              <ParticipantTileWithPin 
                trackRef={pinnedTracks[0]} 
                pinnedTracks={pinnedTracks}
                layoutContext={layoutContext}
                isHost={isHost}
                roomId={roomId || ''}
                onShowHistory={onShowHistory}
              />
              {/* Pin control overlay omitted for brevity but should be kept in real code */}
              <div className="absolute top-6 right-6 z-[40] opacity-0 group-hover:opacity-100 transition-all duration-300">
                <button
                  onClick={() => {
                    if (layoutContext?.pin?.dispatch) {
                      layoutContext.pin.dispatch({ msg: 'clear_pin' });
                      if (isHost) socket.emit('room:pin-sync', { roomId, action: 'unpin' });
                    }
                  }}
                  className="px-4 py-2 rounded-2xl backdrop-blur-xl bg-white/10 text-white border border-white/20 hover:bg-red-500/80 hover:border-red-500 transition-all flex items-center gap-2.5 shadow-2xl"
                >
                  <PinOff size={18} />
                  <span className="text-xs font-black uppercase tracking-[0.1em]">Bỏ ghim</span>
                </button>
              </div>
            </div>

            <div className="flex-1 min-w-[240px] max-w-[300px] flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2">
               {otherTracks.map((t) => (
                 <div key={`${t.participant.sid}-${t.source}`} className="shrink-0 aspect-video rounded-2xl overflow-hidden shadow-lg border border-white/5">
                    <ParticipantTileWithPin trackRef={t} pinnedTracks={pinnedTracks} layoutContext={layoutContext} isHost={isHost} roomId={roomId || ''} onShowHistory={onShowHistory} />
                 </div>
               ))}
            </div>
          </div>
        ) : (
          <div className="flexible-grid custom-scrollbar">
            <TrackLoop tracks={tracks}>
              <div className="flexible-grid-item">
                <ParticipantTileWithPin 
                  pinnedTracks={pinnedTracks}
                  layoutContext={layoutContext}
                  isHost={isHost}
                  roomId={roomId || ''}
                  onShowHistory={onShowHistory}
                />
              </div>
            </TrackLoop>
          </div>
        )}
      </div>
    </div>
  );
};
