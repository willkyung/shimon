import { useEffect, useState } from 'react';
import Icon from '../components/Icon';
import { SITE_OPTIONS } from '../data/adminData';
import { useAdmin } from '../context/AdminContext';

function Heading({ icon, title, copy }) {
  return (
    <div className="settings-heading">
      <Icon name={icon} />
      <div><h3>{title}</h3><p>{copy}</p></div>
    </div>
  );
}

export default function SettingsPage() {
  const { currentAdmin, settings, saveSettings } = useAdmin();
  const [draft, setDraft] = useState(settings);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const setValue = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const toggleChannel = (key) => {
    setDraft((current) => ({
      ...current,
      channels: {
        ...current.channels,
        [key]: !current.channels[key],
      },
    }));
  };

  const save = () => saveSettings(draft);

  return (
    <section className="admin-page active">
      <div className="page-intro-row">
        <div>
          <p>ADMIN SETTINGS</p>
          <h2>설정</h2>
          <span>휴식 기준과 관리자 알림 수신 정보를 관리합니다.</span>
        </div>
      </div>

      <div className="settings-layout settings-layout-expanded">
        <article className="settings-panel">
          <Heading icon="clock" title="작업 · 휴식 기준" copy="현장 체감온도와 연속 작업시간에 따른 휴식 기준을 설정합니다." />

          <div className="setting-line"><label>매우 위험 체감온도</label><div><input value={draft.dangerTemp} onChange={(e) => setValue('dangerTemp', Number(e.target.value))} type="number" step="0.1" /> <span>°C</span></div></div>
          <div className="setting-line"><label>주의 체감온도</label><div><input value={draft.cautionTemp} onChange={(e) => setValue('cautionTemp', Number(e.target.value))} type="number" step="0.1" /> <span>°C</span></div></div>
          <div className="setting-line"><label>최대 연속 작업</label><div><input value={draft.maxWorkMinutes} onChange={(e) => setValue('maxWorkMinutes', Number(e.target.value))} type="number" /> <span>분</span></div></div>
          <div className="setting-line"><label>권장 휴식 시간</label><div><input value={draft.restMinutes} onChange={(e) => setValue('restMinutes', Number(e.target.value))} type="number" /> <span>분</span></div></div>

          <button className="settings-save" type="button" onClick={save}>기준값 저장</button>
        </article>

        <article className="settings-panel core-settings-panel">
          <Heading icon="pulse" title="AI 추정 심부체온 기준" copy="노동자 앱과 관리자 표에 동일하게 적용할 표시 기준입니다." />

          <div className="core-setting-notice">
            <span className="ai-mini-badge">AI 추정</span>
            <p>실측 체온이 아니라 체감온도·연령·작업강도·PPE·연속작업시간 기반 추정치입니다.</p>
          </div>

          <div className="setting-line"><label>주의 표시 시작</label><div><input value={draft.coreCautionTemp} onChange={(e) => setValue('coreCautionTemp', Number(e.target.value))} type="number" step="0.1" /> <span>°C</span></div></div>
          <div className="setting-line"><label>고위험 표시 시작</label><div><input value={draft.coreDangerTemp} onChange={(e) => setValue('coreDangerTemp', Number(e.target.value))} type="number" step="0.1" /> <span>°C</span></div></div>

          <div className="core-level-preview"><span className="normal">정상</span><span className="caution">주의</span><span className="high">고위험</span></div>

          <button className="settings-save" type="button" onClick={save}>심부체온 기준 저장</button>
        </article>

        <article className="settings-panel">
          <Heading icon="bell" title="알림 수신 채널" copy="고위험 및 휴식 미이행 알림의 전달 채널을 선택합니다." />

          <div className="channel-list">
            {[
              ['push', '앱 푸시', '관리자 콘솔과 모바일 푸시'],
              ['sms', 'SMS', '고위험 상태 문자 알림'],
              ['email', '이메일', '일일 안전 요약 및 리포트'],
              ['emergency', '긴급 연락', '고위험 노동자 발생 시 관리자 연락'],
            ].map(([key, title, copy]) => (
              <div className="channel-row" key={key}>
                <div><strong>{title}</strong><span>{copy}</span></div>
                <button
                  className={`settings-toggle ${draft.channels[key] ? 'on' : ''}`}
                  aria-pressed={draft.channels[key]}
                  type="button"
                  onClick={() => toggleChannel(key)}
                >
                  <i />
                </button>
              </div>
            ))}
          </div>

          <button className="settings-save secondary" type="button" onClick={save}>알림 설정 저장</button>
        </article>

        <article className="settings-panel">
          <Heading icon="grid" title="현장 · 구역 관리" copy="기본 현장과 현재 관리 중인 구역을 확인합니다." />

          <div className="site-setting-select">
            <label htmlFor="defaultSite">로그인 시 기본 현장</label>
            <select id="defaultSite" value={draft.defaultSite} onChange={(e) => setValue('defaultSite', e.target.value)}>
              {SITE_OPTIONS.map((site) => <option key={site.value} value={site.value}>{site.label}</option>)}
            </select>
          </div>

          <div className="managed-sites">
            <div><i className="live" /><span>강남 현장</span><strong>3개 구역</strong></div>
            <div><i className="live" /><span>서초 현장</span><strong>2개 구역</strong></div>
            <div><i className="live" /><span>미포 현장</span><strong>2개 구역</strong></div>
          </div>

          <button className="settings-save secondary" type="button" onClick={save}>현장 설정 저장</button>
        </article>

        <article className="settings-panel settings-panel-wide">
          <Heading icon="user" title="관리자 정보" copy="위험 알림을 수신하고 현장 설정을 관리하는 계정 정보입니다." />

          <div className="admin-info-list admin-info-grid">
            <div><span>이름</span><strong>{currentAdmin?.name || '-'}</strong></div>
            <div><span>회사명</span><strong>{currentAdmin?.company || '-'}</strong></div>
            <div><span>이메일</span><strong>{currentAdmin?.email || '-'}</strong></div>
            <div><span>전화번호</span><strong>{currentAdmin?.phone || '-'}</strong></div>
          </div>
        </article>
      </div>
    </section>
  );
}
