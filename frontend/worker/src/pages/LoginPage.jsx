import { useState } from 'react';
import { useWorker } from '../context/WorkerContext';
import { apiFieldErrors, validateLoginForm } from '../utils/authValidation';

export default function LoginPage({ active }) {
  const { navigate, login } = useWorker();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationErrors = validateLoginForm({ email, password });
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const result = await login({
        email: email.trim().toLowerCase(),
        password,
        remember,
      });
      if (!result.ok) {
        const fieldErrors = apiFieldErrors(result.error);
        setErrors(Object.keys(fieldErrors).length ? fieldErrors : { password: '이메일 또는 비밀번호를 확인해주세요.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="screen-login" className={`screen auth-screen ${active ? 'active' : ''}`}>
      <div className="auth-card">
        <div className="auth-topbar">
          <button className="back-button auth-back" type="button" onClick={() => navigate('welcome')} aria-label="뒤로 가기">←</button>
        </div>

        <div className="auth-content">
          <div className="section-heading">
            <p className="eyebrow">WELCOME BACK</p>
            <h1>로그인</h1>
            <p>이메일과 비밀번호를 입력해주세요.</p>
          </div>

          <form className="form-stack" onSubmit={handleSubmit}>
            <label className={`field ${errors.email ? 'has-error' : ''}`}>
              <span>이메일</span>
              <input value={email} onChange={(event) => { setEmail(event.target.value); setErrors((current) => ({ ...current, email: undefined })); }} type="email" placeholder="name@example.com" autoComplete="username" aria-invalid={Boolean(errors.email)} required />
              {errors.email && <small className="auth-field-error">{errors.email}</small>}
            </label>

            <label className={`field ${errors.password ? 'has-error' : ''}`}>
              <span>비밀번호</span>
              <input value={password} onChange={(event) => { setPassword(event.target.value); setErrors((current) => ({ ...current, password: undefined })); }} type="password" placeholder="비밀번호 입력" autoComplete="current-password" aria-invalid={Boolean(errors.password)} required />
              {errors.password && <small className="auth-field-error">{errors.password}</small>}
            </label>

            <label className="check-row">
              <input checked={remember} onChange={(event) => setRemember(event.target.checked)} type="checkbox" />
              <span>이 기기에서 로그인 유지</span>
            </label>

            <button className="btn btn-primary" type="submit" disabled={submitting}>
              {submitting ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <p className="switch-copy">
            계정이 없으신가요?{' '}
            <button className="text-link" type="button" onClick={() => navigate('signup')}>회원가입</button>
          </p>
        </div>
      </div>
    </section>
  );
}
