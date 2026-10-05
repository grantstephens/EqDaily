import { rankOptions } from './options';

test('configured options with no usage keep config order', () => {
  expect(rankOptions(['a', 'b', 'c'], [])).toEqual({ shown: ['a', 'b', 'c'], more: [] });
});
test('most used first; learned options with count>0 included; ties by config order', () => {
  const r = rankOptions(['a', 'b'], [{ option: 'z', count: 5 }, { option: 'b', count: 2 }, { option: 'a', count: 2 }]);
  expect(r.shown).toEqual(['z', 'a', 'b']);
});
test('learned option with count 0 is dropped', () => {
  expect(rankOptions(['a'], [{ option: 'gone', count: 0 }]).shown).toEqual(['a']);
});
test('caps shown at the limit and puts the rest in more', () => {
  const opts = Array.from({ length: 12 }, (_, i) => `o${i}`);
  const r = rankOptions(opts, []);
  expect(r.shown).toHaveLength(8);
  expect(r.more).toEqual(['o8', 'o9', 'o10', 'o11']);
});
test('matching is exact-string (case differs = different option)', () => {
  expect(rankOptions(['a'], [{ option: 'A', count: 1 }]).shown).toEqual(['A', 'a']);
});
