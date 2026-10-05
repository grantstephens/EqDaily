const KEY = 'eqdaily-onboarded';

export async function getOnboarded(): Promise<boolean> {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export async function setOnboarded(): Promise<void> {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    // Blocked storage: the picker may reappear on an empty install. Harmless.
  }
}
