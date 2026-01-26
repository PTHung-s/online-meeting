import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, User, Loader2, Sparkles, Trash2, X, FileText, Terminal, Code2, Database } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { useMeetingStore } from '../store/useMeetingStore';
import type { AiMessage } from '../types/ai';

const AIAssistant: React.FC = () => {
  const { 
    roomId,
    userName,
    aiMessages, 
    addAiMessage, 
    clearAiMessages, 
    aiInput, 
    setAiInput, 
    aiAttachments, 
    removeAiAttachment,
    clearAiAttachments
  } = useMeetingStore();
  
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Tự động cuộn xuống khi có tin nhắn mới
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [aiMessages, isLoading]);

  const handleSend = async () => {
    if ((!aiInput.trim() && aiAttachments.length === 0) || isLoading) return;

    let finalPrompt = aiInput.trim();
    
    // Nếu có attachment, xây dựng prompt bao gồm nội dung context
    if (aiAttachments.length > 0) {
      const contextString = aiAttachments.map(a => 
        `[NGỮ CẢNH: ${a.label.toUpperCase()}]\n\`\`\`\n${a.content}\n\`\`\``
      ).join('\n\n');
      
      finalPrompt = `${contextString}\n\n[CÂU HỎI CỦA TÔI]:\n${finalPrompt || 'Hãy phân tích các thông tin trên giúp tôi.'}`;
    }

    const displayMsg = aiInput.trim() || `Phân tích ${aiAttachments.length} đối tượng đã đính kèm`;
    
    // Lưu lại attachments để hiển thị trong UI lịch sử
    const currentAttachments = [...aiAttachments];
    
    setAiInput('');
    clearAiAttachments();
    
    // Thêm tin nhắn của user vào history kèm theo thông tin attachments
    const newUserMsg: AiMessage = { 
      role: 'user', 
      parts: [{ text: displayMsg }],
      attachments: currentAttachments 
    };
    addAiMessage(newUserMsg);
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: finalPrompt,
          history: aiMessages.slice(-10),
          attachments: currentAttachments,
          roomId,
          userName,
        }),
      });

      const data = await response.json();
      
      if (data.reply) {
        addAiMessage({ role: 'model', parts: [{ text: data.reply }] });
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error) {
      console.error('AI Assistant Error:', error);
      addAiMessage({ role: 'model', parts: [{ text: 'Xin lỗi, tôi gặp lỗi khi xử lý yêu cầu của bạn. Vui lòng thử lại sau.' }] });
    } finally {
      setIsLoading(false);
    }
  };

  const getAttachmentIcon = (type: string) => {
    switch (type) {
      case 'code': return <Code2 size={12} />;
      case 'assignment': return <FileText size={12} />;
      case 'terminal': return <Terminal size={12} />;
      case 'input': return <Database size={12} />;
      default: return <FileText size={12} />;
    }
  };

  const clearChat = () => {
    if (confirm('Bạn có chắc muốn xóa lịch sử trò chuyện với AI?')) {
      clearAiMessages();
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1a1b1e]">
      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar"
      >
        {aiMessages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
            <div className="w-16 h-16 bg-blue-600/10 rounded-3xl flex items-center justify-center text-blue-500 animate-pulse">
              <Bot size={32} />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg mb-1">Trợ lý AI Pro</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                Tôi sử dụng Gemini 1.5 Flash để hỗ trợ bạn giải thích code, tìm lỗi và gợi ý ý tưởng lập trình.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 w-full max-w-xs">
              {['Giải thích đoạn code này', 'Tìm lỗi logic giúp tôi', 'Gợi ý thuật toán tối ưu'].map((hint) => (
                <button
                  key={hint}
                  onClick={() => setAiInput(hint)}
                  className="text-left px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-xs text-gray-400 transition-all"
                >
                  "{hint}"
                </button>
              ))}
            </div>
          </div>
        )}

        {aiMessages.map((msg) => (
          <div 
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              msg.role === 'user' ? 'bg-purple-600' : 'bg-blue-600'
            }`}>
              {msg.role === 'user' ? <User size={16} className="text-white" /> : <Bot size={16} className="text-white" />}
            </div>
            <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed markdown-content ${
              msg.role === 'user' 
              ? 'bg-purple-600/10 text-purple-100 border border-purple-600/20' 
              : 'bg-white/5 text-gray-200 border border-white/10'
            }`}>
              {/* Hiển thị attachments nếu có trong tin nhắn của user */}
              {msg.role === 'user' && msg.attachments && msg.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3 pb-3 border-b border-purple-600/20">
                  {msg.attachments.map((att) => (
                    <div 
                      key={att.id}
                      className="flex items-center gap-1.5 px-2 py-1 bg-purple-600/20 border border-purple-600/30 rounded text-[10px] text-purple-300"
                    >
                      {getAttachmentIcon(att.type)}
                      <span className="max-w-[100px] truncate font-medium">{att.label}</span>
                    </div>
                  ))}
                </div>
              )}
              
              <Markdown 
                remarkPlugins={[remarkGfm, remarkMath]} 
                rehypePlugins={[rehypeKatex]}
                components={{
                  code({ className, children }: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    const isInline = !className;
                    return !isInline ? (
                      <div className="my-2 rounded-lg overflow-hidden border border-white/10">
                        {match && (
                          <div className="bg-white/5 px-3 py-1 text-[10px] font-bold text-gray-500 uppercase border-b border-white/5 flex justify-between items-center">
                            <span>{match[1]}</span>
                          </div>
                        )}
                        <pre className="p-3 bg-black/30 overflow-x-auto custom-scrollbar">
                          <code className={className}>
                            {children}
                          </code>
                        </pre>
                      </div>
                    ) : (
                      <code className="bg-white/10 px-1.5 py-0.5 rounded text-blue-400 font-mono text-[13px]">
                        {children}
                      </code>
                    );
                  },

                  p: ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
                  ul: ({children}) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                  ol: ({children}) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                  li: ({children}) => <li className="mb-1">{children}</li>,
                  a: ({children, href}) => <a href={href} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">{children}</a>,
                  blockquote: ({children}) => <blockquote className="border-l-4 border-white/10 pl-4 italic text-gray-400 my-2">{children}</blockquote>,
                }}
              >
                {msg.parts[0].text}
              </Markdown>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3 animate-pulse">
            <div className="w-8 h-8 rounded-xl bg-blue-600/50 flex items-center justify-center shrink-0">
              <Loader2 size={16} className="text-white animate-spin" />
            </div>
            <div className="bg-white/5 border border-white/10 p-3 rounded-2xl w-24 h-10 flex items-center justify-center">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-[#1a1b1e] border-t border-white/5">
        {/* Attachment chips */}
        {aiAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {aiAttachments.map((attachment) => (
              <div 
                key={attachment.id}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-600/10 border border-blue-600/20 rounded-lg text-[11px] text-blue-400 animate-in fade-in zoom-in duration-200"
              >
                {getAttachmentIcon(attachment.type)}
                <span className="max-w-[100px] truncate font-medium">{attachment.label}</span>
                <button 
                  onClick={() => removeAiAttachment(attachment.id)}
                  className="hover:text-blue-300 transition-colors ml-1 p-0.5 hover:bg-blue-600/20 rounded"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="relative group">
          <textarea
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={aiAttachments.length > 0 ? "Đặt câu hỏi về các mục đã đính kèm..." : "Hỏi AI về bài tập hoặc code..."}
            className="w-full bg-[#2d2d2d] border border-white/10 rounded-2xl p-4 pr-12 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 resize-none transition-all shadow-inner"
            rows={3}
          />
          <button
            onClick={handleSend}
            disabled={(!aiInput.trim() && aiAttachments.length === 0) || isLoading}
            className={`absolute right-3 bottom-3 p-2 rounded-xl transition-all ${
              (aiInput.trim() || aiAttachments.length > 0) && !isLoading 
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25 hover:scale-105 active:scale-95' 
              : 'bg-white/5 text-gray-600 disabled:cursor-not-allowed'
            }`}
          >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
        
        <div className="mt-3 flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <Sparkles size={12} className="text-blue-500 animate-pulse" />
            <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Model: Gemini 1.5 Flash Lite</span>
          </div>
          {aiMessages.length > 0 && (
            <button 
              onClick={clearChat}
              className="p-1.5 hover:bg-red-500/10 rounded-lg text-gray-600 hover:text-red-500 transition-all"
              title="Xóa lịch sử"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <style>{`
        .markdown-content h1 { font-size: 1.25rem; font-weight: 800; margin-bottom: 1rem; color: white; }
        .markdown-content h2 { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.75rem; color: white; }
        .markdown-content h3 { font-size: 1rem; font-weight: 700; margin-bottom: 0.5rem; color: white; }
        .markdown-content table { border-collapse: collapse; width: 100%; margin-bottom: 1rem; font-size: 12px; }
        .markdown-content th, .markdown-content td { border: 1px solid rgba(255,255,255,0.1); padding: 8px; text-align: left; }
        .markdown-content th { background: rgba(255,255,255,0.05); color: white; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.1); }
      `}</style>
    </div>
  );
};

export default AIAssistant;
