import type { ApiError } from './api';

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Invalid email or password',
  auth_requires_postgres: 'Registration is temporarily unavailable',
  jwt_not_configured: 'Sign-in is temporarily unavailable',
  wait_before_resend: 'Please wait a few minutes before requesting another email',
  resend_failed: 'Could not resend verification email',
  primary_chart_required: 'Add a birth chart in My Sky to see your daily transits',
};

export function formatApiError(err: unknown, fallback = 'Something went wrong'): string {
  if (!err || typeof err !== 'object') {
    return fallback;
  }

  const apiErr = err as ApiError;
  if (typeof apiErr.message === 'string' && apiErr.message.trim()) {
    return apiErr.message;
  }

  if (typeof apiErr.error === 'string') {
    return ERROR_MESSAGES[apiErr.error] ?? apiErr.error.replace(/_/g, ' ');
  }

  return fallback;
}
