const globalScope = globalThis as typeof globalThis & {
  Buffer?: unknown;
  URL?: typeof URL;
};

if (typeof globalScope.Buffer === 'undefined') {
  globalScope.Buffer = require('buffer').Buffer;
}

let needsUrlPolyfill = typeof globalScope.URL !== 'function';

if (!needsUrlPolyfill) {
  try {
    needsUrlPolyfill = new globalScope.URL('https://example.com/path').host !== 'example.com';
  } catch {
    needsUrlPolyfill = true;
  }
}

if (needsUrlPolyfill) {
  globalScope.URL = require('whatwg-url').URL;
}
