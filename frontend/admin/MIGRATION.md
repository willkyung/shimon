# Admin 기존 코드 → React 매핑

| 기존 JavaScript | React |
|---|---|
| `currentAdmin` | `AdminContext.currentAdmin` |
| `verifiedAdmin` | `AuthPage` local state |
| `showAuthView()` | `authView` state |
| `showAdminPage()` | `page` state |
| `currentStatusFilter` | `statusFilter` state |
| `currentSiteFilter` | `siteFilter` state |
| `renderDashboard()` | `<DashboardPage />` |
| `renderDashboardInsights()` | Context derived metrics |
| `renderPriorityList()` | JSX `.map()` |
| `renderWorkerManagement()` | `<WorkersPage />` + `useMemo()` |
| `workerRowMarkup()` | React table row JSX |
| `renderAlerts()` | `<AlertsPage />` JSX |
| `saveAdminSettings()` | `saveSettings()` |
| `toggleSettingsChannel()` | controlled `channels` state |
| `showToast()` | `toastMessage` state + `<Toast />` |

기존 CSS 클래스명을 최대한 유지해서 React 전환으로 인한 디자인 변경을 최소화했습니다.
