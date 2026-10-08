import { useState, useEffect } from 'react';
import { supabase, verifyAdminCredentials, getAdminCredentials, resetAdminCredentials } from '@/lib/supabase';
import type { Student } from '@/lib/supabase';
import type { SessionUser } from '@/App';
import { subscribeAuth, googleSignIn } from '@/lib/googleAuth';
import { ensureSpreadsheetSetup } from '@/lib/googleSheets';
import type { User } from 'firebase/auth';
import { GraduationCap, Loader2, AlertCircle, FileSpreadsheet, CheckCircle, Shield } from 'lucide-react';

interface Props {
  onLogin: (user: SessionUser) => void;
}

export function LoginScreen({ onLogin }: Props) {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [connectingGoogle, setConnectingGoogle] = useState(false);

  useEffect(() => {
    const unsub = subscribeAuth((user) => {
      setGoogleUser(user);
    });
    return () => unsub();
  }, []);

  const handleConnectGoogle = async () => {
    setConnectingGoogle(true);
    try {
      await googleSignIn();
      await ensureSpreadsheetSetup();
    } catch {
      // ignore
    } finally {
      setConnectingGoogle(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedId = username.trim();
    const trimmedPin = pin.trim();
    if (!trimmedId || !trimmedPin) {
      setError('Please enter both Student ID and PIN.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Check admin first
      if (verifyAdminCredentials(trimmedId, trimmedPin)) {
        const adminName = getAdminCredentials().username;
        const displayName = adminName.charAt(0).toUpperCase() + adminName.slice(1);
        onLogin({ role: 'admin', name: displayName });
        return;
      }

      // Check student
      const { data, error: dbError } = await supabase
        .from('students')
        .select('*')
        .eq('id', trimmedId)
        .maybeSingle();

      if (dbError) throw dbError;

      const student = data as Student | null;
      if (!student || student.pin !== trimmedPin) {
        setError('Invalid Student ID or PIN.');
        return;
      }

      onLogin({
        role: 'student',
        studentId: student.id,
        name: student.name,
        className: student.class_name,
        subjects: student.subjects,
        imageUrl: student.image_url || '',
      });
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-sky-50 to-slate-100 px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          {/* Brand */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-sky-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg mb-4">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">StudyWise</h1>
            <p className="text-sm text-slate-500 mt-1">Sign in with your Student ID or Admin credentials</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-1.5">
                Student ID
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter Student ID number"
                autoComplete="username"
                disabled={loading}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                PIN Number
              </label>
              <input
                id="password"
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter your PIN"
                autoComplete="current-password"
                disabled={loading}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold py-2.5 rounded-lg transition-all shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Google Sheets Database Status & 1-Click Admin Login */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col items-center text-center space-y-3">
            {googleUser ? (
              <div className="w-full space-y-2.5">
                <div className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span className="font-medium">Google Sheets Database Connected</span>
                </div>

                {/* 1-Click Direct Admin Access for Connected Google Account */}
                <button
                  type="button"
                  onClick={() => onLogin({ role: 'admin', name: googleUser.displayName || 'Admin' })}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-all shadow-sm text-xs"
                >
                  <Shield className="w-4 h-4" />
                  <span>Enter as Admin (Google Verified)</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleConnectGoogle}
                disabled={connectingGoogle}
                className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 py-2.5 px-3 rounded-lg transition-colors disabled:opacity-60"
              >
                {connectingGoogle ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                ) : (
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                )}
                <span>Connect Google Sheets Database</span>
              </button>
            )}

            {/* Quick Reset Button if PIN is forgotten */}
            <button
              type="button"
              onClick={() => {
                resetAdminCredentials();
                setUsername('admin');
                setPin('5678');
                setError('');
              }}
              className="text-[11px] text-slate-400 hover:text-sky-600 underline transition-colors"
            >
              Forgot Admin PIN? Reset &amp; autofill default (admin / 5678)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
