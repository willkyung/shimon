# SHIMON Legacy Admin Frontend

이 디렉터리는 기존 데스크톱 관리자 UI의 참고용 코드입니다. 해커톤 MVP의 기본 진입점이나 실행 대상이 아닙니다.

MVP에서는 `frontend/worker` 하나만 실행합니다. 공통 이메일/비밀번호 로그인 후 백엔드의 사용자 역할이 `WORKER`이면 노동자 화면, `ADMIN`이면 같은 모바일 PWA 안의 관리자 대시보드로 이동합니다.

```bash
cd frontend/worker
npm install
npm run dev
```

기본 접속 주소는 `http://localhost:5173`입니다. 별도의 `frontend/admin` 개발 서버를 실행할 필요가 없습니다.
