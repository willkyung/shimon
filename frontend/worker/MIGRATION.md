# 기존 Worker → React 매핑

| 기존 | React |
|---|---|
| `showWorkerScreen()` | `WorkerContext.navigate()` |
| `currentUser` 전역 변수 | `WorkerContext.currentUser` |
| `workSeconds`, `workState` | Context state + `useEffect` interval |
| `restSeconds`, `restTimerId` | Context state + `useEffect` interval |
| `renderRecords()` + `innerHTML` | `RecordPage.jsx` JSX 렌더 |
| `syncUserUI()` | 각 컴포넌트가 `currentUser` props/state 직접 사용 |
| `showToast()` DOM class 조작 | `toastMessage` state + `<Toast />` |
| `updateHomeEstimatedCoreTemp()` | `estimatedCoreTemp` state + derived level |
| 회원가입 DOM 조회 | `SignupPage` controlled form |
| 프로필 수정 DOM 조회 | `SettingsPage` controlled form |

React 전환 과정에서 기존 worker 파일에 남아 있던 관리자 전용 DOM 함수는 worker React 앱에서 제거했습니다. 관리자 설정 값 중 worker가 사용하는 `maxWorkMinutes`, `restMinutes`는 `shimonAdminSettings` localStorage에서 계속 읽습니다.
