import {
  ErrorResponseSchema,
  SessionResponseSchema,
  type SessionResponse,
} from '@leadflow-ai/domain';
import { createContext, useContext } from 'react';

export const LOCAL_SESSION: SessionResponse = {
  schemaVersion: 'session-response-v1',
  mode: 'local',
  operator: 'local-operator',
  authentication: 'none-loopback',
};

type AuthFailure = 'expired' | 'denied';
const listeners = new Set<(failure: AuthFailure) => void>();

function authFailureOf(status: number, payload: unknown): AuthFailure | null {
  const parsed = ErrorResponseSchema.safeParse(payload);
  if (!parsed.success) {
    if (status === 401) return 'expired';
    if (status === 403) return 'denied';
    return null;
  }
  if (parsed.data.error.code === 'authentication_required') return 'expired';
  if (parsed.data.error.code === 'access_denied' && status === 403) {
    return parsed.data.error.category === 'access' ? 'denied' : null;
  }
  return null;
}

// Every API call goes through here. The header tells IAP the request comes
// from script, so an expired session yields 401 rather than a sign-in
// redirect; an authentication denial stops the whole interface.
export const apiFetch: typeof fetch = async (input, init = {}) => {
  const headers = new Headers(init.headers);
  headers.set('X-Requested-With', 'XMLHttpRequest');
  const response = await fetch(input, {
    ...init,
    headers,
    credentials: 'same-origin',
  });
  if (response.status === 401 || response.status === 403) {
    let payload: unknown = null;
    try {
      payload = await response.clone().json();
    } catch {
      // IAP's own denial pages are not JSON; the status still decides.
    }
    const failure = authFailureOf(response.status, payload);
    if (failure !== null) for (const listener of listeners) listener(failure);
  }
  return response;
};

export function onAuthFailure(listener: (failure: AuthFailure) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export type SessionState =
  | { status: 'loading' }
  | { status: 'ready'; session: SessionResponse }
  | { status: 'expired' }
  | { status: 'denied' }
  | { status: 'unavailable' };

export const SessionContext = createContext<SessionResponse>(LOCAL_SESSION);

export function useSession(): SessionResponse {
  return useContext(SessionContext);
}

export type SessionLoader = () => Promise<SessionState>;

export const loadSession: SessionLoader = async () => {
  let response: Response;
  try {
    response = await apiFetch('/v1/session', {
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { status: 'unavailable' };
  }
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // An IAP page or proxy error is handled by status below.
  }
  if (response.ok) {
    const parsed = SessionResponseSchema.safeParse(payload);
    return parsed.success
      ? { status: 'ready', session: parsed.data }
      : { status: 'unavailable' };
  }
  const failure = authFailureOf(response.status, payload);
  if (failure === 'expired') return { status: 'expired' };
  if (failure === 'denied' || response.status === 403) {
    return { status: 'denied' };
  }
  return { status: 'unavailable' };
};
