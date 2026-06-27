// Movie data access for the bot, backed by Supabase (Postgres).
//
// Exports the same function names the handlers already use, so swapping from
// SQLite to Supabase is invisible to handlers/*.js. All queries run via the
// service_role key (see supabase.js), which bypasses RLS.
const { supabase } = require('./supabase');
const { config } = require('./config');

const TABLE = 'movies';

/** Newest first, paginated. page is 1-based. */
async function getNewMovies(page = 1, pageSize = config.pageSize) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return data || [];
}

/** Most downloaded first, paginated. */
async function getPopularMovies(page = 1, pageSize = config.pageSize) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('downloads', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to);
  if (error) throw error;
  return data || [];
}

async function countMovies() {
  const { count, error } = await supabase
    .from(TABLE)
    .select('*', { count: 'exact', head: true });
  if (error) throw error;
  return count || 0;
}

async function getMovieById(id) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data; // null if not found
}

/** Substring match on title or code (case-insensitive). */
async function searchMovies(query) {
  const q = (query || '').trim();
  if (!q) return [];
  // PostgREST .or() with ilike. The value (including the % wildcards) is embedded
  // in the filter string; the client handles URL encoding.
  const pattern = `%${q}%`;
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .or(`title.ilike.${pattern},code.ilike.${pattern}`)
    .order('created_at', { ascending: false })
    .limit(25);
  if (error) throw error;
  return data || [];
}

/** Increment download counter after a successful delivery (atomic via RPC). */
async function incrementDownloads(id) {
  const { error } = await supabase.rpc('increment_downloads', { movie_id: id });
  if (error) throw error;
}

// ---------- Admin / stats helpers (used by handlers/admin.js) ----------

async function getStats() {
  const total = await countMovies();
  // Supabase REST API has no SUM aggregate, so pull the small column and sum client-side.
  const { data: rows, error: sumErr } = await supabase.from(TABLE).select('downloads');
  const downloads = sumErr ? 0 : (rows || []).reduce((s, r) => s + (r.downloads || 0), 0);

  const { count: featured, error: featErr } = await supabase
    .from(TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('featured', true);

  const { data: top, error: topErr } = await supabase
    .from(TABLE)
    .select('code, title, downloads')
    .order('downloads', { ascending: false })
    .limit(5);

  return {
    total,
    downloads,
    featured: featErr ? 0 : featured || 0,
    top: topErr ? [] : top || [],
  };
}

// Used by handlers/admin.js (/delete). Returns { count } of deleted rows.
async function deleteByCode(code) {
  const { data, error } = await supabase.from(TABLE).delete().eq('code', code).select('id');
  if (error) throw error;
  return { count: (data || []).length };
}

module.exports = {
  getNewMovies,
  getPopularMovies,
  countMovies,
  getMovieById,
  searchMovies,
  incrementDownloads,
  getStats,
  deleteByCode,
};
