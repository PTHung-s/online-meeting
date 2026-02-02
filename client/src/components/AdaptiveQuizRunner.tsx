import React, { useState, useEffect, useRef } from 'react';
import { useMeetingStore } from '../store/useMeetingStore';
import { HelpCircle, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { socket } from '../services/socket';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

const mdComponents: any = {
  code: ({ node, inline, className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || '');
    const content = String(children).replace(/\n$/, '');
    const isSingleLineShort = !inline && content.length < 15 && !content.includes('\n');
    if (inline || isSingleLineShort) {
      return <code className="bg-slate-100 px-1 rounded text-indigo-600 font-bold mx-1" {...props}>{content}</code>;
    }
    return (
      <div className="my-2 rounded-lg overflow-hidden border border-slate-700 shadow-lg w-full max-w-full">
        <SyntaxHighlighter style={atomDark} language={match ? match[1] : 'javascript'} PreTag="div"
          customStyle={{ margin: 0, padding: '0.75rem', fontSize: '11px', lineHeight: '1.4', backgroundColor: '#1E293B', width: '100%' }} {...props}>
          {content}
        </SyntaxHighlighter>
      </div>
    );
  },
  pre: ({ children }: any) => <>{children}</>,
  p: ({ children, ...props }: any) => <p className="whitespace-pre-wrap" {...props}>{children}</p>
};

export const AdaptiveQuizRunner: React.FC = () => {
  const {
    activeAdaptive,
    adaptiveCurrentQuestion,
    adaptiveQuestionIndex,
    adaptiveMyAnswer,
    adaptiveMyResult,
    adaptiveScores,
    adaptiveQuestionResults,
    adaptiveRankings,
    setAdaptiveMyAnswer,
    adaptiveCountdown,
    roomId,
  } = useMeetingStore();

  // Client-side countdown tick
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (adaptiveCountdown > 0) {
      setCountdown(adaptiveCountdown);
      if (countdownRef.current) clearInterval(countdownRef.current);
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) { if (countdownRef.current) clearInterval(countdownRef.current); return 0; }
          return prev - 1;
        });
      }, 1000);
    } else {
      setCountdown(0);
      if (countdownRef.current) clearInterval(countdownRef.current);
    }
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [adaptiveCountdown]);

  const handleAnswer = (optionIndex: number) => {
    if (adaptiveMyAnswer !== null) return; // Already answered
    setAdaptiveMyAnswer(optionIndex);
    if (roomId) {
      socket.emit('adaptive:answer', { roomId, selectedOption: optionIndex });
    }
  };

  // Final rankings screen (after session ended)
  if (!activeAdaptive && adaptiveRankings) {
    return (
      <div className="flex flex-col h-full bg-white text-slate-900 overflow-hidden font-sans border-l border-slate-200">
        <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200 shrink-0">
          <CheckCircle2 size={14} className="text-emerald-600" />
          <h2 className="text-[11px] font-black uppercase tracking-tighter text-slate-700">Kết thúc - Bảng xếp hạng</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {adaptiveRankings.map((r, i) => (
            <div key={r.socketId} className={`flex items-center justify-between px-4 py-3 rounded-xl border ${i === 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-slate-50 border-slate-100'}`}>
              <div className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-black ${i === 0 ? 'bg-yellow-200 text-yellow-700' : i === 1 ? 'bg-slate-200 text-slate-600' : 'bg-slate-100 text-slate-400'}`}>{i + 1}</span>
                <span className="text-sm font-bold text-slate-700">{r.userName}</span>
              </div>
              <span className="text-lg font-black text-indigo-600">{r.score}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!activeAdaptive) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-50 text-slate-400 p-8 text-center border-l border-slate-200">
        <HelpCircle size={32} className="mb-4 opacity-20 text-slate-300" />
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Không có phiên adaptive đang diễn ra</p>
      </div>
    );
  }

  // Waiting for question
  if (!adaptiveCurrentQuestion) {
    // Show last result if available
    const lastResult = adaptiveQuestionResults.length > 0 ? adaptiveQuestionResults[adaptiveQuestionResults.length - 1] : null;
    const myLastResult = lastResult?.results.find(r => r.socketId === socket.id);

    return (
      <div className="flex flex-col h-full bg-white text-slate-900 overflow-hidden font-sans border-l border-slate-200">
        <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200 shrink-0">
          <Clock size={14} className="text-indigo-600 animate-pulse" />
          <h2 className="text-[11px] font-black uppercase tracking-tighter text-slate-700">{activeAdaptive.title}</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center text-center space-y-4">
          {lastResult && myLastResult ? (
            <div className={`p-6 rounded-2xl border w-full max-w-sm ${myLastResult.isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
              {myLastResult.isCorrect
                ? <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-2" />
                : <XCircle size={32} className="text-rose-500 mx-auto mb-2" />}
              <p className="font-black text-sm">{myLastResult.isCorrect ? 'Chính xác!' : 'Sai rồi!'}</p>
              <p className="text-xs text-slate-500 mt-1">{lastResult.correctCount}/{lastResult.totalCount} bạn trả lời đúng</p>
            </div>
          ) : null}

          {/* Mini scoreboard */}
          {adaptiveScores.length > 0 && (
            <div className="w-full max-w-sm space-y-1.5">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Bảng điểm</p>
              {[...adaptiveScores].sort((a, b) => b.score - a.score).map((s, i) => (
                <div key={s.socketId} className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs ${s.socketId === socket.id ? 'bg-indigo-50 border border-indigo-200 font-black' : 'bg-slate-50'}`}>
                  <span>{i + 1}. {s.userName}</span>
                  <span className="font-black text-indigo-600">{s.score}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 text-slate-400 mt-4">
            {countdown > 0 ? (
              <>
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 text-sm font-black">{countdown}</div>
                <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">Câu tiếp trong {countdown}s</p>
              </>
            ) : (
              <>
                <Loader2 className="animate-spin w-4 h-4" />
                <p className="text-[10px] font-black uppercase tracking-widest">Đang chờ câu hỏi tiếp theo...</p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Showing current question
  const q = adaptiveCurrentQuestion;
  const hasAnswered = adaptiveMyAnswer !== null;

  return (
    <div className="flex flex-col h-full bg-white text-slate-900 overflow-hidden font-sans border-l border-slate-200">
      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 border border-indigo-100">
            <span className="text-xs font-black">{adaptiveQuestionIndex}</span>
          </div>
          <div>
            <h2 className="text-[11px] font-black text-slate-800 uppercase tracking-tighter truncate max-w-[160px]">{activeAdaptive.title}</h2>
            <span className="text-[8px] font-black text-indigo-600 uppercase tracking-widest">ADAPTIVE LIVE</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="text-[14px] text-slate-800 font-bold leading-relaxed prose prose-slate prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={mdComponents}>
                {q.question.replace(/\\n/g, '\n')}
              </ReactMarkdown>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {q.options.map((opt: string, aIdx: number) => {
                const isSelected = adaptiveMyAnswer === aIdx;
                const showResult = adaptiveMyResult !== null;
                const isCorrectOption = showResult && aIdx === q.correctAnswer;
                const isWrongSelected = showResult && isSelected && !adaptiveMyResult;

                let btnClass = 'bg-slate-50 border-slate-200 hover:border-indigo-300 hover:bg-slate-100 text-slate-600';
                if (isSelected && !showResult) btnClass = 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200';
                if (isCorrectOption) btnClass = 'bg-emerald-100 border-emerald-400 text-emerald-700';
                if (isWrongSelected) btnClass = 'bg-rose-100 border-rose-400 text-rose-700';

                return (
                  <button
                    key={aIdx}
                    onClick={() => handleAnswer(aIdx)}
                    disabled={hasAnswered}
                    className={`text-left px-5 py-3.5 rounded-xl text-[13px] transition-all border flex items-center gap-4 disabled:cursor-default ${btnClass}`}
                  >
                    <span className={`w-6 h-6 rounded flex items-center justify-center text-[11px] font-black border transition-colors ${
                      isSelected ? 'bg-white text-indigo-600 border-white' : 'bg-white border-slate-300 text-slate-400'
                    }`}>
                      {String.fromCharCode(65 + aIdx)}
                    </span>
                    <span className="font-semibold prose prose-sm prose-slate max-w-none break-words whitespace-pre-wrap">
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{ p: ({ children }) => <>{children}</> }}>
                        {opt.replace(/\\n/g, '\n')}
                      </ReactMarkdown>
                    </span>
                    {isCorrectOption && <CheckCircle2 size={16} className="ml-auto text-emerald-500 shrink-0" />}
                    {isWrongSelected && <XCircle size={16} className="ml-auto text-rose-500 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {hasAnswered && adaptiveMyResult === null && (
              <div className="flex items-center justify-center gap-2 py-3 text-slate-400">
                <Loader2 className="animate-spin w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-widest">Đang chờ mọi người trả lời...</span>
              </div>
            )}

            {adaptiveMyResult !== null && q.explanation && (
              <div className="mt-4 p-4 bg-white/60 rounded-xl border-l-4 border-indigo-400">
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Giải thích</span>
                <div className="text-[12px] text-slate-600 italic leading-relaxed prose prose-slate prose-sm max-w-none mt-1">
                  <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={mdComponents}>
                    {q.explanation.replace(/\\n/g, '\n')}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdaptiveQuizRunner;
