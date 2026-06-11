import { useEffect, useRef } from 'react';

export function useSSE(onMessage: (data: unknown) => void) {
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const url = `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/stats/events`;
    const es = new EventSource(`${url}?token=${token}`);
    sourceRef.current = es;

    es.onmessage = (e) => {
      try { onMessage(JSON.parse(e.data)); } catch { /* ignorer */ }
    };

    es.onerror = () => {
      es.close();
      // Reconnexion après 5 secondes
      setTimeout(() => sourceRef.current?.dispatchEvent(new Event('open')), 5000);
    };

    return () => es.close();
  }, [onMessage]);
}
