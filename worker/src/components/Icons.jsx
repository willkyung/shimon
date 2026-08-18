export function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </svg>
  );
}

export function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v10h13V10" />
      <path d="M9.5 20v-6h5v6" />
    </svg>
  );
}

export function RecordIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h6" />
    </svg>
  );
}

export function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 21c.8-4.2 3.2-6.2 7.5-6.2s6.7 2 7.5 6.2" />
    </svg>
  );
}

export function EkgIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 12h4l1.7-3.5 3.1 7.3 2.2-5 1.3 2.6H21" />
    </svg>
  );
}

export function ThermometerIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 4a2 2 0 0 0-4 0v9.1a5 5 0 1 0 4 0V4Z" />
      <path d="M12 8v7" />
    </svg>
  );
}

export function ShieldIcon({ check = false }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 20 6v5c0 5.2-3.5 8.2-8 10-4.5-1.8-8-4.8-8-10V6l8-3Z" />
      {check ? <path d="m9 12 2 2 4-4" /> : <><path d="M12 8v5" /><path d="M12 16.5h.01" /></>}
    </svg>
  );
}

export function WaterIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3S6 10 6 15a6 6 0 0 0 12 0c0-5-6-12-6-12Z" />
      <path d="M9 16c.5 1.4 1.5 2 3 2" />
    </svg>
  );
}
