export const BITCOIN_SUPPORT_ADDRESS =
  "bc1quj05lnw2wahvqdhst6yklm9wunu3n0uvmmtn9p";
export const BITCOIN_SUPPORT_LABEL = "Support the team";
export const BITCOIN_SUPPORT_MESSAGE =
  "Support PrismAI development with Bitcoin.";

export function hasBitcoinSupportAddress() {
  return BITCOIN_SUPPORT_ADDRESS.trim().length > 0;
}

export function getBitcoinSupportUri() {
  if (!hasBitcoinSupportAddress()) return "";
  return `bitcoin:${BITCOIN_SUPPORT_ADDRESS.trim()}`;
}
