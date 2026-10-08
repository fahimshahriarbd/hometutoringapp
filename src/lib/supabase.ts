import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const ADMIN_USERNAME = 'admin';
export const ADMIN_PIN = '5678';

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
