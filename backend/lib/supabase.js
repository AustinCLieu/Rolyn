import { createClient } from '@supabase/supabase-js'; // pulls createClient function from supabase npm module
import 'dotenv/config'

export const supabase = createClient( // returns a client object, createClient(url, key)
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);