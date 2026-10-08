import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

import { dateFromTime, timeFromDate } from '../domain/time';

export function pickTime(current: string | null): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      DateTimePickerAndroid.open({
        mode: 'time',
        is24Hour: true,
        value: dateFromTime(current),
        onValueChange: (_e, date) => resolve(timeFromDate(date)),
        onDismiss: () => resolve(null),
      });
    } catch {
      resolve(null); // a picker that cannot open is a cancel, never a crash
    }
  });
}
