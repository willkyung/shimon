import { useState } from 'react';
import Icon from '../components/Icon';
import { useAdmin } from '../context/AdminContext';

function BrandPanel() {
  return (
    <div className="auth-brand-panel">
      <div className="auth-brand-top">
        <img src="/shimon-logo.png" alt="SHIMON 로고" />
        <div className="auth-wordmark">
          <strong>SHIMON</strong>
          <span>ADMIN SAFETY CONSOLE</span>
        </div>
      </div>

      <div className="auth-brand-copy">
        <p className="brand-eyebrow">SMART HEAT SAFETY</p>
        <h1>현장의 오늘을<br />안전 데이터로 연결합니다</h1>
        <p>
          작업자의 작업·휴식 상태와 현장 안전 정보를 한 화면에서 확인하고,
          필요한 안전 조치를 빠르게 전달하세요.
        </p>
      </div>

      <div className="auth-ekg" aria-hidden="true">
        <svg viewBox="0 0 760 150" preserveAspectRatio="none">
          <path className="auth-ekg-grid" d="M0 78H760" />
          <path className="auth-ekg-line" d="M0 78 H120 L145 78 L162 54 L184 106 L207 25 L228 91 L246 67 L270 78 H365 L388 78 L404 58 L420 96 L442 41 L463 87 L482 70 L500 78 H760" />
        </svg>
      </div>

      <div className="auth-brand-bottom">
        <div><span>WORKER STATUS</span><strong>작업 · 휴식 · 휴식 필요</strong></div>
        <div><span>ACCESS CONTROL</span><strong>관리자 권한 전용 콘솔</strong></div>
      </div>
    </div>
  );
}

function WelcomeView() {
  const { setAuthView } = useAdmin();
  return (
    <section className="auth-view active">
      <div className="auth-form-inner">
        <p className="auth-kicker">ADMIN ACCESS</p>
        <h2>관리자 계정으로 시작하세요</h2>
        <p className="auth-description">
          관리자 계정은 공개 회원가입으로 생성할 수 없습니다. 운영자가 사전에 발급한 계정으로 로그인해주세요.
        </p>

        <div className="auth-choice-grid">
          <button className="auth-choice primary" type="button" onClick={() => setAuthView('login')}>
            <span className="auth-choice-icon"><Icon name="user" /></span>
            <span><strong>관리자 로그인</strong><small>등록된 이메일로 접속</small></span>
            <Icon name="chevron" className="auth-choice-arrow" />
          </button>
        </div>

        <div className="auth-security-note">
          <Icon name="shield" />
          <p>관리자 권한은 백엔드에 등록된 ADMIN 계정에만 부여됩니다.</p>
        </div>
      </div>
    </section>
  );
}

function LoginView() {
  const { login, setAuthView } = useAdmin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await login({
        email: email.trim().toLowerCase(),
        password,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="auth-view active">
      <div className="auth-form-inner">
        <button className="auth-back" type="button" onClick={() => setAuthView('welcome')}><span>←</span> 처음으로</button>
        <p className="auth-kicker">WELCOME BACK</p>
        <h2>관리자 로그인</h2>
        <p className="auth-description">관리자 이메일과 비밀번호를 입력해주세요.</p>

        <form className="admin-auth-form" onSubmit={submit}>
          <label><span>이메일</span><input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="admin@example.com" autoComplete="username" required /></label>
          <label><span>비밀번호</span><input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="비밀번호 입력" autoComplete="current-password" required /></label>
          <button className="auth-submit" type="submit" disabled={submitting}>{submitting ? '인증 중...' : '관리자 대시보드 접속'}</button>
        </form>

        <div className="auth-demo">
          <div><strong>관리자 계정이 없나요?</strong><span>백엔드 운영자에게 계정 발급을 요청해주세요.</span></div>
        </div>
      </div>
    </section>
  );
}

export default function AuthPage() {
  const { authView } = useAdmin();
  return (
    <section className="auth-shell">
      <BrandPanel />
      <div className="auth-form-panel">
        {authView === 'welcome' && <WelcomeView />}
        {authView === 'login' && <LoginView />}
      </div>
    </section>
  );
}
