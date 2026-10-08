import { keyboardOverlap, scrollTarget } from './keyboardScroll';

describe('keyboardOverlap', () => {
  test('how much of the view the keyboard covers', () => {
    expect(keyboardOverlap({ viewY: 100, viewH: 700, keyboardTop: 500 })).toBe(300);
  });
  test('none when the keyboard is below the view, or not showing', () => {
    expect(keyboardOverlap({ viewY: 100, viewH: 400, keyboardTop: 700 })).toBe(0);
    expect(keyboardOverlap({ viewY: 100, viewH: 700, keyboardTop: null })).toBe(0);
  });
  test('none when the system already resized or panned the window clear of the keyboard', () => {
    expect(keyboardOverlap({ viewY: 0, viewH: 500, keyboardTop: 500 })).toBe(0);
  });
  test('never negative or NaN, and never more than the view', () => {
    expect(keyboardOverlap({ viewY: 100, viewH: 700, keyboardTop: -50 })).toBe(700);
    expect(keyboardOverlap({ viewY: NaN, viewH: 700, keyboardTop: 500 })).toBe(0);
  });
});

describe('scrollTarget', () => {
  const base = { scrollY: 0, viewportH: 800, keyboardH: 300, margin: 16 }; // 500px visible
  test('null when the field is already fully visible above the keyboard', () => {
    expect(scrollTarget({ ...base, fieldY: 100, fieldH: 56 })).toBeNull();
  });
  test('scrolls down just enough to lift a field out from under the keyboard', () => {
    // field bottom at 700, visible bottom (800 - 300 - 16) = 484 -> need +216
    expect(scrollTarget({ ...base, fieldY: 644, fieldH: 56 })).toBe(216);
  });
  test('does nothing once the field is already in view at the current scroll position', () => {
    // scrolled to 300 the visible content is 300..800, so a field ending at 700 is fine
    expect(scrollTarget({ ...base, scrollY: 300, fieldY: 644, fieldH: 56 })).toBeNull();
  });
  test('only scrolls the little that is still needed', () => {
    // scrolled to 200 the visible bottom is 684, the field ends at 700: aim for 216 (+16)
    expect(scrollTarget({ ...base, scrollY: 200, fieldY: 644, fieldH: 56 })).toBe(216);
  });
  test('scrolls back up when the field has gone off the top', () => {
    expect(scrollTarget({ ...base, scrollY: 400, fieldY: 100, fieldH: 56 })).toBe(84);
  });
  test('never scrolls above the start', () => {
    expect(scrollTarget({ ...base, scrollY: 50, fieldY: 5, fieldH: 56 })).toBe(0);
  });
  test('a field taller than the visible area is aligned to its bottom, where you are typing', () => {
    // visible 500; field 1000 tall starting at 100 -> bottom 1100 -> target 1100 - (500 - 16) = 616
    expect(scrollTarget({ ...base, fieldY: 100, fieldH: 1000 })).toBe(616);
  });
  test('null when there is no visible room at all', () => {
    expect(scrollTarget({ ...base, keyboardH: 900, fieldY: 100, fieldH: 56 })).toBeNull();
  });
});
