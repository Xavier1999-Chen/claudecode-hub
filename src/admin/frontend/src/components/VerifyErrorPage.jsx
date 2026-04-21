// Shown when Supabase 302s back to /auth/confirm with ?error_code=...
// Most common cause: an email-link prefetcher consumed the one-time token
// before the user clicked. See GitHub #6.
export default function VerifyErrorPage() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-state-icon">⚠️</div>
        <div className="auth-state-title">验证链接已失效</div>
        <div className="auth-state-desc">
          请回到登录页,使用注册邮箱登录,然后点击「重发邮件」获取新的验证链接。
        </div>
        <button
          className="btn btn-primary"
          style={{ width: '100%', marginTop: 16 }}
          onClick={() => { window.location.href = '/' }}
        >
          回到登录
        </button>
      </div>
    </div>
  )
}
