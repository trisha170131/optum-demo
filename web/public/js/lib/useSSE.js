import { useEffect } from '../react-setup.js';

export function useSSE(onEvent) {
  useEffect(() => {
    // Optional: Connect to SSE stream if available
    try {
      const eventSource = new EventSource('/api/ledgers/stream');
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (onEvent) onEvent({ type: 'ledger.updated', data });
        } catch (err) {
          console.error('Error parsing SSE event:', err);
        }
      };
      eventSource.onerror = () => {
        eventSource.close();
      };
      return () => eventSource.close();
    } catch (err) {
      console.debug('SSE not available:', err);
    }
  }, [onEvent]);
}
