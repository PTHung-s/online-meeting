import React from 'react';
import { X, type LucideIcon } from 'lucide-react';

interface SidebarTemplateProps {
  title: string;
  icon: LucideIcon;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}

const SidebarTemplate: React.FC<SidebarTemplateProps> = ({ 
  title, 
  icon: Icon, 
  onClose, 
  children, 
  footer,
  width = "w-80" 
}) => {
  return (
    <div className={`fixed top-0 right-0 h-full ${width} bg-[#1a1b1e] text-white shadow-2xl z-[110] flex flex-col animate-in slide-in-from-right duration-300 border-l border-white/5`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/5 bg-[#1a1b1e]">
        <div className="flex items-center gap-2">
          <Icon size={20} className="text-blue-500" />
          <h2 className="text-sm font-bold uppercase tracking-widest">{title}</h2>
        </div>
        <button 
          onClick={onClose} 
          className="p-1.5 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition-all shadow-sm"
          title="Đóng"
        >
          <X size={20} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {children}
      </div>

      {/* Footer */}
      {footer && (
        <div className="p-4 bg-black/20 border-t border-white/5 mt-auto">
          {footer}
        </div>
      )}
    </div>
  );
};

export default SidebarTemplate;
