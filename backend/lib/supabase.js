import { createClient } from '@supabase/supabase-js';

const url =
  process.env.SUPABASE_URL?.trim() || 'https://rwycvntrglluxcmhnnqy.supabase.co';
const key =
  process.env.SUPABASE_SERVICE_KEY?.trim() ||
  process.env.SUPABASE_ANON_KEY?.trim();

if (!key) {
  throw new Error(
    'Missing Supabase key. Copy backend/.env.example to backend/.env and set SUPABASE_SERVICE_KEY (preferred) or SUPABASE_ANON_KEY.',
  );
}

export const supabase = createClient(url, key);
