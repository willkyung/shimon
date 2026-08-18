import { useWorker } from '../context/WorkerContext';

export default function Toast() {
  const { toastMessage } = useWorker();
  return (
    <div id="toast" className={`toast ${toastMessage ? 'show' : ''}`} role="status" aria-live="polite">
      {toastMessage}
    </div>
  );
}
