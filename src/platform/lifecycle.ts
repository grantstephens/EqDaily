/**
 * Cross-platform "the app is about to leave the foreground" signal.
 *
 * The implementations live in lifecycle.native.ts and lifecycle.web.ts; Metro
 * picks one by platform extension. This file exists so imports have something
 * to resolve to for TypeScript, and so the contract is stated once.
 */

/**
 * onAppHidden calls `callback` when the app backgrounds or closes (native) or
 * the tab/window is hidden or closed (web). Returns an unsubscribe function.
 */
export declare function onAppHidden(callback: () => void): () => void;

/**
 * onAppVisible calls `callback` when the app returns to the foreground
 * (native) or the tab/window becomes visible (web). Returns an unsubscribe
 * function. Used so a screen left open overnight notices the date moved on.
 */
export declare function onAppVisible(callback: () => void): () => void;
