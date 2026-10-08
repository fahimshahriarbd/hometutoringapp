/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  fetchRowsFromSheet,
  insertRowToSheet,
  updateRowInSheet,
  deleteRowFromSheet,
  fetchAdminFromSheet,
  saveAdminToSheet,
} from './googleSheets';

import { getBangladeshTimeString, getBangladeshDateString, formatDayDate } from './time';
export { getBangladeshTimeString, getBangladeshDateString, formatDayDate };

const ADMIN_USER_KEY = 'studywise_admin_username';
const ADMIN_PIN_KEY = 'studywise_admin_pin';

let memoryAdmin = {
  username: localStorage.getItem(ADMIN_USER_KEY) || 'admin',
  pin: localStorage.getItem(ADMIN_PIN_KEY) || '5678',
};

// Check Google Sheets for updated admin credentials on start
fetchAdminFromSheet().then((creds) => {
  if (creds && creds.username && creds.pin) {
    memoryAdmin = creds;
    localStorage.setItem(ADMIN_USER_KEY, creds.username);
    localStorage.setItem(ADMIN_PIN_KEY, creds.pin);
  }
}).catch(() => {});

export const getAdminCredentials = () => {
  return {
    username: memoryAdmin.username || localStorage.getItem(ADMIN_USER_KEY) || 'admin',
    pin: memoryAdmin.pin || localStorage.getItem(ADMIN_PIN_KEY) || '5678',
  };
};

export const setAdminCredentials = (username: string, pin: string) => {
  memoryAdmin = { username: username.trim(), pin: pin.trim() };
  localStorage.setItem(ADMIN_USER_KEY, username.trim());
  localStorage.setItem(ADMIN_PIN_KEY, pin.trim());
  // Save directly to Google Sheet
  saveAdminToSheet(username.trim(), pin.trim()).catch((err) => {
    console.warn('Could not save admin credentials to Google Sheet:', err);
  });
};

export const resetAdminCredentials = () => {
  memoryAdmin = { username: 'admin', pin: '5678' };
  localStorage.removeItem(ADMIN_USER_KEY);
  localStorage.removeItem(ADMIN_PIN_KEY);
  return memoryAdmin;
};

export const verifyAdminCredentials = (inputUsername: string, inputPin: string) => {
  const current = getAdminCredentials();
  const u = inputUsername.trim().toLowerCase();
  const p = inputPin.trim();

  return (
    u === current.username.toLowerCase() &&
    p === current.pin
  );
};

export const verifyAdminCredentialsAsync = async (inputUsername: string, inputPin: string) => {
  let current = getAdminCredentials();
  if (current.username === 'admin' && current.pin === '5678') {
    try {
      const remote = await fetchAdminFromSheet();
      if (remote && remote.username && remote.pin) {
        memoryAdmin = remote;
        localStorage.setItem(ADMIN_USER_KEY, remote.username);
        localStorage.setItem(ADMIN_PIN_KEY, remote.pin);
        current = remote;
      }
    } catch {
      // ignore
    }
  }

  const u = inputUsername.trim().toLowerCase();
  const p = inputPin.trim();

  return (
    u === current.username.toLowerCase() &&
    p === current.pin
  );
};

export interface Student {
  id: string;
  name: string;
  class_name: string;
  subjects: string;
  image_url: string | null;
  pin: string;
  created_at: string;
}

export interface StudyDay {
  id: string;
  student_id: string;
  day_label: string;
  day_date: string;
  created_at: string;
}

export interface Lesson {
  id: string;
  study_day_id: string;
  subject: string;
  short_note: string;
  pdf_url: string | null;
  test_enabled: boolean;
  created_at: string;
}

export interface Question {
  id: string;
  lesson_id: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  answer: 'A' | 'B' | 'C' | 'D';
  explanation: string;
  created_at: string;
}

export interface ReviewItem {
  question: string;
  studentChoice: string | null;
  studentText: string;
  correctChoice: string;
  correctText: string;
  isCorrect: boolean;
  explanation: string;
}

export interface QuizResult {
  id: string;
  student_id: string;
  lesson_id: string;
  score: number;
  total: number;
  percentage: number;
  review: ReviewItem[];
  created_at: string;
}

// ---------------------------------------------------------------------------
// GOOGLE SHEETS DIRECT DATABASE ADAPTER (ALL OTHER DATABASES DISABLED)
// ---------------------------------------------------------------------------

const tableCache: Record<string, any[]> = {
  students: [],
  study_days: [],
  lessons: [],
  questions: [],
  quiz_results: [],
};

