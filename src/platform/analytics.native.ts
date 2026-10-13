import { File, Paths } from 'expo-file-system';

import { buildUmamiPayload, UMAMI_ENDPOINT } from './umamiPayload';

const file = new File(Paths.document, 'analytics-preference.json');

export async function getAnalyticsEnabled(): Promise<boolean> {
  try {
    return file.exists && (JSON.parse(await file.text()) as { enabled?: unknown }).enabled === true;
  } catch {
    return false; // a corrupt file defaults to off, never to an un-opted-in "on"
  }
}

export async function setAnalyticsEnabled(enabled: boolean): Promise<void> {
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify({ enabled }));
}

export async function trackScreenView(screenName: string): Promise<void> {
  if (!(await getAnalyticsEnabled())) return;
  try {
    await fetch(UMAMI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Umami drops requests with no User-Agent, and the host in front of it
        // silently discards (200 OK, nothing recorded) any UA without a
        // three-part dotted version number, so "EqDaily/1.1 (Android)" would
        // vanish. Only the shape matters here, not the exact number.
        'User-Agent': 'EqDaily/1.1.0 (Android)',
      },
      body: JSON.stringify(buildUmamiPayload(screenName, 'android')),
    });
  } catch {
    // Analytics must never crash the app or raise a dialog.
  }
}
