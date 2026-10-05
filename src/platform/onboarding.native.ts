import { File, Paths } from 'expo-file-system';

const file = new File(Paths.document, 'onboarding.json');

export async function getOnboarded(): Promise<boolean> {
  try {
    return file.exists && (JSON.parse(await file.text()) as { done?: unknown }).done === true;
  } catch {
    return false;
  }
}

export async function setOnboarded(): Promise<void> {
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify({ done: true }));
}
