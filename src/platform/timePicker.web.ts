export function pickTime(current: string | null): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'time';
    input.value = current ?? '22:00';
    input.style.cssText = 'position:fixed;opacity:0;pointer-events:none;top:50%;left:50%';
    let done = false;
    const finish = (v: string | null) => {
      if (done) return;
      done = true;
      input.remove();
      resolve(v);
    };
    input.addEventListener('change', () => finish(/^\d{2}:\d{2}$/.test(input.value) ? input.value : null));
    input.addEventListener('blur', () => setTimeout(() => finish(null), 200));
    document.body.appendChild(input);
    input.focus();
    try { input.showPicker(); } catch { /* older browsers: the focused field is still usable */ }
  });
}
