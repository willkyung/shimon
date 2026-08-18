import { useState } from 'react';
import Icon from '../components/Icon';
import { DEMO_ADMIN } from '../data/adminData';
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
        <h1>현장의 쉼을<br />안전 데이터로 연결합니다.</h1>
        <p>
          노동자의 작업·휴식 상태와 체감온도 데이터를 한 화면에서 확인하고,
          위험도가 높아지기 전에 선제적으로 휴식을 안내하세요.
        </p>
      </div>

      <div className="auth-ekg" aria-hidden="true">
        <svg viewBox="0 0 760 150" preserveAspectRatio="none">
          <path className="auth-ekg-grid" d="M0 78H760" />
          <path
            className="auth-ekg-line"
            d="M0 78 H120 L145 78 L162 54 L184 106 L207 25 L228 91 L246 67 L270 78 H365 L388 78 L404 58 L420 96 L442 41 L463 87 L482 70 L500 78 H760"
          />
        </svg>
      </div>

      <div className="auth-brand-bottom">
        <div><span>WORKER STATUS</span><strong>작업 · 휴식 · 휴식필요</strong></div>
        <div><span>HEAT INDEX</span><strong>실시간 체감온도 모니터링</strong></div>
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
          SHIMON 관리자 계정은 회사에 등록된 사원코드 확인 후 생성할 수 있습니다.
        </p>

        <div className="auth-choice-grid">
          <button className="auth-choice primary" type="button" onClick={() => setAuthView('login')}>
            <span className="auth-choice-icon"><Icon name="user" /></span>
            <span><strong>로그인</strong><small>등록된 관리자 계정으로 접속</small></span>
            <Icon name="chevron" className="auth-choice-arrow" />
          </button>

          <button className="auth-choice" type="button" onClick={() => setAuthView('signup-code')}>
            <span className="auth-choice-icon"><Icon name="shield" /></span>
            <span><strong>관리자 회원가입</strong><small>사원코드 인증 후 계정 생성</small></span>
            <Icon name="chevron" className="auth-choice-arrow" />
          </button>
        </div>

        <div className="auth-security-note">
          <Icon name="shield" />
          <p>회사 관리자 권한은 등록된 관리자 사원코드로만 생성됩니다.</p>
        </div>
      </div>
    </section>
  );
}

function LoginView() {
  const { login, setAuthView } = useAdmin();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  const submit = (event) => {
    event.preventDefault();
    login({ identifier: identifier.trim(), password });
  };

  return (
    <section className="auth-view active">
      <div className="auth-form-inner">
        <button className="auth-back" type="button" onClick={() => setAuthView('welcome')}><span>←</span> 처음으로</button>
        <p className="auth-kicker">WELCOME BACK</p>
        <h2>관리자 로그인</h2>
        <p className="auth-description">사원코드 또는 이메일과 비밀번호를 입력해주세요.</p>

        <form className="admin-auth-form" onSubmit={submit}>
          <label>
            <span>사원코드 또는 이메일</span>
            <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} type="text" placeholder="HB-A001 또는 admin@shimon.com" autoComplete="username" required />
          </label>
          <label>
            <span>비밀번호</span>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="비밀번호 입력" autoComplete="current-password" required />
          </label>
          <button className="auth-submit" type="submit">관리자 대시보드 접속</button>
        </form>

        <div className="auth-demo">
          <div><strong>프로토타입 관리자 계정</strong><span>HB-A001 / 1234</span></div>
          <button type="button" onClick={() => { setIdentifier(DEMO_ADMIN.employeeCode); setPassword(DEMO_ADMIN.password); }}>자동 입력</button>
        </div>

        <p className="auth-switch">
          아직 관리자 계정이 없으신가요?{' '}
          <button type="button" onClick={() => setAuthView('signup-code')}>회원가입</button>
        </p>
      </div>
    </section>
  );
}

function SignupCodeView({ onVerified }) {
  const { setAuthView, verifyAdminEmployee } = useAdmin();
  const [employeeCode, setEmployeeCode] = useState('');
  const [name, setName] = useState('');

  const submit = (event) => {
    event.preventDefault();
    const employee = verifyAdminEmployee({ employeeCode, name });
    if (employee) onVerified(employee);
  };

  return (
    <section className="auth-view active">
      <div className="auth-form-inner">
        <button className="auth-back" type="button" onClick={() => setAuthView('welcome')}><span>←</span> 처음으로</button>

        <div className="signup-step-line">
          <span className="active">01</span><i /><span>02</span>
        </div>

        <p className="auth-kicker">EMPLOYEE VERIFICATION</p>
        <h2>관리자 사원 확인</h2>
        <p className="auth-description">회사에 등록된 관리자 사원코드와 이름을 입력해주세요.</p>

        <form className="admin-auth-form" onSubmit={submit}>
          <label><span>사원코드</span><input value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} type="text" placeholder="예: HB-A001" required /></label>
          <label><span>이름</span><input value={name} onChange={(e) => setName(e.target.value)} type="text" placeholder="등록된 이름" required /></label>
          <button className="auth-submit" type="submit">사원 확인</button>
        </form>

        <div className="auth-demo subtle">
          <div><strong>프로토타입 사원코드</strong><span>HB-A001 / 관리자</span></div>
          <button type="button" onClick={() => { setEmployeeCode('HB-A001'); setName('관리자'); }}>자동 입력</button>
        </div>

        <p className="auth-switch">
          이미 계정이 있으신가요?{' '}
          <button type="button" onClick={() => setAuthView('login')}>로그인</button>
        </p>
      </div>
    </section>
  );
}

