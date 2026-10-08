import { autosizeTextarea } from './autosize.web';

const fake = (scrollHeight: number) => ({ style: { height: '', overflowY: '' }, scrollHeight, rows: 3 });

test('sizes the textarea to its content', () => {
  const el = fake(120);
  autosizeTextarea(el, 240);
  expect(el.style.height).toBe('120px');
  expect(el.style.overflowY).toBe('hidden');
  expect(el.rows).toBe(1); // measured from a single row, so it can also shrink
});

test('stops at the maximum and scrolls inside from there', () => {
  const el = fake(900);
  autosizeTextarea(el, 240);
  expect(el.style.height).toBe('240px');
  expect(el.style.overflowY).toBe('auto');
});

test('measures from a collapsed height so deleting text shrinks the box', () => {
  const seen: string[] = [];
  const el = {
    style: new Proxy({ height: '300px', overflowY: '' } as Record<string, string>, {
      set(t, k, v) { if (k === 'height') seen.push(v as string); t[k as string] = v as string; return true; },
    }),
    get scrollHeight() { return 64; },
    rows: 3,
  };
  autosizeTextarea(el as never, 240);
  expect(seen[0]).toBe('auto'); // collapsed first, then set from the real content height
  expect(seen.at(-1)).toBe('64px');
});

test('ignores anything that is not a textarea-like element', () => {
  expect(() => autosizeTextarea(null as never, 240)).not.toThrow();
  expect(() => autosizeTextarea({} as never, 240)).not.toThrow();
});
