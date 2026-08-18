# SHIMON Admin Frontend

관리자용 React + Vite 애플리케이션입니다. 공개 관리자 회원가입은 지원하지 않으며,
백엔드에 미리 생성된 `ADMIN` 계정만 로그인할 수 있습니다.

## 관리자 계정

공개 관리자 회원가입은 지원하지 않습니다. 운영자가 사전에 등록한 관리자 이메일과
비밀번호로 로그인합니다.

## 실행

FastAPI를 `http://localhost:8000`에서 실행한 뒤:

```bash
cd frontend/admin
npm install
npm run dev
```

접속 주소: `http://localhost:5174`

관리자 JWT는 탭이 종료되면 사라지도록 `sessionStorage`에만 저장합니다.
