import { useWorker } from '../context/WorkerContext';

export default function WelcomePage({ active }) {
  const { navigate } = useWorker();

  return (
    <section id="screen-welcome" className={`screen splash-screen ${active ? 'active' : ''}`}>
      <div className="splash-noise" aria-hidden="true" />

      <div className="splash-hero">
        <div className="splash-logo-stage" aria-hidden="true">
          <span className="splash-glow glow-one" />
          <span className="splash-glow glow-two" />
          <span className="splash-orbit orbit-one" />
          <span className="splash-orbit orbit-two" />
          <img className="splash-logo" src="/shimon-logo.png" alt="SHIMON" />
        </div>

        <div className="splash-wordmark">SHIMON</div>
        <p className="splash-eyebrow">AI 기반 폭염 옥외 노동자 안전관리</p>
        <h1>더위가 위험해지기 전에,<br />쉼이 먼저 시작됩니다.</h1>
      </div>

      <div className="splash-features">
        <div className="splash-feature">
          <span className="feature-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M14 4a2 2 0 0 0-4 0v9.1a5 5 0 1 0 4 0V4Z" />
              <path d="M12 8v7" />
            </svg>
          </span>
          <span className="feature-copy"><strong>체감온도 모니터링</strong></span>
        </div>

        <div className="splash-feature">
          <span className="feature-icon feature-icon-gradient">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="8" />
              <path d="M12 7v5l3 2" />
              <path d="M4 12h3l1.4-2.4 2.3 5.1 2-4 1.4 2.3H20" />
            </svg>
          </span>
          <span className="feature-copy"><strong>스마트 휴식 안내</strong></span>
        </div>

        <div className="splash-feature">
          <span className="feature-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18 8a6 6 0 0 0-12 0c0 6-2.6 6.7-2.6 8.3h17.2C20.6 14.7 18 14 18 8Z" />
              <path d="M9.5 20h5" />
            </svg>
          </span>
          <span className="feature-copy"><strong>위험 알림·안전 기록</strong></span>
        </div>
      </div>

      <div className="splash-signature" aria-hidden="true">
        <svg viewBox="0 0 430 92" preserveAspectRatio="none">
          <path className="signature-grid" d="M0 48H430" />
          <path className="signature-pulse" d="M-30 48 H56 L75 48 L88 33 L104 65 L122 12 L141 61 L157 40 L174 48 H238 L252 48 L264 35 L276 62 L292 22 L308 58 L324 42 L340 48 H460" />
        </svg>
        <div className="splash-cityline" />
      </div>

      <div className="splash-actions">
        <button className="btn btn-splash" type="button" onClick={() => navigate('signup')}>
          <span>회원가입</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" /></svg>
        </button>

        <p className="splash-switch">
          이미 계정이 있으신가요?{' '}
          <button className="splash-link" type="button" onClick={() => navigate('login')}>로그인</button>
        </p>
      </div>
    </section>
  );
}
