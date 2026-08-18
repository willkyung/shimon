import { useMemo } from 'react';
import { useWorker } from '../context/WorkerContext';
import { getRecordRisk, totalRecordMinutes, formatMinutesForUI } from '../utils/format';
import { EkgIcon, ShieldIcon } from '../components/Icons';

export default function RecordPage({ active }) {
  const { workRecords, restRecords, recordTab, setRecordTab, estimatedCoreTemp } = useWorker();

  const summary = useMemo(() => {
    const totalWork = totalRecordMinutes(workRecords);
    const totalRest = totalRecordMinutes(restRecords);
    const temps = workRecords.map((r) => Number(r.temp)).filter(Number.isFinite);
    const cores = workRecords.map((r) => Number(r.coreTemp)).filter(Number.isFinite);
    const average = temps.length ? temps.reduce((sum, value) => sum + value, 0) / temps.length : 0;
    const maxCore = cores.length ? Math.max(...cores) : 0;

    const rank = { normal: 0, caution: 1, warning: 2 };
    const highestRisk = workRecords.reduce((current, record) => {
      const next = getRecordRisk(record.temp, record.coreTemp);
      return rank[next.level] > rank[current.level] ? next : current;
    }, { level: 'normal', label: '정상' });

    return { totalWork, totalRest, average, maxCore, highestRisk };
  }, [workRecords, restRecords]);

  const list = recordTab === 'work' ? workRecords : restRecords;
  const typeLabel = recordTab === 'work' ? '작업' : '휴식';

  return (
    <section id="screen-record" className={`screen content-screen ${active ? 'active' : ''}`}>
      <div className="content-wrap record-content-wrap record-simplified-wrap">
        <div className="section-heading compact">
          <p className="eyebrow">HISTORY</p><h1>기록</h1><p>오늘의 작업과 휴식 기록을 확인하세요.</p>
        </div>

        <div className="segmented-control" role="tablist">
          <button className={`segment ${recordTab === 'work' ? 'active' : ''}`} type="button" onClick={() => setRecordTab('work')}>작업 기록</button>
          <button className={`segment ${recordTab === 'rest' ? 'active' : ''}`} type="button" onClick={() => setRecordTab('rest')}>휴식 기록</button>
        </div>

        <article className="record-safety-overview record-daily-summary">
          <div className="record-overview-heading record-daily-heading">
            <div>
              <span className="record-overview-eyebrow">DAILY SAFETY</span>
              <h2>오늘 기록 요약</h2>
              <p>작업·휴식과 주요 안전 지표를 한 번에 확인하세요.</p>
            </div>
            <span className="record-safe-badge" data-level={summary.highestRisk.level}>{summary.highestRisk.label}</span>
          </div>

          <div className="record-summary-hero-grid">
            <div className="record-summary-hero work-total">
              <span className="record-summary-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="7" /><path d="M12 10v4l3 2" /><path d="M9 3h6M12 3v3" /></svg>
              </span>
              <span className="record-summary-label">총 작업시간</span>
              <strong>{formatMinutesForUI(summary.totalWork)}</strong>
            </div>

            <div className="record-summary-hero core-temp">
              <span className="record-summary-icon" aria-hidden="true"><EkgIcon /></span>
              <span className="record-summary-label">최고 <b>AI 추정</b> 심부체온</span>
              <strong>{summary.maxCore ? `${summary.maxCore.toFixed(1)}℃` : '-'}</strong>
              <small>실측 체온이 아닌 추정치</small>
            </div>
          </div>

          <div className="record-summary-mini-grid">
            <div className="record-summary-mini"><span>작업 횟수</span><strong>{workRecords.length}회</strong></div>
            <div className="record-summary-mini"><span>총 휴식시간</span><strong>{formatMinutesForUI(summary.totalRest)}</strong></div>
            <div className="record-summary-mini"><span>평균 체감온도</span><strong>{summary.average ? `${summary.average.toFixed(1).replace('.0', '')}℃` : '-'}</strong></div>
          </div>

          <div className="record-safety-message record-summary-message">
            <span aria-hidden="true"><ShieldIcon check /></span>
            <p>오늘도 권장 휴식을 지키며 안전하게 작업하고 있어요.</p>
          </div>
        </article>

        <div className="record-list-heading"><h2>{typeLabel} 기록</h2><span>{list.length}건</span></div>

        <div className="record-list">
          {list.map((record, index) => {
            const core = Number.isFinite(Number(record.coreTemp)) ? Number(record.coreTemp) : estimatedCoreTemp;
            const risk = getRecordRisk(record.temp, core);
            let note = '안전하게 기록이 완료되었습니다.';

            if (recordTab === 'work') {
              if (risk.level === 'warning') note = '열스트레스 위험이 높았던 구간입니다. 충분한 휴식과 상태 확인이 필요합니다.';
              else if (risk.level === 'caution') note = '체감온도 또는 추정 심부체온이 주의 구간에 가까웠습니다.';
              else note = '안전한 범위에서 작업을 완료했어요.';
            } else {
              note = risk.level === 'warning'
                ? '휴식 중에도 추정 심부체온이 높게 유지된 구간입니다.'
                : '휴식 기록이 정상적으로 저장되었습니다.';
            }

            return (
              <article key={`${record.time}-${index}`} className={`card record-item risk-${risk.level}`}>
                <div className="record-item-top">
                  <div className="record-item-title">
                    <span className="record-risk-icon" aria-hidden="true"><EkgIcon /></span>
                    <div><strong>{record.time}</strong><small>{typeLabel} 기록</small></div>
                  </div>
                  <span className="record-risk-badge">{risk.label}</span>
                </div>

                <div className="record-item-body">
                  <div className="record-duration-block"><span>{typeLabel}시간</span><strong>{record.duration}</strong></div>
                  <div className="record-metric-stack">
                    <div className="record-metric-chip apparent"><span>체감온도</span><strong>{record.temp}℃</strong></div>
                    <div className={`record-metric-chip core risk-${risk.level}`}>
                      <span><b>AI 추정</b> 심부체온</span><strong>{core.toFixed(1)}℃</strong>
                    </div>
                  </div>
                </div>

                <p className="record-item-note">{note}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
