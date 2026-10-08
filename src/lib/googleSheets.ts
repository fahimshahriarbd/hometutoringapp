/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Student, StudyDay, Lesson, Question, QuizResult } from './supabase';
import { getBangladeshTimeString } from './time';

export const GOOGLE_APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbwesalffjJI8qSlvjN56k_caEPhp6w5HL-1hTnk53cVfmTNegyUIDPyARqqmJbXx50EtQ/exec';

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
    title: 'QuizResults',
    headers: ['Result ID', 'Student ID', 'Lesson ID', 'Score', 'Total Questions', 'Percentage', 'Submitted At', 'Review JSON'],
    keys: ['id', 'student_id', 'lesson_id', 'score', 'total', 'percentage', 'created_at', 'review'],
  },
};

export async function callAppsScript(payload: any): Promise<any> {
  const res = await fetch(GOOGLE_APPS_SCRIPT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Google Apps Script responded with HTTP ${res.status}`);
  }

  return await res.json();
}

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

// 1. READ ALL ROWS FROM TAB
export async function fetchRowsFromSheet(tableKey: string): Promise<any[]> {
  const schema = TAB_SCHEMAS[tableKey];
  if (!schema) return [];

  try {
    const res = await callAppsScript({
      action: 'read',
      table: schema.title,
    });

    if (res.status !== 'success' || !Array.isArray(res.data)) {
      return [];
    }

    const rows: any[][] = res.data;
    if (rows.length <= 1) return [];

    const mapped = rows.slice(1).map((row) => {
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
          item[key] = String(val);
        }
      });
      return item;
    });

    // Deduplicate by ID to prevent duplicate key collisions
    const seen = new Set<string>();
    const uniqueItems: any[] = [];
    for (const item of mapped) {
      const idKey = item.id ? String(item.id) : null;
      if (idKey) {
        if (!seen.has(idKey)) {
          seen.add(idKey);
          uniqueItems.push(item);
        }
      } else {
        uniqueItems.push(item);
      }
    }
    return uniqueItems;
  } catch (err) {
    console.warn(`Error reading ${schema.title} from Google Sheet:`, err);
    return [];
  }
}

// 2. INSERT ROW TO TAB
export async function insertRowToSheet(tableKey: string, item: any): Promise<boolean> {
  const schema = TAB_SCHEMAS[tableKey];
  if (!schema) return false;

  const row = itemToRowArray(tableKey, item);
  try {
    const res = await callAppsScript({
      action: 'insert',
      table: schema.title,
      row,
    });
    return res.status === 'success';
  } catch (err) {
    console.error(`Error inserting into ${schema.title}:`, err);
    return false;
  }
}

// 3. UPDATE ROW IN TAB BY ID
export async function updateRowInSheet(tableKey: string, id: string, updatedFields: any): Promise<boolean> {
  const schema = TAB_SCHEMAS[tableKey];
  if (!schema) return false;

  const currentRows = await fetchRowsFromSheet(tableKey);
  const existing = currentRows.find((r) => String(r.id) === String(id));
  const merged = { ...existing, ...updatedFields, id };
  const row = itemToRowArray(tableKey, merged);

  try {
    const res = await callAppsScript({
      action: 'update',
      table: schema.title,
      id,
      row,
    });
    return res.status === 'success';
  } catch (err) {
    console.error(`Error updating ${schema.title}:`, err);
    return false;
  }
}

// 4. DELETE ROW FROM TAB BY ID
export async function deleteRowFromSheet(tableKey: string, id: string): Promise<boolean> {
  const schema = TAB_SCHEMAS[tableKey];
  if (!schema) return false;

  try {
    const res = await callAppsScript({
      action: 'delete',
      table: schema.title,
      id,
    });
    return res.status === 'success';
  } catch (err) {
    console.error(`Error deleting from ${schema.title}:`, err);
    return false;
  }
}

// 5. ADMIN CREDENTIALS
export async function fetchAdminFromSheet(): Promise<{ username: string; pin: string } | null> {
  try {
    const res = await callAppsScript({
      action: 'read',
      table: 'Admin',
    });
    if (res.status === 'success' && Array.isArray(res.data) && res.data.length > 1) {
      const row = res.data[1];
      if (row && row.length >= 2) {
        return {
          username: String(row[0] || 'admin'),
          pin: String(row[1] || '5678'),
        };
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export async function saveAdminToSheet(username: string, pin: string): Promise<boolean> {
  try {
    await callAppsScript({
      action: 'delete',
      table: 'Admin',
      id: username.trim(),
    });
    const res = await callAppsScript({
      action: 'insert',
      table: 'Admin',
      row: [username.trim(), pin.trim(), getBangladeshTimeString()],
    });
    return res.status === 'success';
  } catch (err) {
    console.error('Error saving admin to Google Sheet:', err);
    return false;
  }
}

// 6. SYNC ALL CURRENT RECORDS TO GOOGLE SHEETS
export async function syncAllDataToGoogleSheets(params: {
  students: Student[];
  studyDays: StudyDay[];
  lessons: Lesson[];
  questions: Question[];
  quizResults: QuizResult[];
}): Promise<{ success: boolean }> {
  for (const s of params.students) {
    await insertRowToSheet('students', s);
  }
  for (const d of params.studyDays) {
    await insertRowToSheet('study_days', d);
  }
  for (const l of params.lessons) {
    await insertRowToSheet('lessons', l);
  }
  for (const q of params.questions) {
    await insertRowToSheet('questions', q);
  }
  for (const r of params.quizResults) {
    await insertRowToSheet('quiz_results', r);
  }
  return { success: true };
}

// Legacy helpers
export async function appendRow(tabName: string, rowValues: any[]): Promise<boolean> {
  try {
    const res = await callAppsScript({
      action: 'insert',
      table: tabName,
      row: rowValues,
    });
    return res.status === 'success';
  } catch {
    return false;
  }
}
