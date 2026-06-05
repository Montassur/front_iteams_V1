import type { AuthSession } from '../types/auth';

const SESSION_KEY = 'meetsync.auth.session';

function hasWindow() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

export function loadSession(): AuthSession | null {
  if (!hasWindow()) return null;
  // prefer sessionStorage (non-persistent) then localStorage
  const rawSession = window.sessionStorage.getItem(SESSION_KEY) || window.localStorage.getItem(SESSION_KEY);
  if (!rawSession) return null;

  try {
    return JSON.parse(rawSession) as AuthSession;
  } catch {
    window.sessionStorage.removeItem(SESSION_KEY);
    window.localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function saveSession(session: AuthSession) {
  if (!hasWindow()) return;
  const serialized = JSON.stringify(session);
  if (session.remember) {
    window.localStorage.setItem(SESSION_KEY, serialized);
    window.sessionStorage.removeItem(SESSION_KEY);
  } else {
    window.sessionStorage.setItem(SESSION_KEY, serialized);
    window.localStorage.removeItem(SESSION_KEY);
  }
}

export function clearSession() {
  if (!hasWindow()) return;
  window.localStorage.removeItem(SESSION_KEY);
  window.sessionStorage.removeItem(SESSION_KEY);
}

