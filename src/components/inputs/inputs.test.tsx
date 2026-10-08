import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
const mockPickTime = jest.fn();
jest.mock('../../platform/timePicker', () => ({ pickTime: (...a: unknown[]) => mockPickTime(...a) }));
import { StyleSheet } from 'react-native';

import type { Question } from '../../domain/question';
import { AnswerInput } from './AnswerInput';

const base = { hideFromInsights: false, sort: 0, archivedAt: null, created: 'T' };
const scaleQ = (min = 0, max = 10, step?: number): Question =>
  ({ ...base, id: 1, label: 'Mood', type: 'scale', config: { min, max, step } });
const numberQ = (config: object = {}): Question =>
  ({ ...base, id: 2, label: 'Meals', type: 'number', config: { decimals: 0, ...config } });
const yesnoQ: Question = { ...base, id: 3, label: 'Exercise', type: 'yesno', config: {} as never };
const textQ = (multiline = false): Question =>
  ({ ...base, id: 4, label: 'Thx', type: 'text', config: { multiline, showFrequent: false } });
const checksQ = (options = ['Headache', 'Asthma'], allowOther = true): Question =>
  ({ ...base, id: 5, label: 'Sym', type: 'checkboxes', config: { options, allowOther } });
const choiceQ = (allowOther = true): Question =>
  ({ ...base, id: 6, label: 'Energy', type: 'choice', config: { options: ['Low', 'High'], allowOther } });
const timeQ: Question = { ...base, id: 7, label: 'Bed', type: 'time', config: {} as never };

async function show(question: Question, value: any, usage: { option: string; count: number }[] = []) {
  const onChange = jest.fn();
  await render(<AnswerInput question={question} value={value} onChange={onChange} optionUsage={usage} />);
  return onChange;
}
const press = (id: string) => fireEvent.press(screen.getByTestId(id));

