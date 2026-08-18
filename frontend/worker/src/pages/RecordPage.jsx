import { useMemo } from 'react';
import { useWorker } from '../context/WorkerContext';
import { EkgIcon } from '../components/Icons';

const RISK_RANK = { normal: 0, caution: 1, warning: 2 };

function riskFromEvaluation(evaluation) {
  if (!evaluation) return { level: 'normal', label: '평가 없음' };
  if (
    evaluation.complianceStatus === 'IMMEDIATE_REST_REQUIRED'
    || evaluation.aiRiskLevel === 'HIGH'
  ) {
    return { level: 'warning', label: '휴식 필요' };
  }
  if (
    ['REST_SCHEDULED', 'DEADLINE_IMMINENT'].includes(evaluation.complianceStatus)
    || evaluation.aiRiskLevel === 'CAUTION'
  ) {
    return { level: 'caution', label: '주의' };
  }
  return { level: 'normal', label: '정상' };
}

function formatClock(value) {
  if (!value) return '진행 중';
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function formatRange(record) {
  return `${formatClock(record.startedAt)} - ${formatClock(record.endedAt)}`;
}

function formatMinutes(minutes) {
  const value = Math.max(0, Number(minutes) || 0);
  const hours = Math.floor(value / 60);
  const remainder = value % 60;
  if (!hours) return `${remainder}분`;
  if (!remainder) return `${hours}시간`;
  return `${hours}시간 ${remainder}분`;
}

function recordNote(record, recordTab, risk) {
  if (!record.endedAt) {
    return recordTab === 'work'
      ? '현재 작업 시간이 서버에 기록되고 있습니다.'
      : '현재 휴식 시간이 서버에 기록되고 있습니다.';
  }
  if (risk.level === 'warning') {
    return recordTab === 'work'
      ? '저장된 준수 또는 AI 평가에서 휴식 필요 상태가 확인되었습니다.'
      : '휴식 시작 당시 저장된 평가에서 휴식 필요 상태가 확인되었습니다.';
  }
  if (risk.level === 'caution') return '저장된 평가에서 주의 상태가 확인되었습니다.';
  return recordTab === 'work'
    ? '작업 기록이 정상적으로 저장되었습니다.'
    : '휴식 기록이 정상적으로 저장되었습니다.';
}

export default function RecordPage({ active }) {
  const {
    workRecords,
    restRecords,
    recordsLoading,
    recordsError,
    refreshRecords,
    recordTab,
    setRecordTab,
  } = useWorker();

  const summary = useMemo(() => {
    const totalWork = workRecords.reduce((sum, record) => sum + record.durationMinutes, 0);
    const totalRest = restRecords.reduce((sum, record) => sum + record.durationMinutes, 0);
    const temperatures = workRecords.flatMap((record) => {
      const value = record.evaluation?.feelsLikeTemperature;
      return value == null ? [] : [Number(value)];
    }).filter(Number.isFinite);
    const predictedCoreTemperatures = workRecords.flatMap((record) => {
      const value = record.evaluation?.predictedCoreTemperature;
      return value == null ? [] : [Number(value)];
    }).filter(Number.isFinite);
    const average = temperatures.length
      ? temperatures.reduce((sum, value) => sum + value, 0) / temperatures.length
      : null;
    const maxCore = predictedCoreTemperatures.length
      ? Math.max(...predictedCoreTemperatures)
      : null;
    const highestRisk = workRecords.reduce((current, record) => {
      const next = riskFromEvaluation(record.evaluation);
      return RISK_RANK[next.level] > RISK_RANK[current.level] ? next : current;
    }, { level: 'normal', label: workRecords.length ? '정상' : '기록 없음' });
    return { totalWork, totalRest, average, maxCore, highestRisk };
  }, [workRecords, restRecords]);

  const list = recordTab === 'work' ? workRecords : restRecords;
  const typeLabel = recordTab === 'work' ? '작업' : '휴식';

  return (
    <section id="screen-record" className={`screen content-screen ${active ? 'active' : ''}`}>
      <div className="content-wrap record-content-wrap record-simplified-wrap">
        <div className="section-heading compact">
          <p className="eyebrow">HISTORY</p>
          <h1>기록</h1>
          <p>실제로 저장된 오늘의 작업과 휴식 기록을 확인하세요.</p>
        </div>

        <div className="segmented-control" role="tablist">
          <button className={`segment ${recordTab === 'work' ? 'active' : ''}`} type="button" onClick={() => setRecordTab('work')}>작업 기록</button>
          <button className={`segment ${recordTab === 'rest' ? 'active' : ''}`} type="button" onClick={() => setRecordTab('rest')}>휴식 기록</button>
        </div>

        <article className="record-safety-overview record-daily-summary">
          <div className="record-overview-heading record-daily-heading">
            <div>
              <span className="record-overview-eyebrow">DAILY RECORD</span>
              <h2>오늘 기록 요약</h2>
              <p>서버에 저장된 작업·휴식 및 평가 결과입니다.</p>
            </div>
            <span className="record-safe-badge" data-level={summary.highestRisk.level}>{summary.highestRisk.label}</span>
          </div>

          <div className="record-summary-hero-grid">
            <div className="record-summary-hero work-total">
              <span className="record-summary-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="7" /><path d="M12 10v4l3 2" /><path d="M9 3h6M12 3v3" /></svg>
              </span>
              <span className="record-summary-label">총 작업시간</span>
              <strong>{formatMinutes(summary.totalWork)}</strong>
            </div>
            <div className="record-summary-hero core-temp">
              <span className="record-summary-icon" aria-hidden="true"><EkgIcon /></span>
              <span className="record-summary-label">최고 <b>AI 추정</b> 심부체온</span>
              <strong>{summary.maxCore == null ? '-' : `${summary.maxCore.toFixed(1)}°C`}</strong>
              <small>{summary.maxCore == null ? 'AI 평가 미연동' : '실측 체온이 아닌 예측치'}</small>
            </div>
          </div>

          <div className="record-summary-mini-grid">
            <div className="record-summary-mini"><span>작업 횟수</span><strong>{workRecords.length}회</strong></div>
            <div className="record-summary-mini"><span>총 휴식시간</span><strong>{formatMinutes(summary.totalRest)}</strong></div>
            <div className="record-summary-mini"><span>평균 체감온도</span><strong>{summary.average == null ? '-' : `${summary.average.toFixed(1)}°C`}</strong></div>
          </div>

        </article>

        <div className="record-list-heading"><h2>{typeLabel} 기록</h2><span>{list.length}건</span></div>

        {recordsLoading && <div className="record-empty-state">기록을 불러오는 중입니다.</div>}
        {!recordsLoading && recordsError && (
          <div className="record-empty-state">
            <p>{recordsError}</p>
            <button type="button" onClick={() => refreshRecords()}>다시 불러오기</button>
          </div>
        )}
        {!recordsLoading && !recordsError && list.length === 0 && (
          <div className="record-empty-state">아직 {typeLabel} 기록이 없습니다.</div>
        )}

        {!recordsLoading && !recordsError && (
          <div className="record-list">
            {list.map((record) => {
              const risk = riskFromEvaluation(record.evaluation);
              const temperature = record.evaluation?.feelsLikeTemperature;
              const core = record.evaluation?.predictedCoreTemperature;
              return (
                <article key={record.id} className={`card record-item risk-${risk.level}`}>
                  <div className="record-item-top">
                    <div className="record-item-title">
                      <span className="record-risk-icon" aria-hidden="true"><EkgIcon /></span>
                      <div><strong>{formatRange(record)}</strong><small>{record.endedAt ? `${typeLabel} 기록` : `${typeLabel} 진행 중`}</small></div>
                    </div>
                    <span className="record-risk-badge">{risk.label}</span>
                  </div>

                  <div className="record-item-body">
                    <div className="record-duration-block"><span>{typeLabel}시간</span><strong>{formatMinutes(record.durationMinutes)}</strong></div>
                    <div className="record-metric-stack">
                      <div className="record-metric-chip apparent"><span>체감온도</span><strong>{temperature == null ? '-' : `${Number(temperature).toFixed(1)}°C`}</strong></div>
                      <div className={`record-metric-chip core risk-${risk.level}`}>
                        <span><b>AI 추정</b> 심부체온</span><strong>{core == null ? '-' : `${Number(core).toFixed(1)}°C`}</strong>
                      </div>
                    </div>
                  </div>
                  <p className="record-item-note">{recordNote(record, recordTab, risk)}</p>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
