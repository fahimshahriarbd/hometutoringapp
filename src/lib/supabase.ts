/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL;
const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const ADMIN_USERNAME = 'admin';
export const ADMIN_PIN = '5678';

export interface AdminAccount {
  id: string; // login ID (e.g. 'admin', 'tutor1')
  name: string; // display name
  pin: string; // 4-digit PIN
}

const ADMINS_LIST_KEY = 'studywise_admins_list';

export const getAdminList = (): AdminAccount[] => {
  try {
    const raw = localStorage.getItem(ADMINS_LIST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore
  }
  const defaultUser = localStorage.getItem('studywise_admin_username') || ADMIN_USERNAME;
  const defaultPin = localStorage.getItem('studywise_admin_pin') || ADMIN_PIN;
  return [{ id: defaultUser, name: defaultUser === 'admin' ? 'Head Tutor' : defaultUser, pin: defaultPin }];
};

export const saveAdminList = (admins: AdminAccount[]) => {
  try {
    localStorage.setItem(ADMINS_LIST_KEY, JSON.stringify(admins));
    if (admins.length > 0) {
      localStorage.setItem('studywise_admin_username', admins[0].id);
      localStorage.setItem('studywise_admin_pin', admins[0].pin);
    }
  } catch {
    // ignore
  }
};

export const getAdminCredentials = () => {
  const list = getAdminList();
  return {
    username: list[0]?.id || ADMIN_USERNAME,
    pin: list[0]?.pin || ADMIN_PIN,
  };
};

export const setAdminCredentials = (username: string, pin: string) => {
  const list = getAdminList();
  if (list.length > 0) {
    list[0].id = username.trim();
    list[0].pin = pin.trim();
  } else {
    list.push({ id: username.trim(), name: username.trim(), pin: pin.trim() });
  }
  saveAdminList(list);
};

export const verifyAdminCredentials = (inputUsername: string, inputPin: string): AdminAccount | null => {
  const list = getAdminList();
  const match = list.find(
    (a) => a.id.toLowerCase() === inputUsername.trim().toLowerCase() && a.pin === inputPin.trim()
  );
  return match || null;
};

export const addAdminAccount = (account: AdminAccount): boolean => {
  const list = getAdminList();
  if (list.some((a) => a.id.toLowerCase() === account.id.trim().toLowerCase())) {
    return false;
  }
  list.push({
    id: account.id.trim(),
    name: account.name.trim(),
    pin: account.pin.trim(),
  });
  saveAdminList(list);
  return true;
};

export const deleteAdminAccount = (adminId: string): boolean => {
  let list = getAdminList();
  if (list.length <= 1) return false;
  list = list.filter((a) => a.id.toLowerCase() !== adminId.toLowerCase());
  saveAdminList(list);
  return true;
};

export const updateAdminAccount = (adminId: string, updated: Partial<AdminAccount>): boolean => {
  const list = getAdminList();
  const idx = list.findIndex((a) => a.id.toLowerCase() === adminId.toLowerCase());
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...updated };
    saveAdminList(list);
    return true;
  }
  return false;
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

// ----------------------------------------------------
// Mock in-memory & localStorage store for local / demo
// ----------------------------------------------------

// One-time cleanup of demo items from localStorage
try {
  const cleanupMarker = 'studywise_purged_demo_v2';
  if (!localStorage.getItem(cleanupMarker)) {
    ['students', 'study_days', 'lessons', 'questions', 'quiz_results'].forEach((table) => {
      const raw = localStorage.getItem(`studywise_${table}`);
      if (raw) {
        let items = JSON.parse(raw);
        if (table === 'students') items = items.filter((s: any) => s.id !== '1001');
        if (table === 'study_days') items = items.filter((d: any) => d.id !== 'day-01');
        if (table === 'lessons') items = items.filter((l: any) => l.id !== 'lesson-01');
        if (table === 'questions') items = items.filter((q: any) => q.id !== 'q-01' && q.id !== 'q-02');
        localStorage.setItem(`studywise_${table}`, JSON.stringify(items));
      }
    });

    const session = localStorage.getItem('studywise_session');
    if (session && session.includes('1001')) {
      localStorage.removeItem('studywise_session');
    }
    localStorage.setItem(cleanupMarker, 'true');
  }
} catch {
  // ignore
}

