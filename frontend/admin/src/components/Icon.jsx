const paths = {
  grid: (
    <>
      <rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="14" y="3.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="3.5" y="14" width="6.5" height="6.5" rx="1.5" />
      <rect x="14" y="14" width="6.5" height="6.5" rx="1.5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.4" />
      <path d="M3.7 19.2c.5-4 2.3-6 5.3-6s4.8 2 5.3 6" />
      <circle cx="17.2" cy="9.2" r="2.4" />
      <path d="M15.5 14.3c3.1-.4 4.8 1.2 5.2 4.2" />
    </>
  ),
  bell: (
    <>
      <path d="M18 9a6 6 0 0 0-12 0c0 6-2.8 6.6-2.8 8.2h17.6C20.8 15.6 18 15 18 9" />
      <path d="M9.7 20h4.6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M19.1 13.5 21 15l-2 3.5-2.4-1a8.7 8.7 0 0 1-2.4 1.4L14 21.5h-4l-.3-2.6a8.7 8.7 0 0 1-2.4-1.4l-2.4 1-2-3.5 1.9-1.5a8.3 8.3 0 0 1 0-3L3 9l2-3.5 2.4 1a8.7 8.7 0 0 1 2.4-1.4L10 2.5h4l.3 2.6a8.7 8.7 0 0 1 2.4 1.4l2.4-1 2 3.5-1.9 1.5a8.3 8.3 0 0 1 0 3Z" />
    </>
  ),
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.3" />
      <path d="m15.5 15.5 4.5 4.5" />
    </>
  ),
  sort: (
    <>
      <path d="M8 4v16M5 7l3-3 3 3M16 20V4M13 17l3 3 3-3" />
    </>
  ),
  export: (
    <>
      <path d="M12 3v11" />
      <path d="m8 10 4 4 4-4" />
      <path d="M5 16v4h14v-4" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 20 6v5.4c0 4.7-3.1 8-8 9.6-4.9-1.6-8-4.9-8-9.6V6l8-3Z" />
      <path d="M7.1 12h2.4l1.2-2.4 2.1 5 1.5-3H17" />
    </>
  ),
  pulse: <path d="M3 12h4l1.6-3.5 3.2 7.5 2.2-5 1.2 2.5H21" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3.2 2" />
    </>
  ),
  phone: <path d="M7.5 3.5h2.2l1.3 4-1.8 1.6a15 15 0 0 0 5.8 5.8l1.6-1.8 4 1.3v2.2c0 2-1.6 3.6-3.6 3.4C9.4 19.1 4.9 14.6 4 7c-.2-2 1.4-3.5 3.5-3.5Z" />,
  user: (
    <>
      <circle cx="12" cy="8" r="3.7" />
      <path d="M4.5 20c.7-4.3 3.2-6.4 7.5-6.4s6.8 2.1 7.5 6.4" />
    </>
  ),
  logout: (
    <>
      <path d="M10 4H5v16h5" />
      <path d="M13 8l4 4-4 4M17 12H9" />
    </>
  ),
  chevron: <path d="m9 5 7 7-7 7" />,
  check: <path d="m5 12 4 4 10-10" />,
  alert: (
    <>
      <path d="m12 3 9 17H3l9-17Z" />
      <path d="M12 9v5M12 17.2v.1" />
    </>
  ),
};

export default function Icon({ name, className = '', ...props }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" {...props}>
      {paths[name] || paths.shield}
    </svg>
  );
}
