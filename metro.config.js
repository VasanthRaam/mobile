const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Exclude native gradle plugin directories from Metro's file watcher and resolver.
// These contain Kotlin/Gradle files that are compiled during native builds, which can crash the Metro watcher on Windows.
const blockList = [
  /.*[\\/]expo-module-gradle-plugin[\\/].*/,
];

if (config.resolver.blockList) {
  if (Array.isArray(config.resolver.blockList)) {
    config.resolver.blockList.push(...blockList);
  } else {
    config.resolver.blockList = [config.resolver.blockList, ...blockList];
  }
} else {
  config.resolver.blockList = blockList;
}

module.exports = config;
