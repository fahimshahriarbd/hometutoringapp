import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Student, StudyDay, Lesson, Question, QuizResult } from '@/lib/supabase';
import type { SessionUser } from '@/App';
import {
  GraduationCap, LogOut, Search, Plus, Pencil, Trash2, X, Loader2,
  Users, BookOpen, HelpCircle, BarChart3, FileText, Check, Calendar,
} from 'lucide-react';

interface Props {
  user: Extract<SessionUser, { role: 'admin' }>;
  onLogout: () => void;
}

type Tab = 'students' | 'lessons' | 'questions' | 'results';

export function AdminPanel({ user, onLogout }: Props) {
  const [tab, setTab] = useState<Tab>('students');

  const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: 'students', label: 'Students', icon: Users },
    { id: 'lessons', label: 'Lessons', icon: BookOpen },
    { id: 'questions', label: 'Questions', icon: HelpCircle },
    { id: 'results', label: 'Results', icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 leading-tight">StudyWise</h2>
              <p className="text-xs text-slate-500">Admin: <strong className="text-slate-700">{user.name}</strong></p>
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

      {/* Tabs */}
      <nav className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === id
                  ? 'border-sky-500 text-sky-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {tab === 'students' && <StudentsTab />}
        {tab === 'lessons' && <LessonsTab />}
        {tab === 'questions' && <QuestionsTab />}
        {tab === 'results' && <ResultsTab />}
      </div>

      <footer className="text-center text-xs text-slate-400 py-4">
        Developed by <a href="https://fahimshahriar.com.bd" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-sky-600">Fahim Shahriar</a>
      </footer>
    </div>
  );
}

// =================== STUDENTS TAB ===================

function StudentsTab() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('students').select('*').order('id', { ascending: true });
      if (error) throw error;
      setStudents((data || []) as Student[]);
    } catch {
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  const filtered = students.filter(s =>
    !search ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.id.includes(search) ||
    (s.class_name && s.class_name.toLowerCase().includes(search.toLowerCase()))
  );

  const handleDelete = async (id: string) => {
    try {
      await supabase.from('students').delete().eq('id', id);
      setStudents(prev => prev.filter(s => s.id !== id));
    } catch {
      // ignore
    }
    setConfirmDelete(null);
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search students..."
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 text-sm font-medium text-white bg-sky-500 hover:bg-sky-600 px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Add Student
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-sky-500 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-slate-500">No students registered yet.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map(s => (
            <div key={s.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex gap-4">
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-200">
                {s.image_url ? (
                  <img src={s.image_url} alt={s.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-sky-100 to-blue-100">
                    <Users className="w-6 h-6 text-sky-400" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-slate-800 truncate">{s.name}</h4>
                <div className="text-xs text-slate-500 mt-0.5">Class: <strong className="text-slate-700">{s.class_name}</strong></div>
                <div className="text-xs text-slate-500">Subject: <span className="text-slate-700">{s.subjects}</span></div>
                <div className="text-xs text-slate-500 mt-0.5">ID: <strong className="text-slate-700">{s.id}</strong> &middot; PIN: <strong className="text-slate-700">{s.pin}</strong></div>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => setEditStudent(s)} className="flex items-center gap-1 text-xs font-medium text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-2.5 py-1 rounded transition-colors">
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                  <button onClick={() => setConfirmDelete(s.id)} className="flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded transition-colors">
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddStudentModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); loadStudents(); }} />}
      {editStudent && <EditStudentModal student={editStudent} onClose={() => setEditStudent(null)} onSaved={() => { setEditStudent(null); loadStudents(); }} />}
      {confirmDelete && <ConfirmModal title="Delete Student" message={`Are you sure you want to delete student ID ${confirmDelete}? All associated logs will also be removed.`} onConfirm={() => handleDelete(confirmDelete)} onCancel={() => setConfirmDelete(null)} />}
    </div>
  );
}

function AddStudentModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [className, setClassName] = useState('');
  const [subjects, setSubjects] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    setSaving(true);
    try {
      // Auto-generate ID if empty
      let studentId = id.trim();
      if (!studentId) {
        const { data: allStudents } = await supabase.from('students').select('id').order('id', { ascending: false }).limit(1);
        const maxId = allStudents && allStudents.length > 0 ? parseInt(allStudents[0].id, 10) : 1000;
        studentId = String(maxId + 1);
      }

      const { error } = await supabase.from('students').insert({
        id: studentId,
        name: name.trim(),
        class_name: className.trim(),
        subjects: subjects.trim(),
        image_url: imageUrl.trim() || null,
        pin: pin.trim(),
      });

      if (error) {
        setMsg(error.message || 'Failed to add student.');
        setSaving(false);
        return;
      }

      setMsg(`Student saved! Assigned ID: ${studentId}`);
      setTimeout(() => onSaved(), 800);
    } catch {
      setMsg('Failed to add student.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalLayout title="Add Student" subtitle="Auto 4-digit ID assigned" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Student ID (Optional - 4 Digits)" hint="Leave empty to auto-assign next ID">
          <input type="text" value={id} onChange={e => setId(e.target.value)} placeholder="e.g. 1001" maxLength={4} className={inputCls} />
        </Field>
        <Field label="Student Name"><input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Student 02" required className={inputCls} /></Field>
        <Field label="Class"><input type="text" value={className} onChange={e => setClassName(e.target.value)} placeholder="e.g. HSC 1st Year" required className={inputCls} /></Field>
        <Field label="Subjects (Comma-separated)"><input type="text" value={subjects} onChange={e => setSubjects(e.target.value)} placeholder="e.g. Physics, Chemistry" required className={inputCls} /></Field>
        <Field label="1:1 Photo URL (Optional)"><input type="url" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." className={inputCls} /></Field>
        <Field label="Student PIN Code"><input type="text" value={pin} onChange={e => setPin(e.target.value)} placeholder="4-digit PIN" required className={inputCls} /></Field>
        {msg && <p className={`text-xs font-medium ${msg.includes('saved') ? 'text-green-600' : 'text-red-600'}`}>{msg}</p>}
        <button type="submit" disabled={saving} className="w-full bg-sky-500 hover:bg-sky-600 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Save Student'}
        </button>
      </form>
    </ModalLayout>
  );
}

