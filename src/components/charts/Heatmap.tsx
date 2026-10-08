import React, { memo, useMemo, useRef } from 'react';
import { ScrollView, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import { calendarGrid, cellLabel, heatmapDates, heatmapSummary, LEVELS, levelAlpha, scaleLevel, withAlpha } from './heatmapGeometry';

interface Props {
  dates: string[];
  values: Map<string, boolean | number>;
  mode: 'yesno' | 'scale';
  min?: number;
  max?: number;
}

const SIZE = 14;
const GAP = 3;
const STEP = SIZE + GAP;
const ROW_LABELS = ['M', '', 'W', '', 'F', '', ''];

/**
 * A calendar heatmap: one column per week (Monday first), one cell per day.
 * Yes is solid, No a neutral fill, skipped just an outline, so a skipped day is
 * never mistaken for a "no". Slider values use a single-hue ramp. Scrolls
 * sideways when the range is long, starting at the most recent weeks.
 */
export const Heatmap = memo(function Heatmap({ dates: allDates, values, mode, min = 0, max = 1 }: Props) {
  const theme = useTheme();
  const scroller = useRef<ScrollView>(null);
  const dates = useMemo(() => heatmapDates(allDates), [allDates]);
  const { columns, months } = useMemo(() => calendarGrid(dates), [dates]);

  const cellStyle = (value: boolean | number | undefined) => {
    const base = { width: SIZE, height: SIZE, borderRadius: 3 };
    // skipped recedes (a faint ring); an answered "no" is a solid, clearly visible neutral
    if (value === undefined) return { ...base, backgroundColor: 'transparent', borderWidth: 1.5, borderColor: theme.colors.outlineVariant };
    if (typeof value === 'boolean') return { ...base, backgroundColor: value ? theme.colors.primary : theme.colors.outline };
    return { ...base, backgroundColor: withAlpha(theme.colors.primary, levelAlpha(scaleLevel(value, min, max))) };
  };

  return (
    <View
      testID="heatmap" style={{ gap: 6 }} accessible
      accessibilityLabel={heatmapSummary(dates, values, mode)}
    >
      <View style={{ flexDirection: 'row', gap: 4 }}>
        <View style={{ gap: GAP, paddingTop: 16 }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {ROW_LABELS.map((l, i) => (
            <View key={i} style={{ height: SIZE, justifyContent: 'center' }}>
              <Text variant="labelSmall">{l}</Text>
            </View>
          ))}
        </View>
        <ScrollView
          ref={scroller} horizontal showsHorizontalScrollIndicator={false}
          onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}
        >
          <View>
            <View testID="heatmap-months" style={{ height: 16, width: columns.length * STEP + 24 }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
              {months.map((m) => (
                <Text key={m.column} variant="labelSmall" style={{ position: 'absolute', left: m.column * STEP }}>{m.label}</Text>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: GAP }}>
              {columns.map((col, ci) => (
                <View key={ci} style={{ gap: GAP }}>
                  {col.map((date, ri) =>
                    date === null ? (
                      <View key={`pad-${ri}`} style={{ width: SIZE, height: SIZE }} />
                    ) : (
                      <View
                        key={date} testID={`heat-${date}`} accessible={false}
                        accessibilityLabel={cellLabel(date, values.get(date))}
                        style={cellStyle(values.get(date))}
                      />
                    ),
                  )}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
      <Legend mode={mode} />
    </View>
  );
});

function Legend({ mode }: { mode: 'yesno' | 'scale' }) {
  const theme = useTheme();
  const swatch = (style: object, key: string) => <View key={key} style={{ width: 10, height: 10, borderRadius: 2, ...style }} />;
  return (
    <View testID="heatmap-legend" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {mode === 'yesno' ? (
        <>
          {swatch({ backgroundColor: theme.colors.primary }, 'y')}<Text variant="labelSmall">yes</Text>
          {swatch({ backgroundColor: theme.colors.outline }, 'n')}<Text variant="labelSmall">no</Text>
          {swatch({ borderWidth: 1.5, borderColor: theme.colors.outlineVariant }, 's')}<Text variant="labelSmall">skipped</Text>
        </>
      ) : (
        <>
          <Text variant="labelSmall">low</Text>
          {Array.from({ length: LEVELS }, (_, i) => swatch({ backgroundColor: withAlpha(theme.colors.primary, levelAlpha(i + 1)) }, `l${i}`))}
          <Text variant="labelSmall">high</Text>
          {swatch({ borderWidth: 1.5, borderColor: theme.colors.outlineVariant }, 's')}<Text variant="labelSmall">skipped</Text>
        </>
      )}
    </View>
  );
}
