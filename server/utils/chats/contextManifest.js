function buildAttachedContextManifest(parsedFiles = []) {
  const attachedTitles = (Array.isArray(parsedFiles) ? parsedFiles : [])
    .map((doc) => String(doc?.title || doc?.location || "").trim())
    .filter(Boolean);

  if (!attachedTitles.length) return null;

  return [
    "Attached Current Context Documents:",
    ...attachedTitles.map((title, index) => `${index + 1}. ${title}`),
    "",
    "These are the documents explicitly attached to the current chat context.",
    "If the user asks which files are attached, available in current context, or visible to you right now, answer from this list before mentioning broader workspace retrieval results.",
  ].join("\n");
}

module.exports = {
  buildAttachedContextManifest,
};
