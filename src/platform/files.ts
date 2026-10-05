/**
 * Reading an export bundle in and writing one out, on both targets.
 *
 * Implementations live in files.native.ts and files.web.ts; Metro picks one by
 * platform extension. Neither assumes a real filesystem path exists, because
 * on the web it does not.
 */

/** A file the user chose. null means they cancelled, which is not an error. */
export interface PickedFile {
  name: string;
  bytes: Uint8Array;
}

/**
 * pickBundle asks for a file and reads it as bytes.
 *
 * Resolves null when the user cancels — on native. A browser fires no event
 * for a dismissed file dialog, so on web a cancelled pick simply never
 * resolves. Nothing is waiting on it but a dialog that should not appear, so
 * that is harmless; it is documented here because the contract otherwise
 * reads as though null were guaranteed on both targets.
 */
export declare function pickBundle(): Promise<PickedFile | null>;

/**
 * saveBundle hands bytes to the user as a file and returns the name it was
 * given. Neither platform can report a cancelled save (Android hands off to a
 * share sheet; a browser download has no completion event), so this never
 * resolves null and callers should not branch on it.
 */
export declare function saveBundle(name: string, bytes: Uint8Array): Promise<string>;
