import { useMemo, useState } from 'react';
import Icon from '../components/Icon';
import { useAdmin } from '../context/AdminContext';
import {
  coreTempClass,
  coreTempLabel,
  minutesToDisplay,
  statusLabel,
  tempClass,
} from '../utils/adminUtils';

export default function WorkersPage() {
  const {
    siteWorkers,
    statusFilter,
    setStatusFilter,
    settings,
    sendWorkerRestAlert,
    exportWorkerCSV,
    getSortedWorkers,
  } = useAdmin();

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('priority');

  const workers = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const filtered = siteWorkers.filter((worker) => {
      const searchable = [worker.name, worker.jobType, worker.phone, worker.site].join(' ').toLowerCase();
      const queryMatches = !needle || searchable.includes(needle);
      const statusMatches = statusFilter === 'all' || worker.status === statusFilter;
      return queryMatches && statusMatches;
    });

    return getSortedWorkers(filtered, sort);
  }, [siteWorkers, query, sort, statusFilter, getSortedWorkers]);

  return (
    <section className="admin-page active">
      <div className="page-intro-row">
        <div>
          <p>WORKER MANAGEMENT</p>
          <h2>노동자 현황</h2>
          <span>체감온도·AI 추정 심부체온·작업 상태·작업시간을 함께 비교합니다.</span>
        </div>

        <button className="export-button large" type="button" onClick={exportWorkerCSV}>
          <Icon name="export" />
          노동자 현황 CSV
        </button>
      </div>

      <div className="worker-toolbar">
        <label className="worker-toolbar-search">
          <Icon name="search" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="이름, 작업 유형, 연락처 검색" />
        </label>

        <div className="status-filter" role="group" aria-label="상태 필터">
          {[
            ['all', '전체'],
            ['working', '작업중'],
            ['resting', '휴식중'],
            ['rest-needed', '휴식필요'],
          ].map(([key, label]) => (
            <button key={key} className={statusFilter === key ? 'active' : ''} type="button" onClick={() => setStatusFilter(key)}>
              {label}
            </button>
          ))}
        </div>

        <label className="toolbar-sort">
          <Icon name="sort" />
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="priority">휴식 필요 우선</option>
            <option value="temp-desc">체감온도 높은 순</option>
            <option value="core-desc">추정 심부체온 높은 순</option>
            <option value="work-desc">하루 작업시간 긴 순</option>
            <option value="name">이름순</option>
          </select>
        </label>
      </div>

      <article className="management-table-panel">
        <div className="worker-sheet-wrap">
          <table className="worker-sheet management-sheet">
            <thead>
              <tr>
                <th>노동자명</th>
                <th>작업 유형</th>
                <th>연락처</th>
                <th>작업복 유무</th>
                <th>체감온도</th>
                <th><span className="table-core-heading">추정 심부체온 <b>AI</b></span></th>
                <th>최근 작업 시작</th>
                <th>최근 작업 중단</th>
                <th>하루 작업시간</th>
                <th>상태</th>
                <th>조치</th>
              </tr>
            </thead>

            <tbody>
              {workers.map((worker) => {
                const coreClass = coreTempClass(worker.coreTemp, settings);

                return (
                  <tr key={worker.id} className={`risk-row risk-${worker.risk}`} data-risk={worker.risk}>
                    <td>
                      <div className="worker-person">
                        <span className="worker-person-avatar">{worker.name.slice(0, 1)}</span>
                        <div className="worker-person-copy"><strong>{worker.name}</strong><small>{worker.site}</small></div>
                      </div>
                    </td>
                    <td>{worker.jobType}</td>
                    <td>{worker.phone}</td>
                    <td><span className={`ppe-value ${worker.uniform === '미착용' ? 'missing' : ''}`}>{worker.uniform}</span></td>
                    <td><span className={`temp-value ${tempClass(worker.apparentTemp)}`}>{worker.apparentTemp}°C</span></td>
                    <td>
                      <div className={`core-temp-cell ${coreClass}`}>
                        <strong>{worker.coreTemp.toFixed(1)}°C</strong>
                        <span>{coreTempLabel(worker.coreTemp, settings)}</span>
                        <small>AI 추정</small>
                      </div>
                    </td>
                    <td>{worker.lastStart}</td>
                    <td>{worker.lastStop}</td>
                    <td>{minutesToDisplay(worker.dailyMinutes)}</td>
                    <td><span className={`worker-status-chip ${worker.status}`}>{statusLabel(worker.status)}</span></td>
                    <td>
                      <button
                        className={`row-action ${worker.status === 'rest-needed' ? 'danger' : ''}`}
                        type="button"
                        onClick={() => sendWorkerRestAlert(worker.name)}
                      >
                        {worker.status === 'rest-needed' ? '즉시 휴식' : '알림'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!workers.length && <p className="empty-state">조건에 맞는 노동자가 없습니다.</p>}
      </article>
    </section>
  );
}
