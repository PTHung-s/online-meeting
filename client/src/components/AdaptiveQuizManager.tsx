import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useMeetingStore } from '../store/useMeetingStore';
import { socket } from '../services/socket';
import { Zap, Play, Sparkles, Loader2, CheckCircle2, XCircle, Award, Plus, ChevronRight, ChevronDown, ChevronUp, Trophy, X, SkipForward } from 'lucide-react';
import type { QuizQuestion } from '../types/quiz';
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

type CreatorView = 'closed' | 'recommend' | 'pick-version' | 'manual-add';

const AdaptiveQuizManager: React.FC<{ onBack: () => void; embedded?: boolean }> = ({ onBack, embedded }) => {
  const {
    activeAdaptive,
    adaptiveCurrentQuestion,
    adaptiveQuestionIndex,
    adaptiveAnswerProgress,
    adaptiveQuestionResults,
    adaptiveScores,
    adaptiveRankings,
    adaptiveCountdown,
    adaptiveQuestionQueue: questionQueue,
    addToAdaptiveQueue,
    removeFromAdaptiveQueue,
    shiftAdaptiveQueue,
    roomId,
    resetAdaptive,
  } = useMeetingStore();

  const [started, setStarted] = useState(!!activeAdaptive);
  const [title, setTitle] = useState('');
  const [creatorView, setCreatorView] = useState<CreatorView>('closed');

  // AI recommend state
  const [isRecommending, setIsRecommending] = useState(false);
  const [recommendedTopics, setRecommendedTopics] = useState<{ title: string; reason: string }[] | null>(null);
  const [topicHint, setTopicHint] = useState('');
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [generatedVersions, setGeneratedVersions] = useState<{ versionA: QuizQuestion[]; versionB: QuizQuestion[] } | null>(null);
  const [selectedTopic, setSelectedTopic] = useState('');

  // Manual add state
  const [manualQuestion, setManualQuestion] = useState<Partial<QuizQuestion>>({
    question: '', options: ['', '', '', ''], correctAnswer: 0, explanation: ''
  });

  // Countdown timer (client-side tick)
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sortedScores = useMemo(() =>
    [...adaptiveScores].sort((a, b) => b.score - a.score)
  , [adaptiveScores]);

  const lastResult = adaptiveQuestionResults.length > 0 ? adaptiveQuestionResults[adaptiveQuestionResults.length - 1] : null;
  const isWaitingAnswers = !!adaptiveCurrentQuestion;

  // Start countdown timer when server sends countdown
  useEffect(() => {
    if (adaptiveCountdown > 0) {
      setCountdown(adaptiveCountdown);
      if (countdownRef.current) clearInterval(countdownRef.current);
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setCountdown(0);
      if (countdownRef.current) clearInterval(countdownRef.current);
    }
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [adaptiveCountdown]);

  // Auto-push next question from queue when server signals
  const handleAutoNext = useCallback(() => {
    const queue = useMeetingStore.getState().adaptiveQuestionQueue;
    if (queue.length > 0 && roomId && !adaptiveCurrentQuestion) {
      const next = queue[0];
      socket.emit('adaptive:push-question', { roomId, question: next });
      shiftAdaptiveQueue();
    }
  }, [roomId, adaptiveCurrentQuestion, shiftAdaptiveQueue]);

  useEffect(() => {
    window.addEventListener('adaptive:auto-next', handleAutoNext);
    return () => window.removeEventListener('adaptive:auto-next', handleAutoNext);
  }, [handleAutoNext]);

  const handleStart = () => {
    if (!title || !roomId) return;
    socket.emit('adaptive:start', { roomId, title }, (res: any) => {
      if (res.ok) setStarted(true);
    });
  };

  const handleEnd = () => {
    if (!window.confirm('Kết thúc phiên adaptive? Sẽ tính điểm xếp hạng.')) return;
    if (roomId) {
      socket.emit('adaptive:end', { roomId }, () => {
        setStarted(false);
      });
    }
  };

  const handlePushNext = () => {
    if (questionQueue.length === 0 || !roomId) return;
    socket.emit('adaptive:skip-countdown', { roomId });
    const next = questionQueue[0];
    socket.emit('adaptive:push-question', { roomId, question: next });
    shiftAdaptiveQueue();
  };

  const handleSkipCountdown = () => {
    if (roomId) socket.emit('adaptive:skip-countdown', { roomId });
  };

  // AI recommend
  const handleRecommend = async () => {
    setIsRecommending(true);
    setRecommendedTopics(null);
    try {
      const res = await fetch('/api/ai/adaptive-recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionHistory: adaptiveQuestionResults, topic: topicHint })
      });
      const data = await res.json();
      if (data.topics) {
        setRecommendedTopics(data.topics);
        setCreatorView('recommend');
      }
    } catch (e) {
      console.error('AI recommend failed:', e);
    } finally {
      setIsRecommending(false);
    }
  };

  const handlePickTopic = async (topic: string) => {
    setSelectedTopic(topic);
    setIsGeneratingQuestions(true);
    setGeneratedVersions(null);
    try {
      const res = await fetch('/api/ai/adaptive-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, questionHistory: adaptiveQuestionResults })
      });
      const data = await res.json();
      if (data.versionA && data.versionB) {
        setGeneratedVersions(data);
        setCreatorView('pick-version');
      }
    } catch (e) {
      console.error('AI generate failed:', e);
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  const handlePickVersion = (version: 'A' | 'B') => {
    if (!generatedVersions) return;
    const questions = version === 'A' ? generatedVersions.versionA : generatedVersions.versionB;
    addToAdaptiveQueue(questions);
    setGeneratedVersions(null);
    setRecommendedTopics(null);
    setCreatorView('closed');
  };

  const handleAddManualQuestion = () => {
    if (!manualQuestion.question) return;
    const q: QuizQuestion = {
      ...manualQuestion as QuizQuestion,
      id: Math.random().toString(36).substr(2, 9)
    };
    addToAdaptiveQueue([q]);
    setManualQuestion({ question: '', options: ['', '', '', ''], correctAnswer: 0, explanation: '' });
    setCreatorView('closed');
  };

  // Final rankings display
  if (!activeAdaptive && adaptiveRankings) {
    return (
      <div className="flex flex-col h-full bg-white text-slate-900 overflow-hidden font-sans border-l border-slate-200">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <Trophy size={14} className="text-yellow-500" />
            <h2 className="text-[11px] font-black uppercase tracking-tighter text-slate-700">Bảng xếp hạng cuối</h2>
          </div>
          <button onClick={() => { resetAdaptive(); onBack(); }} className="text-[10px] font-bold text-slate-400 hover:text-slate-600 px-2 py-1 rounded hover:bg-slate-200/50">ĐÓNG</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {adaptiveRankings.map((r, i) => (
            <div key={r.socketId} className={`flex items-center justify-between px-4 py-3 rounded-xl border ${i === 0 ? 'bg-yellow-50 border-yellow-200' : i === 1 ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-100'}`}>
              <div className="flex items-center gap-3">
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black ${i === 0 ? 'bg-yellow-200 text-yellow-700' : i === 1 ? 'bg-slate-200 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-400'}`}>{i + 1}</span>
                <span className="text-sm font-bold text-slate-700">{r.userName}</span>
              </div>
              <span className="text-lg font-black text-indigo-600">{r.score}<span className="text-[10px] text-slate-400 ml-1">đ</span></span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Setup view
  if (!started && !activeAdaptive) {
    return (
      <div className="flex flex-col h-full bg-white text-slate-900 overflow-hidden font-sans border-l border-slate-200">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-amber-500 fill-amber-500" />
            <h2 className="text-[11px] font-black uppercase tracking-tighter text-slate-700">Adaptive Quiz</h2>
          </div>
          <button onClick={onBack} className="text-[10px] font-bold text-slate-400 hover:text-slate-600 px-2 py-1 rounded hover:bg-slate-200/50">QUAY LẠI</button>
        </div>
        <div className="flex-1 p-6 flex flex-col items-center justify-center space-y-6">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 border border-amber-200">
            <Zap size={28} />
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-lg font-black text-slate-800">Chế độ Adaptive</h3>
            <p className="text-xs text-slate-500 max-w-xs">Ra từng câu hỏi, AI phân tích điểm yếu và gợi ý câu tiếp theo.</p>
          </div>
          <div className="w-full max-w-xs space-y-3">
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Tên phiên (VD: Ôn tập Python)..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
            <button
              onClick={handleStart}
              disabled={!title}
              className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-amber-100 transition-all flex items-center justify-center gap-2"
            >
              <Play size={14} /> BẮT ĐẦU PHIÊN
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =============================================
  // LIVE VIEW
  // embedded = FlexLayout tab (full question display + controls + creator)
  // !embedded = Sidebar (compact tracking: progress, scores, countdown, queue, controls)
  // =============================================
  const currentQ = adaptiveCurrentQuestion;

  // === SIDEBAR (compact tracking view) ===
  if (!embedded) {
    return (
      <div className="flex flex-col h-full bg-white text-slate-900 overflow-hidden font-sans border-l border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600 border border-amber-100">
              <span className="text-xs font-black">{adaptiveQuestionIndex}</span>
            </div>
            <div>
              <h2 className="text-[11px] font-black text-slate-800 uppercase tracking-tighter truncate max-w-[200px]">{activeAdaptive?.title || 'Adaptive'}</h2>
              <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest">ĐANG DIỄN RA</span>
            </div>
          </div>
          <button onClick={handleEnd} className="text-[10px] font-bold text-red-500 hover:bg-red-50 px-2 py-1 rounded uppercase tracking-widest">KẾT THÚC</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {/* Progress bar when waiting answers */}
          {isWaitingAnswers && (
            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl space-y-2">
              <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Câu {adaptiveQuestionIndex} — Đang chờ trả lời</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2.5 bg-indigo-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 transition-all duration-500 rounded-full" style={{ width: `${adaptiveAnswerProgress.total > 0 ? (adaptiveAnswerProgress.count / adaptiveAnswerProgress.total) * 100 : 0}%` }} />
                </div>
                <span className="text-sm font-black text-indigo-600">{adaptiveAnswerProgress.count}/{adaptiveAnswerProgress.total}</span>
              </div>
            </div>
          )}

          {/* Last question result summary */}
          {lastResult && !isWaitingAnswers && (
            <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Kết quả câu {adaptiveQuestionResults.length}</p>
                <span className="text-xs font-black text-indigo-600">{lastResult.correctCount}/{lastResult.totalCount} đúng</span>
              </div>
              <div className="space-y-1">
                {lastResult.results.map(r => (
                  <div key={r.socketId} className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs ${r.isCorrect ? 'bg-emerald-50 border border-emerald-100' : 'bg-rose-50 border border-rose-100'}`}>
                    <span className="font-semibold text-slate-700">{r.userName}</span>
                    {r.isCorrect ? <CheckCircle2 size={12} className="text-emerald-500" /> : <XCircle size={12} className="text-rose-500" />}
                  </div>
                ))}
              </div>
              {/* Countdown + Next */}
              {countdown > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-amber-200 flex items-center justify-center text-amber-700 text-xs font-black">{countdown}</div>
                      <span className="text-[9px] font-bold text-amber-700">Câu tiếp trong {countdown}s</span>
                    </div>
                    <button onClick={handleSkipCountdown} className="text-[8px] font-black text-amber-600 hover:bg-amber-100 px-1.5 py-0.5 rounded uppercase">BỎ QUA</button>
                  </div>
                  {questionQueue.length > 0 && (
                    <button onClick={handlePushNext} className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5">
                      <SkipForward size={12} /> GỬI CÂU TIẾP NGAY ({questionQueue.length})
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Scoreboard */}
          {sortedScores.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Award size={10} /> Bảng điểm</p>
              {sortedScores.map((s, i) => (
                <div key={s.socketId} className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs ${i === 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-slate-50 border border-slate-100'}`}>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded text-[8px] font-black flex items-center justify-center bg-slate-200 text-slate-500">{i + 1}</span>
                    <span className="font-semibold">{s.userName}</span>
                  </div>
                  <span className="font-black text-indigo-600">{s.score}</span>
                </div>
              ))}
            </div>
          )}

          {/* Queue count */}
          {questionQueue.length > 0 && (
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1.5">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Hàng đợi ({questionQueue.length} câu)</p>
              {questionQueue.map((q, i) => (
                <div key={q.id} className="flex items-center gap-2 px-2 py-1 bg-white border border-slate-100 rounded-lg">
                  <span className="w-4 h-4 bg-slate-200 rounded text-[8px] font-black flex items-center justify-center text-slate-500">{i + 1}</span>
                  <p className="text-[10px] font-semibold text-slate-500 truncate flex-1">{q.question.substring(0, 60)}</p>
                  <button onClick={() => removeFromAdaptiveQueue(q.id)} className="text-slate-300 hover:text-red-400 p-0.5"><X size={10} /></button>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!currentQ && !lastResult && adaptiveQuestionIndex === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400 text-center">
              <Zap size={24} className="text-amber-300 mb-2" />
              <p className="text-[10px] font-black uppercase tracking-widest">Phiên đã bắt đầu</p>
              <p className="text-[9px] text-slate-400 mt-1">Tạo câu hỏi bằng AI hoặc thêm thủ công</p>
            </div>
          )}
        </div>

        {/* Bottom controls */}
        <div className="p-3 bg-white border-t border-slate-200 shrink-0 space-y-2">
          <button
            onClick={handlePushNext}
            disabled={questionQueue.length === 0}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-colors"
          >
            <SkipForward size={12} /> GỬI CÂU TIẾP ({questionQueue.length})
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => setCreatorView(creatorView === 'closed' ? 'recommend' : 'closed')}
              className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1 border transition-colors ${
                creatorView !== 'closed' && creatorView !== 'manual-add' ? 'bg-purple-50 border-purple-200 text-purple-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Sparkles size={11} /> AI GỢI Ý
            </button>
            <button
              onClick={() => setCreatorView(creatorView === 'manual-add' ? 'closed' : 'manual-add')}
              className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1 border transition-colors ${
                creatorView === 'manual-add' ? 'bg-slate-100 border-slate-300 text-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Plus size={11} /> THÊM CÂU
            </button>
          </div>
        </div>

        {/* Creator panel in sidebar */}
        {creatorView !== 'closed' && <CreatorPanel creatorView={creatorView} setCreatorView={setCreatorView} isRecommending={isRecommending} recommendedTopics={recommendedTopics} topicHint={topicHint} setTopicHint={setTopicHint} isGeneratingQuestions={isGeneratingQuestions} selectedTopic={selectedTopic} generatedVersions={generatedVersions} manualQuestion={manualQuestion} setManualQuestion={setManualQuestion} handleRecommend={handleRecommend} handlePickTopic={handlePickTopic} handlePickVersion={handlePickVersion} handleAddManualQuestion={handleAddManualQuestion} />}
      </div>
    );
  }

  // === EMBEDDED (FlexLayout tab - full question display) ===
  return (
    <div className="flex flex-col h-full bg-white text-slate-900 overflow-hidden font-sans border-l border-slate-200 relative">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600 border border-amber-100">
            <span className="text-xs font-black">{adaptiveQuestionIndex}</span>
          </div>
          <div>
            <h2 className="text-[11px] font-black text-slate-800 uppercase tracking-tighter truncate max-w-[140px]">{activeAdaptive?.title || 'Adaptive'}</h2>
            <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest">HOST CONTROL</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-black text-slate-400 bg-slate-100 px-2 py-1 rounded">{questionQueue.length} câu chờ</span>
          <button onClick={handleEnd} className="text-[10px] font-bold text-red-500 hover:bg-red-50 px-2 py-1 rounded uppercase tracking-widest">KẾT THÚC</button>
        </div>
      </div>

      {/* Main quiz area - mirrors student view */}
      <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50 custom-scrollbar">
        <div className="max-w-2xl mx-auto space-y-4">

          {/* Active question display (same as student) */}
          {currentQ && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="text-[14px] text-slate-800 font-bold leading-relaxed prose prose-slate prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={mdComponents}>
                  {currentQ.question.replace(/\\n/g, '\n')}
                </ReactMarkdown>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {currentQ.options.map((opt: string, aIdx: number) => {
                  const isCorrect = aIdx === currentQ.correctAnswer;
                  return (
                    <div
                      key={aIdx}
                      className={`text-left px-4 py-3 rounded-xl text-[13px] border flex items-center gap-3 ${isCorrect ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
                    >
                      <span className={`w-6 h-6 rounded flex items-center justify-center text-[11px] font-black border ${isCorrect ? 'bg-emerald-200 border-emerald-300 text-emerald-700' : 'bg-white border-slate-300 text-slate-400'}`}>
                        {String.fromCharCode(65 + aIdx)}
                      </span>
                      <span className="font-semibold prose prose-sm prose-slate max-w-none break-words whitespace-pre-wrap">
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{ p: ({ children }) => <>{children}</> }}>
                          {opt.replace(/\\n/g, '\n')}
                        </ReactMarkdown>
                      </span>
                      {isCorrect && <CheckCircle2 size={16} className="ml-auto text-emerald-500 shrink-0" />}
                    </div>
                  );
                })}
              </div>

              {/* Answer progress bar */}
              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl space-y-2">
                <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Đang chờ trả lời</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2.5 bg-indigo-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 transition-all duration-500 rounded-full" style={{ width: `${adaptiveAnswerProgress.total > 0 ? (adaptiveAnswerProgress.count / adaptiveAnswerProgress.total) * 100 : 0}%` }} />
                  </div>
                  <span className="text-sm font-black text-indigo-600">{adaptiveAnswerProgress.count}/{adaptiveAnswerProgress.total}</span>
                </div>
              </div>

              {currentQ.explanation && (
                <div className="p-3 bg-white/60 rounded-xl border-l-4 border-indigo-400">
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Giải thích</span>
                  <div className="text-[12px] text-slate-600 italic leading-relaxed prose prose-slate prose-sm max-w-none mt-1">
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={mdComponents}>
                      {currentQ.explanation.replace(/\\n/g, '\n')}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Last question result */}
          {lastResult && !isWaitingAnswers && (
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Kết quả câu {adaptiveQuestionResults.length}</p>
                <span className="text-xs font-black text-indigo-600">{lastResult.correctCount}/{lastResult.totalCount} đúng</span>
              </div>
              <div className="space-y-1.5">
                {lastResult.results.map(r => (
                  <div key={r.socketId} className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs ${r.isCorrect ? 'bg-emerald-50 border border-emerald-100' : 'bg-rose-50 border border-rose-100'}`}>
                    <span className="font-semibold text-slate-700">{r.userName}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400">
                        {String.fromCharCode(65 + r.selectedOption)}
                      </span>
                      {r.isCorrect ? <CheckCircle2 size={14} className="text-emerald-500" /> : <XCircle size={14} className="text-rose-500" />}
                    </div>
                  </div>
                ))}
              </div>

              {/* Countdown + Next button */}
              {countdown > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center text-amber-700 text-sm font-black">{countdown}</div>
                      <span className="text-[10px] font-bold text-amber-700">Câu tiếp trong {countdown}s</span>
                    </div>
                    <button onClick={handleSkipCountdown} className="text-[9px] font-black text-amber-600 hover:bg-amber-100 px-2 py-1 rounded uppercase">BỎ QUA</button>
                  </div>
                  {questionQueue.length > 0 && (
                    <button onClick={handlePushNext} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 shadow-md shadow-indigo-200">
                      <SkipForward size={13} /> GỬI CÂU TIẾP NGAY ({questionQueue.length})
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Scoreboard */}
          {sortedScores.length > 0 && (
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Award size={10} /> Bảng điểm</p>
              <div className="space-y-1">
                {sortedScores.map((s, i) => (
                  <div key={s.socketId} className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs ${i === 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-slate-50 border border-slate-100'}`}>
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded text-[8px] font-black flex items-center justify-center bg-slate-200 text-slate-500">{i + 1}</span>
                      <span className="font-semibold">{s.userName}</span>
                    </div>
                    <span className="font-black text-indigo-600">{s.score}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Queue preview */}
          {questionQueue.length > 0 && (
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Hàng đợi ({questionQueue.length} câu)</p>
              {questionQueue.map((q, i) => (
                <div key={q.id} className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg">
                  <span className="w-5 h-5 bg-slate-200 rounded text-[9px] font-black flex items-center justify-center text-slate-500">{i + 1}</span>
                  <p className="text-[11px] font-semibold text-slate-600 truncate flex-1">{q.question.substring(0, 80)}</p>
                  <button
                    onClick={() => removeFromAdaptiveQueue(q.id)}
                    className="text-slate-300 hover:text-red-400 p-0.5"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* No question state */}
          {!currentQ && !lastResult && adaptiveQuestionIndex === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center">
              <Zap size={28} className="text-amber-300 mb-3" />
              <p className="text-xs font-black uppercase tracking-widest">Phiên đã bắt đầu</p>
              <p className="text-[10px] text-slate-400 mt-1">Tạo câu hỏi bằng AI hoặc thêm thủ công</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom control bar */}
      <div className="p-3 bg-white border-t border-slate-200 shrink-0 space-y-2">
        {/* Push next - always visible */}
        <button
          onClick={handlePushNext}
          disabled={questionQueue.length === 0}
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-colors"
        >
          <SkipForward size={12} /> GỬI CÂU TIẾP ({questionQueue.length})
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => setCreatorView(creatorView === 'closed' ? 'recommend' : 'closed')}
            className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1 border transition-colors ${
              creatorView !== 'closed' && creatorView !== 'manual-add' ? 'bg-purple-50 border-purple-200 text-purple-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Sparkles size={11} /> AI GỢI Ý
            {creatorView !== 'closed' && creatorView !== 'manual-add' ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
          </button>
          <button
            onClick={() => setCreatorView(creatorView === 'manual-add' ? 'closed' : 'manual-add')}
            className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1 border transition-colors ${
              creatorView === 'manual-add' ? 'bg-slate-100 border-slate-300 text-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Plus size={11} /> THÊM CÂU
          </button>
        </div>
      </div>

      {/* Floating Creator Panel */}
      {creatorView !== 'closed' && <CreatorPanel creatorView={creatorView} setCreatorView={setCreatorView} isRecommending={isRecommending} recommendedTopics={recommendedTopics} topicHint={topicHint} setTopicHint={setTopicHint} isGeneratingQuestions={isGeneratingQuestions} selectedTopic={selectedTopic} generatedVersions={generatedVersions} manualQuestion={manualQuestion} setManualQuestion={setManualQuestion} handleRecommend={handleRecommend} handlePickTopic={handlePickTopic} handlePickVersion={handlePickVersion} handleAddManualQuestion={handleAddManualQuestion} />}
    </div>
  );
};

// Sub-component: Floating creator panel (used in both sidebar and embedded)
const CreatorPanel: React.FC<{
  creatorView: CreatorView;
  setCreatorView: (v: CreatorView) => void;
  isRecommending: boolean;
  recommendedTopics: { title: string; reason: string }[] | null;
  topicHint: string;
  setTopicHint: (v: string) => void;
  isGeneratingQuestions: boolean;
  selectedTopic: string;
  generatedVersions: { versionA: QuizQuestion[]; versionB: QuizQuestion[] } | null;
  manualQuestion: Partial<QuizQuestion>;
  setManualQuestion: (q: Partial<QuizQuestion>) => void;
  handleRecommend: () => void;
  handlePickTopic: (topic: string) => void;
  handlePickVersion: (version: 'A' | 'B') => void;
  handleAddManualQuestion: () => void;
}> = ({ creatorView, setCreatorView, isRecommending, recommendedTopics, topicHint, setTopicHint, isGeneratingQuestions, selectedTopic, generatedVersions, manualQuestion, setManualQuestion, handleRecommend, handlePickTopic, handlePickVersion, handleAddManualQuestion }) => (
  <div className="absolute bottom-0 left-0 right-0 bg-white border-t-2 border-purple-200 shadow-2xl shadow-black/20 rounded-t-2xl z-20 flex flex-col" style={{ maxHeight: '65%' }}>
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 shrink-0">
      <div className="flex items-center gap-2">
        {creatorView === 'manual-add' ? <Plus size={13} className="text-slate-600" /> : <Sparkles size={13} className="text-purple-600" />}
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-700">
          {creatorView === 'manual-add' ? 'Thêm câu hỏi' : creatorView === 'pick-version' ? 'Chọn phiên bản' : 'AI Gợi ý'}
        </h3>
      </div>
      <button onClick={() => setCreatorView('closed')} className="text-slate-400 hover:text-slate-600 p-1">
        <X size={14} />
      </button>
    </div>
    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
      {creatorView === 'recommend' && (
        <>
          <div className="flex gap-2">
            <input type="text" value={topicHint} onChange={e => setTopicHint(e.target.value)} placeholder="Gợi ý chủ đề (tùy chọn)..." className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-purple-400" />
            <button onClick={handleRecommend} disabled={isRecommending} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-200 text-white rounded-lg text-[9px] font-black uppercase flex items-center gap-1.5">
              {isRecommending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles size={11} />}
              {isRecommending ? 'ĐANG...' : 'GỢI Ý'}
            </button>
          </div>
          {isGeneratingQuestions && (
            <div className="flex items-center justify-center gap-2 py-4 text-purple-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-[10px] font-black uppercase tracking-widest">Đang tạo câu hỏi cho "{selectedTopic}"...</span>
            </div>
          )}
          {!isGeneratingQuestions && recommendedTopics && recommendedTopics.map((t, i) => (
            <button key={i} onClick={() => handlePickTopic(t.title)} className="w-full text-left flex items-start gap-3 px-3 py-2.5 bg-purple-50 border border-purple-100 rounded-xl hover:bg-purple-100 transition-colors">
              <span className="w-5 h-5 bg-purple-200 text-purple-700 rounded flex items-center justify-center text-[9px] font-black shrink-0 mt-0.5">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-slate-800">{t.title}</p>
                <p className="text-[9px] text-slate-500 mt-0.5">{t.reason}</p>
              </div>
              <ChevronRight size={12} className="text-purple-400 shrink-0 mt-1" />
            </button>
          ))}
        </>
      )}
      {creatorView === 'pick-version' && generatedVersions && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <button onClick={() => setCreatorView('recommend')} className="text-[9px] font-bold text-purple-500 hover:text-purple-700 flex items-center gap-0.5">← Chủ đề khác</button>
            <span className="text-[9px] text-slate-400">|</span>
            <span className="text-[10px] font-bold text-purple-600">{selectedTopic}</span>
          </div>
          <div className="space-y-2 p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl">
            <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Phiên bản A</p>
            {generatedVersions.versionA.map((q, i) => (<QuestionPreviewCard key={q.id} question={q} index={i} />))}
            <button onClick={() => handlePickVersion('A')} className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1"><Plus size={10} /> CHỌN A</button>
          </div>
          <div className="space-y-2 p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl">
            <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Phiên bản B</p>
            {generatedVersions.versionB.map((q, i) => (<QuestionPreviewCard key={q.id} question={q} index={i} />))}
            <button onClick={() => handlePickVersion('B')} className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1"><Plus size={10} /> CHỌN B</button>
          </div>
        </>
      )}
      {creatorView === 'manual-add' && (
        <>
          <textarea value={manualQuestion.question} onChange={e => setManualQuestion({ ...manualQuestion, question: e.target.value })} placeholder="Nội dung câu hỏi..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-400 min-h-[60px] resize-none font-medium" />
          <div className="grid grid-cols-1 gap-1.5">
            {manualQuestion.options?.map((opt, idx) => (
              <div key={idx} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border ${manualQuestion.correctAnswer === idx ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100'}`}>
                <button onClick={() => setManualQuestion({ ...manualQuestion, correctAnswer: idx })} className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-black ${manualQuestion.correctAnswer === idx ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{String.fromCharCode(65 + idx)}</button>
                <input type="text" value={opt} onChange={e => { const newOpts = [...(manualQuestion.options || [])]; newOpts[idx] = e.target.value; setManualQuestion({ ...manualQuestion, options: newOpts }); }} placeholder={`Lựa chọn ${idx + 1}`} className="flex-1 bg-transparent border-none px-2 py-0.5 text-xs font-semibold focus:outline-none" />
              </div>
            ))}
          </div>
          <input type="text" value={manualQuestion.explanation || ''} onChange={e => setManualQuestion({ ...manualQuestion, explanation: e.target.value })} placeholder="Giải thích (không bắt buộc)..." className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none" />
          <button onClick={handleAddManualQuestion} disabled={!manualQuestion.question} className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-200 text-white rounded-xl text-[9px] font-black uppercase tracking-widest">+ THÊM VÀO HÀNG ĐỢI</button>
        </>
      )}
    </div>
  </div>
);

// Sub-component for question preview
const QuestionPreviewCard: React.FC<{ question: QuizQuestion; index: number }> = ({ question, index }) => {
  return (
    <div className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-1.5">
      <p className="text-[9px] font-black text-slate-400">Câu {index + 1}</p>
      <div className="text-[11px] font-bold text-slate-700 prose prose-slate prose-sm max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={mdComponents}>
          {question.question.replace(/\\n/g, '\n')}
        </ReactMarkdown>
      </div>
      <div className="grid grid-cols-2 gap-1">
        {question.options.map((opt, i) => (
          <div key={i} className={`px-2 py-0.5 rounded text-[9px] ${i === question.correctAnswer ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-200' : 'bg-slate-50 text-slate-500'}`}>
            {String.fromCharCode(65 + i)}. <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{ p: ({ children }) => <>{children}</> }}>{opt.replace(/\\n/g, '\n')}</ReactMarkdown>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdaptiveQuizManager;
