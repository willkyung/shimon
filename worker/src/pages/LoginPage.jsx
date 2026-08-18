import { useState } from 'react';
import { useWorker } from '../context/WorkerContext';

export default function LoginPage({ active }) {
  const { navigate, login } = useWorker();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    login({ name: name.trim(), password });
  };

  return (
    <section id="screen-login" className={`screen auth-screen ${active ? 'active' : ''}`}>
      <div className="auth-card">
        <div className="auth-topbar">
          <button className="back-button auth-back" type="button" onClick={() => navigate('welcome')} aria-label="뒤로 가기">←</button>
        </div>

        <div className="auth-content">
          <div className="section-heading">
            <p className="eyebrow">WELCOME BACK</p>
            <h1>로그인</h1>
            <p>이름과 비밀번호를 입력해주세요.</p>
          </div>

          <form className="form-stack" onSubmit={handleSubmit}>
            <label className="field">
              <span>이름</span>
              <input value={name} onChange={(e) => setName(e.target.value)} type="text" placeholder="이름 입력" autoComplete="username" required />
            </label>

            <label className="field">
              <span>비밀번호</span>
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="비밀번호 입력" autoComplete="current-password" required />
            </label>

            <label className="check-row">
              <input type="checkbox" />
              <span>로그인 상태 유지</span>
            </label>

            <button className="btn btn-primary" type="submit">로그인</button>
          </form>

          <div className="demo-box">
            <strong>프로토타입 테스트 계정</strong>
            <span>노동자: 김철수 / 1234</span>
            <span>관리자: 관리자 / 1234</span>
          </div>

          <p className="switch-copy">
            계정이 없으신가요?{' '}
            <button className="text-link" type="button" onClick={() => navigate('signup')}>회원가입</button>
          </p>
        </div>
      </div>
    </section>
  );
}
