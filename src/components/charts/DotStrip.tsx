import React from 'react';
import { View } from 'react-native';
import { useTheme } from 'react-native-paper';

/** One dot per day: filled yes, hollow no, faint when the day was skipped. */
export function DotStrip({ days }: { days: { date: string; value: boolean | null }[] }) {
  const theme = useTheme();
  const yes = days.filter((d) => d.value === true).length;
  const no = days.filter((d) => d.value === false).length;
  const skipped = days.length - yes - no;
  return (
    <View accessibilityLabel={`${yes} yes, ${no} no, ${skipped} skipped`}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3 }}>
      {days.map((d) => (
        <View key={d.date} style={{
          width: 10, height: 10, borderRadius: 5, borderWidth: 1.5,
          borderColor: d.value === null ? theme.colors.surfaceVariant : theme.colors.primary,
          backgroundColor: d.value === true ? theme.colors.primary : 'transparent',
        }} />
      ))}
    </View>
  );
}
