-- User approval workflow — Supabase-native.
--
-- Flow:
--   1. User signs up via Supabase Auth → trigger creates a pending row in user_requests
--      and writes status='pending' into auth.users.raw_app_meta_data.
--   2. Admin opens Supabase Studio → Table Editor → user_requests → changes status
--      to 'approved' (and optionally adjusts role).
--   3. Trigger syncs role + status into auth.users.raw_app_meta_data so the user's
--      next JWT carries the claims.
--   4. claudecode-hub backend reads role/status from the JWT (no service_role needed).
--
-- This migration is idempotent: safe to run on a fresh database OR on one that
-- already has earlier versions applied.

-- ╭──────────────────────────────────────────────────────────────────────╮
-- │ 1. ENUM types                                                         │
-- ╰──────────────────────────────────────────────────────────────────────╯

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_request_status') THEN
    CREATE TYPE public.user_request_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE public.user_role AS ENUM ('user', 'admin');
  END IF;
END$$;

-- ╭──────────────────────────────────────────────────────────────────────╮
-- │ 2. user_requests table (approval queue)                              │
-- ╰──────────────────────────────────────────────────────────────────────╯

CREATE TABLE IF NOT EXISTS public.user_requests (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        text NOT NULL,
  status       public.user_request_status NOT NULL DEFAULT 'pending',
  role         public.user_role NOT NULL DEFAULT 'user',
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at  timestamptz,
  note         text
);

COMMENT ON TABLE public.user_requests IS
  'User approval queue. Admin edits status/role in Supabase Studio Table Editor; triggers sync into auth.users.raw_app_meta_data.';

-- Drop any legacy CHECK constraints that might linger from earlier migrations
ALTER TABLE public.user_requests DROP CONSTRAINT IF EXISTS user_requests_status_check;
ALTER TABLE public.user_requests DROP CONSTRAINT IF EXISTS user_requests_role_check;

-- Ensure columns are the expected types (no-op when already correct)
DO $$
BEGIN
  -- status
  IF (SELECT atttypid FROM pg_attribute
      WHERE attrelid = 'public.user_requests'::regclass AND attname = 'status')
     <> 'public.user_request_status'::regtype
  THEN
    EXECUTE 'DROP TRIGGER IF EXISTS on_user_request_status_change ON public.user_requests';
    EXECUTE 'ALTER TABLE public.user_requests ALTER COLUMN status DROP DEFAULT';
    EXECUTE 'ALTER TABLE public.user_requests ALTER COLUMN status TYPE public.user_request_status USING status::public.user_request_status';
    EXECUTE 'ALTER TABLE public.user_requests ALTER COLUMN status SET DEFAULT ''pending''::public.user_request_status';
  END IF;
  -- role
  IF (SELECT atttypid FROM pg_attribute
      WHERE attrelid = 'public.user_requests'::regclass AND attname = 'role')
     <> 'public.user_role'::regtype
  THEN
    EXECUTE 'DROP TRIGGER IF EXISTS on_user_request_status_change ON public.user_requests';
    EXECUTE 'UPDATE public.user_requests SET role = ''user'' WHERE role IS NULL';
    EXECUTE 'ALTER TABLE public.user_requests ALTER COLUMN role TYPE public.user_role USING COALESCE(role, ''user'')::public.user_role';
    EXECUTE 'ALTER TABLE public.user_requests ALTER COLUMN role SET DEFAULT ''user''::public.user_role';
    EXECUTE 'ALTER TABLE public.user_requests ALTER COLUMN role SET NOT NULL';
  END IF;
END$$;

-- ╭──────────────────────────────────────────────────────────────────────╮
-- │ 3. RLS — block Data API access; only service_role (Studio) reads     │
-- ╰──────────────────────────────────────────────────────────────────────╯

ALTER TABLE public.user_requests ENABLE ROW LEVEL SECURITY;
-- No policies → no access for anon / authenticated.

-- ╭──────────────────────────────────────────────────────────────────────╮
-- │ 4. Trigger functions                                                  │
-- ╰──────────────────────────────────────────────────────────────────────╯

-- (a) On new signup: create pending request row + seed app_metadata.status
CREATE OR REPLACE FUNCTION public.handle_new_user_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_requests (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;

  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
                       || jsonb_build_object('status', 'pending')
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- (b) On status/role change: sync to auth.users.raw_app_meta_data
CREATE OR REPLACE FUNCTION public.handle_user_request_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' THEN
    UPDATE auth.users
    SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
                         || jsonb_build_object(
                              'role', NEW.role::text,
                              'status', 'approved'
                            )
    WHERE id = NEW.id;
    NEW.approved_at := COALESCE(NEW.approved_at, now());
  ELSE
    -- pending / rejected: strip role, surface the current status to the frontend
    UPDATE auth.users
    SET raw_app_meta_data = (COALESCE(raw_app_meta_data, '{}'::jsonb) - 'role')
                         || jsonb_build_object('status', NEW.status::text)
    WHERE id = NEW.id;
    NEW.approved_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- ╭──────────────────────────────────────────────────────────────────────╮
-- │ 5. Triggers                                                           │
-- ╰──────────────────────────────────────────────────────────────────────╯

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_request();

DROP TRIGGER IF EXISTS on_user_request_status_change ON public.user_requests;
CREATE TRIGGER on_user_request_status_change
  BEFORE UPDATE OF status, role ON public.user_requests
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION public.handle_user_request_status();

-- ╭──────────────────────────────────────────────────────────────────────╮
-- │ 6. Backfill — reconcile existing users with current schema           │
-- ╰──────────────────────────────────────────────────────────────────────╯

-- Create a user_requests row for any auth.users without one
INSERT INTO public.user_requests (id, email, status, role, requested_at)
SELECT
  u.id,
  u.email,
  CASE
    WHEN u.raw_app_meta_data ? 'role' THEN 'approved'::public.user_request_status
    ELSE 'pending'::public.user_request_status
  END,
  COALESCE(u.raw_app_meta_data->>'role', 'user')::public.user_role,
  COALESCE(u.created_at, now())
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- Ensure every auth.users has a status claim in raw_app_meta_data
UPDATE auth.users u
SET raw_app_meta_data = COALESCE(u.raw_app_meta_data, '{}'::jsonb)
                     || jsonb_build_object('status', ur.status::text)
FROM public.user_requests ur
WHERE u.id = ur.id
  AND (u.raw_app_meta_data->>'status' IS DISTINCT FROM ur.status::text);
