#!/usr/bin/env bash
# Verifies a signed release APK before it ships: real signing key, minimum
# targetSdk, NO declared permissions, and the expected versionCode. Assertions,
# not just output - a silent regression here ships a broken, over-permissioned
# or wrongly-signed build.
#
# Usage: verify-release-apk.sh <apk> <expected-versioncode>
# Expects RUNNER_TEMP, KS_PASS and KEY_ALIAS in the environment (the keystore
# is read from $RUNNER_TEMP/keystore.jks), matching release.yml.
set -euo pipefail

APK="$1"
EXPECTED_CODE="$2"

apksigner verify --print-certs "$APK"

TARGET=$(aapt dump badging "$APK" | sed -n "s/.*targetSdkVersion:'\([0-9]*\)'.*/\1/p")
echo "targetSdkVersion=$TARGET"
[ "$TARGET" -ge 35 ] || { echo "::error::targetSdkVersion $TARGET < 35"; exit 1; }

# EqDaily is local-only: it must declare no permissions at all.
# DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION is excluded deliberately: it is a
# self-signature permission AndroidX Core auto-injects to emulate Android 13's
# RECEIVER_NOT_EXPORTED flag on older API levels - scoped to this app's own
# package and unusable by any other app.
PERM_LIST=$(aapt dump permissions "$APK" | grep 'uses-permission' \
  | grep -v 'DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION' \
  | sed -n "s/.*name='\([^']*\)'.*/\1/p" | sort || true)
echo "declared permissions: [${PERM_LIST}]"
[ -z "$PERM_LIST" ] || {
  echo "::error::declared permissions were [$PERM_LIST], expected none"
  exit 1; }

CODE=$(aapt dump badging "$APK" | sed -n "s/.*versionCode='\([0-9]*\)'.*/\1/p")
[ "$CODE" = "$EXPECTED_CODE" ] || {
  echo "::error::versionCode $CODE != $EXPECTED_CODE"; exit 1; }

# Confirms the signing-config patch took effect: the APK's certificate must be
# the real release keystore's, not the debug one build.gradle defaults to.
APK_FPR=$(apksigner verify --print-certs "$APK" \
  | sed -n 's/.*SHA-256 digest: //p' | head -1 | tr 'A-F' 'a-f')
KS_FPR=$(keytool -list -v -keystore "$RUNNER_TEMP/keystore.jks" \
  -storepass "$KS_PASS" -alias "$KEY_ALIAS" \
  | sed -n 's/.*SHA256: *//p' | head -1 | tr -d ':' | tr 'A-F' 'a-f')
[ -n "$APK_FPR" ] && [ "$APK_FPR" = "$KS_FPR" ] || {
  echo "::error::APK is not signed with the release keystore (signing patch did not apply)"
  echo "apksigner: $APK_FPR"
  echo "keystore:  $KS_FPR"
  exit 1; }

aapt dump badging "$APK" | grep -E '^package|native-code'