const lastFetchedAt: Record<string, number> = {};
const CACHE_DEBOUNCE_MS = 3000; // 3 seconds window to prevent rapid redundant multi-fetches on mount

function deduplicateList(list: any[]): any[] {
  if (!Array.isArray(list)) return [];
  const map = new Map<string, any>();
  for (const item of list) {
    if (!item) continue;
    const key = item.id != null ? String(item.id).trim() : JSON.stringify(item);
    map.set(key, item);
  }
  return Array.from(map.values());
}

// Clear any old local storage tables so that no residual offline database shadows Google Sheets
try {
  ['students', 'study_days', 'lessons', 'questions', 'quiz_results'].forEach((table) => {
    localStorage.removeItem(`studywise_${table}`);
  });
} catch {
  // ignore
}

interface FilterCondition {
  column: string;
  value: any;
}

class SheetQueryBuilder implements PromiseLike<{ data: any; error: any }> {
  private tableName: string;
  private filters: FilterCondition[] = [];
  private orderCol?: string;
  private ascending = true;
  private limitCount?: number;
  private isSingle = false;
  private isMaybeSingle = false;
  private action: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private actionData: any = null;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(...args: any[]) {
    void args;
    return this;
  }

  insert(data: any) {
    this.action = 'insert';
    this.actionData = data;
    return this;
  }

