// Maps a URL's query string to the auth-redirect mode the SPA should render.
// Pure / framework-free so it can be unit-tested under node:test.
//
// Background: see GitHub #6. The Supabase email-confirmation link is a
// one-time GET, which QQ Mail / WeChat-style scanners consume before the
// user clicks. The fix routes the email through an on-domain confirm page
// (`/auth/confirm?token_hash=...&type=...`) where verifyOtp is only called
// on a real user click. This helper is what App.jsx uses to decide between
// the normal flow, the confirm page, and an error page.

export function classifyAuthRedirect(searchParams) {
  const errorCode = searchParams.get('error_code');
  if (errorCode) {
    return {
      mode: 'verify-error',
      errorCode,
      errorDescription: searchParams.get('error_description') ?? '',
    };
  }
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  if (tokenHash && type) {
    return { mode: 'confirm-email', tokenHash, type };
  }
  return { mode: 'normal' };
}