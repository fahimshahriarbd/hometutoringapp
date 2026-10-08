/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  fetchRowsFromSheet,
  insertRowToSheet,
  updateRowInSheet,
  deleteRowFromSheet,
  fetchAdminFromSheet,
  saveAdminToSheet,
} from './googleSheets';

export const ADMIN_USERNAME = 'admin';
export const ADMIN_PIN = '5678';

import { getBangladeshTimeString, getBangladeshDateString, formatDayDate } from './time';
export { getBangladeshTimeString, getBangladeshDateString, formatDayDate };

const ADMIN_USER_KEY = 'studywise_admin_username';
const ADMIN_PIN_KEY = 'studywise_admin_pin';

let memoryAdmin = {
  username: localStorage.getItem(ADMIN_USER_KEY) || ADMIN_USERNAME,
  pin: localStorage.getItem(ADMIN_PIN_KEY) || ADMIN_PIN,
};

// Check Google Sheets for updated admin credentials on start
fetchAdminFromSheet().then((creds) => {
  if (creds) {
    memoryAdmin = creds;
    localStorage.setItem(ADMIN_USER_KEY, creds.username);
    localStorage.setItem(ADMIN_PIN_KEY, creds.pin);
  }
}).catch(() => {});

export const getAdminCredentials = () => {
  return memoryAdmin;
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
  memoryAdmin = { username: ADMIN_USERNAME, pin: ADMIN_PIN };
  localStorage.setItem(ADMIN_USER_KEY, ADMIN_USERNAME);
  localStorage.setItem(ADMIN_PIN_KEY, ADMIN_PIN);
  saveAdminToSheet(ADMIN_USERNAME, ADMIN_PIN).catch(() => {});
  return memoryAdmin;
};

