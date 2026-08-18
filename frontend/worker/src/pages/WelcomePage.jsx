import { useState } from 'react';
import { useWorker } from '../context/WorkerContext';
import { apiFieldErrors, validateLoginForm } from '../utils/authValidation';

export default function WelcomePage({ active }) {
  const { navigate, login } = useWorker();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        remember: false,
      });
      if (!result.ok) {
        const fieldErrors = apiFieldErrors(result.error);
        setErrors(
          Object.keys(fieldErrors).length > 0
            ? fieldErrors
            : { password: '이메일 또는 비밀번호를 확인해주세요.' },
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="screen-welcome" className={`screen splash-screen ${active ? 'active' : ''}`}>
      <div className="splash-noise" aria-hidden="true" />

      <div className="splash-hero">
        <div className="splash-brand-group">
          <div className="splash-logo-stage" aria-hidden="true">
            <span className="splash-glow glow-one" />
            <span className="splash-glow glow-two" />
            <span className="splash-orbit orbit-one" />
            <span className="splash-orbit orbit-two" />
            <img className="splash-logo" src="/shimon-logo.png" alt="SHIMON" />
          </div>

          <div className="splash-wordmark">SHIMON</div>
          <p className="splash-eyebrow">
            AI 기반 폭염 옥외 노동자<br />
            휴식 관리 서비스
          </p>
        </div>

        <form id="welcome-login-form" className="splash-login-form" onSubmit={handleSubmit}>
          <label className={`splash-login-field ${errors.email ? 'has-error' : ''}`}>
            <span>이메일</span>
            <input
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setErrors((current) => ({ ...current, email: undefined }));
              }}
              type="email"
              placeholder="이메일"
              autoComplete="username"
              aria-invalid={Boolean(errors.email)}
              required
            />
            {errors.email && <small className="splash-field-error">{errors.email}</small>}
          </label>

          <label className={`splash-login-field ${errors.password ? 'has-error' : ''}`}>
            <span>비밀번호</span>
            <input
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setErrors((current) => ({ ...current, password: undefined }));
              }}
              type="password"
              placeholder="비밀번호"
              autoComplete="current-password"
              aria-invalid={Boolean(errors.password)}
              required
            />
            {errors.password && <small className="splash-field-error">{errors.password}</small>}
          </label>
        </form>
      </div>

      <div className="splash-signature" aria-hidden="true">
        <svg viewBox="0 0 430 92" preserveAspectRatio="none">
          <path className="signature-grid" d="M0 48H430" />
          <path className="signature-pulse" d="M-30 48 H56 L75 48 L88 33 L104 65 L122 12 L141 61 L157 40 L174 48 H238 L252 48 L264 35 L276 62 L292 22 L308 58 L324 42 L340 48 H460" />
        </svg>
        <div className="splash-cityline" />
      </div>

      <div className="splash-actions">
        <button className="btn btn-splash" type="submit" form="welcome-login-form" disabled={submitting}>
          <span>{submitting ? '로그인 중...' : '로그인'}</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
        </button>

        <p className="splash-switch">
          아직 계정이 없으신가요?{' '}
          <button className="splash-link" type="button" onClick={() => navigate('signup')}>회원가입</button>
        </p>
      </div>
    </section>
  );
}
