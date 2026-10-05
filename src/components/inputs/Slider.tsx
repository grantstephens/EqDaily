import React, { useRef, useState } from 'react';
import { PanResponder, View, type LayoutChangeEvent } from 'react-native';
import { useTheme } from 'react-native-paper';

interface Props {
  value: number | null;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  testID?: string;
}

const THUMB = 22;

/**
 * A minimal horizontal slider: a track, a thumb and a PanResponder. Written
 * in-house to avoid a native slider dependency. Exposes adjustable
 * accessibility actions so it is usable without touch.
 */
export function Slider({ value, min, max, step, onChange, testID }: Props) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const latest = useRef({ width, min, max, step, onChange });
  latest.current = { width, min, max, step, onChange };

  const fromX = (x: number) => {
    const { width: w, min: lo, max: hi, step: st, onChange: emit } = latest.current;
    if (w <= 0) return;
    const ratio = Math.min(1, Math.max(0, x / w));
    const snapped = lo + Math.round(((hi - lo) * ratio) / st) * st;
    emit(Number(Math.min(hi, Math.max(lo, snapped)).toFixed(6)));
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => fromX(e.nativeEvent.locationX),
      onPanResponderMove: (e) => fromX(e.nativeEvent.locationX),
    }),
  ).current;

  const ratio = value === null ? 0 : (value - min) / (max - min);
  const adjust = (dir: 1 | -1) => {
    const base = value ?? (min + max) / 2;
    onChange(Number(Math.min(max, Math.max(min, base + dir * step)).toFixed(6)));
  };

  return (
    <View
      testID={testID}
      accessibilityRole="adjustable"
      accessibilityValue={{ min, max, now: value ?? undefined }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => adjust(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={{ height: 40, justifyContent: 'center' }}
      {...responder.panHandlers}
    >
      <View style={{ height: 4, borderRadius: 2, backgroundColor: theme.colors.surfaceVariant }} />
      {value !== null && (
        <>
          <View style={{ position: 'absolute', height: 4, borderRadius: 2, width: ratio * width, backgroundColor: theme.colors.primary }} />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute', width: THUMB, height: THUMB, borderRadius: THUMB / 2,
              left: Math.max(0, ratio * width - THUMB / 2), backgroundColor: theme.colors.primary,
            }}
          />
        </>
      )}
    </View>
  );
}