function getStoredTable(tableName: string): any[] {
  try {
    const raw = localStorage.getItem(`studywise_${tableName}`);
    if (raw) {
      const items = JSON.parse(raw);
      // Ensure demo items are never returned
      if (tableName === 'students') return items.filter((s: any) => s.id !== '1001');
      if (tableName === 'study_days') return items.filter((d: any) => d.id !== 'day-01');
      if (tableName === 'lessons') return items.filter((l: any) => l.id !== 'lesson-01');
      if (tableName === 'questions') return items.filter((q: any) => q.id !== 'q-01' && q.id !== 'q-02');
      return items;
    }
  } catch {
    // ignore
  }

  return [];
}

function saveStoredTable(tableName: string, data: any[]) {
  try {
    localStorage.setItem(`studywise_${tableName}`, JSON.stringify(data));
  } catch {
    // ignore
  }
}

interface FilterCondition {
  column: string;
  value: any;
}

class MockQueryBuilder implements PromiseLike<{ data: any; error: any }> {
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

  select() {
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

  upsert(data: any) {
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

  private execute(): { data: any; error: any } {
    const table = getStoredTable(this.tableName);

    const matchesFilters = (item: any) => {
      return this.filters.every(f => String(item[f.column]) === String(f.value));
    };

    if (this.action === 'insert') {
      const itemsToInsert = Array.isArray(this.actionData) ? this.actionData : [this.actionData];
      const insertedList: any[] = [];

      for (const item of itemsToInsert) {
        const newItem = {
          id: item.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`),
          created_at: item.created_at || new Date().toISOString(),
          ...item,
        };
        table.push(newItem);
        insertedList.push(newItem);
      }

      saveStoredTable(this.tableName, table);
      const res = Array.isArray(this.actionData) ? insertedList : insertedList[0];
      return { data: res, error: null };
    }

    if (this.action === 'update') {
      const updatedList: any[] = [];
      for (let i = 0; i < table.length; i++) {
        if (matchesFilters(table[i])) {
          table[i] = { ...table[i], ...this.actionData };
          updatedList.push(table[i]);
        }
      }
      saveStoredTable(this.tableName, table);
      const res = this.isSingle ? (updatedList[0] || null) : updatedList;
      return { data: res, error: null };
    }

    if (this.action === 'delete') {
      const remaining = table.filter(item => !matchesFilters(item));
      saveStoredTable(this.tableName, remaining);
      return { data: null, error: null };
    }

    if (this.action === 'upsert') {
      const itemsToUpsert = Array.isArray(this.actionData) ? this.actionData : [this.actionData];
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
          table[existingIdx] = { ...table[existingIdx], ...item };
          resultList.push(table[existingIdx]);
        } else {
          const newItem = {
            id: item.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`),
            created_at: item.created_at || new Date().toISOString(),
            ...item,
          };
          table.push(newItem);
          resultList.push(newItem);
        }
      }

      saveStoredTable(this.tableName, table);
      const res = this.isSingle ? (resultList[0] || null) : (Array.isArray(this.actionData) ? resultList : resultList[0]);
      return { data: res, error: null };
    }

    // Default 'select'
    let filtered = table.filter(matchesFilters);

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
        return { data: null, error: { message: 'Row not found' } };
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
    const res = this.execute();
    return Promise.resolve(res).then(onfulfilled, onrejected);
  }
}

const mockClient = {
  from: (tableName: string) => new MockQueryBuilder(tableName),
};

const hasRealCredentials = Boolean(
  rawUrl &&
  typeof rawUrl === 'string' &&
  rawUrl.startsWith('http') &&
  rawAnonKey &&
  rawAnonKey !== 'undefined'
);

let activeSupabaseClient: any;

if (hasRealCredentials) {
  try {
    activeSupabaseClient = createClient(rawUrl, rawAnonKey);
  } catch (err) {
    console.warn('[StudyWise] Supabase credentials invalid or failed to initialize, falling back to local storage:', err);
    activeSupabaseClient = mockClient;
  }
} else {
  // Graceful in-memory / local storage fallback so app runs out of the box in preview/dev
  activeSupabaseClient = mockClient;
}

export const supabase = activeSupabaseClient;
