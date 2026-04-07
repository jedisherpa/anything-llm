/**
 * HITL Confirm Test Plugin -- Handler
 *
 * Implements the confirm_action tool. This function ONLY executes after the
 * enforcement-wrapper has received human approval via the HITL bridge.
 * The hitl:true flag on the tool declaration in plugin.prismai.json ensures
 * the enforcement-wrapper blocks execution until approval is granted.
 *
 * This file is loaded inside a Worker Thread by worker-runner.js.
 */

"use strict";

/**
 * Execute the confirm action. By the time this function runs, the HITL
 * gate in the enforcement-wrapper has already obtained human approval.
 *
 * @param {object} args
 * @param {string} args.message - Description of the action being confirmed
 * @returns {{ confirmed: boolean, message: string, timestamp: string }}
 */
function confirm_action(args) {
  const message =
    typeof args.message === "string" ? args.message : String(args.message);

  return {
    confirmed: true,
    message,
    timestamp: new Date().toISOString(),
  };
}

module.exports = { confirm_action };
