# SHIMON Admin React

기존 `admin/index.html + script.js + style.css` 관리자 화면을 React + Vite 구조로 옮긴 버전입니다.

## 실행

```bash
npm install
npm run dev
```

## 구조

```text
admin-react/
├─ public/
│  └─ shimon-logo.png
├─ src/
│  ├─ components/
│  │  ├─ Icon.jsx
│  │  ├─ Sidebar.jsx
│  │  ├─ Toast.jsx
│  │  └─ Topbar.jsx
│  ├─ context/
│  │  └─ AdminContext.jsx
│  ├─ data/
│  │  └─ adminData.js
│  ├─ pages/
│  │  ├─ AlertsPage.jsx
│  │  ├─ AuthPage.jsx
│  │  ├─ DashboardPage.jsx
│  │  ├─ SettingsPage.jsx
│  │  └─ WorkersPage.jsx
│  ├─ utils/
│  │  └─ adminUtils.js
│  ├─ App.jsx
│  ├─ main.jsx
│  └─ styles.css
├─ index.html
├─ package.json
└─ vite.config.js
```

## React 전환 내용

- 관리자 로그인 / 2단계 회원가입 → React controlled form
- `showAuthView()` → `authView` state
- `showAdminPage()` → `page` state
- 노동자 검색 / 상태 필터 / 정렬 → React state + `useMemo`
- `innerHTML`로 생성하던 노동자 테이블 → JSX `.map()`
- 위험 알림 카드 → JSX `.map()`
- 현장 필터 → `siteFilter` state
- 관리자 설정 → controlled state + localStorage
- 관리자 로그인 세션 → sessionStorage
- CSV 내보내기 기능 유지
- AI 추정 심부체온 `37.5℃ 주의 / 38.0℃ 고위험` 기본 기준 유지
- 현재 업로드한 관리자 CSS와 로고를 그대로 재사용