function EditStudentModal({ student, onClose, onSaved }: { student: Student; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(student.name);
  const [className, setClassName] = useState(student.class_name);
  const [subjects, setSubjects] = useState(student.subjects);
  const [imageUrl, setImageUrl] = useState(student.image_url || '');
  const [pin, setPin] = useState(student.pin);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase.from('students').update({
        name: name.trim(),
        class_name: className.trim(),
        subjects: subjects.trim(),
        image_url: imageUrl.trim() || null,
        pin: pin.trim(),
      }).eq('id', student.id);

      if (error) { setMsg(error.message); setSaving(false); return; }
      setMsg('Student updated successfully.');
      setTimeout(() => onSaved(), 800);
    } catch {
      setMsg('Failed to update student.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalLayout title="Edit Student" subtitle={`ID: ${student.id}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Student Name"><input type="text" value={name} onChange={e => setName(e.target.value)} required className={inputCls} /></Field>
        <Field label="Class"><input type="text" value={className} onChange={e => setClassName(e.target.value)} required className={inputCls} /></Field>
        <Field label="Subjects"><input type="text" value={subjects} onChange={e => setSubjects(e.target.value)} required className={inputCls} /></Field>
        <Field label="1:1 Photo URL"><input type="url" value={imageUrl} onChange={e => setImageUrl(e.target.value)} className={inputCls} /></Field>
        <Field label="Update PIN Code"><input type="text" value={pin} onChange={e => setPin(e.target.value)} required className={inputCls} /></Field>
        {msg && <p className={`text-xs font-medium ${msg.includes('success') ? 'text-green-600' : 'text-red-600'}`}>{msg}</p>}
        <button type="submit" disabled={saving} className="w-full bg-sky-500 hover:bg-sky-600 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating...</> : 'Save Changes'}
        </button>
      </form>
    </ModalLayout>
  );
}

// =================== LESSONS TAB ===================

function LessonsTab() {
  const [students, setStudents] = useState<Student[]>([]);
  const [studyDays, setStudyDays] = useState<StudyDay[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [selectedDay, setSelectedDay] = useState('');
  const [loading, setLoading] = useState(true);
  const [editLesson, setEditLesson] = useState<Lesson | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Add lesson form
  const [lSubject, setLSubject] = useState('');
  const [lNote, setLNote] = useState('');
  const [lPdf, setLPdf] = useState('');
  const [lTestEnabled, setLTestEnabled] = useState(true);
  const [lessonMsg, setLessonMsg] = useState('');
  const [savingLesson, setSavingLesson] = useState(false);

  // Add study day form
  const [dayLabel, setDayLabel] = useState('DAY-');
  const [dayDate, setDayDate] = useState(new Date().toISOString().split('T')[0]);
  const [dayMsg, setDayMsg] = useState('');
  const [savingDay, setSavingDay] = useState(false);

  const loadStudents = useCallback(async () => {
    const { data } = await supabase.from('students').select('*').order('id', { ascending: true });
    const studs = (data || []) as Student[];
    setStudents(studs);
    if (studs.length > 0 && !selectedStudent) setSelectedStudent(studs[0].id);
    return studs;
  }, [selectedStudent]);

  const loadStudyDays = useCallback(async (studentId: string) => {
    const { data } = await supabase.from('study_days').select('*').eq('student_id', studentId).order('day_date', { ascending: false });
    setStudyDays((data || []) as StudyDay[]);
    if (data && data.length > 0) {
      setSelectedDay((data as StudyDay[])[0].id);
    } else {
      setSelectedDay('');
    }
  }, []);

  const loadLessons = useCallback(async (studyDayId: string) => {
    if (!studyDayId) { setLessons([]); return; }
    setLoading(true);
    const { data } = await supabase.from('lessons').select('*').eq('study_day_id', studyDayId).order('created_at', { ascending: true });
    setLessons((data || []) as Lesson[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const studs = await loadStudents();
      if (studs.length > 0) await loadStudyDays(studs[0].id);
    })();
  }, []);

  useEffect(() => {
    if (selectedStudent) loadStudyDays(selectedStudent);
  }, [selectedStudent]);

  useEffect(() => {
    if (selectedDay) loadLessons(selectedDay);
    else setLessons([]);
  }, [selectedDay]);

  const handleAddDay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setSavingDay(true);
    setDayMsg('');
    try {
      const { error } = await supabase.from('study_days').insert({
        student_id: selectedStudent,
        day_label: dayLabel.trim() || 'DAY-',
        day_date: dayDate,
      });
      if (error) { setDayMsg(error.message); setSavingDay(false); return; }
      setDayMsg('Day scheduled successfully.');
      setDayLabel('DAY-');
      await loadStudyDays(selectedStudent);
    } catch {
      setDayMsg('Failed to add study day.');
    } finally {
      setSavingDay(false);
    }
  };

  const handleAddLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDay) { setLessonMsg('Please select a study day first.'); return; }
    setSavingLesson(true);
    setLessonMsg('');
    try {
      const { error } = await supabase.from('lessons').insert({
        study_day_id: selectedDay,
        subject: lSubject.trim(),
        short_note: lNote.trim(),
        pdf_url: lPdf.trim() || null,
        test_enabled: lTestEnabled,
      });
      if (error) { setLessonMsg(error.message); setSavingLesson(false); return; }
      setLessonMsg('Lesson saved successfully.');
      setLSubject('');
      setLNote('');
      setLPdf('');
      setLTestEnabled(true);
      await loadLessons(selectedDay);
    } catch {
      setLessonMsg('Failed to save lesson.');
    } finally {
      setSavingLesson(false);
    }
  };

  const handleDeleteLesson = async (id: string) => {
    try {
      await supabase.from('lessons').delete().eq('id', id);
      setLessons(prev => prev.filter(l => l.id !== id));
    } catch {}
    setConfirmDelete(null);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        {/* Add Study Day */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-1">1. Schedule Day</h3>
          <p className="text-xs text-slate-500 mb-4">Assign study date for a student</p>
          <form onSubmit={handleAddDay} className="space-y-3">
            <Field label="Select Student">
              <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)} className={inputCls}>
                {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.id})</option>)}
              </select>
            </Field>
            <Field label="Day Label">
              <input type="text" value={dayLabel} onChange={e => setDayLabel(e.target.value)} placeholder="DAY-" required className={inputCls} />
            </Field>
            <Field label="Date">
              <input type="date" value={dayDate} onChange={e => setDayDate(e.target.value)} required className={inputCls} />
            </Field>
            {dayMsg && <p className={`text-xs font-medium ${dayMsg.includes('success') ? 'text-green-600' : 'text-red-600'}`}>{dayMsg}</p>}
            <button type="submit" disabled={savingDay} className="w-full bg-sky-500 hover:bg-sky-600 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {savingDay ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Save Day'}
            </button>
          </form>
        </div>

        {/* Add Lesson */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-bold text-slate-800 mb-1">2. Add Lesson &amp; Topics</h3>
          <p className="text-xs text-slate-500 mb-4">Topic details, notes, PDF link</p>
          <form onSubmit={handleAddLesson} className="space-y-3">
            <Field label="Select Study Day">
              <select value={selectedDay} onChange={e => setSelectedDay(e.target.value)} className={inputCls} required>
                <option value="">-- Select a day --</option>
                {studyDays.map(d => <option key={d.id} value={d.id}>{d.day_label} ({formatDate(d.day_date)})</option>)}
              </select>
            </Field>
            <Field label="Subject">
              <input type="text" value={lSubject} onChange={e => setLSubject(e.target.value)} placeholder="e.g. Biology" required className={inputCls} />
            </Field>
            <Field label="Topics">
              <textarea rows={2} value={lNote} onChange={e => setLNote(e.target.value)} placeholder="Summary of what was taught..." required className={inputCls} />
            </Field>
            <Field label="PDF Notes URL (Optional)">
              <input type="url" value={lPdf} onChange={e => setLPdf(e.target.value)} placeholder="https://drive.google.com/..." className={inputCls} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={lTestEnabled} onChange={e => setLTestEnabled(e.target.checked)} className="w-4 h-4 text-sky-500 rounded" />
              Enable Quiz for this lesson
            </label>
            {lessonMsg && <p className={`text-xs font-medium ${lessonMsg.includes('success') ? 'text-green-600' : 'text-red-600'}`}>{lessonMsg}</p>}
            <button type="submit" disabled={savingLesson} className="w-full bg-sky-500 hover:bg-sky-600 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {savingLesson ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Save Lesson'}
            </button>
          </form>
        </div>
      </div>

      {/* Manage Lessons */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-1">Manage Existing Lessons</h3>
        <p className="text-xs text-slate-500 mb-4">Edit or delete lessons for the selected study day</p>
        {loading ? (
          <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 text-sky-500 animate-spin" /></div>
        ) : lessons.length === 0 ? (
          <div className="text-xs text-slate-500 py-4">No lessons for selected study day.</div>
        ) : (
          <div className="space-y-2">
            {lessons.map(l => (
              <div key={l.id} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800">{l.subject}</div>
                  <div className="text-xs text-slate-500 truncate">{l.short_note?.slice(0, 50)}</div>
                </div>
                <button onClick={() => setEditLesson(l)} className="flex items-center gap-1 text-xs font-medium text-sky-600 hover:text-sky-700 bg-sky-50 border border-sky-200 px-2.5 py-1 rounded transition-colors">
                  <Pencil className="w-3 h-3" /> Edit
                </button>
                <button onClick={() => setConfirmDelete(l.id)} className="flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded transition-colors">
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {editLesson && <EditLessonModal lesson={editLesson} studyDayId={selectedDay} onClose={() => setEditLesson(null)} onSaved={() => { setEditLesson(null); loadLessons(selectedDay); }} />}
      {confirmDelete && <ConfirmModal title="Delete Lesson" message="Are you sure you want to delete this lesson? Associated questions will also be removed." onConfirm={() => handleDeleteLesson(confirmDelete)} onCancel={() => setConfirmDelete(null)} />}
    </div>
  );
}

function EditLessonModal({ lesson, studyDayId, onClose, onSaved }: { lesson: Lesson; studyDayId: string; onClose: () => void; onSaved: () => void }) {
  const [subject, setSubject] = useState(lesson.subject);
  const [note, setNote] = useState(lesson.short_note);
  const [pdf, setPdf] = useState(lesson.pdf_url || '');
  const [testEnabled, setTestEnabled] = useState(lesson.test_enabled);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase.from('lessons').update({
        subject: subject.trim(),
        short_note: note.trim(),
        pdf_url: pdf.trim() || null,
        test_enabled: testEnabled,
      }).eq('id', lesson.id);
      if (error) { setMsg(error.message); setSaving(false); return; }
      setMsg('Lesson updated successfully.');
      setTimeout(() => onSaved(), 800);
    } catch {
      setMsg('Failed to update lesson.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalLayout title="Edit Lesson" subtitle="Update subject, notes, or quiz status" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Subject"><input type="text" value={subject} onChange={e => setSubject(e.target.value)} required className={inputCls} /></Field>
        <Field label="Topics"><textarea rows={3} value={note} onChange={e => setNote(e.target.value)} required className={inputCls} /></Field>
        <Field label="PDF Notes URL"><input type="url" value={pdf} onChange={e => setPdf(e.target.value)} className={inputCls} /></Field>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input type="checkbox" checked={testEnabled} onChange={e => setTestEnabled(e.target.checked)} className="w-4 h-4 text-sky-500 rounded" />
          Enable Quiz for this lesson
        </label>
        {msg && <p className={`text-xs font-medium ${msg.includes('success') ? 'text-green-600' : 'text-red-600'}`}>{msg}</p>}
        <button type="submit" disabled={saving} className="w-full bg-sky-500 hover:bg-sky-600 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating...</> : 'Save Lesson Changes'}
        </button>
      </form>
    </ModalLayout>
  );
}

// =================== QUESTIONS TAB ===================

function QuestionsTab() {
  const [allLessons, setAllLessons] = useState<(Lesson & { day_label: string; day_date: string })[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedLesson, setSelectedLesson] = useState('');
  const [loading, setLoading] = useState(true);
  const [editQuestion, setEditQuestion] = useState<Question | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Add question form
  const [qText, setQText] = useState('');
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [optD, setOptD] = useState('');
  const [correct, setCorrect] = useState<'A'|'B'|'C'|'D'>('A');
  const [explanation, setExplanation] = useState('');
  const [qMsg, setQMsg] = useState('');
  const [savingQ, setSavingQ] = useState(false);

  const loadAllLessons = useCallback(async () => {
    // Fetch all study days, then all lessons for each
    const { data: days } = await supabase.from('study_days').select('*').order('day_date', { ascending: false });
    if (!days || days.length === 0) { setAllLessons([]); return; }

    const lessonPromises = (days as StudyDay[]).map(async d => {
      const { data: lessons } = await supabase.from('lessons').select('*').eq('study_day_id', d.id);
      return (lessons || []).map((l: Lesson) => ({ ...l, day_label: d.day_label, day_date: d.day_date }));
    });

    const results = await Promise.all(lessonPromises);
    const flat = results.flat();
    setAllLessons(flat);
    if (flat.length > 0 && !selectedLesson) setSelectedLesson(flat[0].id);
  }, [selectedLesson]);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('questions').select('*').order('created_at', { ascending: true });
    if (error) { setQuestions([]); setLoading(false); return; }
    setQuestions((data || []) as Question[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadAllLessons(); loadQuestions(); }, []);

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLesson) { setQMsg('Please select a target lesson.'); return; }

    const existingCount = questions.filter(q => q.lesson_id === selectedLesson).length;
    if (existingCount >= 10) { setQMsg('Maximum 10 questions allowed per lesson.'); return; }

    setSavingQ(true);
    setQMsg('');
    try {
      const { error } = await supabase.from('questions').insert({
        lesson_id: selectedLesson,
        question: qText.trim(),
        option_a: optA.trim(),
        option_b: optB.trim(),
        option_c: optC.trim(),
        option_d: optD.trim(),
        answer: correct,
        explanation: explanation.trim(),
      });
      if (error) { setQMsg(error.message); setSavingQ(false); return; }
      setQMsg('Question added successfully.');
      setQText(''); setOptA(''); setOptB(''); setOptC(''); setOptD(''); setExplanation('');
      await loadQuestions();
    } catch {
      setQMsg('Failed to add question.');
    } finally {
      setSavingQ(false);
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    try {
      await supabase.from('questions').delete().eq('id', id);
      setQuestions(prev => prev.filter(q => q.id !== id));
    } catch {}
    setConfirmDelete(null);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-1">Add Quiz Question</h3>
        <p className="text-xs text-slate-500 mb-4">Create MCQ questions with explanations</p>
        <form onSubmit={handleAddQuestion} className="space-y-3">
          <Field label="Target Lesson">
            <select value={selectedLesson} onChange={e => setSelectedLesson(e.target.value)} className={inputCls} required>
              {allLessons.length === 0 ? <option value="">No lessons available</option> :
                allLessons.map(l => <option key={l.id} value={l.id}>[{l.day_label}] {l.subject} - {l.short_note?.slice(0, 30)}</option>)}
            </select>
          </Field>
          <Field label="Question Text">
            <input type="text" value={qText} onChange={e => setQText(e.target.value)} placeholder="Enter question..." required className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Option A"><input type="text" value={optA} onChange={e => setOptA(e.target.value)} placeholder="Option A" required className={inputCls} /></Field>
            <Field label="Option B"><input type="text" value={optB} onChange={e => setOptB(e.target.value)} placeholder="Option B" required className={inputCls} /></Field>
            <Field label="Option C"><input type="text" value={optC} onChange={e => setOptC(e.target.value)} placeholder="Option C" required className={inputCls} /></Field>
            <Field label="Option D"><input type="text" value={optD} onChange={e => setOptD(e.target.value)} placeholder="Option D" required className={inputCls} /></Field>
          </div>
          <Field label="Correct Answer">
            <select value={correct} onChange={e => setCorrect(e.target.value as 'A'|'B'|'C'|'D')} className={inputCls} required>
              <option value="A">Option A</option>
              <option value="B">Option B</option>
              <option value="C">Option C</option>
              <option value="D">Option D</option>
            </select>
          </Field>
          <Field label="Explanation (Optional)">
            <textarea rows={2} value={explanation} onChange={e => setExplanation(e.target.value)} placeholder="Why this option is correct..." className={inputCls} />
          </Field>
          {qMsg && <p className={`text-xs font-medium ${qMsg.includes('success') ? 'text-green-600' : 'text-red-600'}`}>{qMsg}</p>}
          <button type="submit" disabled={savingQ} className="w-full bg-sky-500 hover:bg-sky-600 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {savingQ ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : 'Save Question'}
          </button>
        </form>
      </div>

      {/* Existing Questions */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-sm font-bold text-slate-800 mb-1">Existing Questions</h3>
        <p className="text-xs text-slate-500 mb-4">Edit or delete questions</p>
        {loading ? (
          <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 text-sky-500 animate-spin" /></div>
        ) : questions.length === 0 ? (
          <div className="text-xs text-slate-500 py-4">No questions created yet.</div>
        ) : (
          <div className="space-y-2">
            {questions.map(q => {
              const lesson = allLessons.find(l => l.id === q.lesson_id);
              return (
                <div key={q.id} className="flex items-start gap-3 py-2 border-b border-slate-100 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800">{q.question}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Ans: <strong>Option {q.answer}</strong>
                      {lesson && <span className="text-slate-400"> &middot; {lesson.subject}</span>}
                    </div>
                  </div>
                  <button onClick={() => setEditQuestion(q)} className="flex items-center gap-1 text-xs font-medium text-sky-600 hover:text-sky-700 bg-sky-50 border border-sky-200 px-2.5 py-1 rounded transition-colors flex-shrink-0">
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                  <button onClick={() => setConfirmDelete(q.id)} className="flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded transition-colors flex-shrink-0">
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editQuestion && <EditQuestionModal question={editQuestion} onClose={() => setEditQuestion(null)} onSaved={() => { setEditQuestion(null); loadQuestions(); }} />}
      {confirmDelete && <ConfirmModal title="Delete Question" message="Are you sure you want to delete this question?" onConfirm={() => handleDeleteQuestion(confirmDelete)} onCancel={() => setConfirmDelete(null)} />}
    </div>
  );
}

function EditQuestionModal({ question, onClose, onSaved }: { question: Question; onClose: () => void; onSaved: () => void }) {
  const [qText, setQText] = useState(question.question);
  const [optA, setOptA] = useState(question.option_a);
  const [optB, setOptB] = useState(question.option_b);
  const [optC, setOptC] = useState(question.option_c);
  const [optD, setOptD] = useState(question.option_d);
  const [correct, setCorrect] = useState(question.answer);
  const [explanation, setExplanation] = useState(question.explanation);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase.from('questions').update({
        question: qText.trim(),
        option_a: optA.trim(),
        option_b: optB.trim(),
        option_c: optC.trim(),
        option_d: optD.trim(),
        answer: correct,
        explanation: explanation.trim(),
      }).eq('id', question.id);
      if (error) { setMsg(error.message); setSaving(false); return; }
      setMsg('Question updated successfully.');
      setTimeout(() => onSaved(), 800);
    } catch {
      setMsg('Failed to update question.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalLayout title="Edit Question" subtitle="Update question text and choices" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Question"><input type="text" value={qText} onChange={e => setQText(e.target.value)} required className={inputCls} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Option A"><input type="text" value={optA} onChange={e => setOptA(e.target.value)} required className={inputCls} /></Field>
          <Field label="Option B"><input type="text" value={optB} onChange={e => setOptB(e.target.value)} required className={inputCls} /></Field>
          <Field label="Option C"><input type="text" value={optC} onChange={e => setOptC(e.target.value)} required className={inputCls} /></Field>
          <Field label="Option D"><input type="text" value={optD} onChange={e => setOptD(e.target.value)} required className={inputCls} /></Field>
        </div>
        <Field label="Correct Answer">
          <select value={correct} onChange={e => setCorrect(e.target.value as 'A'|'B'|'C'|'D')} className={inputCls} required>
            <option value="A">Option A</option>
            <option value="B">Option B</option>
            <option value="C">Option C</option>
            <option value="D">Option D</option>
          </select>
        </Field>
        <Field label="Explanation"><textarea rows={2} value={explanation} onChange={e => setExplanation(e.target.value)} className={inputCls} /></Field>
        {msg && <p className={`text-xs font-medium ${msg.includes('success') ? 'text-green-600' : 'text-red-600'}`}>{msg}</p>}
        <button type="submit" disabled={saving} className="w-full bg-sky-500 hover:bg-sky-600 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating...</> : 'Save Question Changes'}
        </button>
      </form>
    </ModalLayout>
  );
}

// =================== RESULTS TAB ===================

function ResultsTab() {
  const [results, setResults] = useState<QuizResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.from('quiz_results').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        setResults((data || []) as QuizResult[]);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-sky-500 animate-spin" /></div>;
  }

  if (results.length === 0) {
    return <div className="text-center py-12 text-sm text-slate-500">No test submissions recorded.</div>;
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-800">Quiz Submissions</h3>
        <p className="text-xs text-slate-500 mt-0.5">Student scores &amp; percentages</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-600">Student ID</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-600">Lesson</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-600">Score</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-600">Pct</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-600">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {results.map(r => (
              <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-2.5 font-medium text-slate-800">{r.student_id}</td>
                <td className="px-4 py-2.5 text-slate-600 text-xs">{r.lesson_id.slice(0, 8)}...</td>
                <td className="px-4 py-2.5"><span className="font-bold text-green-600">{r.score} / {r.total}</span></td>
                <td className="px-4 py-2.5 text-slate-700">{r.percentage}%</td>
                <td className="px-4 py-2.5 text-slate-500 text-xs">{formatDate(r.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =================== SHARED COMPONENTS ===================

const inputCls = 'w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

function ModalLayout({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-800">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function ConfirmModal({ title, message, onConfirm, onCancel }: { title: string; message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-3">
            <span className="text-xl font-bold text-red-600">!</span>
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">{title}</h3>
          <p className="text-sm text-slate-600 mb-5">{message}</p>
          <div className="flex gap-3 w-full">
            <button onClick={onCancel} className="flex-1 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
              Cancel
            </button>
            <button onClick={onConfirm} className="flex-1 py-2.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors">
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
