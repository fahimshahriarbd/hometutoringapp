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

// ---------------------------------------------------------------------------
// TAB SCHEMAS & COLUMN DEFINITIONS
// ---------------------------------------------------------------------------

export const TAB_SCHEMAS: Record<string, { title: string; headers: string[]; keys: string[] }> = {
  admin: {
    title: 'Admin',
    headers: ['Username', 'PIN', 'Updated At'],
    keys: ['username', 'pin', 'updated_at'],
  },
  students: {
    title: 'Students',
    headers: ['Student ID', 'Full Name', 'Class / Grade', 'Subjects', 'PIN', 'Photo URL', 'Created At'],
    keys: ['id', 'name', 'class_name', 'subjects', 'pin', 'image_url', 'created_at'],
  },
  study_days: {
    title: 'StudyDays',
    headers: ['Day ID', 'Student ID', 'Day Label', 'Date', 'Created At'],
    keys: ['id', 'student_id', 'day_label', 'day_date', 'created_at'],
  },
  lessons: {
    title: 'Lessons',
    headers: ['Lesson ID', 'Study Day ID', 'Subject', 'Topics & Notes', 'PDF Resource', 'Quiz Enabled', 'Created At'],
    keys: ['id', 'study_day_id', 'subject', 'short_note', 'pdf_url', 'test_enabled', 'created_at'],
  },
  questions: {
    title: 'Questions',
    headers: ['Question ID', 'Lesson ID', 'Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Answer', 'Explanation', 'Created At'],
    keys: ['id', 'lesson_id', 'question', 'option_a', 'option_b', 'option_c', 'option_d', 'answer', 'explanation', 'created_at'],
  },
  quiz_results: {
    title: 'Quiz Results',
    headers: ['Result ID', 'Student ID', 'Lesson ID', 'Score', 'Total Questions', 'Percentage', 'Submitted At', 'Review JSON'],
    keys: ['id', 'student_id', 'lesson_id', 'score', 'total', 'percentage', 'created_at', 'review'],
  },
};

// Escape single quotes and format range safely
export function formatRange(sheetTitle: string, cellRange: string): string {
  const safeTitle = sheetTitle.replace(/'/g, "''");
  return `'${safeTitle}'!${cellRange}`;
}

// ---------------------------------------------------------------------------
// SPREADSHEET INITIALIZATION & SETUP
// ---------------------------------------------------------------------------

export async function createStudyWiseSpreadsheet(title = 'StudyWise - Tutoring & Student Learning'): Promise<{ id: string; url: string }> {
  const token = await getAccessToken();
  if (!token) throw new Error('Google account is not connected. Please sign in first.');

  const sheets = Object.values(TAB_SCHEMAS).map((s, idx) => ({
    properties: { title: s.title, index: idx },
  }));

  const body = {
    properties: { title },
    sheets,
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
  await setupHeaders(spreadsheetId, token);

  return { id: spreadsheetId, url: spreadsheetUrl };
}

export async function ensureSpreadsheetSetup(): Promise<{ id: string; url: string } | null> {
  const token = await getAccessToken();
  if (!token) return null;

  let { spreadsheetId, spreadsheetUrl } = getStoredSheetConfig();
  let existingSheetTitles: string[] = [];

  // Check if existing spreadsheet is valid
  if (spreadsheetId) {
    try {
      const checkRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (checkRes.ok) {
        const meta = await checkRes.json();
        existingSheetTitles = (meta.sheets || []).map((s: any) => s.properties?.title || '');
      } else {
        spreadsheetId = null;
      }
    } catch {
      spreadsheetId = null;
    }
  }

  // Create new if none exists
  if (!spreadsheetId) {
    try {
      const created = await createStudyWiseSpreadsheet();
      spreadsheetId = created.id;
      spreadsheetUrl = created.url;
      existingSheetTitles = Object.values(TAB_SCHEMAS).map((s) => s.title);
    } catch (e) {
      console.warn('Could not auto-create spreadsheet:', e);
      return null;
    }
  }

  // Add any missing tabs
  const missingTabs = Object.values(TAB_SCHEMAS).filter(
    (schema) =>
      !existingSheetTitles.includes(schema.title) &&
      !existingSheetTitles.includes(schema.title.replace(' ', '')) // e.g. QuizResults vs Quiz Results
  );

  if (missingTabs.length > 0) {
    try {
      const requests = missingTabs.map((schema) => ({
        addSheet: {
          properties: {
            title: schema.title,
          },
        },
      }));

      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests }),
      });

      const headerData = missingTabs.map((schema) => ({
        range: formatRange(schema.title, 'A1:Z1'),
        values: [schema.headers],
      }));

      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data: headerData,
        }),
      });
    } catch (err) {
      console.warn('Error adding missing tabs:', err);
    }
  }

  return { id: spreadsheetId, url: spreadsheetUrl! };
}

