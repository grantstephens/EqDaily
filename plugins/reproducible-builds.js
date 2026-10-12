// Expo config plugin: installs reproducible-builds.gradle into the generated
// android/ tree and applies it from app/build.gradle.
//
// Why a plugin: android/ is generated fresh by `expo prebuild` and never
// committed (managed workflow), so build-level reproducibility tweaks can
// only live in the repo as a config plugin. This runs on every prebuild -
// locally, in release.yml, and in F-Droid's own buildserver recipe - so all
// three produce the same gradle configuration.
//
// See plugins/reproducible-builds.gradle for what it does and why.

const { withAppBuildGradle, withGradleProperties } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SCRIPT_NAME = 'reproducible-builds.gradle';
const APPLY_LINE = `apply from: rootProject.file('${SCRIPT_NAME}')`;
const ANCHOR = 'apply plugin: "com.facebook.react"';

// @react-native-community/datetimepicker hardcodes kotlinOptions.jvmTarget =
// '17' while its Java side follows the JDK 21 the release and F-Droid builds
// use (RN's gradle-plugin is patched 17 -> 21), and Kotlin's default
// validation fails the build on that mismatch. Downgrading it to a warning is
// safe: the bytecode is desugared by D8 either way. Set here, not in the
// F-Droid recipe, so release.yml, F-Droid and local prebuilds stay identical.
const KOTLIN_VALIDATION = { type: 'property', key: 'kotlin.jvm.target.validation.mode', value: 'warning' };

module.exports = function withReproducibleBuilds(config) {
  config = withGradleProperties(config, (mod) => {
    mod.modResults = mod.modResults.filter((i) => !(i.type === 'property' && i.key === KOTLIN_VALIDATION.key));
    mod.modResults.push(KOTLIN_VALIDATION);
    return mod;
  });
  return withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') {
      throw new Error(`withReproducibleBuilds: expected groovy, got ${mod.modResults.language}`);
    }
    const projectRoot = mod.modRequest.projectRoot;

    // Install the gradle script next to android/settings.gradle, where the
    // apply-from below looks for it via rootProject.file(...).
    fs.copyFileSync(
      path.join(__dirname, SCRIPT_NAME),
      path.join(projectRoot, 'android', SCRIPT_NAME),
    );

    const contents = mod.modResults.contents;
    if (contents.includes(APPLY_LINE)) {
      return mod; // idempotent across repeated prebuilds
    }
    if (!contents.includes(ANCHOR)) {
      throw new Error(
        `withReproducibleBuilds: anchor '${ANCHOR}' not found in app/build.gradle - ` +
        'the Expo template changed; update this plugin.',
      );
    }
    // Apply right after the RN plugin, same position wafrn uses.
    mod.modResults.contents = contents.replace(ANCHOR, `${ANCHOR}\n${APPLY_LINE}`);
    return mod;
  });
};
