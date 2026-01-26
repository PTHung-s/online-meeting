import React, { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { useMeetingStore } from '../store/useMeetingStore';
import { socket } from '../services/socket';
import type { Message } from '../types';

const CustomChat: React.FC = () => {
  const { roomId, messages, addMessage, peers } = useMeetingStore();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new message arrives
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Listen for new messages from Socket.IO: Handled by MeetingPage to persist across tabs
  useEffect(() => {
    // Request chat history when joining if it hasn't been loaded
    if (roomId && messages.length === 0) {
      socket.emit('chat:history', { roomId });
    }
  }, [roomId, messages.length]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || !roomId) return;

    const store = useMeetingStore.getState();
    const message: Message = {
      senderId: socket.id || 'unknown',
      senderName: store.userName || (store.isHost ? 'Teacher' : 'Student'),
      text: input.trim(),
      time: Date.now(),
    };

    // Emit message to server
    socket.emit('chat:send', { roomId, message });
    
    // Add message to local state immediately
    addMessage(message);
    
    setInput('');
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  const getParticipantName = (senderId: string) => {
    const peer = peers.find(p => p.socketId === senderId);
    return peer?.name || (senderId === socket.id ? 'Bạn' : 'Người dùng');
  };

  const isOwnMessage = (senderId: string) => senderId === socket.id;

  return (
    <div className="flex flex-col h-full bg-[#1a1b1e]">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <div className="text-4xl mb-2 grayscale opacity-50">💬</div>
            <p className="text-sm font-medium">Chưa có tin nhắn nào</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={`${msg.senderId}-${msg.time}-${index}`}
              className={`flex flex-col ${isOwnMessage(msg.senderId) ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-2 mb-1 px-1">
                <span className="text-[10px] font-bold text-gray-500">
                  {isOwnMessage(msg.senderId) ? 'Bạn' : (msg.senderName || getParticipantName(msg.senderId))}
                </span>
                <span className="text-[10px] text-gray-600 font-mono italic opacity-50">{formatTime(msg.time)}</span>
              </div>
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm shadow-sm border border-white/5 ${
                  isOwnMessage(msg.senderId)
                    ? 'bg-blue-600 text-white rounded-tr-none'
                    : 'bg-[#2d2d2d] text-gray-200 rounded-tl-none'
                }`}
              >
                <div className="break-words">{msg.text}</div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-white/5 bg-[#1e1e1e]">
        <form onSubmit={handleSendMessage} className="flex gap-1.5">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Nhập tin nhắn..."
            className="flex-1 bg-[#2d2d2d] text-white text-sm px-4 py-2 rounded-lg border border-white/5 focus:outline-none focus:border-blue-500 placeholder-white/20"
            maxLength={500}
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-all"
            title="Gửi tin nhắn"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default CustomChat;
