import type { PickedFile } from './files';

export function pickBundle(): Promise<PickedFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip,application/zip';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      file.arrayBuffer().then(
        (buf) => resolve({ name: file.name, bytes: new Uint8Array(buf) }),
        () => resolve(null),
      );
    };
    // A browser gives no cancel event, so a dismissed picker never resolves.
    input.click();
  });
}

export async function saveBundle(name: string, bytes: Uint8Array): Promise<string> {
  const blob = new Blob([bytes as BlobPart], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  // Appended before clicking, and revoked on a later tick: a detached anchor
  // plus a synchronous revoke works in Chrome and silently drops the download
  // elsewhere, and this is the only route data leaves the web build.
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 0);
  return name;
}
