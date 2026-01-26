import React, { useState, useMemo, useEffect } from 'react';
import { useParticipants, useRoomContext, useLayoutContext, usePinnedTracks, useLocalParticipant } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useMeetingStore } from '../store/useMeetingStore';
import { History, Pin, PinOff, Check, Copy, Mic, MicOff, Video, VideoOff, Monitor, MonitorOff, Activity, X, Clock, Trash2 } from 'lucide-react';
import { socket } from '../services/socket';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend
} from 'recharts';

export const DigitalClock: React.FC = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-lg border border-white/5 font-mono text-xs font-bold text-gray-300">
      <Clock size={12} className="text-blue-400" />
      <span>{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
    </div>
  );
};

// --- Thêm Component Biểu đồ Hoạt động sử dụng Recharts ---
const ActivityChart: React.FC<{ stats: Array<{ timestamp: number; added: number; deleted: number }>, userName: string, onClose: () => void }> = ({ stats, userName, onClose }) => {
  const [timeRange, setTimeRange] = useState<number | 'full'>(30);

  const filteredData = useMemo(() => {
    let rawData = stats;
    if (timeRange !== 'full') {
      const cutoff = Date.now() - (timeRange as number) * 60 * 1000;
      rawData = stats.filter(s => s.timestamp >= cutoff);
    }
    
    return rawData.map(s => ({
      ...s,
      time: new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      "Gõ thêm": s.added,
      "Xóa đi": Math.abs(s.deleted) // Hiểu thị giá trị dương để vẽ cạnh nhau
    }));
  }, [stats, timeRange]);

  const ranges = [
    { label: '10p', value: 10 },
    { label: '20p', value: 20 },
    { label: '30p', value: 30 },
    { label: '60p', value: 60 },
    { label: '90p', value: 90 },
    { label: 'Tất cả', value: 'full' },
  ];

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      <div 
        className="bg-[#1a1b1e] border border-white/10 rounded-[2.5rem] w-full max-w-4xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-blue-500/5 to-transparent">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl">
                <Activity size={20} />
              </div>
              <div>
                <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Phân tích tương tác code</h3>
                <p className="text-gray-500 text-[9px] font-bold uppercase tracking-[0.2em]">Học viên: <span className="text-blue-400">{userName}</span></p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/10">
              {ranges.map((r) => (
                <button
                  key={r.label}
                  onClick={(e) => {
                    e.stopPropagation();
                    setTimeRange(r.value as any);
                  }}
                  className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${
                    timeRange === r.value 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                    : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <button onClick={onClose} className="p-2 hover:bg-red-500/10 rounded-xl text-gray-500 hover:text-red-500 transition-all active:scale-90">
              <X size={20} />
            </button>
          </div>
        </div>
        
        <div className="p-6 bg-[#141517]">
          {filteredData.length === 0 ? (
            <div className="h-[300px] flex flex-col items-center justify-center text-gray-700 gap-3">
              <div className="p-4 bg-white/5 rounded-full animate-pulse text-gray-600">
                <Clock size={32} />
              </div>
              <p className="font-bold italic text-xs">Không có dữ liệu trong {timeRange === 'full' ? 'toàn bộ thời gian' : `${timeRange} phút qua`}.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={filteredData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2d2d2d" vertical={false} />
                    <XAxis 
                      dataKey="time" 
                      stroke="#4a4a4a" 
                      fontSize={9} 
                      fontWeight="bold"
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      stroke="#4a4a4a" 
                      fontSize={9} 
                      fontWeight="bold"
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1a1b1e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '11px' }}
                      itemStyle={{ fontWeight: 'bold' }}
                      cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    />
                    <Legend 
                      verticalAlign="top" 
                      align="right" 
                      iconType="circle"
                      wrapperStyle={{ paddingBottom: '15px', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }}
                    />
                    <Bar 
                      dataKey="Gõ thêm" 
                      fill="#22c55e" 
                      radius={[3, 3, 0, 0]} 
                      barSize={15}
                      animationDuration={800}
                    />
                    <Bar 
                      dataKey="Xóa đi" 
                      fill="#ef4444" 
                      radius={[3, 3, 0, 0]} 
                      barSize={15}
                      animationDuration={800}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex items-center gap-3">
                  <div className="p-3 bg-green-500/10 rounded-xl text-green-500">
                    <Activity size={18} />
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block mb-0.5">Thêm mới</span>
                    <span className="text-xl font-black text-green-400">{filteredData.reduce((acc, s) => acc + s.added, 0)}</span>
                  </div>
                </div>
                
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex items-center gap-3">
                  <div className="p-3 bg-red-500/10 rounded-xl text-red-500">
                    <Trash2 size={18} />
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest block mb-0.5">Đã xóa</span>
                    <span className="text-xl font-black text-red-400">{filteredData.reduce((acc, s) => acc + Math.abs(s.deleted), 0)}</span>
                  </div>
                </div>

                <div className="bg-blue-600/10 p-4 rounded-2xl border border-blue-500/20 flex items-center gap-3">
                  <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500">
                    <Monitor size={18} />
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest block mb-0.5">Cường độ PB</span>
                    <span className="text-xl font-black text-white">
                      {filteredData.length > 0 
                        ? Math.round(filteredData.reduce((acc, s) => acc + s.added + Math.abs(s.deleted), 0) / filteredData.length)
                        : 0
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-[#1a1b1e] border-t border-white/5 text-center flex items-center justify-center gap-2">
           <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse"></div>
           <p className="text-gray-600 text-[8px] font-black uppercase tracking-[0.3em]">Hệ thống phân tích thời gian thực • Cập nhật mỗi 60 giây</p>
        </div>
      </div>
    </div>
  );
};


export const MediaControls: React.FC = () => {
  const { isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled, localParticipant } = useLocalParticipant();
  const { setMicEnabled, setCameraEnabled } = useMeetingStore();

  const toggleMic = async () => {
    const enabled = !isMicrophoneEnabled;
    await localParticipant.setMicrophoneEnabled(enabled);
    setMicEnabled(enabled);
    
    // Notify others via socket
    const roomId = useMeetingStore.getState().roomId;
    if (roomId) {
      socket.emit('peer:update-state', { roomId, state: { isMuted: !enabled } });
    }
  };

  const toggleCamera = async () => {
    const enabled = !isCameraEnabled;
    await localParticipant.setCameraEnabled(enabled);
    setCameraEnabled(enabled);
    
    // Notify others via socket
    const roomId = useMeetingStore.getState().roomId;
    if (roomId) {
      socket.emit('peer:update-state', { roomId, state: { isCameraOff: !enabled } });
    }
  };

  const toggleScreenShare = async () => {
    const enabled = !isScreenShareEnabled;
    await localParticipant.setScreenShareEnabled(enabled);
  };

  return (
    <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/5">
      <button
        onClick={toggleMic}
        className={`p-2 rounded-lg transition-all ${isMicrophoneEnabled ? 'text-gray-400 hover:bg-white/10 hover:text-white' : 'bg-red-500 text-white'}`}
        title={isMicrophoneEnabled ? "Tắt Mic" : "Bật Mic"}
      >
        {isMicrophoneEnabled ? <Mic size={18} /> : <MicOff size={18} />}
      </button>
      <button
        onClick={toggleCamera}
        className={`p-2 rounded-lg transition-all ${isCameraEnabled ? 'text-gray-400 hover:bg-white/10 hover:text-white' : 'bg-red-500 text-white'}`}
        title={isCameraEnabled ? "Tắt Camera" : "Bật Camera"}
      >
        {isCameraEnabled ? <Video size={18} /> : <VideoOff size={18} />}
      </button>
      <button
        onClick={toggleScreenShare}
        className={`p-2 rounded-lg transition-all ${isScreenShareEnabled ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-white/10 hover:text-white'}`}
        title={isScreenShareEnabled ? "Dừng chia sẻ" : "Chia sẻ màn hình"}
      >
        {isScreenShareEnabled ? <MonitorOff size={18} /> : <Monitor size={18} />}
      </button>
    </div>
  );
};

export const RoomStats = () => {
  const participants = useParticipants();
  const room = useRoomContext();
  
  const StatRow = ({ label, value, colorClass = "text-white" }: { label: string, value: string | number, colorClass?: string }) => (
    <div className="flex justify-between items-center py-2 border-b border-white/5">
      <span className="text-gray-500 font-medium">{label}:</span>
      <span className={`font-mono font-bold ${colorClass}`}>{value}</span>
    </div>
  );

  return (
    <div className="p-4 space-y-1 bg-[#1a1b1e]">
      <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-4 border-b border-blue-500/20 pb-2">
        LiveKit Session Node
      </div>
      <StatRow label="Room ID" value={room.name} />
      <StatRow label="Local User" value={room.localParticipant.identity.split('_')[0]} colorClass="text-green-400" />
      <StatRow label="Participants" value={participants.length} />
      <StatRow label="State" value={room.state} colorClass="text-blue-400 uppercase" />
      <StatRow label="Latency" value="24ms" colorClass="text-gray-400" />
    </div>
  );
};

export const UserList: React.FC<{ onShowHistory: (socketId: string) => void }> = ({ onShowHistory }) => {
  const participants = useParticipants();
  const layoutContext = useLayoutContext();
  const pinnedTracks = usePinnedTracks();
  const isHost = useMeetingStore(state => state.isHost);
  const roomId = useMeetingStore(state => state.roomId);
  const peers = useMeetingStore(state => state.peers);
  
  const [selectedActivityPeer, setSelectedActivityPeer] = useState<{ stats: any[], name: string } | null>(null);

  // Tính toán thứ hạng dựa trên điểm số
  const sortedPeers = [...peers].sort((a, b) => (b.points || 0) - (a.points || 0));
  const getRank = (socketId: string) => {
    const peer = peers.find(p => p.socketId === socketId);
    if (!peer || (peer.points || 0) <= 0) return null;
    const index = sortedPeers.findIndex(p => p.socketId === socketId);
    if (index === 0) return { icon: '🥇', label: 'Top 1', color: 'text-yellow-400' };
    if (index === 1) return { icon: '🥈', label: 'Top 2', color: 'text-gray-300' };
    if (index === 2) return { icon: '🥉', label: 'Top 3', color: 'text-orange-400' };
    return null;
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#1a1b1e] h-full custom-scrollbar">
      {selectedActivityPeer && (
        <ActivityChart 
          stats={selectedActivityPeer.stats} 
          userName={selectedActivityPeer.name} 
          onClose={() => setSelectedActivityPeer(null)} 
        />
      )}
      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 border-b border-white/5 pb-2">
        Đang trực tuyến ({participants.length})
      </div>
      {participants.map((p) => {
        const cameraPub = p.getTrackPublication(Track.Source.Camera);
        const isPinned = pinnedTracks.some(
          (t) => t?.participant?.sid === p.sid && t?.source === Track.Source.Camera
        );
        const peer = peers.find(peer => peer.socketId === p.identity || peer.socketId === p.sid || (p.identity && peer.socketId.includes(p.identity)));
        const displayName = peer?.name || p.name || p.identity.split('_')[0];
        const rank = getRank(peer?.socketId || '');

        return (
          <div key={p.sid} className="flex items-center justify-between group p-2 hover:bg-white/5 rounded-xl transition-colors">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm ${
                  p.isLocal ? 'bg-blue-600' : 'bg-gray-600'
                }`}>
                  {displayName.charAt(0).toUpperCase()}
                </div>
                
                {rank && (
                  <div className="absolute -bottom-1 -right-1 text-[14px]">
                    {rank.icon}
                  </div>
                )}
                
                {peer?.violations && peer.violations > 0 && (
                  <div className="absolute -top-1 -right-1 bg-red-600 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-[#1a1b1e] shadow-sm" title={`Số lần vi phạm: ${peer.violations}`}>
                    {peer.violations}
                  </div>
                )}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-gray-200 text-sm flex items-center gap-1">
                    {displayName}
                  </span>
                  {p.isLocal && <span className="text-[8px] bg-blue-900/30 text-blue-400 px-1 rounded uppercase">You</span>}
                  {peer?.points !== undefined && peer.points !== 0 && (
                    <span className={`text-[10px] font-black ${peer.points > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {peer.points > 0 ? `+${peer.points}` : peer.points} LP
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-gray-500 italic">
                  {peer?.isActive === true ? (
                    <span className="text-green-500 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Active
                    </span>
                  ) : (
                    <span className="text-gray-500 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-500"></span> Away
                    </span>
                  )}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {isHost && !p.isLocal && (
                <>
                  <button 
                    onClick={() => setSelectedActivityPeer({ stats: peer?.activityStats || [], name: displayName })} 
                    className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                    title="Xem thống kê gõ phím"
                  >
                    <Activity size={14} />
                  </button>
                  {peer?.violationHistory && peer.violationHistory.length > 0 && (
                    <button onClick={() => onShowHistory(peer.socketId)} className="p-2 text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors" title="Xem lịch sử vi phạm">
                      <History size={14} />
                    </button>
                  )}
                </>
              )}
              <button
                onClick={() => {
                  if (!layoutContext?.pin?.dispatch) return;
                  if (isPinned) {
                    layoutContext.pin.dispatch({ msg: 'clear_pin' });
                    if (isHost) socket.emit('room:pin-sync', { roomId, action: 'unpin' });
                  } else {
                    const trackRef = { participant: p, source: Track.Source.Camera, publication: cameraPub };
                    layoutContext.pin.dispatch({ msg: 'set_pin', trackReference: trackRef });
                    if (isHost) socket.emit('room:pin-sync', { roomId, action: 'pin', participantIdentity: p.identity, source: Track.Source.Camera });
                  }
                }}
                className={`p-1.5 rounded-lg ${isPinned ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-500 hover:text-white'}`}
              >
                {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const RoomInfo: React.FC<{ roomId: string, roomName: string, handleCopyLink: () => void, copied: boolean }> = ({ roomId, roomName, handleCopyLink, copied }) => {
  return (
    <div className="p-6 space-y-8 bg-[#1a1b1e] h-full overflow-y-auto text-gray-200 custom-scrollbar">
      <div className="bg-blue-900/10 p-5 rounded-3xl border border-blue-500/20">
        <h4 className="text-[10px] font-bold text-blue-400 uppercase mb-3 tracking-widest">Mã Cuộc Họp</h4>
        <p className="text-gray-500 text-xs mb-4 italic">Sử dụng mã này để mời người khác tham gia vào không gian học tập này.</p>
        <div className="flex items-center justify-between bg-[#2d2d2d] p-4 rounded-2xl border border-white/5 shadow-sm">
          <span className="font-mono font-bold text-blue-400 text-lg tracking-tighter">{roomId}</span>
          <button onClick={handleCopyLink} className="p-2.5 hover:bg-blue-900/30 text-blue-400 rounded-xl transition-all active:scale-90">
            {copied ? <Check size={20} /> : <Copy size={20} />}
          </button>
        </div>
      </div>
      <div>
        <h4 className="text-[10px] font-bold text-gray-500 uppercase mb-2 tracking-widest">Tiêu Đề</h4>
        <p className="text-2xl font-black text-white leading-tight">{roomName || 'Đang diễn ra...'}</p>
      </div>
    </div>
  );
};
