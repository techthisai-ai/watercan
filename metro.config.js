const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

// Support .mjs modules (needed for firebase on Android bundling)
config.resolver.sourceExts.push('mjs');

module.exports = config;
