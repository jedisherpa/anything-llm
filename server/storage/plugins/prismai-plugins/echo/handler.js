/**
 * Echo plugin handler
 * Simple test plugin that echoes the provided message.
 */

/**
 * @param {{ message: string }} args
 * @returns {{ echoedMessage: string }}
 */
function echo(args) {
  return { echoedMessage: args.message };
}

module.exports = { echo };
