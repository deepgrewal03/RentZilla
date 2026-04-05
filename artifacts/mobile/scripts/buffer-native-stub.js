// Stub for 'buffer' package in native builds.
// Buffer is a global in React Native (provided by @react-native/polyfills),
// so this explicit import is a no-op for iOS/Android.
'use strict';
const B = typeof Buffer !== 'undefined' ? Buffer : class Buffer {};
module.exports = { Buffer: B };
module.exports.default = module.exports;
