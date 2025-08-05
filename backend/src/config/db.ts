import { createClient } from '@supabase/supabase-js';
import { Database } from '../../database.types.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// More detailed error logging to help debug environment issues on Render
if (!supabaseUrl || !supabaseKey) {
    console.error("--- SUPABASE CONNECTION FAILED ---");
    console.error(`SUPABASE_URL is: ${supabaseUrl ? 'SET' : 'MISSING'}`);
    console.error(`SUPABASE_KEY is: ${supabaseKey ? 'SET (hidden)' : 'MISSING'}`);
    console.error("Please double-check your environment variables in the Render dashboard.");
    console.error("------------------------------------");
    throw new Error('Supabase configuration is incomplete. Check server logs for details.');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);