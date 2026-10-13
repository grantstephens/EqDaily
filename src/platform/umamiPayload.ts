/**
 * Pure payload shaping for Umami's server-side event API: no fetch, no storage,
 * so it is unit-tested without either. analytics.native.ts and analytics.web.ts
 * each send this body; the platform split is only about how the request goes out.
 */

export const UMAMI_ENDPOINT = 'https://a7s.hub13.xyz/api/send';
export const UMAMI_WEBSITE_ID = '4280d74b-6616-4758-be99-5d9169291449';

export interface UmamiEventPayload {
  type: 'event';
  payload: { website: string; hostname: string; url: string };
}

/**
 * A screen change as a pageview. There is deliberately no `name` field: that
 * would make it a custom event, a different kind of tracking than "which
 * screen was open". The screen name is all that is ever sent.
 */
export function buildUmamiPayload(screenName: string, hostname: 'web' | 'android'): UmamiEventPayload {
  return { type: 'event', payload: { website: UMAMI_WEBSITE_ID, hostname, url: `/${screenName}` } };
}
