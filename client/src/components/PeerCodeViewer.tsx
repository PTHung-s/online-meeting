import React from "react";
import { useMeetingStore } from "../store/useMeetingStore";
import { Eye, Users } from "lucide-react";
import { socket } from "../services/socket";
import SidebarTemplate from "./SidebarTemplate";
import { useParticipants } from "@livekit/components-react";

interface PeerCodeViewerProps {
  onClose: () => void;
}

const PeerCodeViewer: React.FC<PeerCodeViewerProps> = ({ onClose }) => {
  const participants = useParticipants();
  const { 
    peers, 
    isHost, 
    peerCodes, 
    viewingPeerCode, 
    setViewingPeerCode, 
    roomId, 
    isCodeEditorOpen,
    toggleCodeEditor
  } = useMeetingStore();

  if (!isHost) return null;

  // Filter to get only remote participants (students)
  const students = participants.filter(p => !p.isLocal);

  const handleViewPeerCode = (socketId: string) => {
    if (!peerCodes.has(socketId)) {
      socket.emit("code:request", { roomId, targetSocketId: socketId });
    }
    setViewingPeerCode(socketId);
    if (!isCodeEditorOpen) toggleCodeEditor();
  };

  return (
    <SidebarTemplate
      title="Học viên đang code"
      icon={Users}
      onClose={onClose}
      footer={
        <p className="text-[10px] text-blue-400 italic">
          * Nhấn vào học viên để hỗ trợ sửa code trực tiếp.
        </p>
      }
    >
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {students.length === 0 ? (
          <div className="text-center py-8 text-gray-500 font-medium italic">
            <p>Chưa có học viên nào đang tham gia</p>
          </div>
        ) : (
          students.map((p) => {
            const peer = peers.find(peer => 
              peer.socketId === p.identity || 
              peer.socketId === p.sid || 
              (p.identity && peer.socketId.includes(p.identity))
            );
            
            const displayName = peer?.name || p.name || p.identity.split('_')[0];
            const socketId = peer?.socketId || p.identity;

            return (
              <div
                key={p.sid}
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  viewingPeerCode === socketId 
                  ? "border-green-500 bg-green-500/10" 
                  : "border-white/5 bg-white/5 hover:border-blue-500/50 hover:bg-white/10"
                } ${peer?.isActive === false ? 'opacity-60' : ''}`}
                onClick={() => handleViewPeerCode(socketId)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-lg">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-xs text-white truncate">{displayName}</h3>
                      {peer?.isActive === false && (
                        <span className="text-[8px] bg-red-500/20 text-red-500 px-1.5 py-0.5 rounded uppercase font-bold tracking-tighter">
                          Khỏi tab
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[10px]">
                      {peerCodes.has(socketId) ? (
                        <span className="text-green-400 flex items-center gap-1 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> Sẵn sàng
                        </span>
                      ) : (
                        <span className="text-gray-500">Đang chờ...</span>
                      )}
                    </div>
                  </div>
                  {viewingPeerCode === socketId && <div className="text-green-400"><Eye size={16} /></div>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </SidebarTemplate>
  );
};

export default PeerCodeViewer;