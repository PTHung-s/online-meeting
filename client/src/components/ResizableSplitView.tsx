import React, { useState, useRef, useEffect } from 'react';
import { GripVertical } from 'lucide-react';

interface ResizableSplitViewProps {
  leftPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  initialLeftWidth?: number;
  minWidth?: number;
  maxWidth?: number;
}

const ResizableSplitView: React.FC<ResizableSplitViewProps> = ({
  leftPanel,
  rightPanel,
  initialLeftWidth = 50,
  minWidth = 20,
  maxWidth = 80,
}) => {
  const [leftWidth, setLeftWidth] = useState(initialLeftWidth);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      
      // Clamp the width between min and max
      const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newLeftWidth));
      setLeftWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, minWidth, maxWidth]);

  return (
    <div
      ref={containerRef}
      className="flex h-screen w-screen overflow-hidden bg-[#202124]"
    >
      {/* Left Panel - Code Editor */}
      <div
        style={{ width: `${leftWidth}%` }}
        className="flex-shrink-0 overflow-hidden"
      >
        {leftPanel}
      </div>

      {/* Resizer Handle */}
      <div
        onMouseDown={handleMouseDown}
        className={`flex-shrink-0 w-1 bg-[#3c4043] hover:bg-blue-500 cursor-col-resize transition-colors relative group ${
          isResizing ? 'bg-blue-500' : ''
        }`}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-500 group-hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical size={16} />
        </div>
      </div>

      {/* Right Panel - Video Meeting */}
      <div
        style={{ width: `${100 - leftWidth}%` }}
        className="flex-shrink-0 overflow-hidden"
      >
        {rightPanel}
      </div>
    </div>
  );
};

export default ResizableSplitView;
