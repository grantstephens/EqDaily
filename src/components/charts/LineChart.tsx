import React, { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Svg, { Circle, Path } from 'react-native-svg';

import { linePath, scalePoints, segments, shortDate, type DatedPoint } from './chartGeometry';

interface Props {
  points: DatedPoint[];
  dates: string[];
  axisMin: number;
  axisMax: number;
  height?: number;
  yLabel?: (v: number) => string;
}

const defaultLabel = (v: number) => String(Number(v.toFixed(1)));

/** A line chart over a window of days. Skipped days leave gaps, not slopes. */
export function LineChart({ points, dates, axisMin, axisMax, height = 120, yLabel = defaultLabel }: Props) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const color = theme.colors.primary;
  const scaled = (pts: DatedPoint[]) => scalePoints(pts, dates, width, height, axisMin, axisMax);

  return (
    <View accessibilityLabel={`Chart of ${points.length} answers`}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: 40, height, justifyContent: 'space-between' }}>
          <Text variant="labelSmall">{yLabel(axisMax)}</Text>
          <Text variant="labelSmall">{yLabel(axisMin)}</Text>
        </View>
        <View style={{ flex: 1, height }} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
          {width > 0 && (
            <Svg width={width} height={height}>
              {segments(points, dates).map((run, i) =>
                run.length > 1 ? <Path key={i} d={linePath(scaled(run))} stroke={color} strokeWidth={2} fill="none" /> : null)}
              {/* the newest point is picked out in the accent, like the dot on the logo's graph tail */}
              {scaled(points).map((p, i, all) => (
                <Circle key={i} cx={p.x} cy={p.y} r={i === all.length - 1 ? 5 : 3.5}
                  fill={i === all.length - 1 ? theme.colors.tertiary : color} />
              ))}
            </Svg>
          )}
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 40 }}>
        <Text variant="labelSmall">{dates.length > 0 ? shortDate(dates[0]!) : ''}</Text>
        <Text variant="labelSmall">{dates.length > 1 ? shortDate(dates[dates.length - 1]!) : ''}</Text>
      </View>
    </View>
  );
}
