/* Server-side config — never imported from client components */

/** Google Apps Script endpoint backing the team's existing Sheet */
export const SHEETS_API =
  process.env.SHEETS_API_URL ??
  'https://script.google.com/macros/s/AKfycbwNbyFuoNJV6XPAWbwANg1DOuW9rBshHlBrm3cLPcDeZORwu2L2k8N6VoHYNKdoyKhYtg/exec';

/** Marker for special rows (legacy duel feature, filtered out) */
export const DUEL_ROW_MARKER = '__DUEL__';
