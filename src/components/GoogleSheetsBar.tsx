/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import {
  subscribeAuth,
  googleSignIn,
  googleSignOut,
} from '@/lib/googleAuth';
import {
  getStoredSheetConfig,
  setStoredSheetConfig,
  createStudyWiseSpreadsheet,
  syncAllDataToGoogleSheets,
} from '@/lib/googleSheets';
import { supabase } from '@/lib/supabase';
import type { Student, StudyDay, Lesson, Question, QuizResult } from '@/lib/supabase';
import {
  FileSpreadsheet,
  ExternalLink,
  RefreshCw,
  LogOut,
  CheckCircle,
  AlertCircle,
  Loader2,
  Table,
} from 'lucide-react';

export function GoogleSheetsBar() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCreatingSheet, setIsCreatingSheet] = useState(false);
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'success' | 'error' | 'info'>('info');

  useEffect(() => {
    const unsub = subscribeAuth((user) => {
      setCurrentUser(user);
      setIsAuthLoading(false);
    });

    const config = getStoredSheetConfig();
    setSheetUrl(config.spreadsheetUrl);

    return () => unsub();
  }, []);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setStatusMessage(null);
    try {
      await googleSignIn();
      setStatusType('success');
      setStatusMessage('Google account connected! You can now create or sync to Google Sheets.');
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.message?.includes('popup-closed-by-user')) {
        setStatusType('info');
        setStatusMessage('Google Sign-In popup was closed. Click the button again and select "Continue" to proceed.');
      } else {
        setStatusType('error');
        setStatusMessage(err.message || 'Failed to sign in with Google.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    await googleSignOut();
    setStatusMessage(null);
  };

  const handleCreateSheet = async () => {
    setIsCreatingSheet(true);
    setStatusMessage(null);
    try {
      const created = await createStudyWiseSpreadsheet();
      setSheetUrl(created.url);
      setStoredSheetConfig(created.id, created.url);
      setStatusType('success');
      setStatusMessage('New Google Spreadsheet created with tabs: Students, Lessons, Questions, and Quiz Results!');
    } catch (err: any) {
      console.error(err);
      setStatusType('error');
      setStatusMessage(err.message || 'Failed to create Google Spreadsheet.');
    } finally {
      setIsCreatingSheet(false);
    }
  };

  const handleSyncAll = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to sync all current records (Students, Lessons, Questions, and Quiz Results) to your Google Sheet? This will update the sheet data.'
    );
    if (!confirmed) return;

    setIsSyncing(true);
    setStatusMessage(null);
    try {
      const [sRes, dRes, lRes, qRes, rRes] = await Promise.all([
        supabase.from('students').select('*'),
        supabase.from('study_days').select('*'),
        supabase.from('lessons').select('*'),
        supabase.from('questions').select('*'),
        supabase.from('quiz_results').select('*'),
      ]);

      const students = (sRes.data || []) as Student[];
      const studyDays = (dRes.data || []) as StudyDay[];
      const lessons = (lRes.data || []) as Lesson[];
      const questions = (qRes.data || []) as Question[];
      const quizResults = (rRes.data || []) as QuizResult[];

      const res = await syncAllDataToGoogleSheets({
        students,
        studyDays,
        lessons,
        questions,
        quizResults,
      });

      setSheetUrl(res.spreadsheetUrl);
      setStatusType('success');
      setStatusMessage(`All data successfully synced to Google Sheets (${students.length} students, ${lessons.length} lessons, ${questions.length} questions, ${quizResults.length} quiz results)!`);
    } catch (err: any) {
      console.error(err);
      setStatusType('error');
      setStatusMessage(err.message || 'Failed to sync data to Google Sheets.');
    } finally {
      setIsSyncing(false);
    }
  };

  if (isAuthLoading) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl border border-emerald-200/80 shadow-sm p-4 mb-6 transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Brand and Connection Status */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center flex-shrink-0">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-800">Google Sheets Cloud Storage</h3>
              {currentUser ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <CheckCircle className="w-3 h-3 text-emerald-600" />
                  Connected
                </span>
              ) : (
                <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  Not Connected
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {currentUser
                ? `Account: ${currentUser.email || currentUser.displayName}`
                : 'Sign in with Google to automatically backup and sync records to Google Sheets'}
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {!currentUser ? (
            <button
              onClick={handleSignIn}
              disabled={isSigningIn}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-sm transition-all hover:border-slate-400 disabled:opacity-60"
            >
              {isSigningIn ? (
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              <span>Sign in with Google</span>
            </button>
          ) : (
            <>
              {sheetUrl ? (
                <a
                  href={sheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Google Sheets</span>
                </a>
              ) : (
                <button
                  onClick={handleCreateSheet}
                  disabled={isCreatingSheet}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-lg shadow-sm transition-colors disabled:opacity-60"
                >
                  {isCreatingSheet ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Table className="w-3.5 h-3.5" />}
                  <span>Create Spreadsheet</span>
                </button>
              )}

              <button
                onClick={handleSyncAll}
                disabled={isSyncing}
                title="Sync all database records to Google Sheets"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Sync to Sheets'}</span>
              </button>

              <button
                onClick={handleSignOut}
                title="Disconnect Google Account"
                className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {!currentUser && (
        <div className="mt-2.5 pt-2 border-t border-emerald-100/70 text-[11px] text-slate-500 flex items-center gap-1.5">
          <span className="font-semibold text-emerald-700">Tip:</span>
          <span>If Google displays "Google hasn’t verified this app", click <strong>Continue</strong> to grant permissions.</span>
        </div>
      )}

      {statusMessage && (
        <div
          className={`mt-3 flex items-start gap-2 text-xs p-2.5 rounded-lg border ${
            statusType === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : statusType === 'error'
              ? 'bg-red-50 text-red-700 border-red-200'
              : 'bg-sky-50 text-sky-800 border-sky-200'
          }`}
        >
          {statusType === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
          )}
          <span className="flex-1">{statusMessage}</span>
          <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-slate-600 text-xs font-bold">
            &times;
          </button>
        </div>
      )}
    </div>
  );
}
