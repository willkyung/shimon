import { useState } from 'react';
import { ShieldIcon } from '../components/Icons';
import { useWorker } from '../context/WorkerContext';
import { apiFieldErrors, validateSignupForm } from '../utils/authValidation';
import { WORK_TYPE_OPTIONS, workIntensityFor } from '../utils/workProfile';

const initialForm = {
  companyName: '',
  workArea: '',
  workType: '',
  hasWorkwear: false,
  name: '',
  phone: '',
  email: '',
  age: '',
  password: '',
  passwordConfirm: '',
};

function LineIcon({ type }) {
  const icons = {
    code: <><rect x="4" y="5" width="16" height="14" rx="3" /><path d="M8 9h5M8 13h8" /></>,
    user: <><circle cx="12" cy="8" r="3.2" /><path d="M5.5 20c.7-4 3-6 6.5-6s5.8 2 6.5 6" /></>,
    company: <><path d="M4 20V7l8-4 8 4v13" /><path d="M8 10h2M14 10h2M8 14h2M14 14h2" /></>,
    phone: <path d="M6.5 4h3l1.5 4-2 1.7a14 14 0 0 0 5.3 5.3l1.7-2 4 1.5v3c0 1.4-1.1 2.5-2.5 2.5C10 20 4 14 4 6.5 4 5.1 5.1 4 6.5 4Z" />,
    email: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m5 8 7 5 7-5" /></>,
    location: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.4" /></>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    clock: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 2" /></>,
  };
  return <svg viewBox="0 0 24 24">{icons[type] || icons.user}</svg>;
}

function Field({ label, icon, error, children }) {
  return (
    <label className={`field signup-field ${error ? 'has-error' : ''}`}>
      <span>{label}</span>
      <span className="signup-control">
        <span className="signup-control-icon" aria-hidden="true"><LineIcon type={icon} /></span>
        {children}
      </span>
      {error && <small className="signup-field-error">{error}</small>}
    </label>
  );
}

function SectionHeading({ title, description, gradient = false }) {
  return (
    <div className="signup-section-heading">
      <span className={`signup-section-mini-icon ${gradient ? 'gradient' : ''}`} aria-hidden="true"><ShieldIcon check /></span>
      <div><strong>{title}</strong><small>{description}</small></div>
    </div>
  );
}

export default function SignupPage({ active }) {
  const { navigate, signup } = useWorker();
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const setValue = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationErrors = validateSignupForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const result = await signup({
        companyName: form.companyName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        role: 'WORKER',
        workerProfile: {
          age: Number(form.age),
          workArea: form.workArea.trim(),
          workType: form.workType,
          hasWorkwear: form.hasWorkwear,
        },
      });
      if (result.ok) {
        setForm(initialForm);
      } else {
        setErrors(apiFieldErrors(result.error));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="screen-signup" className={`screen auth-screen long-screen ${active ? 'active' : ''}`}>
      <div className="auth-card signup-auth-card">
        <div className="auth-topbar signup-auth-topbar">
          <button className="back-button auth-back" type="button" onClick={() => navigate('welcome')} aria-label="뒤로 가기">←</button>
          <div className="signup-topbar-brand">
            <span className="signup-topbar-mark" aria-hidden="true"><ShieldIcon /></span>
            <span><strong>SHIMON</strong><small>WORKER ONBOARDING</small></span>
          </div>
        </div>

        <div className="auth-content signup-auth-content">
          <div className="section-heading signup-heading">
            <p className="eyebrow">CREATE ACCOUNT</p>
            <h1>안전한 작업을 위한<br />첫 설정을 시작해요</h1>
            <p>기존 회사와 현장에 연결되는 작업자 계정을 생성합니다.</p>
          </div>

          <form className="form-stack signup-form" onSubmit={handleSubmit}>
            <section className="signup-section-card">
              <SectionHeading title="소속 정보" description="회사명과 작업 구역을 입력해주세요. 사번은 가입 시 자동 생성됩니다." />
              <Field label="회사명" icon="company" error={errors.companyName}><input value={form.companyName} onChange={(event) => setValue('companyName', event.target.value)} type="text" placeholder="회사명 입력" aria-invalid={Boolean(errors.companyName)} required /></Field>
              <Field label="작업 구역" icon="location" error={errors.workArea}><input value={form.workArea} onChange={(event) => setValue('workArea', event.target.value)} type="text" placeholder="작업 구역 입력" aria-invalid={Boolean(errors.workArea)} required /></Field>
            </section>

            <section className="signup-section-card">
              <SectionHeading title="기본 정보" description="작업자 식별과 안전 지원에 필요한 최소 정보입니다." gradient />
              <Field label="이름" icon="user" error={errors.name}><input value={form.name} onChange={(event) => setValue('name', event.target.value)} type="text" aria-invalid={Boolean(errors.name)} required /></Field>
              <Field label="이메일" icon="email" error={errors.email}><input value={form.email} onChange={(event) => setValue('email', event.target.value)} type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} required /></Field>
              <Field label="전화번호 (선택)" icon="phone" error={errors.phone}><input value={form.phone} onChange={(event) => setValue('phone', event.target.value)} type="tel" placeholder="010-0000-0000" autoComplete="tel" aria-invalid={Boolean(errors.phone)} /></Field>
              <Field label="나이" icon="clock" error={errors.age}><input value={form.age} onChange={(event) => setValue('age', event.target.value)} type="number" min="18" max="100" placeholder="나이 입력" aria-invalid={Boolean(errors.age)} required /></Field>
              <Field label="작업 유형" icon="code" error={errors.workType}>
                <select value={form.workType} onChange={(event) => setValue('workType', event.target.value)} aria-invalid={Boolean(errors.workType)} required>
                  <option value="">작업 유형 선택</option>
                  {WORK_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.value} · {option.intensity}</option>
                  ))}
                </select>
              </Field>
              {form.workType && (
                <div className="signup-derived-info" role="status">
                  작업 강도는 <strong>{workIntensityFor(form.workType)}</strong>으로 자동 설정됩니다.
                </div>
              )}
              <label className="check-row signup-workwear-check">
                <input checked={form.hasWorkwear} onChange={(event) => setValue('hasWorkwear', event.target.checked)} type="checkbox" />
                <span>작업복을 착용합니다.</span>
              </label>
            </section>

            <section className="signup-section-card">
              <SectionHeading title="계정 정보" description="영문과 숫자를 포함한 8자 이상의 비밀번호를 설정해주세요." />
              <Field label="비밀번호" icon="lock" error={errors.password}><input value={form.password} onChange={(event) => setValue('password', event.target.value)} type="password" minLength="8" maxLength="128" autoComplete="new-password" aria-invalid={Boolean(errors.password)} required /></Field>
              <Field label="비밀번호 확인" icon="lock" error={errors.passwordConfirm}><input value={form.passwordConfirm} onChange={(event) => setValue('passwordConfirm', event.target.value)} type="password" minLength="8" maxLength="128" autoComplete="new-password" aria-invalid={Boolean(errors.passwordConfirm)} required /></Field>
            </section>

            <div className="signup-minimum-note"><ShieldIcon check /><span>비밀번호는 브라우저에 저장하지 않고 안전하게 서버로 전송됩니다.</span></div>
            <button className="btn btn-primary signup-submit-button" type="submit" disabled={submitting}>{submitting ? '가입 처리 중...' : '회원가입 완료'}</button>
          </form>

          <p className="switch-copy">이미 계정이 있으신가요?{' '}<button className="text-link" type="button" onClick={() => navigate('welcome')}>로그인</button></p>
        </div>
      </div>
    </section>
  );
}