describe('scale', () => {
  test('+ from null emits the midpoint of a 0-10 scale', async () => {
    const onChange = await show(scaleQ(0, 10), null);
    await press('scale-plus');
    expect(onChange).toHaveBeenCalledWith(5);
  });
  test('- at min stays at min', async () => {
    const onChange = await show(scaleQ(0, 10), 0);
    await press('scale-minus');
    expect(onChange).toHaveBeenCalledWith(0);
  });
  test('+ steps by the scale step', async () => {
    const onChange = await show(scaleQ(0, 10, 0.5), 3);
    await press('scale-plus');
    expect(onChange).toHaveBeenCalledWith(3.5);
  });
  test('Skip only shows with a value and emits null', async () => {
    const onChange = await show(scaleQ(), 4);
    await press('scale-skip');
    expect(onChange).toHaveBeenCalledWith(null);
  });
  test('no Skip when unanswered', async () => {
    await show(scaleQ(), null);
    expect(screen.queryByTestId('scale-skip')).toBeNull();
  });
  test('accessibility increment action on the slider steps up', async () => {
    const onChange = await show(scaleQ(0, 10), 3);
    await fireEvent(screen.getByTestId('scale-slider'), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(onChange).toHaveBeenCalledWith(4);
  });
  test('shows a dash when unanswered and the value when answered', async () => {
    await show(scaleQ(), null);
    expect(screen.getByTestId('scale-readout')).toHaveTextContent('—');
  });
});

describe('scale start value', () => {
  test('first + on an integer 1-10 scale lands on a whole number', async () => {
    const onChange = await show(scaleQ(1, 10), null);
    await press('scale-plus');
    expect(Number.isInteger(onChange.mock.calls[0][0])).toBe(true);
  });
  test('accessibility increment from null also lands on the step grid', async () => {
    const onChange = await show(scaleQ(1, 10), null);
    await fireEvent(screen.getByTestId('scale-slider'), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(Number.isInteger(onChange.mock.calls[0][0])).toBe(true);
  });
});

describe('number', () => {
  test('+ from null starts at max(min,0)', async () => {
    const onChange = await show(numberQ({ min: 2 }), null);
    await press('number-plus');
    expect(onChange).toHaveBeenCalledWith(2);
  });
  test('decimals=1 steppers emit tenths without float noise', async () => {
    const onChange = await show(numberQ({ decimals: 1 }), 0.2);
    await press('number-plus');
    expect(onChange).toHaveBeenCalledWith(0.3);
  });
  test('clearing the field then blur emits null (skip)', async () => {
    const onChange = await show(numberQ(), 3);
    await fireEvent.changeText(screen.getByTestId('number-input'), '');
    await fireEvent(screen.getByTestId('number-input'), 'blur');
    expect(onChange).toHaveBeenCalledWith(null);
  });
  test('unparseable text then blur reverts and does NOT delete the saved answer', async () => {
    const onChange = await show(numberQ(), 3);
    await fireEvent.changeText(screen.getByTestId('number-input'), '-');
    await fireEvent(screen.getByTestId('number-input'), 'blur');
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('number-input').props.value).toBe('3');
  });
  test('typing 3 then blur emits 3', async () => {
    const onChange = await show(numberQ(), null);
    await fireEvent.changeText(screen.getByTestId('number-input'), '3');
    await fireEvent(screen.getByTestId('number-input'), 'blur');
    expect(onChange).toHaveBeenCalledWith(3);
  });
  test('"1,000" is a thousand, not one', async () => {
    const onChange = await show(numberQ(), null);
    await fireEvent.changeText(screen.getByTestId('number-input'), '1,000');
    await fireEvent(screen.getByTestId('number-input'), 'blur');
    expect(onChange).toHaveBeenCalledWith(1000);
  });
  test('a decimal comma works on a decimal field', async () => {
    const onChange = await show(numberQ({ decimals: 1 }), null);
    await fireEvent.changeText(screen.getByTestId('number-input'), '2,5');
    await fireEvent(screen.getByTestId('number-input'), 'blur');
    expect(onChange).toHaveBeenCalledWith(2.5);
  });
  test('clamped at max', async () => {
    const onChange = await show(numberQ({ max: 5 }), 5);
    await press('number-plus');
    expect(onChange).toHaveBeenCalledWith(5);
  });
  test('typed values are clamped to the range', async () => {
    const onChange = await show(numberQ({ max: 5 }), null);
    await fireEvent.changeText(screen.getByTestId('number-input'), '9');
    await fireEvent(screen.getByTestId('number-input'), 'blur');
    expect(onChange).toHaveBeenCalledWith(5);
  });
  test('shows the unit', async () => {
    await show(numberQ({ unit: 'meals' }), 2);
    expect(screen.getByText('meals')).toBeTruthy();
  });
});

describe('yes/no', () => {
  test('Yes emits true, No emits false', async () => {
    const onChange = await show(yesnoQ, null);
    await press('yesno-yes');
    expect(onChange).toHaveBeenLastCalledWith(true);
    await press('yesno-no');
    expect(onChange).toHaveBeenLastCalledWith(false);
  });
  test('Skip emits null when answered', async () => {
    const onChange = await show(yesnoQ, true);
    await press('yesno-skip');
    expect(onChange).toHaveBeenCalledWith(null);
  });
  test('pressing the already-selected answer emits nothing', async () => {
    const onChange = await show(yesnoQ, true);
    await press('yesno-yes');
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('text', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('typing then 800ms emits once with the text', async () => {
    const onChange = await show(textQ(), null);
    await fireEvent.changeText(screen.getByTestId('text-input'), 'hello');
    expect(onChange).not.toHaveBeenCalled();
    await act(async () => { jest.advanceTimersByTime(800); });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('hello');
  });
  test('blur emits immediately and the timer does not double-emit', async () => {
    const onChange = await show(textQ(), null);
    await fireEvent.changeText(screen.getByTestId('text-input'), 'hello');
    await fireEvent(screen.getByTestId('text-input'), 'blur');
    expect(onChange).toHaveBeenCalledTimes(1);
    await act(async () => { jest.advanceTimersByTime(2000); });
    expect(onChange).toHaveBeenCalledTimes(1);
  });
  test('clearing emits null', async () => {
    const onChange = await show(textQ(), 'old');
    await fireEvent.changeText(screen.getByTestId('text-input'), '');
    await fireEvent(screen.getByTestId('text-input'), 'blur');
    expect(onChange).toHaveBeenCalledWith(null);
  });
  test('input is capped at the stored-answer limit so long text is never silently discarded', async () => {
    await show(textQ(), null);
    expect(screen.getByTestId('text-input').props.maxLength).toBe(5000);
  });
  test('always wraps, so a long entry becomes multi-line by itself (even on a one-line question)', async () => {
    await show(textQ(false), null);
    expect(screen.getByTestId('text-input').props.multiline).toBe(true);
  });
  test('Enter dismisses the keyboard on a one-line question', async () => {
    await show(textQ(false), null);
    expect(screen.getByTestId('text-input').props.submitBehavior).toBe('blurAndSubmit');
  });
  test('Enter adds a new line on a multi-line question', async () => {
    await show(textQ(true), null);
    expect(screen.getByTestId('text-input').props.submitBehavior).toBe('newline');
  });
  test('the box is capped at a maximum height; native then grows with the text up to it', async () => {
    await show(textQ(), null);
    const style = StyleSheet.flatten(screen.getByTestId('text-input').props.style);
    expect(style.maxHeight).toBe(240);
    expect(style.height).toBeUndefined(); // no fixed height: the input sizes itself to its content
  });
  test('blur on an untouched empty field emits nothing', async () => {
    const onChange = await show(textQ(), null);
    await fireEvent(screen.getByTestId('text-input'), 'blur');
    expect(onChange).not.toHaveBeenCalled();
  });
  test('unmounting with a pending edit flushes it', async () => {
    const onChange = jest.fn();
    const { unmount } = await render(<AnswerInput question={textQ()} value={null} onChange={onChange} optionUsage={[]} />);
    await fireEvent.changeText(screen.getByTestId('text-input'), 'draft');
    await unmount();
    expect(onChange).toHaveBeenCalledWith('draft');
  });
  test('draft follows an external value change (date switch)', async () => {
    const onChange = jest.fn();
    const { rerender } = await render(<AnswerInput question={textQ()} value="one" onChange={onChange} optionUsage={[]} />);
    await rerender(<AnswerInput question={textQ()} value="two" onChange={onChange} optionUsage={[]} />);
    expect(screen.getByTestId('text-input').props.value).toBe('two');
  });
});

describe('checkboxes', () => {
  test('pressing a chip adds it', async () => {
    const onChange = await show(checksQ(), ['Headache']);
    await press('chip-Asthma');
    expect(onChange).toHaveBeenCalledWith(['Headache', 'Asthma']);
  });
  test('unselecting the only one emits [] (an answer: none), not null', async () => {
    const onChange = await show(checksQ(), ['Headache']);
    await press('chip-Headache');
    expect(onChange).toHaveBeenCalledWith([]);
  });
  test('None emits []', async () => {
    const onChange = await show(checksQ(), null);
    await press('chip-none');
    expect(onChange).toHaveBeenCalledWith([]);
  });
  test('Skip emits null', async () => {
    const onChange = await show(checksQ(), ['Headache']);
    await press('checks-skip');
    expect(onChange).toHaveBeenCalledWith(null);
  });
  test('Other adds a trimmed custom value to the selection', async () => {
    const onChange = await show(checksQ(), ['Headache']);
    await fireEvent.changeText(screen.getByTestId('other-input'), '  Wheezy ');
    await press('other-add');
    expect(onChange).toHaveBeenCalledWith(['Headache', 'Wheezy']);
  });
  test.each([['a|b'], ['   ']])('Other rejects %j with a message and emits nothing', async (bad) => {
    const onChange = await show(checksQ(), []);
    await fireEvent.changeText(screen.getByTestId('other-input'), bad);
    await press('other-add');
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('other-error')).toBeTruthy();
  });
  test('allowOther=false hides the Other row', async () => {
    await show(checksQ(['a'], false), null);
    expect(screen.queryByTestId('other-input')).toBeNull();
  });
  test('only 8 chips show for 12 options; More reveals the rest', async () => {
    const opts = Array.from({ length: 12 }, (_, i) => `o${i}`);
    await show(checksQ(opts), null);
    expect(screen.queryByTestId('chip-o8')).toBeNull();
    expect(screen.getByTestId('chip-o7')).toBeTruthy();
    await press('chip-more');
    expect(screen.getByTestId('chip-o11')).toBeTruthy();
  });
  test('usage reorders chips most-used first', async () => {
    await show(checksQ(['a', 'b', 'c']), null, [{ option: 'c', count: 9 }]);
    const ids = screen.getAllByTestId(/^chip-[abc]$/).map((n) => n.props.testID);
    expect(ids).toEqual(['chip-c', 'chip-a', 'chip-b']);
  });
  test('Other matching an existing option ignoring case reuses that option instead of adding a lookalike', async () => {
    const onChange = await show(checksQ(['Gym', 'Asthma']), []);
    await fireEvent.changeText(screen.getByTestId('other-input'), 'gym');
    await press('other-add');
    expect(onChange).toHaveBeenCalledWith(['Gym']);
  });
  test('a selected value not in the option list is still shown selected', async () => {
    await show(checksQ(), ['Removed option']);
    expect(screen.getByTestId('chip-Removed option')).toBeTruthy();
  });
});

describe('choice', () => {
  test('pressing a chip selects it', async () => {
    const onChange = await show(choiceQ(), null);
    await press('chip-Low');
    expect(onChange).toHaveBeenCalledWith('Low');
  });
  test('pressing the selected chip clears to null', async () => {
    const onChange = await show(choiceQ(), 'Low');
    await press('chip-Low');
    expect(onChange).toHaveBeenCalledWith(null);
  });
  test('Other matching an existing option ignoring case selects that option', async () => {
    const onChange = await show(choiceQ(), null);
    await fireEvent.changeText(screen.getByTestId('other-input'), 'LOW');
    await press('other-add');
    expect(onChange).toHaveBeenCalledWith('Low');
  });
  test('Other adds a custom value', async () => {
    const onChange = await show(choiceQ(), null);
    await fireEvent.changeText(screen.getByTestId('other-input'), 'Wired');
    await press('other-add');
    expect(onChange).toHaveBeenCalledWith('Wired');
  });
});

describe('time', () => {
  test('tapping the time opens the clock and emits what was picked', async () => {
    mockPickTime.mockResolvedValueOnce('07:05');
    const onChange = await show(timeQ, null);
    await press('time-pick');
    expect(mockPickTime).toHaveBeenCalledWith(null);
    expect(onChange).toHaveBeenCalledWith('07:05');
  });
  test('the clock starts from the current answer; cancelling emits nothing', async () => {
    mockPickTime.mockResolvedValueOnce(null);
    const onChange = await show(timeQ, '08:00');
    await press('time-pick');
    expect(mockPickTime).toHaveBeenCalledWith('08:00');
    expect(onChange).not.toHaveBeenCalled();
  });
  test('shows the answer', async () => {
    await show(timeQ, '08:00');
    expect(screen.getByTestId('time-pick')).toHaveTextContent(/08:00/);
  });
  test('prompts when there is no answer', async () => {
    await show(timeQ, null);
    expect(screen.getByTestId('time-pick')).toHaveTextContent(/set time/i);
  });
  test('+15 wraps past midnight', async () => {
    const onChange = await show(timeQ, '23:50');
    await press('time-plus');
    expect(onChange).toHaveBeenCalledWith('00:05');
  });
  test('+15 from null starts at 22:00', async () => {
    const onChange = await show(timeQ, null);
    await press('time-plus');
    expect(onChange).toHaveBeenCalledWith('22:00');
  });
  test('with a question default, the clock and +15 start there instead of 22:00', async () => {
    mockPickTime.mockResolvedValueOnce(null);
    const q = { ...timeQ, config: { defaultTime: '07:00' } } as Question;
    const onChange = await show(q, null);
    await press('time-pick');
    expect(mockPickTime).toHaveBeenCalledWith('07:00');
    await press('time-plus');
    expect(onChange).toHaveBeenCalledWith('07:00');
  });
  test('Reset puts the answer back on the question default', async () => {
    const q = { ...timeQ, config: { defaultTime: '07:00' } } as Question;
    const onChange = await show(q, '09:40');
    await press('time-reset');
    expect(onChange).toHaveBeenCalledWith('07:00');
  });
  test('Reset falls back to 22:00 without a configured default', async () => {
    const onChange = await show(timeQ, '09:40');
    await press('time-reset');
    expect(onChange).toHaveBeenCalledWith('22:00');
  });
  test('Reset is hidden when there is no answer or it already is the default', async () => {
    const q = { ...timeQ, config: { defaultTime: '07:00' } } as Question;
    await show(q, null);
    expect(screen.queryByTestId('time-reset')).toBeNull();
    await show(q, '07:00');
    expect(screen.queryByTestId('time-reset')).toBeNull();
  });
  test('Skip only shows with a value and clears it', async () => {
    const onChange = await show(timeQ, '08:00');
    await press('time-skip');
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