function SignupProfileView({ verifiedAdmin, onBack }) {
  const { signup } = useAdmin();
  const [form, setForm] = useState({
    name: verifiedAdmin.name,
    company: verifiedAdmin.company,
    email: '',
    phone: '',
    password: '',
    passwordConfirm: '',
  });

  const setValue = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = (event) => {
    event.preventDefault();

    if (form.password !== form.passwordConfirm) return;

    signup({
      employeeCode: verifiedAdmin.employeeCode,
      role: 'admin',
      name: form.name.trim() || verifiedAdmin.name,
      company: form.company.trim() || verifiedAdmin.company,
      email: form.email.trim(),
      phone: form.phone.trim(),
      password: form.password,
    });
  };

  return (
    <section className="auth-view active">
      <div className="auth-form-inner wide">
        <button className="auth-back" type="button" onClick={onBack}><span>←</span> 사원 확인</button>

        <div className="signup-step-line">
          <span className="done">01</span><i className="done" /><span className="active">02</span>
        </div>

        <p className="auth-kicker">ADMIN PROFILE</p>
        <h2>관리자 정보 입력</h2>
        <p className="auth-description">대시보드와 위험 알림 수신에 사용할 정보를 입력해주세요.</p>

        <form className="admin-auth-form profile-form" onSubmit={submit}>
          <label><span>이름</span><input value={form.name} onChange={(e) => setValue('name', e.target.value)} type="text" required /></label>
          <label><span>회사명</span><input value={form.company} onChange={(e) => setValue('company', e.target.value)} type="text" required /></label>
          <label><span>이메일</span><input value={form.email} onChange={(e) => setValue('email', e.target.value)} type="email" placeholder="admin@company.com" required /></label>
          <label><span>전화번호</span><input value={form.phone} onChange={(e) => setValue('phone', e.target.value)} type="tel" placeholder="010-0000-0000" required /></label>
          <label><span>비밀번호</span><input value={form.password} onChange={(e) => setValue('password', e.target.value)} type="password" minLength="4" required /></label>
          <label><span>비밀번호 확인</span><input value={form.passwordConfirm} onChange={(e) => setValue('passwordConfirm', e.target.value)} type="password" minLength="4" required /></label>
          <button className="auth-submit full" type="submit">관리자 계정 생성</button>
        </form>

        <div className="verified-admin">
          <Icon name="check" />
          <div><strong>{verifiedAdmin.company} 관리자 권한 확인됨</strong><span>{verifiedAdmin.employeeCode}</span></div>
        </div>
      </div>
    </section>
  );
}

export default function AuthPage() {
  const { authView, setAuthView, showToast } = useAdmin();
  const [verifiedAdmin, setVerifiedAdmin] = useState(null);

  const handleVerified = (employee) => {
    setVerifiedAdmin(employee);
    setAuthView('signup-profile');
  };

  const profileBack = () => {
    setVerifiedAdmin(null);
    setAuthView('signup-code');
  };

  return (
    <section className="auth-shell">
      <BrandPanel />

      <div className="auth-form-panel">
        {authView === 'welcome' && <WelcomeView />}
        {authView === 'login' && <LoginView />}
        {authView === 'signup-code' && <SignupCodeView onVerified={handleVerified} />}
        {authView === 'signup-profile' && verifiedAdmin && (
          <SignupProfileView verifiedAdmin={verifiedAdmin} onBack={profileBack} />
        )}
        {authView === 'signup-profile' && !verifiedAdmin && (
          <section className="auth-view active">
            <div className="auth-form-inner">
              <p className="auth-description">관리자 사원 확인이 필요합니다.</p>
              <button className="auth-submit" type="button" onClick={() => { showToast('먼저 관리자 사원 확인을 완료해주세요.'); setAuthView('signup-code'); }}>사원 확인으로 이동</button>
            </div>
          </section>
        )}
      </div>
    </section>
  );
}
