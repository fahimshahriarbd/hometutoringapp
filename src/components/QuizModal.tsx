import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Question, QuizResult, ReviewItem } from '@/lib/supabase';
import { getBangladeshTimeString } from '@/lib/time';
import { X, Clock, Loader2, CheckCircle2, XCircle, MinusCircle } from 'lucide-react';

interface Props {
  lessonId: string;
  subject: string;
  studentId: string;
  existingResult: QuizResult | null;
  onClose: () => void;
  onComplete: () => void;
}

const QUESTION_TIME = 45;

export function QuizModal({ lessonId, subject, studentId, existingResult, onClose, onComplete }: Props) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(existingResult);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: qErr } = await supabase
        .from('questions')
        .select('*')
        .eq('lesson_id', lessonId)
        .order('created_at', { ascending: true });
      if (qErr) throw qErr;
      const qs = (data || []) as Question[];
      if (qs.length === 0) {
        setError('No quiz questions available for this lesson.');
        return;
      }
      setQuestions(qs);
      setCurrentIndex(0);
      setAnswers({});
      setTimeLeft(QUESTION_TIME);
    } catch {
      setError('Error loading quiz questions.');
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    if (existingResult) {
      setResult(existingResult);
      setLoading(false);
      return;
    }
    fetchQuestions();
  }, [fetchQuestions, existingResult]);

  // Timer effect
  useEffect(() => {
    if (result || loading || error || questions.length === 0) return;

    stopTimer();
    setTimeLeft(QUESTION_TIME);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          stopTimer();
          // Auto-advance
          handleNext();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => stopTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, result, loading, error, questions.length]);

  const handleAnswer = (questionId: string, choice: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: choice }));
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      submitQuiz();
    }
  };

  const handleSubmitClick = () => {
    stopTimer();
    handleNext();
  };

  const submitQuiz = async () => {
    stopTimer();
    setSubmitting(true);
    let score = 0;
    const review: ReviewItem[] = [];

    for (const q of questions) {
      const studentChoice = answers[q.id] || null;
      const isCorrect = studentChoice === q.answer;
      if (isCorrect) score++;

      const optMap: Record<string, string> = {
        A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d,
      };
      const studentText = studentChoice ? (optMap[studentChoice] || '') : 'Unanswered (Time Expired)';
      const correctText = optMap[q.answer] || '';

      review.push({
        question: q.question,
        studentChoice,
        studentText,
        correctChoice: q.answer,
        correctText,
        isCorrect,
        explanation: q.explanation || '',
      });
    }

    const total = questions.length;
    const percentage = Math.round((score / (total || 1)) * 100);

    try {
      // Upsert: one result per student per lesson
      const { data: existing } = await supabase
        .from('quiz_results')
        .select('id')
        .eq('student_id', studentId)
        .eq('lesson_id', lessonId)
        .maybeSingle();

      let savedResult: QuizResult;

      if (existing) {
        const { data: updated, error: uErr } = await supabase
          .from('quiz_results')
          .update({
            score, total, percentage,
            review: review as unknown as Record<string, unknown>[],
            created_at: getBangladeshTimeString(),
          })
          .eq('id', existing.id)
          .select('*')
          .single();
        if (uErr) throw uErr;
        savedResult = updated as QuizResult;
      } else {
        const { data: inserted, error: iErr } = await supabase
          .from('quiz_results')
          .insert({
            student_id: studentId,
            lesson_id: lessonId,
            score, total, percentage,
            review: review as unknown as Record<string, unknown>[],
            created_at: getBangladeshTimeString(),
          })
          .select('*')
          .single();
        if (iErr) throw iErr;
        savedResult = inserted as QuizResult;
      }

      setResult(savedResult);
    } catch {
      // Fallback to local result
      setResult({
        id: 'local',
        student_id: studentId,
        lesson_id: lessonId,
        score, total, percentage,
        review,
        created_at: getBangladeshTimeString(),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    stopTimer();
    if (result) {
      onComplete();
    } else {
      onClose();
    }
  };

  // Render result view
  if (result) {
    const correct = result.review.filter(r => r.isCorrect).length;
    const wrong = result.review.filter(r => !r.isCorrect && r.studentChoice).length;
    const unanswered = result.review.filter(r => !r.studentChoice).length;
    const pct = result.percentage;

    let title = 'Review Topic Notes!';
    if (pct >= 80) title = 'Excellent Score!';
    else if (pct >= 50) title = 'Good Effort!';

    const correctDeg = (correct / (result.total || 1)) * 360;
    const wrongDeg = (wrong / (result.total || 1)) * 360;

    let donutBg = '';
    if (correct === result.total) donutBg = '#22c55e';
    else if (wrong === result.total && unanswered === 0) donutBg = '#ef4444';
    else if (unanswered === result.total) donutBg = '#eab308';
    else {
      donutBg = `conic-gradient(#22c55e 0deg ${correctDeg}deg, #ef4444 ${correctDeg}deg ${correctDeg + wrongDeg}deg, #eab308 ${correctDeg + wrongDeg}deg 360deg)`;
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-800">{subject} Result</h3>
              <p className="text-xs text-slate-500">Completed Quiz Summary</p>
            </div>
            <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="overflow-y-auto p-5">
            {/* Score Donut */}
            <div className="flex flex-col items-center mb-5">
              <h2 className="text-lg font-bold text-slate-800 mb-4">{title}</h2>
              <div className="relative w-32 h-32 rounded-full flex items-center justify-center" style={{ background: donutBg }}>
                <div className="w-24 h-24 bg-white rounded-full flex flex-col items-center justify-center shadow-inner">
                  <div className="text-2xl font-bold text-slate-800">{pct}%</div>
                  <div className="text-xs text-slate-500">{result.score} / {result.total}</div>
                </div>
              </div>
            </div>

            {/* Breakdown */}
            <div className="flex justify-center gap-3 mb-5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5" /> Correct: <b>{correct}</b>
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
                <XCircle className="w-3.5 h-3.5" /> Wrong: <b>{wrong}</b>
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 px-2.5 py-1 rounded-full">
                <MinusCircle className="w-3.5 h-3.5" /> Unanswered: <b>{unanswered}</b>
              </span>
            </div>

            {/* Review */}
            <div className="space-y-3">
              {result.review.map((r, i) => (
                <div key={i} className={`rounded-lg border p-3 ${r.isCorrect ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}`}>
                  <div className="flex items-start gap-2">
                    {r.isCorrect ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800">{r.question}</div>
                      <div className="text-xs text-slate-600 mt-1">
                        Your answer: <span className={r.isCorrect ? 'text-green-700 font-medium' : 'text-red-700 font-medium'}>{r.studentText}</span>
                      </div>
                      {!r.isCorrect && (
                        <div className="text-xs text-slate-600 mt-0.5">
                          Correct: <span className="text-green-700 font-medium">{r.correctText}</span>
                        </div>
                      )}
                      {r.explanation && (
                        <div className="text-xs text-slate-500 mt-1 italic">{r.explanation}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="px-5 py-3 border-t border-slate-100">
            <button
              onClick={handleClose}
              className="w-full bg-sky-500 hover:bg-sky-600 text-white font-semibold py-2.5 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 flex flex-col items-center">
          <Loader2 className="w-8 h-8 text-sky-500 animate-spin mb-3" />
          <p className="text-sm text-slate-600">Loading quiz questions...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 flex flex-col items-center">
          <XCircle className="w-8 h-8 text-red-500 mb-3" />
          <p className="text-sm text-slate-600 text-center">{error}</p>
          <button onClick={onClose} className="mt-4 text-sm font-medium text-sky-600 hover:text-sky-700">Close</button>
        </div>
      </div>
    );
  }

  // Quiz question view
  const q = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;
  const progressPct = Math.round(((currentIndex + 1) / questions.length) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-white bg-sky-500 px-2 py-0.5 rounded">{subject}</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1 ${timeLeft <= 10 ? 'text-red-700 bg-red-100' : 'text-slate-700 bg-slate-100'}`}>
                <Clock className="w-3 h-3" />
                {timeLeft}s
              </span>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          <h3 className="text-base font-bold text-slate-800">{subject} Quiz</h3>
          <p className="text-xs text-slate-500">Question {currentIndex + 1} of {questions.length}</p>
          {/* Progress bar */}
          <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-sky-500 transition-all duration-300" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {/* Question */}
        <div className="overflow-y-auto p-5">
          <div className="mb-4">
            <div className="flex items-start gap-2 mb-4">
              <span className="text-xs font-bold text-white bg-slate-700 px-2 py-1 rounded flex-shrink-0">Q{currentIndex + 1}</span>
              <div className="text-sm font-medium text-slate-800 leading-relaxed">{q.question}</div>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-2">
            {(['A', 'B', 'C', 'D'] as const).map((opt) => {
              const text = opt === 'A' ? q.option_a : opt === 'B' ? q.option_b : opt === 'C' ? q.option_c : q.option_d;
              const selected = answers[q.id] === opt;
              return (
                <label
                  key={opt}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-all ${
                    selected
                      ? 'border-sky-500 bg-sky-50 ring-1 ring-sky-500'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name={`q_${q.id}`}
                    value={opt}
                    checked={selected}
                    onChange={() => handleAnswer(q.id, opt)}
                    className="w-4 h-4 text-sky-500 focus:ring-sky-500"
                  />
                  <span className="text-sm text-slate-700">{text}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100">
          <button
            onClick={handleSubmitClick}
            disabled={submitting}
            className="w-full bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold py-2.5 rounded-lg transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Submitting...</span>
              </>
            ) : isLast ? (
              'Submit Quiz'
            ) : (
              'Next Question'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
