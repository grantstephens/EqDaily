import { act, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Keyboard, ScrollView, StyleSheet, Text } from 'react-native';

import { KeyboardAwareScroll } from './KeyboardAwareScroll';

type Handler = (e: unknown) => void;
const handlers: Record<string, Handler> = {};
const removes: jest.Mock[] = [];

beforeEach(() => {
  for (const k of Object.keys(handlers)) delete handlers[k];
  removes.length = 0;
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((name: string, cb: Handler) => {
    handlers[name] = cb;
    const remove = jest.fn();
    removes.push(remove);
    return { remove };
  }) as never);
  // The scroll view sits at y=100, 700 tall, on screen.
  jest.spyOn(ScrollView.prototype as never, 'measureInWindow').mockImplementation(((cb: (...a: number[]) => void) => cb(0, 100, 400, 700)) as never);
});
afterEach(() => jest.restoreAllMocks());

const spacer = () => StyleSheet.flatten(screen.getByTestId('keyboard-spacer').props.style).height;
const show = (screenY: number) =>
  act(async () => { handlers.keyboardDidShow!({ endCoordinates: { screenY, height: 900 - screenY } }); });

test('renders its children and starts with no keyboard room', async () => {
  await render(<KeyboardAwareScroll><Text>hello</Text></KeyboardAwareScroll>);
  expect(screen.getByText('hello')).toBeTruthy();
  expect(spacer()).toBe(0);
});

test('adds room equal to how much of the scroll view the keyboard covers', async () => {
  await render(<KeyboardAwareScroll><Text>hello</Text></KeyboardAwareScroll>);
  await show(500); // keyboard top at 500; view spans 100..800 -> covers 300
  expect(spacer()).toBe(300);
});

test('adds no room when the system has already moved the window clear of the keyboard', async () => {
  await render(<KeyboardAwareScroll><Text>hello</Text></KeyboardAwareScroll>);
  await show(800); // keyboard top at the view bottom: nothing covered
  expect(spacer()).toBe(0);
});

test('takes the room away again when the keyboard hides', async () => {
  await render(<KeyboardAwareScroll><Text>hello</Text></KeyboardAwareScroll>);
  await show(500);
  await act(async () => { handlers.keyboardDidHide!({}); });
  expect(spacer()).toBe(0);
});

test('passes scroll view props through and keeps taps working while the keyboard is open', async () => {
  await render(<KeyboardAwareScroll testID="scroller" accessibilityLabel="form"><Text>x</Text></KeyboardAwareScroll>);
  const el = screen.getByTestId('scroller');
  expect(el.props.accessibilityLabel).toBe('form');
  expect(el.props.keyboardShouldPersistTaps).toBe('handled');
});

test('stops listening when it unmounts', async () => {
  const { unmount } = await render(<KeyboardAwareScroll><Text>x</Text></KeyboardAwareScroll>);
  await unmount();
  expect(removes.length).toBeGreaterThan(0);
  for (const r of removes) expect(r).toHaveBeenCalled();
});
