export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, code?: string) {
    super(code ?? `Request failed with status ${status}`);
    this.status = status;
    this.code = code;
  }
}

export async function apiFetch(url: string, options?: RequestInit): Promise<unknown> {
  const res = await fetch(url, options);
  if (!res.ok) {
    let code: string | undefined;
    try {
      const body = await res.json();
      code = (body as { error?: string })?.error;
    } catch {
      // ignore parse errors
    }
    throw new ApiError(res.status, code);
  }
  const contentType = res.headers.get('Content-Type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error('Unexpected response format');
  }
  return res.json();
}

export async function apiPost(url: string, body: unknown): Promise<unknown> {
  return apiFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
