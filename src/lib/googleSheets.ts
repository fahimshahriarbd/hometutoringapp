/* eslint-disable @typescript-eslint/no-explicit-any */
import { getAccessToken } from './googleAuth';
import type { Student, StudyDay, Lesson, Question, QuizResult } from './supabase';

const SPREADSHEET_ID_KEY = 'studywise_sheets_id';
const SPREADSHEET_URL_KEY = 'studywise_sheets_url';

export interface SheetConfig {
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
}

export const getStoredSheetConfig = (): SheetConfig => {
  return {
    spreadsheetId: localStorage.getItem(SPREADSHEET_ID_KEY),
    spreadsheetUrl: localStorage.getItem(SPREADSHEET_URL_KEY),
  };
};

export const setStoredSheetConfig = (id: string, url: string) => {
  localStorage.setItem(SPREADSHEET_ID_KEY, id);
  localStorage.setItem(SPREADSHEET_URL_KEY, url);
};

export const clearStoredSheetConfig = () => {
  localStorage.removeItem(SPREADSHEET_ID_KEY);
  localStorage.removeItem(SPREADSHEET_URL_KEY);
};

// Create a new Google Spreadsheet with 4 organized tabs
export async function createStudyWiseSpreadsheet(title = 'StudyWise - Tutoring & Student Learning'): Promise<{ id: string; url: string }> {
  const token = await getAccessToken();
  if (!token) throw new Error('Google account is not connected. Please sign in first.');

  const body = {
    properties: {
      title,
    },
    sheets: [
      { properties: { title: 'Students', index: 0 } },
      { properties: { title: 'Lessons', index: 1 } },
      { properties: { title: 'Questions', index: 2 } },
      { properties: { title: 'Quiz Results', index: 3 } },
    ],
  };

  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to create Google Spreadsheet');
  }

  const data = await res.json();
  const spreadsheetId = data.spreadsheetId;
  const spreadsheetUrl = data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  setStoredSheetConfig(spreadsheetId, spreadsheetUrl);

  // Initialize Headers
  await setupHeaders(spreadsheetId, token);

  return { id: spreadsheetId, url: spreadsheetUrl };
}

// Ensure header rows exist in each sheet tab
async function setupHeaders(spreadsheetId: string, token: string) {
  const headers = [
    {
      range: 'Students!A1:G1',
      values: [['Student ID', 'Full Name', 'Class / Grade', 'Subjects', 'PIN', 'Photo URL', 'Created At']],
    },
    {
      range: 'Lessons!A1:H1',
      values: [['Lesson ID', 'Student ID', 'Day Label', 'Date', 'Subject', 'Topics & Notes', 'PDF Resource', 'Quiz Enabled']],
    },
    {
      range: 'Questions!A1:I1',
      values: [['Question ID', 'Lesson ID', 'Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Answer', 'Explanation']],
    },
    {
      range: 'Quiz Results!A1:H1',
      values: [['Result ID', 'Student ID', 'Lesson ID', 'Score', 'Total Questions', 'Percentage (%)', 'Submitted At', 'Review JSON']],
    },
  ];

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: headers,
    }),
  });
}

// Append a single row to a given sheet
export async function appendRow(tabName: string, rowValues: any[]): Promise<boolean> {
  const token = await getAccessToken();
  const { spreadsheetId } = getStoredSheetConfig();
  if (!token || !spreadsheetId) return false;

  try {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A1:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [rowValues],
        }),
      }
    );
    return res.ok;
  } catch (err) {
    console.error(`Error appending to ${tabName}:`, err);
    return false;
  }
}

// Sync all local / Supabase database records to Google Sheets
export async function syncAllDataToGoogleSheets(params: {
  students: Student[];
  studyDays: StudyDay[];
  lessons: Lesson[];
  questions: Question[];
  quizResults: QuizResult[];
}): Promise<{ success: boolean; spreadsheetUrl: string }> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not signed into Google. Please sign in first.');

  let { spreadsheetId, spreadsheetUrl } = getStoredSheetConfig();

  // If no spreadsheet configured yet, create one
  if (!spreadsheetId) {
    const created = await createStudyWiseSpreadsheet();
    spreadsheetId = created.id;
    spreadsheetUrl = created.url;
  }

  // Build rows for Students
  const studentRows = [
    ['Student ID', 'Full Name', 'Class / Grade', 'Subjects', 'PIN', 'Photo URL', 'Created At'],
    ...params.students.map((s) => [
      s.id,
      s.name,
      s.class_name,
      s.subjects,
      s.pin,
      s.image_url || '',
      s.created_at,
    ]),
  ];

  // Map study day info for lessons
  const dayMap = new Map<string, StudyDay>();
  for (const d of params.studyDays) {
    dayMap.set(d.id, d);
  }

  // Build rows for Lessons
  const lessonRows = [
    ['Lesson ID', 'Student ID', 'Day Label', 'Date', 'Subject', 'Topics & Notes', 'PDF Resource', 'Quiz Enabled'],
    ...params.lessons.map((l) => {
      const day = dayMap.get(l.study_day_id);
      return [
        l.id,
        day ? day.student_id : '',
        day ? day.day_label : '',
        day ? day.day_date : '',
        l.subject,
        l.short_note,
        l.pdf_url || '',
        l.test_enabled ? 'Yes' : 'No',
      ];
    }),
  ];

  // Build rows for Questions
  const questionRows = [
    ['Question ID', 'Lesson ID', 'Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Answer', 'Explanation'],
    ...params.questions.map((q) => [
      q.id,
      q.lesson_id,
      q.question,
      q.option_a,
      q.option_b,
      q.option_c,
      q.option_d,
      q.answer,
      q.explanation || '',
    ]),
  ];

  // Build rows for Quiz Results
  const resultRows = [
    ['Result ID', 'Student ID', 'Lesson ID', 'Score', 'Total Questions', 'Percentage (%)', 'Submitted At', 'Review JSON'],
    ...params.quizResults.map((r) => [
      r.id,
      r.student_id,
      r.lesson_id,
      r.score,
      r.total,
      `${r.percentage}%`,
      r.created_at,
      JSON.stringify(r.review || []),
    ]),
  ];

  // Clear existing sheet contents and overwrite with fresh data
  const clearRanges = ['Students!A1:Z500', 'Lessons!A1:Z500', 'Questions!A1:Z500', 'Quiz Results!A1:Z500'];
  for (const range of clearRanges) {
    try {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );
    } catch {
      // ignore clear error
    }
  }

  // Write new rows in batch
  const writeData = [
    { range: 'Students!A1', values: studentRows },
    { range: 'Lessons!A1', values: lessonRows },
    { range: 'Questions!A1', values: questionRows },
    { range: 'Quiz Results!A1', values: resultRows },
  ];

  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: writeData,
      }),
    }
  );

  if (!updateRes.ok) {
    const err = await updateRes.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to sync data to Google Sheets.');
  }

  return { success: true, spreadsheetUrl: spreadsheetUrl! };
}
