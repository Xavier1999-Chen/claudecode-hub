// Shown when Supabase 302s back to /auth/confirm with ?error_code=...
// Most common cause: an email-link prefetcher consumed the one-time token
// before the user clicked. See GitHub #6.
export default function VerifyErrorPage({ errorCode, errorDescription }) {
  const friendly = errorCode === 'otp_expired'
    ? '验证链接已失效。可能是邮件安全扫描器抢先访问了链接,或链接已过期。'
    : (errorDescription || '邮箱验证失败,请重新发起注册或登录。')

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-state-icon">⚠️</div>
        <div className="auth-state-title">验证链接无效</div>
        <div className="auth-state-desc">{friendly}</div>
        <button
          className="btn btn-primary"
          style={{ width: '100%', marginTop: 16 }}
          onClick={() => { window.location.href = '/' }}
        >
          返回登录页
        </button>
      </div>
    </div>
  )
}
