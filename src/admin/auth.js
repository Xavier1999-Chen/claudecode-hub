import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('[auth] SUPABASE_URL or SUPABASE_ANON_KEY is missing — all /api/* requests will be rejected');
}

const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  : null;

function extractToken(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/.exec(header);
  return m ? m[1] : null;
}

/**
 * Verify the Supabase JWT on every /api/* request.
 * On success: req.user = { id, email, role }
 * On failure: 401
 *
 * Security: Always read role from app_metadata (controlled by service_role / admin),
 * NEVER from user_metadata (user-editable).
 */
export async function requireAuth(req, res, next) {
  if (!supabase) return res.status(503).json({ error: 'auth_not_configured' });

  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'missing_token' });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return res.status(401).json({ error: 'invalid_token' });

  const role = data.user.app_metadata?.role ?? null;
  req.user = {
    id: data.user.id,
    email: data.user.email,
    role,
  };
  next();
}

/**
 * Require that the authenticated user has role === 'user' or 'admin'.
 * Users with no role (just registered but not approved) are rejected.
 */
export function requireApproved(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });
  if (req.user.role !== 'admin' && req.user.role !== 'user') {
    return res.status(403).json({ error: 'pending_approval' });
  }
  next();
}

/**
 * Require that the authenticated user has role === 'admin'.
 */
export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'admin_required' });
  next();
}
