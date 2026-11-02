import api from '../lib/axios';

export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
}

export interface ResetPasswordResponse {
  success: boolean;
  message: string;
}

/**
 * Request a password reset link for the given email address
 */
export async function requestPasswordReset(email: string): Promise<ForgotPasswordResponse> {
  const response = await api.post<ForgotPasswordResponse>('/auth/forgot-password', { email });
  return response.data;
}

/**
 * Submit a new password with the verification token
 */
export async function resetPassword(token: string, password: string): Promise<ResetPasswordResponse> {
  const response = await api.post<ResetPasswordResponse>('/auth/reset-password', { token, password });
  return response.data;
}

