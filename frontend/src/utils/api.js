// Frontend API client.
// Dev: Vite proxies /api/* to localhost:8000 (vite.config.js)
// Prod: set VITE_API_BASE in Netlify env to your Render backend URL

const API_BASE = (import.meta.env.VITE_API_BASE || '') + '/api';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let detail = `Request failed: ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {}
    throw new Error(detail);
  }
  return res.json();
}

export const api = {
  // Workflows
  listWorkflows:  ()  => request('/workflows'),
  getWorkflow:    id  => request(`/workflows/${id}`),
  deleteWorkflow: id  => request(`/workflows/${id}`, { method: 'DELETE' }),

  // Reference
  listAgents:    () => request('/agents'),
  listTools:     () => request('/tools'),
  listTemplates: () => request('/templates'),
  stats:         () => request('/stats'),

  // Health probe
  ping: () => fetch(`${API_BASE.replace('/api', '/')}`).then(r => r.ok),
};

/**
 * Stream a multi-agent workflow via SSE.
 * Returns an unsubscribe function.
 */
export function streamWorkflow(payload, handlers) {
  const controller = new AbortController();

  fetch(`${API_BASE}/workflow/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) {
        const text = await res.text();
        let msg = `Stream failed: ${res.status}`;
        try { msg = JSON.parse(text).detail || msg; } catch {}
        handlers.onError?.(new Error(msg));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const block of events) {
          const lines = block.split('\n');
          let event = 'message';
          let data = '';
          for (const ln of lines) {
            if (ln.startsWith('event: ')) event = ln.slice(7).trim();
            else if (ln.startsWith('data: ')) data += ln.slice(6);
          }
          if (data) {
            try {
              const parsed = JSON.parse(data);
              handlers.onEvent?.(event, parsed);
            } catch (e) {
              handlers.onError?.(e);
            }
          }
        }
      }
      handlers.onClose?.();
    })
    .catch((e) => {
      if (e.name !== 'AbortError') handlers.onError?.(e);
    });

  return () => controller.abort();
}
