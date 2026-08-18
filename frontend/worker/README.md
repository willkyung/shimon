# SHIMON Worker Frontend

작업자용 React + Vite 애플리케이션입니다. 회원가입, 로그인, 로그인 상태 복구는
FastAPI 인증 API와 연결되어 있습니다.

## 실행

루트에서 PostgreSQL, 마이그레이션, FastAPI를 먼저 실행합니다.

```bash
docker compose up -d
./.venv/Scripts/python.exe -m alembic upgrade head
export JWT_SECRET="development-only-secret-at-least-32-characters"
./.venv/Scripts/python.exe -m uvicorn backend.app.main:app --reload --port 8000
```

별도 터미널에서 worker 앱을 실행합니다.

```bash
cd frontend/worker
npm install
npm run dev
```

접속 주소: `http://localhost:5173`

## 회원가입 조건

- 회사와 작업 구역은 관리자가 먼저 등록해야 합니다.
- 사용자는 회사명과 작업 구역명을 입력하며 사번은 서버에서 자동 생성됩니다.
- 로그인 아이디는 가입할 때 등록한 이메일입니다.
- 역할은 `WORKER`로 고정됩니다.

비밀번호는 브라우저 저장소에 보관하지 않습니다. JWT만 저장하며 로그인 유지 선택 시
`localStorage`, 선택하지 않으면 `sessionStorage`를 사용합니다.