  update(data: any) {
    this.action = 'update';
    this.actionData = data;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  upsert(data: any, ...options: any[]) {
    void options;
    this.action = 'upsert';
    this.actionData = data;
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ column, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderCol = column;
    this.ascending = options?.ascending ?? true;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  private async executeAsync(): Promise<{ data: any; error: any }> {
    const matchesFilters = (item: any) => {
      return this.filters.every((f) => String(item[f.column]) === String(f.value));
    };

    // 1. INSERT: Directly write to Google Sheet and await completion
    if (this.action === 'insert') {
      const itemsToInsert = Array.isArray(this.actionData) ? this.actionData : [this.actionData];
      const insertedList: any[] = [];

      // Make sure we have latest table state
      let table = tableCache[this.tableName] || [];
      if (table.length === 0) {
        try {
          const fresh = await fetchRowsFromSheet(this.tableName);
          table = deduplicateList(fresh || []);
          tableCache[this.tableName] = table;
        } catch {
          // ignore
        }
      }

      for (const item of itemsToInsert) {
        const id =
          item.id ||
          (typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `id-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);
        const newItem = {
          created_at: item.created_at || getBangladeshTimeString(),
          ...item,
          id: String(id).trim(),
        };

        const success = await insertRowToSheet(this.tableName, newItem);
        if (!success) {
          return { data: null, error: { message: `Google Sheets insert failed for ${this.tableName}` } };
        }

        const existingIdx = table.findIndex((r: any) => String(r.id).trim() === String(newItem.id));
        if (existingIdx >= 0) {
          table[existingIdx] = { ...table[existingIdx], ...newItem };
        } else {
          table.push(newItem);
        }
        insertedList.push(newItem);
      }

      tableCache[this.tableName] = deduplicateList(table);
      lastFetchedAt[this.tableName] = Date.now();
      const res = Array.isArray(this.actionData) ? insertedList : insertedList[0];
      return { data: res, error: null };
    }

    // 2. UPDATE: Directly update in Google Sheet and await completion
    if (this.action === 'update') {
      let table = tableCache[this.tableName] || [];
      if (table.length === 0) {
        try {
          const fresh = await fetchRowsFromSheet(this.tableName);
          table = deduplicateList(fresh || []);
          tableCache[this.tableName] = table;
        } catch {
          // ignore
        }
      }

      const updatedList: any[] = [];
      for (let i = 0; i < table.length; i++) {
        if (matchesFilters(table[i])) {
          const targetId = table[i].id;
          if (targetId) {
            const success = await updateRowInSheet(this.tableName, targetId, this.actionData);
            if (!success) {
              return { data: null, error: { message: `Google Sheets update failed for ${this.tableName}` } };
            }
          }
          table[i] = { ...table[i], ...this.actionData };
          updatedList.push(table[i]);
        }
      }

      tableCache[this.tableName] = deduplicateList(table);
      lastFetchedAt[this.tableName] = Date.now();
      const res = this.isSingle ? (updatedList[0] || null) : updatedList;
      return { data: res, error: null };
    }

    // 3. DELETE: Directly delete from Google Sheet and await completion
    if (this.action === 'delete') {
      let table = tableCache[this.tableName] || [];
      if (table.length === 0) {
        try {
          const fresh = await fetchRowsFromSheet(this.tableName);
          table = deduplicateList(fresh || []);
          tableCache[this.tableName] = table;
        } catch {
          // ignore
        }
      }

      const itemsToDelete = table.filter(matchesFilters);
      for (const item of itemsToDelete) {
        if (item.id) {
          const success = await deleteRowFromSheet(this.tableName, item.id);
          if (!success) {
            return { data: null, error: { message: `Google Sheets delete failed for ${this.tableName}` } };
          }
        }
      }

      tableCache[this.tableName] = table.filter((item) => !matchesFilters(item));
      lastFetchedAt[this.tableName] = Date.now();
      return { data: null, error: null };
    }

    // 4. UPSERT: Update or Insert directly in Google Sheet
    if (this.action === 'upsert') {
      const itemsToUpsert = Array.isArray(this.actionData) ? this.actionData : [this.actionData];
      let table = tableCache[this.tableName] || [];
      if (table.length === 0) {
        try {
          const fresh = await fetchRowsFromSheet(this.tableName);
          table = deduplicateList(fresh || []);
          tableCache[this.tableName] = table;
        } catch {
          // ignore
        }
      }

      const resultList: any[] = [];
      for (const item of itemsToUpsert) {
        let existingIdx = -1;
        if (this.tableName === 'quiz_results' && item.student_id && item.lesson_id) {
          existingIdx = table.findIndex(
            (r: any) => r.student_id === item.student_id && r.lesson_id === item.lesson_id
          );
        } else if (item.id) {
          existingIdx = table.findIndex((r: any) => r.id === item.id);
        }

        if (existingIdx >= 0) {
          const targetId = table[existingIdx].id;
          const success = await updateRowInSheet(this.tableName, targetId, item);
          if (!success) {
            return { data: null, error: { message: `Google Sheets upsert update failed for ${this.tableName}` } };
          }
          table[existingIdx] = { ...table[existingIdx], ...item };
          resultList.push(table[existingIdx]);
        } else {
          const newItem = {
            id:
              item.id ||
              (typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : `id-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`),
            created_at: item.created_at || getBangladeshTimeString(),
            ...item,
          };
          const success = await insertRowToSheet(this.tableName, newItem);
          if (!success) {
            return { data: null, error: { message: `Google Sheets upsert insert failed for ${this.tableName}` } };
          }
          table.push(newItem);
          resultList.push(newItem);
        }
      }

      tableCache[this.tableName] = deduplicateList(table);
      lastFetchedAt[this.tableName] = Date.now();
      const res = this.isSingle
        ? (resultList[0] || null)
        : Array.isArray(this.actionData)
        ? resultList
        : resultList[0];
      return { data: res, error: null };
    }

    // 5. SELECT: Read directly from Google Sheet
    const now = Date.now();
    const last = lastFetchedAt[this.tableName] || 0;
    const isExpired = now - last > CACHE_DEBOUNCE_MS;

    if (isExpired || !tableCache[this.tableName] || tableCache[this.tableName].length === 0) {
      try {
        const sheetRows = await fetchRowsFromSheet(this.tableName);
        tableCache[this.tableName] = deduplicateList(sheetRows || []);
        lastFetchedAt[this.tableName] = Date.now();
      } catch (e) {
        console.warn(`Could not fetch ${this.tableName} from Google Sheets:`, e);
      }
    }

    const table = tableCache[this.tableName] || [];
    let filtered = deduplicateList(table.filter(matchesFilters));

    if (this.orderCol) {
      const col = this.orderCol;
      const asc = this.ascending;
      filtered.sort((a, b) => {
        const valA = a[col];
        const valB = b[col];
        if (valA === undefined || valB === undefined) return 0;
        if (valA < valB) return asc ? -1 : 1;
        if (valA > valB) return asc ? 1 : -1;
        return 0;
      });
    }

    if (typeof this.limitCount === 'number') {
      filtered = filtered.slice(0, this.limitCount);
    }

    if (this.isSingle) {
      if (filtered.length === 0) {
        return { data: null, error: { message: 'Row not found in Google Sheets' } };
      }
      return { data: filtered[0], error: null };
    }

    if (this.isMaybeSingle) {
      return { data: filtered[0] || null, error: null };
    }

    return { data: filtered, error: null };
  }

  then<TResult1 = { data: any; error: any }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.executeAsync().then(onfulfilled, onrejected);
  }
}

// Google Sheets Database Client (Sole active database)
export const sheetsDb = {
  from: (tableName: string) => new SheetQueryBuilder(tableName),
};

export const db = sheetsDb;
export const supabase = sheetsDb;
