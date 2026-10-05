import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { PickedFile } from './files';

export async function pickBundle(): Promise<PickedFile | null> {
  // Android's MIME reporting for zips is unreliable (application/zip,
  // application/x-zip-compressed, octet-stream, or nothing), so the filter is
  // deliberately wide.
  //
  // copyToCacheDirectory is deliberately false. When true, expo-document-picker
  // copies into context.cacheDir and hands back a plain file:// URI; under Expo
  // Go that path doesn't match the scoped cache directory expo-file-system's
  // own permission check compares against, so reading is rejected with a false
  // "missing read permission" error. Left false, the URI stays the original
  // SAF content:// URI, which carries its own read grant and which
  // expo-file-system's File class reads directly - no storage permission.
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: false,
    multiple: false,
  });
  if (result.canceled) return null;

  const asset = result.assets[0];
  if (asset === undefined) return null;

  const file = new File(asset.uri);
  return { name: asset.name, bytes: await file.bytes() };
}

export async function saveBundle(name: string, bytes: Uint8Array): Promise<string> {
  const file = new File(Paths.cache, name);
  // create() throws if the file already exists, and an export a minute after
  // the last one has the same dated name.
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);

  if (!(await Sharing.isAvailableAsync())) {
    // No share target at all. The file is written and named; say so rather
    // than pretending nothing happened.
    return name;
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/zip',
    dialogTitle: 'Export your answers',
    UTI: 'public.zip-archive',
  });
  return name;
}
