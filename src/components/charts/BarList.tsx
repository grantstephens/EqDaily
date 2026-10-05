import React from 'react';
import { View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import type { Counted } from '../../domain/stats';

/** Horizontal bars for a ranking or distribution: label, bar, "count · percent". */
export function BarList({ items, limit = 8 }: { items: Counted[]; limit?: number }) {
  const theme = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {items.slice(0, limit).map((it) => (
        <View key={it.option}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text>{it.option}</Text>
            <Text>{`${it.count} · ${Math.round(it.percent)}%`}</Text>
          </View>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.colors.surfaceVariant }}>
            <View style={{ height: 6, borderRadius: 3, width: `${Math.min(100, Math.max(0, it.percent))}%`, backgroundColor: theme.colors.primary }} />
          </View>
        </View>
      ))}
    </View>
  );
}
