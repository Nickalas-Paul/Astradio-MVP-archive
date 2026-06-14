/** Founder account id — inventory badge only (NEXT_PUBLIC_ for client access). */
export const FOUNDER_USER_ID =
  (typeof process.env.NEXT_PUBLIC_FOUNDER_USER_ID === 'string'
    ? process.env.NEXT_PUBLIC_FOUNDER_USER_ID.trim()
    : '') || '';
