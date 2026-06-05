import { api } from '../services/api';
import { buildDisplayUser } from '../utils/avatar';
import type {
  AuthApiResponse,
  AuthLoginRequest,
  AuthRegisterRequest,
  AuthSession,
  CompleteCompanyRequestPayload,
  GoogleAuthRequestPayload,
  GoogleAuthResult,
  MicrosoftAuthRequestPayload,
  OtpVerifyRequest,
} from '../types/auth';

type AuthResult = AuthSession | { otpRequired: true };

function toSession(response: { token: string; user: NonNullable<AuthApiResponse['user']> }): AuthSession {
  return {
    token: response.token,
    user: buildDisplayUser(response.user),
  };
}

export async function login(payload: AuthLoginRequest): Promise<AuthResult> {
  const response = await api.post<AuthApiResponse>('/auth/login', {
    email: payload.email,
    password: payload.password,
    rememberMe: payload.remember,
  });
  if (response.otpRequired) return { otpRequired: true };
  if (!response.token || !response.user) throw new Error('Réponse de connexion invalide');
  const session = toSession(response as { token: string; user: NonNullable<AuthApiResponse['user']> });
  return { ...session, remember: payload.remember };
}

export async function register(payload: AuthRegisterRequest): Promise<AuthResult> {
  const response = await api.post<AuthApiResponse>('/auth/register', {
    name: payload.name,
    email: payload.email,
    password: payload.password,
    companyName: payload.companyName,
    registryNumber: payload.registryNumber,
    rememberMe: payload.remember,
  });
  if (response.otpRequired) return { otpRequired: true };
  if (!response.token || !response.user) throw new Error('Réponse d’inscription invalide');
  const session = toSession(response as { token: string; user: NonNullable<AuthApiResponse['user']> });
  return { ...session, remember: payload.remember };
}

export async function googleAuth(payload: GoogleAuthRequestPayload): Promise<GoogleAuthResult> {
  const response = await api.post<AuthApiResponse>('/auth/google', {
    credential: payload.credential,
    rememberMe: payload.remember,
  });
  if (!response.token || !response.user) throw new Error('Réponse Google invalide');
  const session = toSession(response as { token: string; user: NonNullable<AuthApiResponse['user']> });
  return { ...session, remember: payload.remember, needsCompany: Boolean(response.needsCompany) } as GoogleAuthResult;
}

export async function microsoftAuth(payload: MicrosoftAuthRequestPayload): Promise<GoogleAuthResult> {
  const response = await api.post<AuthApiResponse>('/auth/microsoft', {
    idToken: payload.idToken,
    rememberMe: payload.remember,
  });
  if (!response.token || !response.user) throw new Error('Réponse Microsoft invalide');
  const session = toSession(response as { token: string; user: NonNullable<AuthApiResponse['user']> });
  return { ...session, remember: payload.remember, needsCompany: Boolean(response.needsCompany) } as GoogleAuthResult;
}

export async function completeCompany(payload: CompleteCompanyRequestPayload & { token: string }): Promise<AuthSession> {
  const base = import.meta.env.VITE_API_URL as string;
  const res = await fetch(`${base}/auth/complete-company`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${payload.token}`,
    },
    body: JSON.stringify({
      companyName: payload.companyName,
      registryNumber: payload.registryNumber,
    }),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => null) as { message?: string; error?: string; detail?: string } | null;
    throw new Error(errBody?.detail || errBody?.message || errBody?.error || `${res.status} ${res.statusText}`);
  }
  const response = await res.json() as AuthApiResponse;
  if (!response.token || !response.user) throw new Error('Réponse invalide');
  return toSession(response as { token: string; user: NonNullable<AuthApiResponse['user']> });
}

export async function verifyOtp(payload: OtpVerifyRequest): Promise<AuthSession> {
  const response = await api.post<AuthApiResponse>('/auth/verify-otp', {
    email: payload.email,
    code: payload.code,
    rememberMe: payload.remember,
  });
  if (!response.token || !response.user) throw new Error('Réponse OTP invalide');
  const session = toSession(response as { token: string; user: NonNullable<AuthApiResponse['user']> });
  return { ...session, remember: payload.remember };
}


