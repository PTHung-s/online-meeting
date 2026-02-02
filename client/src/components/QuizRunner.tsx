import React, { useState, useEffect, useRef } from 'react';
import { useMeetingStore } from '../store/useMeetingStore';
import { HelpCircle, CheckCircle2, Award, Clock, XCircle, ChevronRight, Info } from 'lucide-react';
import { socket } from '../services/socket';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { AdaptiveQuizRunner } from './AdaptiveQuizRunner';
import AdaptiveQuizManager from './AdaptiveQuizManager';

export const QuizRunner: React.FC = () => {
  const { activeQuiz, roomId, activeAdaptive, adaptiveRankings, isHost } = useMeetingStore();

  // Delegate to adaptive components if adaptive session is active or rankings are showing
  if (activeAdaptive || adaptiveRankings) {
    if (isHost) {
      return <AdaptiveQuizManager onBack={() => {}} embedded />;
    }
    return <AdaptiveQuizRunner />;
  }
  const [studentAnswers, setStudentAnswers] = useState<Record<string, number>>({});
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [timeTaken, setTimeTaken] = useState(0);
  const startTime = useRef(Date.now());

  useEffect(() => {
    setStudentAnswers({});
    setHasSubmitted(false);
    setScore(0);
    setTimeTaken(0);
    startTime.current = Date.now();
  }, [activeQuiz]);

  if (!activeQuiz) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-50 text-slate-400 p-8 text-center border-l border-slate-200">
        <HelpCircle size={32} className="mb-4 opacity-20 text-slate-300" />
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Không có bài tập đang diễn ra</p>
      </div>
    );
  }

  const handleAnswerChange = (qId: string, qIdx: number, aIndex: number) => {
    if (hasSubmitted) return;
    const key = qId || `q-${qIdx}`;
    setStudentAnswers(prev => ({
      ...prev,
      [key]: aIndex
    }));
  };

  const handleSubmitQuiz = () => {
    if (!activeQuiz || hasSubmitted) return;
    
    const store = useMeetingStore.getState();
    let currentScore = 0;
    const finalAnswers = activeQuiz.questions.map((q, qIdx) => {
      const key = q.id || `q-${qIdx}`;
      const selected = studentAnswers[key];
      const isCorrect = selected === q.correctAnswer;
      if (isCorrect) currentScore++;
      return {
        questionId: q.id,
        selectedOption: selected,
        isCorrect
      };
    });
    
    const finalTime = Math.floor((Date.now() - startTime.current) / 1000);
    setScore(currentScore);
    setTimeTaken(finalTime);
    setHasSubmitted(true);
    
    if (roomId) {
      const response = {
        userId: socket.id,
        userName: store.userName || localStorage.getItem('userName') || 'Học sinh',
        quizId: activeQuiz.id,
        answers: finalAnswers,
        score: currentScore,
        timeTaken: finalTime,
        completedAt: Date.now()
      };
      socket.emit('quiz:submit', { roomId, response });
    }
  };

  return (
    <div className="flex flex-col h-full bg-white text-slate-900 overflow-hidden font-sans border-l border-slate-200">
      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 border border-indigo-100">
            <HelpCircle size={16} />
          </div>
          <div>
            <h2 className="text-[11px] font-black text-slate-800 uppercase tracking-tighter truncate max-w-[120px]">{activeQuiz.title}</h2>
            <div className="flex items-center gap-1.5">
              <span className="text-[8px] font-black text-indigo-600 uppercase tracking-widest">LIVE</span>
              <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">• {activeQuiz.questions.length} CÂU HỎI</span>
            </div>
          </div>
        </div>
        {!hasSubmitted && (
          <div className="flex items-center gap-2 px-2 py-1 bg-slate-50 rounded border border-slate-200">
            <Clock size={10} className="text-slate-400" />
            <span className="text-[10px] font-black font-mono text-slate-600">00:00</span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 bg-slate-50/50">
        <div className="max-w-2xl mx-auto space-y-8">
          {!hasSubmitted ? (
            <>
              {activeQuiz.questions.map((q, qIdx) => (
                <div key={q.id} className="space-y-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex gap-4">
                     <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[12px] font-black text-indigo-600">
                        {qIdx + 1}
                     </span>
                     <div className="text-[14px] text-slate-800 font-bold leading-relaxed pt-1 w-full prose prose-slate prose-sm max-w-none">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}
                          components={{
                            code: ({node, inline, className, children, ...props}: any) => {
                              const match = /language-(\w+)/.exec(className || '');
                              const content = String(children).replace(/\n$/, '');
                              const isSingleLineShort = !inline && content.length < 15 && !content.includes('\n');

                              if (inline || isSingleLineShort) {
                                return (
                                  <code className="inline-code-quiz" {...props}>
                                    {content}
                                  </code>
                                );
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
                            p: ({node, children, ...props}: any) => {
                              return <p className="quiz-paragraph whitespace-pre-wrap" {...props}>{children}</p>;
                            }
                          }}
                        >
                          {q.question.replace(/\\n/g, '\n')}
                        </ReactMarkdown>
                     </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-2.5 pl-12">
                    {q.options.map((opt, aIdx) => {
                      const selectionKey = q.id || `q-${qIdx}`;
                      const isSelected = studentAnswers[selectionKey] === aIdx;
                      
                      return (
                        <button 
                          key={aIdx}
                          onClick={() => handleAnswerChange(q.id, qIdx, aIdx)}
                          className={`text-left px-5 py-3.5 rounded-xl text-[13px] transition-all border flex items-center gap-4 ${
                            isSelected 
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200' 
                            : 'bg-slate-50 border-slate-200 hover:border-indigo-300 hover:bg-slate-100 text-slate-600'
                          }`}
                        >
                          <span className={`w-6 h-6 rounded flex items-center justify-center text-[11px] font-black border transition-colors ${
                            isSelected 
                            ? 'bg-white text-indigo-600 border-white' 
                            : 'bg-white border-slate-300 text-slate-400'
                          }`}>
                            {String.fromCharCode(65 + aIdx)}
                          </span>
                          <span className="font-semibold prose prose-sm prose-slate max-w-none break-words whitespace-pre-wrap">
                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{ p: ({children}) => <>{children}</> }}>
                              {opt.replace(/\\n/g, '\n')}
                            </ReactMarkdown>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              
              <div className="pt-8 pb-12 flex flex-col items-center gap-4">
                <button 
                  onClick={handleSubmitQuiz}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white text-[12px] font-bold rounded-xl transition-all shadow-lg shadow-indigo-200 uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  NỘP BÀI TẬP NGAY
                  <ChevronRight size={16} />
                </button>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">
                  * Vui lòng kiểm tra kỹ trước khi nộp *
                </p>
              </div>
            </>
          ) : (
            <div className="space-y-8 py-4 animate-in fade-in slide-in-from-bottom-2 duration-700">
               <div className="p-8 bg-white border border-slate-200 rounded-3xl flex flex-col items-center text-center space-y-6 shadow-sm">
                  <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 border border-indigo-100">
                    <Award size={32} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Hoàn thành bài tập!</h3>
                    <p className="text-[12px] text-slate-500 font-bold uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full inline-block">Thời gian: {timeTaken}s</p>
                  </div>
                  
                  <div className="flex gap-4 w-full pt-4">
                    <div className="flex-1 py-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                      <p className="text-[10px] text-indigo-600 font-black uppercase tracking-widest mb-1">Kết quả</p>
                      <p className="text-3xl font-black text-indigo-700">{score}<span className="text-sm text-indigo-400 ml-1">/{activeQuiz.questions.length}</span></p>
                    </div>
                    <div className="flex-1 py-4 bg-slate-50 border border-slate-200 rounded-2xl">
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Xếp hạng</p>
                      <p className="text-3xl font-black text-slate-300">--</p>
                    </div>
                  </div>
               </div>

               <div className="space-y-6">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-3">Xem lại bài làm</h4>
                  {activeQuiz.questions.map((q, idx) => {
                     const selectionKey = q.id || `q-${idx}`;
                     const selected = studentAnswers[selectionKey];
                     const isCorrect = selected === q.correctAnswer;
                     return (
                        <div key={idx} className={`p-6 rounded-2xl border transition-all ${isCorrect ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                           <div className="flex gap-4 mb-5">
                              <span className={`shrink-0 w-6 h-6 rounded flex items-center justify-center text-[11px] font-black ${isCorrect ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                {idx + 1}
                              </span>
                              <div className="text-[14px] font-bold text-slate-800 leading-snug w-full prose prose-slate prose-sm max-w-none">
                                <ReactMarkdown 
                                  remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}
                                  components={{
                                    code: ({node, inline, className, children, ...props}: any) => {
                                      const match = /language-(\w+)/.exec(className || '');
                                      const content = String(children).replace(/\n$/, '');
                                      const isSingleLineShort = !inline && content.length < 15 && !content.includes('\n');

                                      if (inline || isSingleLineShort) {
                                        return (
                                          <code className="inline-code-quiz" {...props}>
                                            {content}
                                          </code>
                                        );
                                      }
                                      
                                      return (
                                        <div className="rounded-xl overflow-hidden my-3 border border-slate-700 shadow-xl">
                                          <SyntaxHighlighter
                                            style={atomDark}
                                            language={match ? match[1] : 'javascript'}
                                            PreTag="div"
                                            customStyle={{
                                              margin: 0,
                                              padding: '1.25rem',
                                              fontSize: '0.85rem',
                                              backgroundColor: '#1e1e2e',
                                            }}
                                            {...props}
                                          >
                                            {content}
                                          </SyntaxHighlighter>
                                        </div>
                                      );
                                    },
                                    pre: ({children}) => <>{children}</>,
                                    p: ({children, ...props}: any) => {
                                      return <p className="quiz-paragraph" {...props}>{children}</p>;
                                    }
                                  }}
                                >
                                  {q.question}
                                </ReactMarkdown>
                              </div>
                           </div>

                           <div className="space-y-2.5 pl-10">
                              {q.options.map((opt, aIdx) => {
                                 const isSelected = selected === aIdx;
                                 const isCorrectOption = q.correctAnswer === aIdx;
                                 
                                 return (
                                    <div key={aIdx} className={`text-[12px] font-bold flex items-center gap-3 py-1 ${
                                       isCorrectOption ? 'text-emerald-600' : isSelected ? 'text-rose-600' : 'text-slate-400'
                                    }`}>
                                       {isCorrectOption ? <CheckCircle2 size={14} /> : isSelected ? <XCircle size={14} /> : <div className="w-3.5" />}
                                       <span className="prose prose-sm max-w-none break-words whitespace-pre-wrap">
                                          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{ p: ({children}) => <>{children}</> }}>
                                            {opt.replace(/\\n/g, '\n')}
                                          </ReactMarkdown>
                                       </span>
                                    </div>
                                 );
                              })}

                              {q.explanation && (
                                <div className="mt-5 p-4 bg-white/60 rounded-xl border-l-4 border-indigo-400">
                                   <div className="flex items-center gap-2 mb-1.5">
                                      <Info size={12} className="text-indigo-600" />
                                      <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Giải thích</span>
                                   </div>
                                   <div className="text-[12px] text-slate-600 italic leading-relaxed prose prose-slate prose-sm max-w-none">
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
                                          pre: ({children}) => <>{children}</>
                                        }}
                                      >
                                      {q.explanation.replace(/\\n/g, '\n')}
                                      </ReactMarkdown>
                                   </div>
                                </div>
                              )}
                           </div>
                        </div>
                     );
                  })}
               </div>
            </div>
          )}
        </div>
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 4px; }
        
        .code-block-quiz {
          background-color: #0f172a !important;
          color: #e2e8f0 !important;
          padding: 0.75rem 1rem !important;
          border-radius: 0.75rem !important;
          margin: 0.5rem 0 !important;
          overflow-x: auto !important;
          font-family: Consolas, Monaco, monospace !important;
          font-size: 0.875rem !important;
          line-height: 1.6 !important;
          display: block !important;
          border: 1px solid #1e293b !important;
          width: 100% !important;
          max-width: 100% !important;
        }
        
        .code-block-quiz code {
          background: none !important;
          color: inherit !important;
          padding: 0 !important;
          border-radius: 0 !important;
          font-weight: 400 !important;
          font-size: inherit !important;
        }
        
        .inline-code-quiz {
          background-color: #f1f5f9 !important;
          color: #4338ca !important;
          padding: 0.2rem 0.4rem !important;
          border-radius: 0.375rem !important;
          font-weight: 600 !important;
          font-size: 0.9em !important;
          font-family: Consolas, Monaco, monospace !important;
        }
        
        .quiz-paragraph {
          margin: 0.5rem 0 !important;
          line-height: 1.7 !important;
        }
        
        .prose strong { color: #1e293b !important; font-weight: 800 !important; }
      `}</style>
    </div>
  );
};
