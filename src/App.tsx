import { useState, useEffect } from 'react';
import { LoginScreen } from '@/components/LoginScreen';
import { StudentPortal } from '@/components/StudentPortal';
import { AdminPanel } from '@/components/AdminPanel';

export type SessionUser =
  | { role: 'student'; studentId: string; name: string; className: string; subjects: string; imageUrl: string }
  | { role: 'admin'; name: string };

function App() {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(() => {
    try {
      const saved = localStorage.getItem('studywise_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Keep session refreshed if needed
    const saved = localStorage.getItem('studywise_session');
    if (saved && !sessionUser) {
      try {
        setSessionUser(JSON.parse(saved));
      } catch {
        localStorage.removeItem('studywise_session');
      }
    }
    setLoading(false);
  }, [sessionUser]);

  const handleLogin = (user: SessionUser) => {
    localStorage.setItem('studywise_session', JSON.stringify(user));
    setSessionUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('studywise_session');
    setSessionUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-[3px] border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!sessionUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (sessionUser.role === 'admin') {
    return <AdminPanel user={sessionUser} onLogout={handleLogout} />;
  }

  return <StudentPortal user={sessionUser} onLogout={handleLogout} />;
}

export default App;
