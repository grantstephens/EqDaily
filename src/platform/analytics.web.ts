import { buildUmamiPayload, UMAMI_ENDPOINT } from './umamiPayload';

const KEY = 'eqdaily-analytics-enabled';

export async function getAnalyticsEnabled(): Promise<boolean> {
  try {
    return localStorage.getItem(KEY) === 'true';
  } catch {
    return false; // blocked storage reads as a first launch: off
  }
}

export async function setAnalyticsEnabled(enabled: boolean): Promise<void> {
  try {
    localStorage.setItem(KEY, String(enabled));
  } catch {
    // The choice just will not survive a reload.
  }
}

export async function trackScreenView(screenName: string): Promise<void> {
  if (!(await getAnalyticsEnabled())) return;
  try {
    // A browser's fetch always sends its own User-Agent, which Umami requires.
    await fetch(UMAMI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildUmamiPayload(screenName, 'web')),
    });
  } catch {
    // Analytics must never crash the app or raise a dialog.
  }
}