async function setupHeaders(spreadsheetId: string, token: string) {
  const data = Object.values(TAB_SCHEMAS).map((s) => ({
    range: formatRange(s.title, 'A1:Z1'),
    values: [s.headers],
  }));

  const adminInit = {
    range: formatRange('Admin', 'A2:C2'),
    values: [['admin', '5678', new Date().toISOString()]],
  };

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: [...data, adminInit],
    }),
  });
}

// ---------------------------------------------------------------------------
// CRUD OPERATIONS DIRECTLY ON GOOGLE SHEETS
// ---------------------------------------------------------------------------

// 1. READ ALL ROWS FROM TAB
export async function fetchRowsFromSheet(tableKey: string): Promise<any[]> {
  const token = await getAccessToken();
  const { spreadsheetId } = getStoredSheetConfig();
  if (!token || !spreadsheetId) return [];

  const schema = TAB_SCHEMAS[tableKey];
  if (!schema) return [];

  const range = formatRange(schema.title, 'A2:Z500');

  try {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!res.ok) return [];

    const data = await res.json();
    const rows: string[][] = data.values || [];

    return rows.map((row) => {
      const item: Record<string, any> = {};
      schema.keys.forEach((key, idx) => {
        const val = row[idx] ?? '';
        if (key === 'test_enabled') {
          item[key] = val === 'true' || val === 'Yes' || val === true;
        } else if (key === 'score' || key === 'total' || key === 'percentage') {
          item[key] = val ? parseInt(String(val).replace('%', ''), 10) || 0 : 0;
        } else if (key === 'review') {
          try {
            item[key] = val ? JSON.parse(val) : [];
          } catch {
            item[key] = [];
          }
        } else {
          item[key] = val;
        }
      });
      return item;
    });
  } catch (err) {
    console.error(`Error reading ${schema.title} from Google Sheets:`, err);
    return [];
  }
}

// Convert item object to row array
function itemToRowArray(tableKey: string, item: any): (string | number | boolean)[] {
  const schema = TAB_SCHEMAS[tableKey];
  if (!schema) return [];

  return schema.keys.map((key) => {
    const val = item[key];
    if (key === 'review') {
      return typeof val === 'object' ? JSON.stringify(val) : String(val || '[]');
    }
    if (key === 'test_enabled') {
      return val ? 'Yes' : 'No';
    }
    if (val === undefined || val === null) {
      return '';
    }
    return val;
  });
}

// 2. INSERT ROW TO TAB
export async function insertRowToSheet(tableKey: string, item: any): Promise<boolean> {
  const token = await getAccessToken();
  const { spreadsheetId } = getStoredSheetConfig();
  if (!token || !spreadsheetId) return false;

  const schema = TAB_SCHEMAS[tableKey];
  if (!schema) return false;

  const rowValues = itemToRowArray(tableKey, item);
  const range = formatRange(schema.title, 'A1');

  try {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
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
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error(`Append failed on ${schema.title}:`, err);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Error inserting into ${schema.title}:`, err);
    return false;
  }
}

// 3. UPDATE ROW IN TAB BY ID
export async function updateRowInSheet(tableKey: string, id: string, updatedFields: any): Promise<boolean> {
  const token = await getAccessToken();
  const { spreadsheetId } = getStoredSheetConfig();
  if (!token || !spreadsheetId) return false;

  const schema = TAB_SCHEMAS[tableKey];
  if (!schema) return false;

  const readRange = formatRange(schema.title, 'A2:Z500');

  try {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(readRange)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!res.ok) return false;

    const data = await res.json();
    const rows: string[][] = data.values || [];
    const idIdx = schema.keys.indexOf('id');

    const rowIndex = rows.findIndex((r) => r[idIdx] === id);
    if (rowIndex === -1) return false;

    const existingRow = rows[rowIndex];
    const mergedItem: Record<string, any> = {};
    schema.keys.forEach((k, idx) => {
      mergedItem[k] = existingRow[idx] ?? '';
    });
    Object.assign(mergedItem, updatedFields);

    const updatedRowArray = itemToRowArray(tableKey, mergedItem);
    const sheetRowNumber = rowIndex + 2;
    const writeRange = formatRange(schema.title, `A${sheetRowNumber}:Z${sheetRowNumber}`);

    const updateRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(writeRange)}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [updatedRowArray],
        }),
      }
    );
    return updateRes.ok;
  } catch (err) {
    console.error(`Error updating row in ${schema.title}:`, err);
    return false;
  }
}

// 4. DELETE ROW FROM TAB BY ID
export async function deleteRowFromSheet(tableKey: string, id: string): Promise<boolean> {
  const token = await getAccessToken();
  const { spreadsheetId } = getStoredSheetConfig();
  if (!token || !spreadsheetId) return false;

  const schema = TAB_SCHEMAS[tableKey];
  if (!schema) return false;

  const readRange = formatRange(schema.title, 'A2:Z500');

  try {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(readRange)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!res.ok) return false;

    const data = await res.json();
    const rows: string[][] = data.values || [];
    const idIdx = schema.keys.indexOf('id');

    const remainingRows = rows.filter((r) => r[idIdx] !== id);

    // Clear A2:Z500
    const clearRange = formatRange(schema.title, 'A2:Z500');
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(clearRange)}:clear`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    // Write back remaining rows
    if (remainingRows.length > 0) {
      const writeRange = formatRange(schema.title, 'A2');
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(writeRange)}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: remainingRows,
          }),
        }
      );
    }
    return true;
  } catch (err) {
    console.error(`Error deleting row from ${schema.title}:`, err);
    return false;
  }
}

