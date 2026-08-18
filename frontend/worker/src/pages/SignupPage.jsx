import { useState } from 'react';
import { ShieldIcon } from '../components/Icons';
import { useWorker } from '../context/WorkerContext';
import { authErrorMessage } from '../api/authApi';

const initialVerifyForm = { employeeCode: '', name: '' };

const initialDetailsForm = {
  gender: 'MALE',
  phone: '',
  email: '',
  age: '',
  workIntensity: 'MEDIUM',
  ppeWorn: false,
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
  const { navigate, verifyEmployee, signup } = useWorker();

  const [step, setStep] = useState('verify'); // 'verify' | 'details'
  const [verifyForm, setVerifyForm] = useState(initialVerifyForm);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  const [verificationToken, setVerificationToken] = useState('');
  const [employee, setEmployee] = useState(null); // { employeeCode, name, company, role, jobType, workplace }

  const [form, setForm] = useState(initialDetailsForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const isAdmin = employee?.role === 'ADMIN';

  const setValue = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const handleVerify = async (event) => {
    event.preventDefault();
    setVerifyError('');
    setVerifying(true);
    try {
      const result = await verifyEmployee({
        employeeCode: verifyForm.employeeCode.trim(),
        name: verifyForm.name.trim(),
      });
      setVerificationToken(result.verificationToken);
      setEmployee(result.employee);
      setStep('details');
    } catch (error) {
      setVerifyError(authErrorMessage(error));
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (form.password.length < 4) {
      setErrors((current) => ({ ...current, password: '비밀번호는 4자 이상이어야 합니다.' }));
      return;
    }
    if (form.password !== form.passwordConfirm) {
      setErrors((current) => ({ ...current, passwordConfirm: '비밀번호가 일치하지 않습니다.' }));
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const result = await signup({
        verificationToken,
        phone: form.phone.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        ...(isAdmin ? {} : {
          gender: form.gender,
          age: Number(form.age),
          jobType: employee.jobType,
          workplace: employee.workplace,
          workIntensity: form.workIntensity,
          ppeWorn: form.ppeWorn,
        }),
      });
      if (!result.ok) {
        setErrors({ password: authErrorMessage(result.error) });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="screen-signup" className={`screen auth-screen long-screen ${active ? 'active' : ''}`}>
      <div className="auth-card signup-auth-card">
        <div className="auth-topbar signup-auth-topbar">
          <button
            className="back-button auth-back"
            type="button"
            onClick={() => (step === 'details' ? setStep('verify') : navigate('welcome'))}
            aria-label="뒤로 가기"
          >←</button>
          <div className="signup-topbar-brand">
            <span className="signup-topbar-mark" aria-hidden="true"><ShieldIcon /></span>
            <span><strong>SHIMON</strong><small>ONBOARDING</small></span>
          </div>
        </div>

        <div className="auth-content signup-auth-content">
          {step === 'verify' && (
            <>
              <div className="section-heading signup-heading">
                <p className="eyebrow">STEP 1</p>
                <h1>사원 확인</h1>
                <p>회사에서 미리 등록한 사원코드와 이름을 입력해주세요.</p>
              </div>

              <form className="form-stack signup-form" onSubmit={handleVerify}>
                <section className="signup-section-card">
                  <Field label="사원코드" icon="code">
                    <input
                      value={verifyForm.employeeCode}
                      onChange={(event) => setVerifyForm((c) => ({ ...c, employeeCode: event.target.value }))}
                      type="text"
                      placeholder="예: HB-W001"
                      required
                    />
                  </Field>
                  <Field label="이름" icon="user">
                    <input
                      value={verifyForm.name}
                      onChange={(event) => setVerifyForm((c) => ({ ...c, name: event.target.value }))}
                      type="text"
                      required
                    />
                  </Field>
                </section>

                {verifyError && <div className="signup-field-error" role="alert">{verifyError}</div>}

                <button className="btn btn-primary signup-submit-button" type="submit" disabled={verifying}>
                  {verifying ? '확인 중...' : '다음'}
                </button>
              </form>

              <p className="switch-copy">이미 계정이 있으신가요?{' '}<button className="text-link" type="button" onClick={() => navigate('welcome')}>로그인</button></p>
            </>
          )}

          {step === 'details' && employee && (
            <>
              <div className="section-heading signup-heading">
                <p className="eyebrow">STEP 2</p>
                <h1>{employee.name}님, 반가워요</h1>
                <p>{employee.company} · {isAdmin ? '관리자' : employee.jobType} 계정으로 가입을 진행합니다.</p>
              </div>

              <form className="form-stack signup-form" onSubmit={handleSubmit}>
                <section className="signup-section-card">
                  <SectionHeading title="계정 정보" description="이메일과 전화번호, 비밀번호를 입력해주세요." gradient />
                  <Field label="이메일" icon="email" error={errors.email}>
                    <input value={form.email} onChange={(event) => setValue('email', event.target.value)} type="email" autoComplete="email" required />
                  </Field>
                  <Field label="전화번호" icon="phone" error={errors.phone}>
                    <input value={form.phone} onChange={(event) => setValue('phone', event.target.value)} type="tel" placeholder="010-0000-0000" autoComplete="tel" required />
                  </Field>
                  <Field label="비밀번호" icon="lock" error={errors.password}>
                    <input value={form.password} onChange={(event) => setValue('password', event.target.value)} type="password" minLength="4" maxLength="128" autoComplete="new-password" required />
                  </Field>
                  <Field label="비밀번호 확인" icon="lock" error={errors.passwordConfirm}>
                    <input value={form.passwordConfirm} onChange={(event) => setValue('passwordConfirm', event.target.value)} type="password" minLength="4" maxLength="128" autoComplete="new-password" required />
                  </Field>
                </section>

                {!isAdmin && (
                  <section className="signup-section-card">
                    <SectionHeading title="작업 정보" description="안전 지원에 필요한 최소 정보입니다." />
                    <Field label="나이" icon="clock" error={errors.age}>
                      <input value={form.age} onChange={(event) => setValue('age', event.target.value)} type="number" min="18" max="100" required />
                    </Field>
                    <label className="check-row">
                      <input
                        checked={form.gender === 'FEMALE'}
                        onChange={(event) => setValue('gender', event.target.checked ? 'FEMALE' : 'MALE')}
                        type="checkbox"
                      />
                      <span>여성입니다.</span>
                    </label>
                    <Field label="작업강도" icon="code">
                      <select value={form.workIntensity} onChange={(event) => setValue('workIntensity', event.target.value)}>
                        <option value="LOW">낮음</option>
                        <option value="MEDIUM">보통</option>
                        <option value="HIGH">높음</option>
                      </select>
                    </Field>
                    <label className="check-row signup-workwear-check">
                      <input checked={form.ppeWorn} onChange={(event) => setValue('ppeWorn', event.target.checked)} type="checkbox" />
                      <span>보호구(작업복)를 착용합니다.</span>
                    </label>
                  </section>
                )}

                <div className="signup-minimum-note"><ShieldIcon check /><span>비밀번호는 브라우저에 저장하지 않고 안전하게 서버로 전송됩니다.</span></div>
                <button className="btn btn-primary signup-submit-button" type="submit" disabled={submitting}>
                  {submitting ? '가입 처리 중...' : '회원가입 완료'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