export const verifyAdminCredentials = (inputUsername: string, inputPin: string) => {
  const current = getAdminCredentials();
  const u = inputUsername.trim().toLowerCase();
  const p = inputPin.trim();

  // Always allow default credentials as master recovery
  if (u === ADMIN_USERNAME && p === ADMIN_PIN) {
    return true;
  }

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
// IN-MEMORY CACHE SYNCED DIRECTLY WITH GOOGLE SHEETS
// ---------------------------------------------------------------------------

const SEED_STUDENTS: Student[] = [
  {
    id: '1001',
    name: 'Student 01',
    class_name: 'HSC 2nd Year',
    subjects: 'Biology, Chemistry',
    image_url: '',
    pin: '1234',
    created_at: getBangladeshTimeString(),
  },
];

const SEED_STUDY_DAYS: StudyDay[] = [
  {
    id: 'day-seed-1',
    student_id: '1001',
    day_label: 'DAY-1',
    day_date: getBangladeshDateString(),
    created_at: getBangladeshTimeString(),
  },
];

const SEED_LESSONS: Lesson[] = [
  {
    id: 'lesson-seed-1',
    study_day_id: 'day-seed-1',
    subject: 'Biology',
    short_note: 'Cell division (Mitosis & Meiosis) and chromosomal structures.',
    pdf_url: '',
    test_enabled: true,
    created_at: getBangladeshTimeString(),
  },
];

const SEED_QUESTIONS: Question[] = [
  {
    id: 'q-seed-1',
    lesson_id: 'lesson-seed-1',
    question: 'During which phase of mitosis do chromosomes align at the equatorial plate?',
    option_a: 'Prophase',
    option_b: 'Metaphase',
    option_c: 'Anaphase',
    option_d: 'Telophase',
    answer: 'B',
    explanation: 'Chromosomes align along the metaphase plate during metaphase.',
    created_at: getBangladeshTimeString(),
  },
  {
    id: 'q-seed-2',
    lesson_id: 'lesson-seed-1',
    question: 'How many daughter cells are produced at the end of Meiosis?',
    option_a: '2 diploid cells',
    option_b: '4 diploid cells',
    option_c: '4 haploid cells',
    option_d: '2 haploid cells',
    answer: 'C',
    explanation: 'Meiosis results in 4 genetically unique haploid daughter cells.',
    created_at: getBangladeshTimeString(),
  },
];

const tableCache: Record<string, any[]> = {
  students: SEED_STUDENTS,
  study_days: SEED_STUDY_DAYS,
  lessons: SEED_LESSONS,
  questions: SEED_QUESTIONS,
  quiz_results: [],
};

const lastFetchedAt: Record<string, number> = {};
const CACHE_TTL_MS = 60 * 1000; // 1 minute fresh cache

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

// Initial sync from local cache for instant initial rendering
try {
  ['students', 'study_days', 'lessons', 'questions', 'quiz_results'].forEach((table) => {
    const raw = localStorage.getItem(`studywise_${table}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        tableCache[table] = deduplicateList(parsed);
      }
    }
  });
} catch {
  // ignore
}

function persistCache(table: string) {
  try {
    const cleaned = deduplicateList(tableCache[table] || []);
    tableCache[table] = cleaned;
    localStorage.setItem(`studywise_${table}`, JSON.stringify(cleaned));
  } catch {
    // ignore
  }
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
    // 1. If select: check memory cache first so tab switching is instantaneous
    if (this.action === 'select') {
      const now = Date.now();
      const last = lastFetchedAt[this.tableName] || 0;
      const isExpired = now - last > CACHE_TTL_MS;
      const hasCached = (tableCache[this.tableName]?.length || 0) > 0;

      if (!hasCached) {
        // Initial fetch when cache has no records yet
        try {
          const sheetRows = await fetchRowsFromSheet(this.tableName);
          if (sheetRows && sheetRows.length > 0) {
            tableCache[this.tableName] = deduplicateList(sheetRows);
            persistCache(this.tableName);
          }
          lastFetchedAt[this.tableName] = Date.now();
        } catch (e) {
          console.warn(`Could not fetch ${this.tableName} from Google Sheets:`, e);
        }
      } else if (isExpired) {
        // Cache exists: return instantly and refresh in the background without blocking the UI
        lastFetchedAt[this.tableName] = Date.now();
        fetchRowsFromSheet(this.tableName)
          .then((sheetRows) => {
            if (sheetRows && sheetRows.length > 0) {
              tableCache[this.tableName] = deduplicateList(sheetRows);
              persistCache(this.tableName);
            }
          })
          .catch((e) => {
            console.warn(`Background fetch error for ${this.tableName}:`, e);
          });
      }
    }

    const table = tableCache[this.tableName] || [];

    const matchesFilters = (item: any) => {
      return this.filters.every((f) => String(item[f.column]) === String(f.value));
    };

    // 2. INSERT: Add to cache and write directly to Google Sheet
    if (this.action === 'insert') {
      const itemsToInsert = Array.isArray(this.actionData) ? this.actionData : [this.actionData];
      const insertedList: any[] = [];

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

        const existingIdx = table.findIndex((r: any) => String(r.id).trim() === String(newItem.id));
        if (existingIdx >= 0) {
          table[existingIdx] = { ...table[existingIdx], ...newItem };
        } else {
          table.push(newItem);
        }
        insertedList.push(newItem);

        // DIRECT WRITE TO GOOGLE SHEET
        insertRowToSheet(this.tableName, newItem).catch((err) => {
          console.warn(`Google Sheet insert failed for ${this.tableName}:`, err);
        });
      }

      tableCache[this.tableName] = table;
      persistCache(this.tableName);
      const res = Array.isArray(this.actionData) ? insertedList : insertedList[0];
      return { data: res, error: null };
    }

    // 3. UPDATE: Update in cache and write directly to Google Sheet
    if (this.action === 'update') {
      const updatedList: any[] = [];
      for (let i = 0; i < table.length; i++) {
        if (matchesFilters(table[i])) {
          table[i] = { ...table[i], ...this.actionData };
          updatedList.push(table[i]);

          // DIRECT UPDATE IN GOOGLE SHEET
          if (table[i].id) {
            updateRowInSheet(this.tableName, table[i].id, this.actionData).catch((err) => {
              console.warn(`Google Sheet update failed for ${this.tableName}:`, err);
            });
          }
        }
      }

      tableCache[this.tableName] = table;
      persistCache(this.tableName);
      const res = this.isSingle ? (updatedList[0] || null) : updatedList;
      return { data: res, error: null };
    }

    // 4. DELETE: Remove from cache and delete from Google Sheet
    if (this.action === 'delete') {
      const itemsToDelete = table.filter(matchesFilters);
      const remaining = table.filter((item) => !matchesFilters(item));

      for (const item of itemsToDelete) {
        if (item.id) {
          // DIRECT DELETE IN GOOGLE SHEET
          deleteRowFromSheet(this.tableName, item.id).catch((err) => {
            console.warn(`Google Sheet delete failed for ${this.tableName}:`, err);
          });
        }
      }

      tableCache[this.tableName] = remaining;
      persistCache(this.tableName);
      return { data: null, error: null };
    }

    // 5. UPSERT: Update if exists, insert if new
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
          if (table[existingIdx].id) {
            updateRowInSheet(this.tableName, table[existingIdx].id, item).catch(() => {});
          }
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
          table.push(newItem);
          resultList.push(newItem);
          insertRowToSheet(this.tableName, newItem).catch(() => {});
        }
      }

      tableCache[this.tableName] = table;
      persistCache(this.tableName);
      const res = this.isSingle
        ? (resultList[0] || null)
        : Array.isArray(this.actionData)
        ? resultList
        : resultList[0];
      return { data: res, error: null };
    }

    // Default: SELECT filtered
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
    return this.executeAsync().then(onfulfilled, onrejected);
  }
}

export const supabase = {
  from: (tableName: string) => new SheetQueryBuilder(tableName),
};
