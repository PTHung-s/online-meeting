import React, { useState, useMemo } from 'react';
import { useMeetingStore } from '../store/useMeetingStore';
import { HelpCircle, Plus, Send, BarChart2, Award, Clock, User, Zap, Trash2, Sparkles, Loader2 } from 'lucide-react';
import type { Quiz, QuizQuestion } from '../types/quiz';
import { socket } from '../services/socket';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import AdaptiveQuizManager from './AdaptiveQuizManager';

const QuizManager: React.FC = () => {
  const { isHost, activeQuiz, setActiveQuiz, quizResponses, peers, roomId, draftQuiz, setDraftQuiz, activeAdaptive, adaptiveRankings } = useMeetingStore();
  const [view, setView] = useState<'list' | 'create' | 'active' | 'results' | 'adaptive'>(activeQuiz ? 'active' : (activeAdaptive || adaptiveRankings) ? 'adaptive' : 'list');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiCount, setAiCount] = useState(5);
  const [editingId, setEditingId] = useState<string | null>(null);

  const rankings = useMemo(() => {
    return [...quizResponses].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.timeTaken - b.timeTaken;
    });
  }, [quizResponses]);

  const questionStats = useMemo(() => {
    if (!activeQuiz) return [];
    return activeQuiz.questions.map((q) => {
      const answersForThisQuestion = quizResponses.map(r => r.answers.find(a => a.questionId === q.id));
      const correctCount = answersForThisQuestion.filter(a => a?.isCorrect).length;
      const totalCount = quizResponses.length;
      const percentCorrect = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
      return {
        id: q.id,
        question: q.question,
        percentCorrect,
        correctCount,
        totalCount
      };
    });
  }, [activeQuiz, quizResponses]);

  const averageScorePercent = useMemo(() => {
    if (quizResponses.length === 0 || !activeQuiz) return 0;
    const totalScore = quizResponses.reduce((acc, curr) => acc + curr.score, 0);
    const totalPossible = quizResponses.length * activeQuiz.questions.length;
    return Math.round((totalScore / totalPossible) * 100);
  }, [quizResponses, activeQuiz]);

  const [currentQuestion, setCurrentQuestion] = useState<Partial<QuizQuestion>>({
    question: '',
    options: ['', '', '', ''],
    correctAnswer: 0,
    explanation: ''
  });

  const handleAiGenerate = async () => {
    if (!aiPrompt) return;
    setIsGenerating(true);
    try {
      const response = await fetch('/api/ai/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: aiPrompt,
          count: aiCount,
          context: draftQuiz.questions || []
        })
      });
      const data = await response.json();
      if (data.questions) {
        // Ensure each AI-generated question has a unique ID
        const questionsWithIds = data.questions.map((q: any) => ({
          ...q,
          id: Math.random().toString(36).substr(2, 9)
        }));
        
        setDraftQuiz({
          ...draftQuiz,
          questions: [...(draftQuiz.questions || []), ...questionsWithIds]
        });
        setAiPrompt('');
      }
    } catch (error) {
      console.error('AI Generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddQuestion = () => {
    if (!currentQuestion.question) return;
    setDraftQuiz({
      ...draftQuiz,
      questions: [...(draftQuiz.questions || []), { ...currentQuestion, id: Math.random().toString(36).substr(2, 9) } as QuizQuestion]
    });
    setCurrentQuestion({
      question: '',
      options: ['', '', '', ''],
      correctAnswer: 0,
      explanation: ''
    });
  };

  const handleUpdateQuestion = (updatedQ: QuizQuestion) => {
    setDraftQuiz({
      ...draftQuiz,
      questions: draftQuiz.questions?.map(q => q.id === updatedQ.id ? updatedQ : q)
    });
  };

  const removeQuestion = (id: string) => {
    setDraftQuiz({
      ...draftQuiz,
      questions: draftQuiz.questions?.filter(q => q.id !== id)
    });
  };

  const handleStartQuiz = () => {
    if (!draftQuiz.title || (draftQuiz.questions?.length || 0) === 0) return;
    const quiz = { ...draftQuiz, id: Date.now().toString(), createdAt: Date.now() } as Quiz;
    setActiveQuiz(quiz);
    setDraftQuiz({ title: '', questions: [] }); // Clear draft after start
    setView('active');
    
    if (roomId) {
      socket.emit('quiz:start', { roomId, quiz });
    }
  };

  const handleEndQuiz = () => {
    if (window.confirm('Bạn có chắc chắn muốn kết thúc bài tập này?')) {
      setActiveQuiz(null);
      setView('list');
      if (roomId) {
        socket.emit('quiz:end', { roomId });
      }
    }
  };

  if (view === 'adaptive') {
    return <AdaptiveQuizManager onBack={() => setView('list')} />;
  }

  if (view === 'create') {
    return (
      <div className="flex flex-col h-full bg-white text-slate-900 overflow-hidden font-sans border-l border-slate-200">
        {/* Header - Clean Light */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-indigo-600 fill-indigo-600" />
            <h2 className="text-[11px] font-black uppercase tracking-tighter text-slate-700">Thiết kế bài tập</h2>
          </div>
          <button 
            onClick={() => setView('list')}
            className="text-[10px] font-bold text-slate-400 hover:text-slate-600 px-2 py-1 rounded hover:bg-slate-200/50 transition-all"
          >
            ĐÓNG
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar bg-white">
          {/* Quiz Title */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-indigo-600 uppercase tracking-widest ml-1">Tiêu đề bài tập</label>
            <input 
              type="text" 
              value={draftQuiz.title || ''}
              onChange={e => setDraftQuiz({...draftQuiz, title: e.target.value})}
              placeholder="Nhập tên bài tập..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-300"
            />
          </div>

          {/* AI Generator Panel */}
          <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl space-y-3 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={14} className="text-indigo-600" />
              <h3 className="text-[10px] font-black text-indigo-900 uppercase tracking-wider">AI Soạn đề nhanh</h3>
            </div>
            <textarea 
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              placeholder="Nhập chủ đề (vd: Lệnh điều kiện Python)..."
              className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:border-indigo-500 min-h-[60px] resize-none shadow-inner"
            />
            <div className="flex items-center justify-between gap-4">
               <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Số câu:</span>
                  <input 
                    type="number" 
                    value={aiCount}
                    onChange={e => setAiCount(parseInt(e.target.value))}
                    className="w-12 bg-white border border-slate-200 rounded px-2 py-1 text-[11px] font-black text-center text-slate-700"
                    min="1" max="10"
                  />
               </div>
               <button 
                onClick={handleAiGenerate}
                disabled={!aiPrompt || isGenerating}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 rounded-lg text-[10px] font-black transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-white shadow-md shadow-indigo-200"
              >
                {isGenerating ? <Loader2 className="w-3 h-3 animate-spin text-white" /> : <Sparkles size={12} />}
                {isGenerating ? 'ĐANG TẠO...' : 'PHÁT SINH CÂU HỎI'}
              </button>
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          {/* New Question Form */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <Plus size={14} /> THÊM CÂU HỎI THỦ CÔNG
              </h3>
            </div>
            
            <textarea 
              value={currentQuestion.question}
              onChange={e => setCurrentQuestion({...currentQuestion, question: e.target.value})}
              placeholder="Nội dung câu hỏi..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400 min-h-[80px] transition-all resize-none font-medium text-slate-700"
            />

            <div className="grid grid-cols-1 gap-2">
              {currentQuestion.options?.map((opt, idx) => (
                <div key={idx} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-all ${currentQuestion.correctAnswer === idx ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100'}`}>
                  <button 
                    onClick={() => setCurrentQuestion({...currentQuestion, correctAnswer: idx})}
                    className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-black transition-all ${
                        currentQuestion.correctAnswer === idx 
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' 
                        : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                    }`}
                  >
                    {String.fromCharCode(65 + idx)}
                  </button>
                  <input 
                    type="text" 
                    value={opt}
                    onChange={e => {
                      const newOpts = [...(currentQuestion.options || [])];
                      newOpts[idx] = e.target.value;
                      setCurrentQuestion({...currentQuestion, options: newOpts});
                    }}
                    placeholder={`Lựa chọn ${idx + 1}`}
                    className="flex-1 bg-transparent border-none px-2 py-1 text-xs font-semibold focus:outline-none text-slate-700 placeholder:text-slate-300"
                  />
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
               <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Lời giải (không bắt buộc)</label>
               <input 
                 type="text" 
                 value={currentQuestion.explanation}
                 onChange={e => setCurrentQuestion({...currentQuestion, explanation: e.target.value})}
                 placeholder="Giải thích tại sao đáp án này đúng..."
                 className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-xs focus:outline-none focus:border-indigo-400 transition-all text-slate-600"
               />
            </div>

            <button 
              onClick={handleAddQuestion}
              disabled={!currentQuestion.question}
              className="w-full py-3 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-200 text-white rounded-xl text-[10px] font-black transition-all shadow-lg shadow-slate-200 tracking-widest uppercase"
            >
              + THÊM VÀO DANH SÁCH
            </button>
          </div>

          {/* Question List Preview */}
          { (draftQuiz.questions?.length || 0) > 0 && (
             <div className="space-y-3 pt-4 border-t border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center justify-between">
                  <span>DANH SÁCH {draftQuiz.questions?.length} CÂU ĐÃ SOẠN</span>
                  <span className="text-[8px] font-normal italic">* Ấn vào câu để sửa</span>
                </p>
                <div className="space-y-3">
                    {draftQuiz.questions?.map((q, idx) => (
                        <div key={q.id} className="group overflow-hidden bg-slate-50 border border-slate-200 rounded-xl transition-all">
                            {/* Toggle Header */}
                            <div 
                              onClick={() => setEditingId(editingId === q.id ? null : q.id)}
                              className={`flex items-start gap-3 p-4 cursor-pointer hover:bg-white transition-colors ${editingId === q.id ? 'bg-white border-b border-slate-100 shadow-sm' : ''}`}
                            >
                               <span className={`text-[10px] font-black w-6 h-6 rounded flex items-center justify-center shrink-0 transition-colors ${editingId === q.id ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600'}`}>
                                  {idx + 1}
                               </span>
                               <div className="flex-1 min-w-0">
                                  <div className={`text-[12px] font-bold leading-snug w-full prose prose-slate prose-sm max-w-none ${editingId === q.id ? '' : 'truncate line-clamp-2'}`}>
                                     <ReactMarkdown 
                                       remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}
                                       components={{
                                          code: ({node, inline, className, children, ...props}: any) => {
                                            const match = /language-(\w+)/.exec(className || '');
                                            const content = String(children).replace(/\n$/, '');
                                            const isSingleLineShort = !inline && content.length < 15 && !content.includes('\n');

                                            if (inline || isSingleLineShort) {
                                              return <code className="bg-slate-100 px-1 rounded text-indigo-600 font-bold mx-1" {...props}>{content}</code>;
                                            }
                                            return (
                                              <div className="my-2 rounded-lg overflow-hidden border border-slate-700 shadow-lg w-full max-w-full">
                                                <SyntaxHighlighter
                                                  style={atomDark}
                                                  language={match ? match[1] : 'javascript'}
                                                  PreTag="div"
                                                  customStyle={{
                                                    margin: 0,
                                                    padding: '0.75rem',
                                                    fontSize: '11px',
                                                    lineHeight: '1.4',
                                                    backgroundColor: '#1E293B',
                                                    width: '100%',
                                                  }}
                                                  {...props}
                                                >
                                                  {content}
                                                </SyntaxHighlighter>
                                              </div>
                                            );
                                          },
                                          pre: ({children}) => <>{children}</>,
                                          p: ({children, ...props}: any) => <p className="whitespace-pre-wrap" {...props}>{children}</p>
                                       }}
                                     >
                                         {q.question.replace(/\\n/g, '\n')}
                                     </ReactMarkdown>
                                  </div>
                               </div>
                               <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={(e) => { e.stopPropagation(); removeQuestion(q.id); }} className="p-1.5 text-slate-300 hover:text-red-500"><Trash2 size={12}/></button>
                               </div>
                            </div>

                            {/* Edit Form (Expanded) */}
                            {editingId === q.id && (
                               <div className="p-4 bg-white space-y-4 animate-in slide-in-from-top-2 duration-200">
                                  <div className="space-y-1.5">
                                     <label className="text-[9px] font-black text-indigo-600 uppercase tracking-wider">Nội dung câu hỏi</label>
                                     <textarea 
                                       value={q.question}
                                       onChange={e => handleUpdateQuestion({...q, question: e.target.value})}
                                       className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-400 min-h-[60px] font-medium"
                                     />
                                  </div>

                                  <div className="grid grid-cols-1 gap-2">
                                     {q.options.map((opt, oIdx) => (
                                        <div key={oIdx} className="flex items-center gap-2">
                                           <button 
                                              onClick={() => handleUpdateQuestion({...q, correctAnswer: oIdx})}
                                              className={`w-6 h-6 rounded flex items-center justify-center text-[9px] font-black shrink-0 ${q.correctAnswer === oIdx ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}
                                           >
                                              {String.fromCharCode(65 + oIdx)}
                                           </button>
                                           <input 
                                              type="text" 
                                              value={opt}
                                              onChange={e => {
                                                 const newOptions = [...q.options];
                                                 newOptions[oIdx] = e.target.value;
                                                 handleUpdateQuestion({...q, options: newOptions});
                                              }}
                                              className="flex-1 bg-slate-50 border border-slate-100 rounded px-2 py-1.5 text-[11px] font-semibold text-slate-600"
                                           />
                                        </div>
                                     ))}
                                  </div>

                                  <div className="space-y-1.5">
                                     <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Giải thích</label>
                                     <input 
                                       type="text" 
                                       value={q.explanation || ''}
                                       onChange={e => handleUpdateQuestion({...q, explanation: e.target.value})}
                                       className="w-full bg-slate-50 border border-slate-100 rounded px-3 py-1.5 text-[11px] text-slate-500 italic"
                                       placeholder="Giải thích..."
                                     />
                                  </div>

                                  <button 
                                    onClick={() => setEditingId(null)}
                                    className="w-full py-2 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-colors"
                                  >
                                    XÁC NHẬN SỬA ĐỔI
                                  </button>
                               </div>
                            )}
                        </div>
                    ))}
                </div>
             </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0">
          <button 
            disabled={!draftQuiz.title || (draftQuiz.questions?.length || 0) === 0}
            onClick={handleStartQuiz}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-100 transition-all uppercase tracking-widest"
          >
            PHÁT ĐỀ CHO LỚP HỌC
          </button>
        </div>
      </div>
    );
  }

  if (view === 'active' && activeQuiz) {
    return (
      <div className="flex flex-col h-full bg-white text-slate-900 overflow-hidden font-sans border-l border-slate-200">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200 shrink-0">
           <div className="flex items-center gap-2">
              <Clock size={14} className="text-indigo-600 animate-pulse" />
              <h2 className="text-[11px] font-black uppercase tracking-tighter text-slate-700">Đang dạy: {activeQuiz.title}</h2>
           </div>
           <button 
             onClick={handleEndQuiz}
             className="text-[10px] font-bold text-red-500 hover:bg-red-50 px-2 py-1 rounded transition-colors uppercase tracking-widest"
           >
             KẾT THÚC
           </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center text-center space-y-6 bg-white">
           <div className="relative">
              <div className="absolute inset-0 bg-indigo-100 blur-2xl rounded-full" />
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-indigo-600 border border-slate-200 relative z-10 animate-bounce transition-all shadow-sm">
                <Send size={24} />
              </div>
           </div>
           
           <div className="space-y-2 max-w-xs relative z-10">
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
                Học sinh đang làm bài trắc nghiệm thực tế...
              </p>
           </div>
           
           {isHost ? (
              <div className="w-full max-w-[240px] space-y-3">
                <button 
                  onClick={() => setView('results')}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 uppercase tracking-tighter text-[11px]"
                >
                  <BarChart2 size={16} />
                  XEM THỐNG KÊ CHI TIẾT
                </button>
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl shadow-sm">
                   <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                    Tiến độ: <span className="text-indigo-600 text-xs font-black">{quizResponses.length}</span> / {peers.length + 1} nộp
                   </p>
                </div>
              </div>
           ) : (
              <div className="px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-lg text-[11px] font-bold text-indigo-600 animate-pulse">
                 Làm bài ngay tại tab Trắc nghiệm
              </div>
           )}
        </div>
      </div>
    );
  }

  // Results View for Host
  if (view === 'results' && activeQuiz) {
    return (
      <div className="flex flex-col h-full bg-white text-slate-900 overflow-hidden font-sans border-l border-slate-200">
         <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200 shrink-0">
            <div className="flex items-center gap-2">
              <BarChart2 size={14} className="text-indigo-600" />
              <h2 className="text-[11px] font-black uppercase tracking-tighter text-slate-700">Báo cáo kết quả</h2>
            </div>
            <button 
              onClick={() => setView('active')}
              className="text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase"
            >
              BACK
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar bg-white">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col items-center shadow-sm">
              <p className="text-[9px] text-slate-500 font-black uppercase tracking-tighter mb-1">Đã nộp</p>
              <p className="text-2xl font-black text-slate-900 tracking-tighter">{quizResponses.length}<span className="text-[10px] text-slate-400 ml-1">/{peers.length + 1}</span></p>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col items-center shadow-sm">
               <p className="text-[9px] text-slate-500 font-black uppercase tracking-tighter mb-1">Điểm TB</p>
               <p className="text-2xl font-black text-indigo-600 tracking-tighter">{averageScorePercent}<span className="text-sm text-slate-400 ml-1">%</span></p>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 flex items-center gap-2 border-b border-slate-100 pb-1">
              <Award size={12} className="text-yellow-500" /> BẢNG THÀNH TÍCH
            </h3>
            <div className="space-y-2">
              {rankings.length === 0 ? (
                <div className="py-8 flex flex-col items-center justify-center opacity-30">
                    <User size={32} className="mb-2 text-slate-300" />
                    <p className="text-[10px] font-bold text-slate-400">Chưa có dữ liệu...</p>
                </div>
              ) : (
                rankings.map((r, i) => (
                  <div key={r.userId} className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className={`w-5 h-5 flex items-center justify-center rounded text-[9px] font-black ${
                          i === 0 ? 'bg-yellow-100 text-yellow-600' : 'bg-slate-200 text-slate-500'
                      }`}>
                        {i + 1}
                      </span>
                      <span className="text-[11px] font-bold text-slate-700">{r.userName}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1"><Clock size={10} /> {r.timeTaken}s</span>
                      <span className="text-sm font-black text-indigo-600 tabular-nums">{r.score}<span className="text-[9px] text-slate-400 ml-0.5">/{activeQuiz.questions.length}</span></span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1 border-b border-slate-100 pb-1">ANALYTICS CÂU HỎI</h3>
            <div className="space-y-3">
                {questionStats.map((stat, idx) => (
                <div key={stat.id} className="p-3 bg-white border border-slate-100 rounded-xl space-y-2 shadow-sm">
                    <div className="flex items-start gap-2">
                        <span className="text-[9px] font-black text-slate-400 bg-slate-100 w-4 h-4 rounded flex items-center justify-center shrink-0 mt-0.5">{idx+1}</span>
                        <div className="text-[11px] font-bold text-slate-700 leading-snug w-full prose prose-slate prose-sm max-w-none">
                            <ReactMarkdown 
                              remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}
                              components={{
                                code: ({node, inline, className, children, ...props}: any) => {
                                  const match = /language-(\w+)/.exec(className || '');
                                  const content = String(children).replace(/\n$/, '');
                                  const isSingleLineShort = !inline && content.length < 15 && !content.includes('\n');

                                  if (inline || isSingleLineShort) {
                                    return <code className="bg-slate-100 px-1 rounded text-indigo-600 font-bold mx-1" {...props}>{content}</code>;
                                  }
                                  return (
                                    <div className="my-2 rounded-lg overflow-hidden border border-slate-700 shadow-lg w-full max-w-full">
                                      <SyntaxHighlighter
                                        style={atomDark}
                                        language={match ? match[1] : 'javascript'}
                                        PreTag="div"
                                        customStyle={{
                                          margin: 0,
                                          padding: '0.75rem',
                                          fontSize: '11px',
                                          lineHeight: '1.4',
                                          backgroundColor: '#1E293B',
                                          width: '100%',
                                        }}
                                        {...props}
                                      >
                                        {content}
                                      </SyntaxHighlighter>
                                    </div>
                                  );
                                },
                                pre: ({children}) => <>{children}</>,
                                p: ({children, ...props}: any) => <p className="whitespace-pre-wrap" {...props}>{children}</p>
                              }}
                            >
                                {stat.question.replace(/\\n/g, '\n')}
                            </ReactMarkdown>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
                                <div className="h-full bg-indigo-500 shadow-sm transition-all duration-700" style={{width: `${stat.percentCorrect}%`}}></div>
                                <div className="h-full bg-red-100" style={{width: `${100 - stat.percentCorrect}%`}}></div>
                            </div>
                            <span className="text-[10px] font-black text-indigo-600 w-8 text-right">{stat.percentCorrect}%</span>
                        </div>
                    </div>
                </div>
                ))}
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0">
          <button 
            onClick={handleEndQuiz}
            className="w-full py-3 bg-white text-red-500 border border-red-200 rounded-xl text-[10px] font-black hover:bg-red-500 hover:text-white transition-all uppercase tracking-widest shadow-sm shadow-red-50"
          >
            ĐÓNG BÀI TẬP
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white text-slate-900 p-6 items-center justify-center text-center space-y-8 relative overflow-hidden font-sans border-l border-slate-200">
      <div className="relative">
        <div className="absolute inset-0 bg-indigo-50 blur-3xl rounded-full scale-150" />
        <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-indigo-600 border border-slate-100 relative z-10 transition-transform hover:scale-110 duration-500 shadow-sm">
            <HelpCircle size={36} />
        </div>
      </div>

      <div className="space-y-3 max-w-xs relative z-10 font-sans">
        <h2 className="text-2xl font-black tracking-tight text-slate-900 uppercase italic">Trắc nghiệm</h2>
        <p className="text-slate-500 text-[12px] font-bold leading-relaxed uppercase tracking-wider">
          Công cụ tương tác thời gian thực cho lớp học.
        </p>
      </div>
      
      {isHost ? (
        <div className="flex flex-col gap-3 w-full max-w-[220px] relative z-10">
          <button
            onClick={() => setView('create')}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-2 hover:scale-105 active:scale-95 group uppercase tracking-widest text-[11px]"
          >
            <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" />
            TẠO TRẮC NGHIỆM
          </button>
          <button
            onClick={() => setView('adaptive')}
            className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black shadow-xl shadow-amber-100 transition-all flex items-center justify-center gap-2 hover:scale-105 active:scale-95 group uppercase tracking-widest text-[11px]"
          >
            <Zap size={18} className="group-hover:animate-pulse" />
            ADAPTIVE QUIZ
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 text-slate-400 relative z-10">
          <Loader2 className="animate-spin text-indigo-500 w-5 h-5" />
          <p className="text-[10px] font-black tracking-[0.2em] uppercase opacity-60">Đang chờ giảng viên ra đề...</p>
        </div>
      )}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 4px; }
        .prose pre { background-color: #f8fafc !important; color: #334155 !important; padding: 0.75rem !important; border-radius: 0.5rem !important; border: 1px solid #e2e8f0 !important; margin: 0.5rem 0 !important; }
        .prose code { background-color: #f1f5f9 !important; color: #4338ca !important; padding: 0.1rem 0.25rem !important; border-radius: 0.25rem !important; font-weight: 600 !important; }
        .prose p { margin: 0.25rem 0 !important; }
      `}</style>
    </div>
  );
};

export default QuizManager;
