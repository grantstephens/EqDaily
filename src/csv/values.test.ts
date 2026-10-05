import { decodeValue, encodeValue } from './values';

test.each([
  ['scale', 0.25], ['number', 3], ['yesno', true], ['yesno', false],
  ['text', 'a,b "q"\nline'], ['time', '07:05'], ['choice', 'Wired'],
  ['checkboxes', ['Headache', 'Other thing']], ['checkboxes', []],
] as const)('%s round-trips %j', (type, v) => {
  expect(decodeValue(type, encodeValue(type, v as never))).toEqual(v);
});
test('garbage decodes to null', () => {
  expect(decodeValue('scale', 'abc')).toBeNull();
  expect(decodeValue('scale', '')).toBeNull();
  expect(decodeValue('yesno', 'maybe')).toBeNull();
  expect(decodeValue('number', 'Infinity')).toBeNull();
});
