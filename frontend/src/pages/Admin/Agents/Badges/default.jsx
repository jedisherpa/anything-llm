export function DefaultBadge({ title: _title }) {
  return (
    <>
      <span
        className="w-fit"
        data-tooltip-id="default-skill"
        data-tooltip-content="This skill is enabled by default and cannot be turned off."
      >
        <div className="metacanon-lens-card__badge flex items-center gap-x-1 w-fit rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] cursor-pointer">
          Default
        </div>
      </span>
    </>
  );
}
