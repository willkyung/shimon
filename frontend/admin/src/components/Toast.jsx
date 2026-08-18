import { useAdmin } from '../context/AdminContext';

export default function Toast() {
  const { toastMessage } = useAdmin();

  return (
    <div className={`toast ${toastMessage ? 'show' : ''}`} role="status" aria-live="polite">
      {toastMessage}
    </div>
  );
}