// 5. ADMIN CREDENTIALS
export async function fetchAdminFromSheet(): Promise<{ username: string; pin: string } | null> {
  const token = await getAccessToken();
  const { spreadsheetId } = getStoredSheetConfig();
  if (!token || !spreadsheetId) return null;

  const range = formatRange('Admin', 'A2:B2');
  try {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!res.ok) return null;

    const data = await res.json();
    if (data.values && data.values.length > 0 && data.values[0].length >= 2) {
      return {
        username: data.values[0][0] || 'admin',
        pin: data.values[0][1] || '5678',
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveAdminToSheet(username: string, pin: string): Promise<boolean> {
  const token = await getAccessToken();
  const { spreadsheetId } = getStoredSheetConfig();
  if (!token || !spreadsheetId) return false;

  const range = formatRange('Admin', 'A2:C2');
  try {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [[username.trim(), pin.trim(), new Date().toISOString()]],
        }),
      }
    );
    return res.ok;
  } catch (err) {
    console.error('Error saving admin to Google Sheet:', err);
    return false;
  }
}

// Append legacy
export async function appendRow(tabName: string, rowValues: any[]): Promise<boolean> {
  const token = await getAccessToken();
  const { spreadsheetId } = getStoredSheetConfig();
  if (!token || !spreadsheetId) return false;

  const range = formatRange(tabName, 'A1');
  try {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
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

// Sync all data to Google Sheets
export async function syncAllDataToGoogleSheets(params: {
  students: Student[];
  studyDays: StudyDay[];
  lessons: Lesson[];
  questions: Question[];
  quizResults: QuizResult[];
}): Promise<{ success: boolean; spreadsheetUrl: string }> {
  const token = await getAccessToken();
  if (!token) throw new Error('Not signed into Google. Please sign in first.');

  const setup = await ensureSpreadsheetSetup();
  if (!setup) throw new Error('Could not initialize Google Spreadsheet.');

  const spreadsheetId = setup.id;
  const spreadsheetUrl = setup.url;

  const studentRows = [
    TAB_SCHEMAS.students.headers,
    ...params.students.map((s) => itemToRowArray('students', s)),
  ];

  const dayRows = [
    TAB_SCHEMAS.study_days.headers,
    ...params.studyDays.map((d) => itemToRowArray('study_days', d)),
  ];

  const lessonRows = [
    TAB_SCHEMAS.lessons.headers,
    ...params.lessons.map((l) => itemToRowArray('lessons', l)),
  ];

  const questionRows = [
    TAB_SCHEMAS.questions.headers,
    ...params.questions.map((q) => itemToRowArray('questions', q)),
  ];

  const resultRows = [
    TAB_SCHEMAS.quiz_results.headers,
    ...params.quizResults.map((r) => itemToRowArray('quiz_results', r)),
  ];

  const writeData = [
    { range: formatRange(TAB_SCHEMAS.students.title, 'A1'), values: studentRows },
    { range: formatRange(TAB_SCHEMAS.study_days.title, 'A1'), values: dayRows },
    { range: formatRange(TAB_SCHEMAS.lessons.title, 'A1'), values: lessonRows },
    { range: formatRange(TAB_SCHEMAS.questions.title, 'A1'), values: questionRows },
    { range: formatRange(TAB_SCHEMAS.quiz_results.title, 'A1'), values: resultRows },
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

  return { success: true, spreadsheetUrl };
}
