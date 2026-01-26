import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useMeetingStore } from '../store/useMeetingStore';
import { FileText, Download, ChevronLeft, ChevronRight, Trash2, ZoomIn, ZoomOut, Maximize2, Minimize2, Bot } from 'lucide-react';
import { socket } from '../services/socket';

export const AssignmentView: React.FC = () => {
  const { 
    assignments, 
    currentAssignmentIndex, 
    setCurrentAssignmentIndex,
    removeAssignment,
    isHost,
    roomId,
    attachToAi
  } = useMeetingStore();
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.2, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.2, 0.5));
  const handleResetZoom = () => setZoom(1);

  // Track container width for responsive paging
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      setContainerWidth(entries[0].contentRect.width);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const assignment = assignments[currentAssignmentIndex];

  const pdfUrl = useMemo(() => {
    if (assignment?.type === 'pdf' && assignment.data.startsWith('data:application/pdf;base64,')) {
      try {
        const base64Data = assignment.data.split(',')[1];
        const binaryString = window.atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/pdf' });
        return URL.createObjectURL(blob);
      } catch (e) {
        console.error('Error creating PDF blob:', e);
        return assignment.data;
      }
    }
    return assignment?.data;
  }, [assignment]);

  useEffect(() => {
    return () => {
      if (pdfUrl && pdfUrl.startsWith('blob:')) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Bạn có chắc chắn muốn xóa đề bài này?')) {
      socket.emit('assignment:delete', { roomId, assignmentId: id });
      removeAssignment(id);
    }
  };

  const handlePageChange = (index: number) => {
    setCurrentAssignmentIndex(index);
    if (isHost) {
      socket.emit('assignment:page', { roomId, index });
    }
  };

  // Pagination Logic
  const renderPagination = () => {
    if (assignments.length <= 1) return null;

    const total = assignments.length;
    // Càng rộng thì càng hiện nhiều số
    const maxVisibleParams = containerWidth > 500 ? 7 : containerWidth > 350 ? 5 : 3;
    
    const pages: (number | string)[] = [];
    
    if (total <= maxVisibleParams) {
      for (let i = 0; i < total; i++) pages.push(i);
    } else {
      // Logic with ellipsis
      pages.push(0);
      
      let start = Math.max(1, currentAssignmentIndex - Math.floor((maxVisibleParams - 3) / 2));
      let end = Math.min(total - 2, start + (maxVisibleParams - 3));
      
      if (end === total - 2) {
        start = Math.max(1, end - (maxVisibleParams - 4));
      }

      if (start > 1) pages.push('...');
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < total - 2) pages.push('...');
      
      pages.push(total - 1);
    }

    return (
      <div className="flex items-center gap-1 bg-[#25262b] p-1 rounded-lg border border-white/5 mx-auto">
        <button
          onClick={() => handlePageChange(Math.max(0, currentAssignmentIndex - 1))}
          disabled={currentAssignmentIndex === 0}
          className="p-1.5 hover:bg-white/5 disabled:opacity-30 rounded-md transition-colors"
        >
          <ChevronLeft size={14} />
        </button>
        
        <div className="flex items-center gap-1">
          {pages.map((p, idx) => (
            typeof p === 'number' ? (
              <button
                key={idx}
                onClick={() => handlePageChange(p)}
                className={`w-7 h-7 flex items-center justify-center rounded-md text-xs font-bold transition-all ${
                  currentAssignmentIndex === p 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                {p + 1}
              </button>
            ) : (
              <span key={idx} className="w-5 text-center text-gray-600 text-[10px]">...</span>
            )
          ))}
        </div>

        <button
          onClick={() => handlePageChange(Math.min(total - 1, currentAssignmentIndex + 1))}
          disabled={currentAssignmentIndex === total - 1}
          className="p-1.5 hover:bg-white/5 disabled:opacity-30 rounded-md transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    );
  };

  if (assignments.length === 0) {
    return (
      <div ref={containerRef} className="flex flex-col items-center justify-center h-full bg-[#1a1b1e] text-gray-500 p-8 text-center">
        <div className="w-16 h-16 bg-gray-800/50 rounded-full flex items-center justify-center mb-4">
          <FileText size={32} />
        </div>
        <p className="font-bold text-lg text-gray-400">Chưa có đề bài</p>
        <p className="text-sm">Host chưa tải lên đề bài cho buổi học này.</p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className={`flex flex-col h-full bg-[#1a1b1e] text-white transition-all ${
        isFullscreen ? 'fixed inset-0 z-[400] p-4 bg-black/80 backdrop-blur-md' : ''
      }`}
    >
      <div className={`flex flex-col h-full bg-[#1a1b1e] rounded-[1.5rem] overflow-hidden ${isFullscreen ? 'shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10' : ''}`}>
        {/* Paging Bar */}
        <div className="flex-none px-4 py-2 border-b border-white/5 bg-[#1e1f23] flex items-center gap-4">
          {renderPagination()}
        </div>

        <div className="flex-none px-4 py-3 bg-[#1a1b1e] border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <FileText size={18} className="text-orange-400 shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">Đang xem ({currentAssignmentIndex + 1}/{assignments.length})</span>
              <span className="text-xs font-bold text-white truncate max-w-[200px] md:max-w-[400px]">{assignment.name}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <div className="flex items-center bg-white/5 p-0.5 rounded-lg border border-white/5 mr-1">
              <button
                onClick={handleZoomOut}
                className="p-1.5 hover:bg-white/10 rounded-md text-gray-400 hover:text-white transition-all active:scale-95"
                title="Thu nhỏ"
              >
                <ZoomOut size={14} />
              </button>
              <button
                onClick={handleResetZoom}
                className="px-2 py-1 hover:bg-white/10 rounded-md text-[10px] font-bold text-gray-400 hover:text-white transition-all min-w-[42px]"
                title="Đặt lại zoom"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                onClick={handleZoomIn}
                className="p-1.5 hover:bg-white/10 rounded-md text-gray-400 hover:text-white transition-all active:scale-95"
                title="Phóng to"
              >
                <ZoomIn size={14} />
              </button>
            </div>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={`p-2 rounded-lg transition-all ${isFullscreen ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
              title={isFullscreen ? "Đóng phóng to" : "Phóng to toàn tab"}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            {isHost && (
              <button
                onClick={(e) => handleDelete(e, assignment.id)}
                className="p-2 hover:bg-red-500/10 rounded-lg text-gray-400 hover:text-red-400 transition-all"
                title="Xóa đề bài này"
              >
                <Trash2 size={16} />
              </button>
            )}
            <button
                onClick={() => {
                  const match = assignment.data.match(/^data:([^;]+);base64,(.+)$/);
                  const mimeType = match ? match[1] : undefined;
                  const fileData = match ? match[2] : undefined;
                  attachToAi(
                    `Tôi đang làm đề bài: ${assignment.name}. Hãy hỗ trợ tôi các kiến thức liên quan hoặc gợi ý hướng giải quyết cho đề bài này.`, 
                    `đề bài ${assignment.name}`, 
                    'assignment',
                    fileData,
                    mimeType
                  );
                }}
                className="flex items-center gap-2 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-600/30 px-3 py-1.5 rounded transition-all text-sm group"
                title="Hỏi AI về đề bài này"
              >
                <Bot size={14} className="group-hover:animate-bounce" />
                <span className="hidden sm:inline font-bold">AI</span>
            </button>
            <a 
              href={pdfUrl} 
              download={assignment.name}
              className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-all shadow-sm"
              title="Tải xuống đề bài"
            >
              <Download size={16} />
            </a>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto p-4 custom-scrollbar bg-[#0f0f11] flex flex-col items-center">
          <div 
            className="transition-all duration-300 ease-out py-4"
            style={{ 
              // Dùng chiều ngang dựa trên % zoom để PDF tự reflow
              width: `${Math.max(100, zoom * 100)}%`,
              maxWidth: zoom <= 1 ? (isFullscreen ? '1400px' : '1000px') : 'none',
              // PDF cần một chiều cao cố định đủ lớn để hiển thị, và chiều cao này cũng phải nhân với zoom
              minHeight: assignment.type === 'pdf' 
                ? (isFullscreen ? `calc((100vh - 200px) * ${zoom})` : `${800 * zoom}px`)
                : 'auto'
            }}
          >
            {assignment.type === 'image' ? (
              <div className="flex justify-center">
                <img 
                  src={assignment.data} 
                  alt="Assignment" 
                  className="rounded-xl shadow-2xl border border-white/10 transition-all duration-300 object-contain" 
                  style={{ 
                    width: '100%',
                    height: 'auto'
                  }}
                />
              </div>
            ) : (
              <div 
                className="rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-white sticky top-4"
                style={{ 
                  height: isFullscreen ? `calc(100vh - 200px)` : '800px',
                  width: '100%',
                  // Khi zoom PDF, ta tăng kích thước của chính Iframe để PDF viewer bên trong tự thích nghi
                  transform: zoom > 1 ? `scale(${zoom})` : 'none',
                  transformOrigin: 'top center',
                  marginBottom: zoom > 1 ? `${(zoom - 1) * 100}%` : '0'
                }}
              >
                <iframe 
                  src={`${pdfUrl}#toolbar=0&view=FitH`} 
                  title="PDF Assignment"
                  className="w-full h-full border-none"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 4px; }
      `}</style>
    </div>
  );
};
