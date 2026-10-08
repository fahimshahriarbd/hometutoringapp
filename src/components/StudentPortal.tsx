import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Student, StudyDay, Lesson, QuizResult, ReviewItem } from '@/lib/supabase';
import type { SessionUser } from '@/App';
import { QuizModal } from '@/components/QuizModal';
import { GraduationCap, LogOut, FileText, Clock, CheckCircle2, ChevronRight, Loader2, BookOpen } from 'lucide-react';

interface Props {
  user: Extract<SessionUser, { role: 'student' }>;
  onLogout: () => void;
}

interface DayWithLessons extends StudyDay {
  lessons: Lesson[];
}

export function StudentPortal({ user, onLogout }: Props) {
  const [student, setStudent] = useState<Student | null>(null);
  const [days, setDays] = useState<DayWithLessons[]>([]);
  const [results, setResults] = useState<Map<string, QuizResult>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quizState, setQuizState] = useState<{ lessonId: string; subject: string } | null>(null);
  const [quizResultView, setQuizResultView] = useState<QuizResult | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [studRes, daysRes, resultsRes] = await Promise.all([
        supabase.from('students').select('*').eq('id', user.studentId).maybeSingle(),
        supabase.from('study_days').select('*').eq('student_id', user.studentId).order('day_date', { ascending: false }),
        supabase.from('quiz_results').select('*').eq('student_id', user.studentId),
      ]);

      if (studRes.error) throw studRes.error;
      if (daysRes.error) throw daysRes.error;
      if (resultsRes.error) throw resultsRes.error;

      const stud = studRes.data as Student | null;
      setStudent(stud);

      const studyDays = (daysRes.data || []) as StudyDay[];

      // Fetch lessons for all days in parallel
      const lessonsByDay = await Promise.all(
        studyDays.map(async (d) => {
          const { data: lessons, error: lErr } = await supabase
            .from('lessons')
            .select('*')
            .eq('study_day_id', d.id)
            .order('created_at', { ascending: true });
          if (lErr) throw lErr;
          return { ...d, lessons: (lessons || []) as Lesson[] };
        })
      );

      lessonsByDay.sort((a, b) => {
        const dateA = new Date(a.day_date).getTime();
        const dateB = new Date(b.day_date).getTime();
        return dateB - dateA;
      });

      setDays(lessonsByDay);

      const resMap = new Map<string, QuizResult>();
      for (const r of (resultsRes.data || []) as QuizResult[]) {
        resMap.set(r.lesson_id, r);
      }
      setResults(resMap);
    } catch {
      setError('Unable to load class activity.');
    } finally {
      setLoading(false);
    }
  }, [user.studentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleQuizComplete = () => {
    setQuizState(null);
    setQuizResultView(null);
    loadData();
  };

  const handleViewResult = (result: QuizResult, subject: string) => {
    setQuizResultView(result);
    setQuizState({ lessonId: result.lesson_id, subject });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const day = d.getDate();
    const suffix = ['th', 'st', 'nd', 'rd'];
    const v = day % 100;
    const ord = suffix[(v - 20) % 10] || suffix[v] || suffix[0];
    return `${day}${ord} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 leading-tight">StudyWise</h2>
              <p className="text-xs text-slate-500">Student Portal</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-red-600 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* Profile Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-center gap-5">
          <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-200">
            {student?.image_url ? (
              <img src={student.image_url} alt={student.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-sky-100 to-blue-100">
                <GraduationCap className="w-8 h-8 text-sky-500" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="space-y-1">
              <div className="text-sm text-slate-500">ID: <strong className="text-slate-800">{student?.id || user.studentId}</strong></div>
              <div className="text-sm text-slate-500">Name: <strong className="text-slate-800">{student?.name || user.name}</strong></div>
              <div className="text-sm text-slate-500">Class: <span className="text-slate-700">{student?.class_name || user.className}</span></div>
              <div className="text-sm text-slate-500">Subject: <span className="text-slate-700">{student?.subjects || user.subjects}</span></div>
            </div>
          </div>
        </div>

        {/* Lessons Feed */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-800">Class &amp; Lessons</h3>
            <p className="text-xs text-slate-500 mt-0.5">Class activities and online quizzes</p>
          </div>

          <div className="p-4 space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-sky-500 animate-spin" />
              </div>
            ) : error ? (
              <div className="text-center py-12 text-sm text-red-600">{error}</div>
            ) : days.length === 0 ? (
              <div className="text-center py-12 text-sm text-slate-500">No lessons logged yet.</div>
            ) : (
              days.map((day) => (
                <div key={day.id} className="border border-slate-200 rounded-lg overflow-hidden">
                  {/* Day Header */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white bg-sky-500 px-2 py-0.5 rounded">{day.day_label}</span>
                      <span className="text-xs text-slate-600 font-medium">{formatDate(day.day_date)}</span>
                    </div>
                    <span className="text-xs text-slate-400 font-medium">Class Activity</span>
                  </div>

                  {/* Lessons */}
                  <div className="divide-y divide-slate-100">
                    {day.lessons.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-slate-400">No topics logged.</div>
                    ) : (
                      day.lessons.map((lesson) => {
                        const completed = results.get(lesson.id);
                        return (
                          <div key={lesson.id} className="px-4 py-3">
                            <span className="inline-block text-xs font-medium text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded mb-2">
                              {lesson.subject}
                            </span>
                            <div className="bg-slate-50 rounded-lg px-3 py-2 mb-2">
                              <div className="text-xs font-semibold text-slate-600">Topics:</div>
                              <div className="text-sm text-slate-700 mt-0.5">{lesson.short_note || 'Class notes recorded.'}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              {lesson.pdf_url && (
                                <a
                                  href={lesson.pdf_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  View PDF
                                </a>
                              )}
                              {lesson.test_enabled ? (
                                completed ? (
                                  <button
                                    onClick={() => handleViewResult(completed, lesson.subject)}
                                    className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 px-3 py-1.5 rounded-lg transition-colors"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    View Result
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => setQuizState({ lessonId: lesson.id, subject: lesson.subject })}
                                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-sky-500 hover:bg-sky-600 px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                                  >
                                    <BookOpen className="w-3.5 h-3.5" />
                                    Take Quiz
                                  </button>
                                )
                              ) : (
                                <span className="text-xs text-slate-400">(Quiz not required)</span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quiz Modal */}
      {quizState && (
        <QuizModal
          lessonId={quizState.lessonId}
          subject={quizState.subject}
          studentId={user.studentId}
          existingResult={quizResultView}
          onClose={() => { setQuizState(null); setQuizResultView(null); }}
          onComplete={handleQuizComplete}
        />
      )}

      <footer className="text-center text-xs text-slate-400 py-4">
        Developed by <a href="https://fahimshahriar.com.bd" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-sky-600">Fahim Shahriar</a>
      </footer>
    </div>
  );
}
