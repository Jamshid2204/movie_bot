// Supabase client for the bot. Uses the service_role key, which bypasses Row-Level
// Security entirely — so the bot can read/write movies without going through Auth.
// NEVER ship this key to a browser. It lives only in the bot's environment.
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error(
    '[supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Fill in bot/.env (see SUPABASE_SETUP.md).'
  );
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

module.exports = { supabase };
