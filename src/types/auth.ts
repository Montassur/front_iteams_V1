import type { User } from './index';

export interface AuthApiUser {
  id?: number;
  name: string;
  email: string;
  globalRole?: string | null;
}

export interface AuthLoginRequest {
  email: string;
  password: string;
  remember?: boolean;
}

export interface AuthRegisterRequest extends AuthLoginRequest {
  name: string;
  companyName: string;
  registryNumber: string;
}

export interface OtpVerifyRequest {
  email: string;
  code: string;
  remember?: boolean;
}

export interface AuthSession {
  token: string;
  user: User;
  remember?: boolean;
}

export interface AuthApiResponse {
  token?: string;
  user?: AuthApiUser;
  otpRequired?: boolean;
  needsCompany?: boolean;
}

export interface GoogleAuthRequestPayload {
  credential: string;
  remember?: boolean;
}

export interface MicrosoftAuthRequestPayload {
  idToken: string;
  remember?: boolean;
}

export interface CompleteCompanyRequestPayload {
  companyName: string;
  registryNumber: string;
}

export type GoogleAuthResult =
  | (AuthSession & { needsCompany: false })
  | (AuthSession & { needsCompany: true });

