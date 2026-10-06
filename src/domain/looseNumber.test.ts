import { parseLooseNumber } from './looseNumber';

test.each([
  ['3', 0, 3],
  ['2.5', 1, 2.5],
  ['2,5', 1, 2.5],
  ['1,000', 0, 1000],
  ['12,345,678', 0, 12345678],
  ['1,000.5', 1, 1000.5],
  ['1.000,5', 1, 1000.5],
  ['  7 ', 0, 7],
  ['-4', 0, -4],
  ['1,000', 2, 1],
])('%j with %i decimals is %j', (text, decimals, want) => {
  expect(parseLooseNumber(text, decimals)).toBe(want);
});
test.each([[''], ['-'], ['abc'], ['1e'], ['1.2.3'], ['Infinity']])('%j is not a number', (text) => {
  expect(parseLooseNumber(text, 1)).toBeNull();
});
