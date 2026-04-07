/**
 * Counter plugin handler
 *
 * Demonstrates module-scoped state persistence across tool calls within
 * a single Worker Thread lifecycle. The counter resets to 0 when the
 * Worker Thread is terminated and respawned (crash, restart, or explicit
 * terminate).
 */

/** @type {number} Module-scoped counter state — persists across tool calls within one Worker. */
let count = 0;

/**
 * Increment the counter by the given amount (default 1).
 * Negative amounts are allowed (counter can go below zero).
 * Non-integer amounts are floored to the nearest integer.
 *
 * @param {{ amount?: number }} args
 * @returns {{ count: number, incremented_by: number }}
 */
function increment(args) {
  const raw = args && args.amount !== undefined ? args.amount : 1;
  const delta = Math.floor(raw);
  count += delta;
  return { count, incremented_by: delta };
}

/**
 * Return the current value of the counter without modifying it.
 *
 * @param {object} _args
 * @returns {{ count: number }}
 */
function get_count(_args) {
  return { count };
}

module.exports = { increment, get_count };
