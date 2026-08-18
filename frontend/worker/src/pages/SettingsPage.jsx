import { useEffect, useState } from 'react';
import { useWorker } from '../context/WorkerContext';
import { apiFieldErrors, validateProfileUpdateForm } from '../utils/authValidation';

export default function SettingsPage({ active }) {
  const { currentUser, navigate, saveProfile, showToast } = useWorker();
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    jobType: '',
    workplace: '',
    workIntensity: 'MEDIUM',
    uniform: 'X',
    gender: 'MALE',
    phone: '',
    email: '',
  });

  useEffect(() => {
    if (!active) return;
    setForm({
      jobType: currentUser?.jobType || '',
      workplace: currentUser?.workplace || '',
      workIntensity: currentUser?.workIntensity || 'MEDIUM',
      uniform: currentUser?.uniform || 'X',
      gender: currentUser?.gender || 'MALE',
      phone: currentUser?.phone || '',
      email: currentUser?.email || '',
    });
    setErrors({});
  }, [active, currentUser]);

  const setValue = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const save = async () => {
    const validationErrors = validateProfileUpdateForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      showToast('입력값을 다시 확인해주세요.');
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const result = await saveProfile(form);
      if (!result.ok) {
        const apiErrors = apiFieldErrors(result.error);
        setErrors({
          email: apiErrors.email,
          workplace: apiErrors.workArea,
          jobType: apiErrors.workType,
          phone: apiErrors.phone,
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="screen-settings" className={`screen content-screen ${active ? 'active' : ''}`}>
      <div className="settings-screen-wrap">
        <div className="settings-page-header">
          <button className="settings-back-button" type="button" onClick={() => navigate('mypage')}>←</button>
          <div><p className="eyebrow">SETTINGS</p><h1>정보 수정</h1><p>현재 개인 및 작업 정보를 수정할 수 있습니다.</p></div>
        </div>

        <div className="settings-fields">
          <label className={`field ${errors.jobType ? 'has-error' : ''}`}><span>작업 유형</span>
            <input value={form.jobType} onChange={(e) => setValue('jobType', e.target.value)} type="text" placeholder="예: 토목 작업" />
            {errors.jobType && <small className="settings-field-error">{errors.jobType}</small>}
          </label>
          <label className={`field ${errors.workplace ? 'has-error' : ''}`}><span>작업 장소</span><input value={form.workplace} onChange={(e) => setValue('workplace', e.target.value)} type="text" placeholder="예: 부산 북항 현장" />{errors.workplace && <small className="settings-field-error">{errors.workplace}</small>}</label>
          <label className="field"><span>작업 강도</span>
            <select value={form.workIntensity} onChange={(e) => setValue('workIntensity', e.target.value)}>
              <option value="LOW">낮음</option><option value="MEDIUM">보통</option><option value="HIGH">높음</option>
            </select>
          </label>
          <label className="field"><span>작업복 착용 여부</span>
            <select value={form.uniform} onChange={(e) => setValue('uniform', e.target.value)}>
              <option value="O">O</option><option value="X">X</option>
            </select>
          </label>
          <label className="field"><span>성별</span>
            <select value={form.gender} onChange={(e) => setValue('gender', e.target.value)}>
              <option value="MALE">남성</option><option value="FEMALE">여성</option>
            </select>
          </label>
          <label className={`field ${errors.phone ? 'has-error' : ''}`}><span>전화번호</span><input value={form.phone} onChange={(e) => setValue('phone', e.target.value)} type="tel" placeholder="010-1234-5678" />{errors.phone && <small className="settings-field-error">{errors.phone}</small>}</label>
          <label className={`field ${errors.email ? 'has-error' : ''}`}><span>이메일</span><input value={form.email} onChange={(e) => setValue('email', e.target.value)} type="email" placeholder="example@email.com" />{errors.email && <small className="settings-field-error">{errors.email}</small>}</label>
        </div>

        <div className="settings-bottom-actions">
          <button className="settings-cancel-btn" type="button" onClick={() => navigate('mypage')}>취소</button>
          <button className="settings-complete-btn" type="button" onClick={save} disabled={submitting}>{submitting ? '저장 중...' : '완료'}</button>
        </div>
      </div>
    </section>
  );
}
