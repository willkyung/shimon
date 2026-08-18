import { useEffect, useState } from 'react';
import { useWorker } from '../context/WorkerContext';

export default function SettingsPage({ active }) {
  const { currentUser, navigate, saveProfile, showToast } = useWorker();
  const [form, setForm] = useState({
    jobType: '',
    workplace: '',
    workIntensity: '보통',
    uniform: '착용',
    gender: '남성',
    phone: '',
    email: '',
  });

  useEffect(() => {
    if (!active) return;
    setForm({
      jobType: currentUser?.jobType || '',
      workplace: currentUser?.workplace || '',
      workIntensity: currentUser?.workIntensity || '보통',
      uniform: currentUser?.uniform || '착용',
      gender: currentUser?.gender || '남성',
      phone: currentUser?.phone || '',
      email: currentUser?.email || '',
    });
  }, [active, currentUser]);

  const setValue = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const save = () => {
    if (!form.jobType.trim()) {
      showToast('작업 유형을 입력해주세요.');
      return;
    }
    if (!form.workplace.trim()) {
      showToast('작업 장소를 입력해주세요.');
      return;
    }
    saveProfile({
      ...form,
      jobType: form.jobType.trim(),
      workplace: form.workplace.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
    });
  };

  return (
    <section id="screen-settings" className={`screen content-screen ${active ? 'active' : ''}`}>
      <div className="settings-screen-wrap">
        <div className="settings-page-header">
          <button className="settings-back-button" type="button" onClick={() => navigate('mypage')}>←</button>
          <div><p className="eyebrow">SETTINGS</p><h1>작업 정보 수정</h1><p>현재 작업 환경 정보를 수정할 수 있습니다.</p></div>
        </div>

        <div className="settings-fields">
          <label className="field"><span>작업 유형</span><input value={form.jobType} onChange={(e) => setValue('jobType', e.target.value)} type="text" placeholder="예: 토목 작업" /></label>
          <label className="field"><span>작업 장소</span><input value={form.workplace} onChange={(e) => setValue('workplace', e.target.value)} type="text" placeholder="예: 부산 북항 현장" /></label>
          <label className="field"><span>작업 강도</span>
            <select value={form.workIntensity} onChange={(e) => setValue('workIntensity', e.target.value)}>
              <option value="낮음">낮음</option><option value="보통">보통</option><option value="높음">높음</option>
            </select>
          </label>
          <label className="field"><span>작업복 착용 여부</span>
            <select value={form.uniform} onChange={(e) => setValue('uniform', e.target.value)}>
              <option value="착용">착용</option><option value="미착용">미착용</option>
            </select>
          </label>
          <label className="field"><span>성별</span>
            <select value={form.gender} onChange={(e) => setValue('gender', e.target.value)}>
              <option value="남성">남성</option><option value="여성">여성</option><option value="기타">기타</option>
            </select>
          </label>
          <label className="field"><span>전화번호</span><input value={form.phone} onChange={(e) => setValue('phone', e.target.value)} type="tel" placeholder="010-1234-5678" /></label>
          <label className="field"><span>이메일</span><input value={form.email} onChange={(e) => setValue('email', e.target.value)} type="email" placeholder="example@email.com" /></label>
        </div>

        <div className="settings-bottom-actions">
          <button className="settings-cancel-btn" type="button" onClick={() => navigate('mypage')}>취소</button>
          <button className="settings-complete-btn" type="button" onClick={save}>완료</button>
        </div>
      </div>
    </section>
  );
}
