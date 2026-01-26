import React from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Eye, 
  FileText, 
  Image as ImageIcon,
  File as FileIcon,
  AlertCircle
} from 'lucide-react';
import { useMeetingStore } from '../store/useMeetingStore';
import { socket } from '../services/socket';

interface AssignmentManagerProps {
  visible: boolean;
  onClose: () => void;
  roomId: string;
}

const AssignmentManager: React.FC<AssignmentManagerProps> = ({ visible, onClose, roomId }) => {
  const { assignments, updateAssignments, removeAssignment, setCurrentAssignmentIndex, currentAssignmentIndex } = useMeetingStore();
  
  if (!visible) return null;

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const newAssignments = [...assignments];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= assignments.length) return;
    
    const [movedItem] = newAssignments.splice(index, 1);
    newAssignments.splice(targetIndex, 0, movedItem);
    
    updateAssignments(newAssignments);
    socket.emit('assignment:reorder', { roomId, assignments: newAssignments });
    
    if (currentAssignmentIndex === index) {
      setCurrentAssignmentIndex(targetIndex);
    } else if (currentAssignmentIndex === targetIndex) {
      setCurrentAssignmentIndex(index);
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa đề bài này?')) {
      socket.emit('assignment:delete', { roomId, assignmentId: id });
      removeAssignment(id);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isLt20M = file.size / 1024 / 1024 < 20;
        if (!isLt20M) {
            alert(`File ${file.name} vượt quá 20MB!`);
            continue;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const data = event.target?.result as string;
            const type = file.type.startsWith('image/') ? 'image' : 'pdf';
            const assignmentId = `asgn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            const newAssignment = {
                id: assignmentId,
                data,
                type: type as 'image' | 'pdf',
                name: file.name
            };

            socket.emit('assignment:add', { roomId, assignment: newAssignment });
        };
        reader.readAsDataURL(file);
    }
    // Clear the input
    e.target.value = '';
  };

  const getIcon = (type: string) => {
    if (type === 'pdf') return <FileText className="text-red-500" size={20} />;
    if (type === 'image') return <ImageIcon className="text-green-500" size={20} />;
    return <FileIcon className="text-blue-500" size={20} />;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#1a1b1e] border border-white/10 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/10 text-orange-500 rounded-xl">
              <FileIcon size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Quản lý đề bài</h3>
              <p className="text-gray-500 text-xs">Tải lên, sắp xếp hoặc xóa tài liệu học tập</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-full text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto bg-[#1e1e1e] space-y-4 custom-scrollbar">
          <div className="flex justify-between items-center mb-6">
             <label className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all cursor-pointer shadow-lg shadow-blue-600/20 active:scale-95 text-sm">
                <Plus size={18} />
                <span>Thêm đề bài mới</span>
                <input 
                    type="file" 
                    className="hidden" 
                    multiple 
                    accept="image/*,application/pdf"
                    onChange={handleUpload}
                />
             </label>
             <span className="text-xs text-gray-500 font-medium italic">Tối đa 20MB/file</span>
          </div>

          {assignments.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-gray-600 italic">
               <AlertCircle size={40} className="mb-2 opacity-20" />
               <p>Chưa có đề bài nào được tải lên</p>
            </div>
          ) : (
            <div className="space-y-2">
              {assignments.map((item, index) => (
                <div 
                  key={item.id} 
                  className={`group flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                    currentAssignmentIndex === index 
                    ? 'bg-blue-600/10 border-blue-500/30 ring-1 ring-blue-500/20' 
                    : 'bg-[#2d2d2d] border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="shrink-0">
                    {getIcon(item.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold truncate text-sm ${currentAssignmentIndex === index ? 'text-blue-400' : 'text-gray-200'}`}>
                      {item.name}
                    </p>
                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">
                      {item.type}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleMove(index, 'up')}
                      disabled={index === 0}
                      className="p-1.5 hover:bg-white/10 disabled:opacity-20 rounded-lg text-gray-400 hover:text-white transition-colors"
                      title="Chuyển lên"
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      onClick={() => handleMove(index, 'down')}
                      disabled={index === assignments.length - 1}
                      className="p-1.5 hover:bg-white/10 disabled:opacity-20 rounded-lg text-gray-400 hover:text-white transition-colors"
                      title="Chuyển xuống"
                    >
                      <ArrowDown size={16} />
                    </button>
                    <button
                      onClick={() => {
                        setCurrentAssignmentIndex(index);
                        socket.emit('assignment:page', { roomId, index });
                      }}
                      className={`p-1.5 rounded-lg transition-colors ${
                        currentAssignmentIndex === index 
                        ? 'bg-blue-600 text-white' 
                        : 'hover:bg-white/10 text-gray-400 hover:text-white'
                      }`}
                      title="Xem nội dung"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 hover:bg-red-500/10 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                      title="Xóa"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 bg-[#1a1b1e] text-right">
          <button 
            onClick={onClose}
            className="px-8 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold transition-all border border-white/5"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssignmentManager;
