/**
 * Whether the first-launch template picker has been dealt with. Implementations
 * live in onboarding.native.ts and onboarding.web.ts; Metro picks by platform.
 * Failures read as "not onboarded"/are swallowed: a missing flag only means the
 * picker shows again on an empty install, never a crash.
 */
export declare function getOnboarded(): Promise<boolean>;
export declare function setOnboarded(): Promise<void>;
