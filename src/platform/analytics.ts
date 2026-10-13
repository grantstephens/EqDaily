/**
 * Opt-in, anonymous usage counts: which screen was opened, nothing else. Off
 * until the user turns it on in Settings. Implementations live in
 * analytics.native.ts and analytics.web.ts; Metro picks by platform. Nothing
 * here ever throws: a failure reads as "off" or is dropped.
 */
export declare function getAnalyticsEnabled(): Promise<boolean>;
export declare function setAnalyticsEnabled(enabled: boolean): Promise<void>;
export declare function trackScreenView(screenName: string): Promise<void>;
