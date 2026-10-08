# StudyWise — GitHub + Vercel

A React + TypeScript + Vite web app. Supabase is used as the database.

## 1. Before uploading
- Do **not** upload `.env`. It is excluded by `.gitignore`.
- `.env.example` is only a template; it does not contain your real credentials.
- Keep the Supabase project that already stores your data. Deploying the frontend does not copy or migrate the database.

## 2. Upload to GitHub
1. Create a new repository on GitHub.
2. Upload/extract the contents of this folder into the repository root (so `package.json` is at the top level).
3. Commit the files.

## 3. Deploy on Vercel
1. Sign in to Vercel and choose **Add New → Project**.
2. Import the GitHub repository.
3. Framework preset: **Vite** (usually detected automatically).
4. Build command: `npm run build`
5. Output directory: `dist`
6. In **Environment Variables**, add:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon/public key
7. Add them for Production (and Preview if needed), then Deploy.

You can find the Supabase URL and anon/public key in your Supabase project's API settings. Never put a `service_role` key in a frontend app or Vercel's `VITE_` variables.

## 4. Local testing (optional)
1. Install Node.js LTS.
2. Copy `.env.example` to `.env`.
3. Fill in the two Supabase values.
4. Run:
   ```bash
   npm install
   npm run dev
   ```
5. Test a production build:
   ```bash
   npm run build
   ```

## 5. Database
The SQL migration is in `supabase/migrations/`. Do not run it on an existing database without checking first; it creates tables and policies. If your current Bolt project already has these tables, keep using that same Supabase project.

## Important security warning before sharing with students
The current project includes a hard-coded admin login in frontend code, and the SQL migration grants broad read/write/delete access to anonymous users through permissive RLS policies. This means someone could potentially read, change, or delete student data. The demo student PIN is also stored in plain text. **Do not use this setup for real student data until authentication and Supabase Row Level Security policies are properly secured.** Changing the admin PIN in frontend code is not sufficient security because frontend code is public.

## Android APK
This folder is prepared for GitHub/Vercel web deployment. An APK is a separate next step (for example, using Capacitor); test and secure the web app first.
