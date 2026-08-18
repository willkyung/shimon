import { useMemo, useState } from 'react';
import { useWorker } from '../context/WorkerContext';
import { roleLabel } from '../utils/format';
import { ShieldIcon } from '../components/Icons';

const initialForm = {
  employeeCode: '',
  name: '',
  company: '',
  role: '',
  gender: '',
  phone: '',
  email: '',
  age: '',
  jobType: '',
  workplace: '',
  uniform: '착용',
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
    work: <><path d="M4 19h16M6 19v-7h12v7M8 12V8h8v4" /><path d="M9 8V5h6v3" /></>,
    shirt: <path d="M8 4 4 7l2 4 2-1v10h8V10l2 1 2-4-4-3-2 2h-4L8 4Z" />,
  };
  return <svg viewBox="0 0 24 24">{icons[type] || icons.user}</svg>;
}

function Field({ label, icon, children, readOnly = false }) {
  return (
    <label className="field signup-field">
      <span>{label}</span>
      <span className={`signup-control ${readOnly ? 'readonly' : ''}`}>
        <span className="signup-control-icon" aria-hidden="true"><LineIcon type={icon} /></span>
        {children}
      </span>
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
  const { navigate, employeeDirectory, normalizeEmployeeCode, showToast, signup } = useWorker();
  const [form, setForm] = useState(initialForm);
  const [verifiedEmployee, setVerifiedEmployee] = useState(null);
  const [verifyError, setVerifyError] = useState('');

  const step = verifiedEmployee ? 2 : 1;
  const isWorker = verifiedEmployee?.role === 'worker';

  const setValue = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const resetVerification = (clearValues = false) => {
    setVerifiedEmployee(null);
    setVerifyError('');
    setForm((current) => ({
      ...current,
      employeeCode: clearValues ? '' : current.employeeCode,
      name: clearValues ? '' : current.name,
      company: '',
      role: '',
      gender: clearValues ? '' : current.gender,
      phone: clearValues ? '' : current.phone,
      email: clearValues ? '' : current.email,
      age: clearValues ? '' : current.age,
      jobType: clearValues ? '' : current.jobType,
      workplace: clearValues ? '' : current.workplace,
      uniform: '착용',
      password: clearValues ? '' : current.password,
      passwordConfirm: clearValues ? '' : current.passwordConfirm,
    }));
  };

  const verify = () => {
    const code = normalizeEmployeeCode(form.employeeCode);
    const name = form.name.trim();
    setVerifyError('');

    if (!code || !name) {
      setVerifyError('사원코드와 이름을 모두 입력해주세요.');
      showToast('사원코드와 이름을 입력해주세요.');
      return;
    }

    const employee = employeeDirectory[code];
    if (!employee) {
      resetVerification(false);
      setVerifyError('등록되지 않은 사원코드입니다. 현장 관리자에게 문의해주세요.');
      showToast('등록되지 않은 사원코드입니다.');
      return;
    }

    if (employee.name !== name) {
      resetVerification(false);
      setVerifyError('사원코드와 회사에 등록된 이름이 일치하지 않습니다.');
      showToast('사원코드와 이름을 확인해주세요.');
      return;
    }

    setVerifiedEmployee(employee);
    setForm((current) => ({
      ...current,
      employeeCode: code,
      name: employee.name,
      company: employee.company,
      role: employee.role,
      jobType: employee.role === 'worker' ? employee.jobType || '' : '-',
      workplace: employee.role === 'worker' ? employee.workplace || '' : '통합 관제 센터',
    }));
    showToast(`${employee.company} ${roleLabel(employee.role)}로 확인되었습니다.`);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!verifiedEmployee) {
      setVerifyError('회원가입 전에 사원 확인이 필요합니다.');
      showToast('먼저 사원코드 확인을 완료해주세요.');
      return;
    }

    if (form.password !== form.passwordConfirm) {
      showToast('비밀번호와 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    const age = isWorker ? Number(form.age) : null;
    if (isWorker && (!age || age < 18 || age > 80)) {
      showToast('연령을 확인해주세요.');
      return;
    }

    const user = {
      employeeCode: normalizeEmployeeCode(form.employeeCode),
      name: form.name.trim(),
      password: form.password,
      role: verifiedEmployee.role,
      company: verifiedEmployee.company,
      gender: form.gender,
      phone: form.phone.trim(),
      email: form.email.trim(),
      age,
      jobType: isWorker ? (form.jobType.trim() || verifiedEmployee.jobType || '') : '-',
      workplace: isWorker ? (form.workplace.trim() || verifiedEmployee.workplace || '') : '통합 관제 센터',
      workIntensity: isWorker ? '보통' : '-',
      uniform: isWorker ? form.uniform : '-',
    };

    signup(user);
    setVerifiedEmployee(null);
    setForm(initialForm);
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
            <p>회사 등록 정보를 확인한 뒤, 근로 환경에 필요한 정보만 입력합니다.</p>
          </div>

          <div id="signupStepper" className="signup-stepper" data-step={step} aria-label="회원가입 진행 단계">
            <div className={`signup-step ${step === 1 ? 'is-active' : 'is-complete'}`} aria-current={step === 1 ? 'step' : undefined}>
              <span className="signup-step-circle">1</span>
              <span className="signup-step-copy"><strong>사원 확인</strong><small>소속·권한 확인</small></span>
            </div>
            <span className={`signup-step-connector ${step === 2 ? 'is-complete' : ''}`} aria-hidden="true" />
            <div className={`signup-step ${step === 2 ? 'is-active' : ''}`} aria-current={step === 2 ? 'step' : undefined}>
              <span className="signup-step-circle">2</span>
              <span className="signup-step-copy"><strong>정보 입력</strong><small>계정·작업 정보</small></span>
            </div>
          </div>

          <form className="form-stack signup-form" onSubmit={handleSubmit}>
            <div className="employee-verification-card signup-step-card">
              <div className="signup-card-heading">
                <span className="signup-section-icon" aria-hidden="true"><ShieldIcon check /></span>
                <div>
                  <span className="signup-card-kicker">STEP 01</span>
                  <strong>회사 등록 정보 확인</strong>
                  <p>사원코드와 이름으로 소속과 사용자 권한을 확인합니다.</p>
                </div>
              </div>

              <Field label="사원코드" icon="code">
                <input value={form.employeeCode} onChange={(e) => setValue('employeeCode', e.target.value)} type="text" placeholder="예: HB-W001" autoComplete="off" autoCapitalize="characters" readOnly={Boolean(verifiedEmployee)} required />
              </Field>
              <Field label="이름" icon="user">
                <input value={form.name} onChange={(e) => setValue('name', e.target.value)} type="text" placeholder="회사에 등록된 이름" readOnly={Boolean(verifiedEmployee)} required />
              </Field>

              <button className="btn employee-verify-button signup-gradient-cta" type="button" onClick={verify} disabled={Boolean(verifiedEmployee)}>
                <span>사원 확인</span>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
              </button>

              {verifiedEmployee && (
                <div className="employee-verify-result" aria-live="polite">
                  <div className="employee-verify-icon">✓</div>
                  <div className="employee-verify-copy">
                    <strong>소속이 확인되었습니다.</strong>
                    <span>{verifiedEmployee.company}</span>
                    <small>{verifiedEmployee.employeeCode} · {roleLabel(verifiedEmployee.role)}</small>
                  </div>
                  <button className="employee-reset-button" type="button" onClick={() => resetVerification(false)}>다시 입력</button>
                </div>
              )}

              {verifyError && <p className="employee-verify-error" aria-live="polite">{verifyError}</p>}
            </div>

            <div id="signupDetails" className={`signup-details ${verifiedEmployee ? '' : 'is-locked'}`}>
              <div className="signup-step2-heading">
                <span className="signup-section-icon gradient" aria-hidden="true"><ShieldIcon check /></span>
                <div>
                  <span className="signup-card-kicker">STEP 02</span>
                  <strong>필요한 정보만 입력해요</strong>
                  <p>폭염 안전관리와 계정 사용에 필요한 최소 정보로 구성했습니다.</p>
                </div>
              </div>

              <section className="signup-section-card">
                <SectionHeading title="기본 정보" description="회사 등록 정보와 기본 프로필" />
                <Field label="회사명" icon="company" readOnly>
                  <input value={form.company} type="text" placeholder="사원 확인 후 자동 입력" readOnly />
                </Field>
                <Field label="성별" icon="user">
                  <select value={form.gender} onChange={(e) => setValue('gender', e.target.value)} disabled={!verifiedEmployee} required>
                    <option value="">선택</option><option value="남성">남성</option><option value="여성">여성</option><option value="기타">기타</option>
                  </select>
                </Field>
              </section>

              <section className="signup-section-card">
                <SectionHeading title="연락처" description="안전 알림과 계정 확인에 사용" />
                <Field label="전화번호" icon="phone">
                  <input value={form.phone} onChange={(e) => setValue('phone', e.target.value)} type="tel" placeholder="010-1234-5678" disabled={!verifiedEmployee} required />
                </Field>
                <Field label="이메일" icon="email">
                  <input value={form.email} onChange={(e) => setValue('email', e.target.value)} type="email" placeholder="example@email.com" disabled={!verifiedEmployee} required />
                </Field>
              </section>

              {(!verifiedEmployee || isWorker) && (
                <div className="worker-only-fields signup-worker-section">
                  <section className="signup-section-card">
                    <SectionHeading title="작업 정보" description="개인별 휴식 안내에 필요한 작업 조건" gradient />
                    <Field label="연령" icon="clock">
                      <input value={form.age} onChange={(e) => setValue('age', e.target.value)} type="number" min="18" max="80" placeholder="예: 42" disabled={!verifiedEmployee} required={Boolean(verifiedEmployee)} />
                    </Field>
                    <Field label="작업 유형" icon="work">
                      <input value={form.jobType} onChange={(e) => setValue('jobType', e.target.value)} type="text" placeholder="예: 건설 / 토목 / 도로 작업" disabled={!verifiedEmployee} required={Boolean(verifiedEmployee)} />
                    </Field>
                    <Field label="작업 장소" icon="location">
                      <input value={form.workplace} onChange={(e) => setValue('workplace', e.target.value)} type="text" placeholder="예: 부산 북항 현장" disabled={!verifiedEmployee} required={Boolean(verifiedEmployee)} />
                    </Field>
                    <Field label="작업복 착용 여부" icon="shirt">
                      <select value={form.uniform} onChange={(e) => setValue('uniform', e.target.value)} disabled={!verifiedEmployee}>
                        <option value="착용">착용</option><option value="미착용">미착용</option>
                      </select>
                    </Field>
                  </section>
                </div>
              )}

              <section className="signup-section-card">
                <SectionHeading title="계정 정보" description="로그인에 사용할 비밀번호를 설정" />
                <Field label="비밀번호" icon="lock">
                  <input value={form.password} onChange={(e) => setValue('password', e.target.value)} type="password" placeholder="비밀번호" disabled={!verifiedEmployee} required />
                </Field>
                <Field label="비밀번호 확인" icon="lock">
                  <input value={form.passwordConfirm} onChange={(e) => setValue('passwordConfirm', e.target.value)} type="password" placeholder="비밀번호 다시 입력" disabled={!verifiedEmployee} required />
                </Field>
              </section>

              <div className="signup-minimum-note">
                <ShieldIcon check />
                <span>안전관리와 계정 운영에 필요한 최소 정보만 입력받습니다.</span>
              </div>

              <button className="btn btn-primary signup-submit-button" type="submit" disabled={!verifiedEmployee}>회원가입 완료</button>
            </div>
          </form>

          <div className="signup-demo-box">
            <strong>프로토타입 사원코드</strong>
            <span>노동자: HB-W001 / 김철수</span>
            <span>관리자: HB-A001 / 관리자</span>
            <small>사원코드로 회사와 노동자·관리자 권한을 자동 구분합니다.</small>
          </div>

          <p className="switch-copy">
            이미 계정이 있으신가요?{' '}
            <button className="text-link" type="button" onClick={() => navigate('login')}>로그인</button>
          </p>
        </div>
      </div>
    </section>
  );
}
