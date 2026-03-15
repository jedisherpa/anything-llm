const browserCrypto =
  typeof globalThis !== "undefined" ? (globalThis.crypto ?? {}) : {};

export default browserCrypto;
