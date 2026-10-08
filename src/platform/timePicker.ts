/**
 * Ask the user for a time of day, starting from `current` ("HH:MM" or null).
 * Resolves "HH:MM", or null if they cancelled. Native opens Android's clock
 * dialog; web uses the browser's own time picker. Implementations live in
 * timePicker.native.ts and timePicker.web.ts.
 */
export declare function pickTime(current: string | null): Promise<string | null>;
