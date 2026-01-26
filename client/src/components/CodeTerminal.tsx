import React, { useEffect, useRef, useState } from 'react';
import { Terminal, Trash2, Copy, Check, Bot } from 'lucide-react';
import { useMeetingStore } from '../store/useMeetingStore';

const CodeTerminal: React.FC = () => {
  const { output, isRunning, setOutput, attachToAi } = useMeetingStore();
  const terminalRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  // Auto-scroll to bottom when output changes
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTo({
        top: terminalRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [output]);

  const handleClear = () => {
    setOutput('');
  };

  const handleCopy = () => {
    if (!output) return;
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-[#1e1e1e] border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 mr-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]"></div>
          </div>
          <Terminal size={14} className="text-gray-400" />
          <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">Output Terminal</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => attachToAi(output, 'kết quả output terminal', 'terminal')}
            disabled={!output}
            className={`flex items-center gap-1.5 px-2 py-1 rounded transition-all mr-1 ${
              output 
                ? 'bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 border border-blue-600/20' 
                : 'opacity-50 cursor-not-allowed'
            }`}
            title="Giải thích lỗi/output với AI"
          >
            <Bot size={12} className="animate-bounce" />
            <span className="text-[10px] font-bold uppercase tracking-wider">AI</span>
          </button>
          <button
            onClick={handleCopy}
            disabled={!output}
            className={`p-1.5 rounded transition-all ${
              output 
                ? 'text-gray-500 hover:text-white hover:bg-white/5' 
                : 'text-gray-700 cursor-not-allowed'
            }`}
            title="Copy output"
          >
            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
          </button>
          <button
            onClick={handleClear}
            className="p-1.5 text-gray-500 hover:text-white hover:bg-white/5 rounded transition-all"
            title="Clear terminal"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Terminal Output */}
      <div
        ref={terminalRef}
        className="flex-1 overflow-y-auto p-4 font-mono text-[13px] scroll-smooth custom-scrollbar"
      >
        {output ? (
          <div className="relative">
             <div className="absolute left-[-16px] top-0 bottom-0 w-[2px] bg-blue-500/20 rounded-full"></div>
             <pre
                className={`whitespace-pre-wrap break-words leading-relaxed ${
                output.includes('Error') || output.includes('error') || output.includes('Exit Code:')
                    ? 'text-red-400'
                    : 'text-green-400'
                }`}
            >
                {output}
            </pre>
          </div>
        ) : (
          <div className="text-gray-600 flex flex-col items-center justify-center h-full opacity-40">
             <Terminal size={32} className="mb-2" />
             <p className="text-xs font-bold uppercase tracking-widest">
                {isRunning ? 'Program is execution...' : 'Ready for execution'}
             </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CodeTerminal;
