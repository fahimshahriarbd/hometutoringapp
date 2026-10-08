/*
# StudyWise — Full Database Schema

## Overview
Creates all tables needed for the StudyWise home tutor management app:
students, study_days, lessons, questions, and quiz_results.

## Tables

### 1. students
- id (text, primary key) — 4-digit student ID like "1001"
- name (text) — student full name
- class_name (text) — e.g. "HSC 2nd Year"
- subjects (text) — comma-separated subjects
- image_url (text) — optional photo URL
- pin (text) — 4-digit PIN for login
- created_at (timestamptz)

### 2. study_days
- id (uuid, primary key)
- student_id (text, FK -> students.id)
- day_label (text) — e.g. "DAY-1"
- day_date (date) — the study date
- created_at (timestamptz)

### 3. lessons
- id (uuid, primary key)
- study_day_id (uuid, FK -> study_days.id)
- subject (text) — e.g. "Biology"
- short_note (text) — topics covered
- pdf_url (text) — optional PDF link
- test_enabled (boolean, default true)
- created_at (timestamptz)

### 4. questions
- id (uuid, primary key)
- lesson_id (uuid, FK -> lessons.id)
- question (text) — question text
- option_a, option_b, option_c, option_d (text) — four choices
- answer (text) — "A", "B", "C", or "D"
- explanation (text) — optional explanation
- created_at (timestamptz)

### 5. quiz_results
- id (uuid, primary key)
- student_id (text) — which student took the quiz
- lesson_id (uuid, FK -> lessons.id)
- score (integer) — correct answers
- total (integer) — total questions
- percentage (integer) — score/total * 100
- review (jsonb) — detailed review data
- created_at (timestamptz)
- UNIQUE constraint on (student_id, lesson_id) — one attempt per student per lesson

## Admin
Admin login is hardcoded with username "admin" and PIN stored in the app.
No admin table is needed for this single-admin app.

## Security
- RLS enabled on all tables.
- All policies use TO anon, authenticated (no auth screen — the app uses custom PIN login).
- Full CRUD access for anon + authenticated since this is a single-tenant tutor app.
*/

-- 1. students
CREATE TABLE IF NOT EXISTS students (
  id text PRIMARY KEY,
  name text NOT NULL,
  class_name text NOT NULL DEFAULT 'Class',
  subjects text NOT NULL DEFAULT 'General',
  image_url text,
  pin text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "students_select" ON students;
CREATE POLICY "students_select" ON students FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "students_insert" ON students;
CREATE POLICY "students_insert" ON students FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "students_update" ON students;
CREATE POLICY "students_update" ON students FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "students_delete" ON students;
CREATE POLICY "students_delete" ON students FOR DELETE TO anon, authenticated USING (true);

-- 2. study_days
CREATE TABLE IF NOT EXISTS study_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  day_label text NOT NULL DEFAULT 'DAY-',
  day_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE study_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "study_days_select" ON study_days;
CREATE POLICY "study_days_select" ON study_days FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "study_days_insert" ON study_days;
CREATE POLICY "study_days_insert" ON study_days FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "study_days_update" ON study_days;
CREATE POLICY "study_days_update" ON study_days FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "study_days_delete" ON study_days;
CREATE POLICY "study_days_delete" ON study_days FOR DELETE TO anon, authenticated USING (true);

-- 3. lessons
CREATE TABLE IF NOT EXISTS lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  study_day_id uuid NOT NULL REFERENCES study_days(id) ON DELETE CASCADE,
  subject text NOT NULL,
  short_note text NOT NULL DEFAULT '',
  pdf_url text,
  test_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lessons_select" ON lessons;
CREATE POLICY "lessons_select" ON lessons FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "lessons_insert" ON lessons;
CREATE POLICY "lessons_insert" ON lessons FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "lessons_update" ON lessons;
CREATE POLICY "lessons_update" ON lessons FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "lessons_delete" ON lessons;
CREATE POLICY "lessons_delete" ON lessons FOR DELETE TO anon, authenticated USING (true);

-- 4. questions
CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  question text NOT NULL,
  option_a text NOT NULL,
  option_b text NOT NULL,
  option_c text NOT NULL,
  option_d text NOT NULL,
  answer text NOT NULL CHECK (answer IN ('A','B','C','D')),
  explanation text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "questions_select" ON questions;
CREATE POLICY "questions_select" ON questions FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "questions_insert" ON questions;
CREATE POLICY "questions_insert" ON questions FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "questions_update" ON questions;
CREATE POLICY "questions_update" ON questions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "questions_delete" ON questions;
CREATE POLICY "questions_delete" ON questions FOR DELETE TO anon, authenticated USING (true);

-- 5. quiz_results
CREATE TABLE IF NOT EXISTS quiz_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL,
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  percentage integer NOT NULL DEFAULT 0,
  review jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(student_id, lesson_id)
);

ALTER TABLE quiz_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quiz_results_select" ON quiz_results;
CREATE POLICY "quiz_results_select" ON quiz_results FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "quiz_results_insert" ON quiz_results;
CREATE POLICY "quiz_results_insert" ON quiz_results FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "quiz_results_update" ON quiz_results;
CREATE POLICY "quiz_results_update" ON quiz_results FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "quiz_results_delete" ON quiz_results;
CREATE POLICY "quiz_results_delete" ON quiz_results FOR DELETE TO anon, authenticated USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_study_days_student_id ON study_days(student_id);
CREATE INDEX IF NOT EXISTS idx_lessons_study_day_id ON lessons(study_day_id);
CREATE INDEX IF NOT EXISTS idx_questions_lesson_id ON questions(lesson_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_student_id ON quiz_results(student_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_lesson_id ON quiz_results(lesson_id);

-- Seed default admin info and a demo student so login works immediately
INSERT INTO students (id, name, class_name, subjects, image_url, pin)
VALUES ('1001', 'Student 01', 'HSC 2nd Year', 'Biology, Chemistry', '', '1234')
ON CONFLICT (id) DO NOTHING;