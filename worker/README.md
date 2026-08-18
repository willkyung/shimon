# SHIMON Worker React

기존 `worker/index.html + script.js + style.css` 구조를 React + Vite 구조로 옮긴 버전입니다.

## 실행

```bash
npm install
npm run dev
```

같은 Wi-Fi의 휴대폰에서도 확인하려면:

```bash
npm run dev -- --host 0.0.0.0
```

Vite가 보여주는 Network 주소를 휴대폰 브라우저에서 열면 됩니다.

## 구조

```text
worker-react/
├─ public/
│  └─ shimon-logo.png
├─ src/
│  ├─ components/
│  │  ├─ BottomNav.jsx
│  │  ├─ Header.jsx
│  │  ├─ Icons.jsx
│  │  └─ Toast.jsx
│  ├─ context/
│  │  └─ WorkerContext.jsx
│  ├─ data/
│  │  └─ demoData.js
│  ├─ pages/
│  │  ├─ HomePage.jsx
│  │  ├─ LoginPage.jsx
│  │  ├─ MyPage.jsx
│  │  ├─ NotificationsPage.jsx
│  │  ├─ RecordPage.jsx
│  │  ├─ RestAlertPage.jsx
│  │  ├─ RestProgressPage.jsx
│  │  ├─ SettingsPage.jsx
│  │  ├─ SignupPage.jsx
│  │  ├─ WelcomePage.jsx
│  │  └─ WorkProgressPage.jsx
│  ├─ utils/
│  │  └─ format.js
│  ├─ App.jsx
│  ├─ main.jsx
│  └─ styles.css
├─ index.html
├─ package.json
└─ vite.config.js
```

## 기존 코드에서 바뀐 핵심

- `onclick="..."` → React `onClick`
- `onsubmit="..."` → React `onSubmit`
- `document.getElementById()`로 값 변경 → React state/props
- `setInterval()` 전역 변수 → `useEffect()` 기반 타이머
- 화면 `classList.toggle('active')` → `screen` state
- 회원/알림/작업/휴식/기록 상태 → `WorkerContext`
- 기록 `innerHTML` 생성 → JSX `.map()`
- `localStorage`의 `shimonUser`, `shimonAdminSettings` 연동 유지
- AI 추정 심부체온은 `37.5℃ 주의 / 38.0℃ 고위험` 로직 유지
- 신체 질환 필드는 React 회원가입 데이터에서도 수집하지 않음

## CSS

기존 worker CSS를 `src/styles.css`로 그대로 재사용했습니다. 기존 클래스와 ID를 최대한 유지해서 디자인 변화가 최소화되도록 구성했습니다.

## 관리자 화면 이동

프로토타입 관리자 계정으로 로그인하면 기존 동작처럼 `../admin/index.html`로 이동합니다.
React worker만 단독 Vite 서버로 띄운 경우에는 admin 경로가 제공되지 않을 수 있으므로, 실제 통합 단계에서는 Router/API 구성에 맞춰 경로를 조정하세요.
