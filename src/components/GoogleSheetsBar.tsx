/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import {
  syncAllDataToGoogleSheets,
  callAppsScript,
} from '@/lib/googleSheets';
import { supabase } from '@/lib/supabase';
import type { Student, StudyDay, Lesson, Question, QuizResult } from '@/lib/supabase';
import {
  FileSpreadsheet,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Loader2,
  CheckCheck,
} from 'lucide-react';

export function GoogleSheetsBar() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'success' | 'error' | 'info'>('info');

  const handleTestConnection = async () => {
    setIsTesting(true);
    setStatusMessage(null);
    try {
      const res = await callAppsScript({
        action: 'read',
        table: 'Students',
      });
      if (res && res.status === 'success') {
        setStatusType('success');
        setStatusMessage('Connection verified! Google Sheets Database is active, responsive, and ready for live read & write.');
      } else {
        setStatusType('error');
        setStatusMessage(res?.message || 'Unexpected response from Google Sheet.');
      }
    } catch (err: any) {
      setStatusType('error');
      setStatusMessage(err.message || 'Failed to reach Google Apps Script Web App.');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSyncAll = async () => {
    let confirmed = true;
    try {
      if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        confirmed = window.confirm(
          'Are you sure you want to push all current records (Students, Lessons, Questions, and Quiz Results) to your Google Sheet?'
        );
      }
    } catch {
      confirmed = true;
    }
    if (!confirmed) return;

    setIsSyncing(true);
    setStatusMessage(null);
    try {
      const [sRes, dRes, lRes, qRes, rRes] = await Promise.all([
        supabase.from('students').select(),
        supabase.from('study_days').select(),
        supabase.from('lessons').select(),
        supabase.from('questions').select(),
        supabase.from('quiz_results').select(),
      ]);

      const students = (sRes.data || []) as Student[];
      const studyDays = (dRes.data || []) as StudyDay[];
      const lessons = (lRes.data || []) as Lesson[];
      const questions = (qRes.data || []) as Question[];
      const quizResults = (rRes.data || []) as QuizResult[];

      await syncAllDataToGoogleSheets({
        students,
        studyDays,
        lessons,
        questions,
        quizResults,
      });

      setStatusType('success');
      setStatusMessage(
        `All records successfully synced to Google Sheets (${students.length} students, ${lessons.length} lessons, ${questions.length} questions, ${quizResults.length} quiz results)!`
      );
    } catch (err: any) {
      console.error(err);
      setStatusType('error');
      setStatusMessage(err.message || 'Failed to sync data to Google Sheets.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-emerald-200 shadow-sm p-4 mb-6 transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Brand and Connection Status */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center flex-shrink-0">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-800">Google Sheets Online Database</h3>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                <CheckCircle className="w-3 h-3 text-emerald-600" />
                Permanently Connected
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Connected directly via Google Web App. Every insert, edit, and delete syncs live 24/7.
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleTestConnection}
            disabled={isTesting}
            title="Test Google Sheets live connection"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
          >
            {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" /> : <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />}
            <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
          </button>

          <button
            onClick={handleSyncAll}
            disabled={isSyncing}
            title="Push all database records to Google Sheets"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-3.5 py-1.5 rounded-lg shadow-sm transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync All to Sheets'}</span>
          </button>
        </div>
      </div>

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
