import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard, ScrollView, TextInput, View,
  type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewProps,
} from 'react-native';

import { keyboardOverlap, scrollTarget } from '../domain/keyboardScroll';

/** Methods ScrollView has at runtime that its typings leave out. */
type ScrollHandle = ScrollView & {
  measureInWindow(cb: (x: number, y: number, w: number, h: number) => void): void;
  getInnerViewRef?(): unknown;
};

/** Breathing room kept between a focused field and the keyboard or screen edge. */
const MARGIN = 24;

/**
 * A ScrollView that keeps the focused text field visible above the on-screen
 * keyboard. The app is edge-to-edge, where Android no longer pans or resizes the
 * window for the keyboard, so without this the keyboard simply covers the field.
 *
 * It measures how much of its own on-screen area the keyboard covers (so it
 * stays correct if the system moved the window anyway), adds that much room at
 * the bottom so everything can scroll clear, and scrolls the focused field into
 * the free space, again whenever the field grows as you type. On web there are
 * no keyboard events, so it is a plain ScrollView.
 */
export function KeyboardAwareScroll({
  children, onLayout, onScroll, onContentSizeChange, ...rest
}: ScrollViewProps) {
  const ref = useRef<ScrollHandle>(null);
  const [overlap, setOverlap] = useState(0);
  const overlapRef = useRef(0);
  const keyboardTop = useRef<number | null>(null);
  const scrollY = useRef(0);
  const viewportH = useRef(0);

  const measure = useCallback(() => {
    ref.current?.measureInWindow((_x, y, _w, h) => {
      const o = keyboardOverlap({ viewY: y, viewH: h, keyboardTop: keyboardTop.current });
      overlapRef.current = o;
      setOverlap(o);
    });
  }, []);

  const reveal = useCallback(() => {
    if (keyboardTop.current === null) return;
    const field = TextInput.State?.currentlyFocusedInput?.();
    const inner = ref.current?.getInnerViewRef?.();
    if (!field || !inner) return;
    field.measureLayout(
      inner as never,
      (_x, y, _w, h) => {
        const target = scrollTarget({
          fieldY: y, fieldH: h, scrollY: scrollY.current, viewportH: viewportH.current,
          keyboardH: overlapRef.current, margin: MARGIN,
        });
        if (target !== null) ref.current?.scrollTo({ y: target, animated: true });
      },
      () => {},
    );
  }, []);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      keyboardTop.current = e.endCoordinates?.screenY ?? null;
      measure();
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      keyboardTop.current = null;
      overlapRef.current = 0;
      setOverlap(0);
    });
    return () => { show.remove(); hide.remove(); };
  }, [measure]);

  // Once the extra room is in place (or the keyboard changes size), bring the field into view.
  useEffect(() => {
    if (overlap > 0) requestAnimationFrame(reveal);
  }, [overlap, reveal]);

  return (
    <ScrollView
      ref={ref}
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}
      {...rest}
      onLayout={(e: LayoutChangeEvent) => {
        viewportH.current = e.nativeEvent.layout.height;
        if (keyboardTop.current !== null) measure();
        onLayout?.(e);
      }}
      onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
        scrollY.current = e.nativeEvent.contentOffset.y;
        onScroll?.(e);
      }}
      onContentSizeChange={(w, h) => {
        // A text field growing as you type pushes its own bottom edge down.
        if (keyboardTop.current !== null) requestAnimationFrame(reveal);
        onContentSizeChange?.(w, h);
      }}
    >
      {children}
      <View testID="keyboard-spacer" style={{ height: overlap }} />
    </ScrollView>
  );
}
