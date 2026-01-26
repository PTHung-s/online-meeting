import React from 'react';
import { useMeetingStore } from '../store/useMeetingStore';
import { Bot } from 'lucide-react';

const CodeInput: React.FC = () => {
  const { stdin, setStdin, viewingPeerCode, isHost, attachToAi } = useMeetingStore();
  const isReadOnly = !!viewingPeerCode && !isHost;

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      <div className="px-4 py-2 bg-[#252526] border-b border-[#3c3c3c] flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400 font-medium">Input (stdin)</span>
          <button
            onClick={() => attachToAi(stdin, 'dữ liệu input (stdin)', 'input')}
            disabled={!stdin}
            className={`flex items-center gap-1.5 px-2 py-1 rounded transition-all ${
              stdin 
                ? 'bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 border border-blue-600/20' 
                : 'opacity-50 cursor-not-allowed'
            }`}
            title="Thảo luận về dữ liệu input với AI"
          >
            <Bot size={12} className="animate-bounce" />
            <span className="text-[10px] font-bold uppercase tracking-wider">AI</span>
          </button>
        </div>
        <button
          onClick={() => setStdin('')}
          className="text-xs text-gray-500 hover:text-gray-300 underline"
          title="Clear input"
        >
          Clear
        </button>
      </div>
      <div className="flex-1 p-2">
        <textarea
          value={stdin}
          onChange={(e) => {
            if (!isReadOnly) {
              setStdin(e.target.value);
            }
          }}
          disabled={isReadOnly}
          placeholder="Nhập input cho chương trình (ví dụ: 5 10). Các giá trị nhập vào stdin trong quá trình chạy sẽ được đọc từ đây."
          className="w-full h-full bg-[#1e1e1e] text-white text-sm p-3 rounded border border-[#3c3c3c] focus:outline-none focus:border-blue-500 resize-none font-mono custom-scrollbar"
        />
      </div>
    </div>
  );
};

export default CodeInput;
