export function onAppHidden(callback: () => void): () => void {
  const handle = () => {
    if (document.visibilityState === 'hidden') callback();
  };
  document.addEventListener('visibilitychange', handle);
  return () => document.removeEventListener('visibilitychange', handle);
}

export function onAppVisible(callback: () => void): () => void {
  const handle = () => {
    if (document.visibilityState === 'visible') callback();
  };
  document.addEventListener('visibilitychange', handle);
  return () => document.removeEventListener('visibilitychange', handle);
}
