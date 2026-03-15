import { X } from "@phosphor-icons/react/dist/csr/X";
import { STARTER_PACKS } from "@/utils/metacanonStarterPacks";
import { setActiveMetacanonAlignment } from "@/utils/metacanonAlignment";

export default function StarterPackSheet({ open = false, onClose = () => {} }) {
  if (!open) return null;

  function handleSelect(pack) {
    setActiveMetacanonAlignment({
      id: `starter-pack-${pack.id}`,
      title: pack.title,
      handle: pack.handle,
      collectionLabel: pack.collectionLabel,
      colorHex: pack.colorHex,
    });
    onClose();
  }

  return (
    <div className="metacanon-starter-sheet fixed inset-0 z-[90]">
      <button
        type="button"
        aria-label="Close starter packs"
        className="metacanon-starter-sheet__backdrop absolute inset-0 h-full w-full border-none bg-transparent"
        onClick={onClose}
      />

      <div className="metacanon-starter-sheet__panel absolute inset-x-0 bottom-0 mx-auto w-full max-w-[520px] rounded-t-[28px] px-5 pb-6 pt-5 md:left-1/2 md:right-auto md:bottom-8 md:w-[520px] md:-translate-x-1/2 md:rounded-[28px]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-theme-text-secondary">
              Alignment Menu
            </div>
            <h3 className="mt-2 text-[24px] font-semibold leading-tight text-theme-text-primary">
              Starter Packs
            </h3>
            <p className="mt-2 max-w-[34ch] text-sm leading-6 text-theme-text-secondary">
              Choose a starting alignment for Prism. Each pack routes your next
              prompt through a different Lens or Council flow.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="metacanon-starter-sheet__close flex h-10 w-10 items-center justify-center rounded-full border-none"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        <div className="mt-5 grid gap-3">
          {STARTER_PACKS.map((pack) => (
            <button
              key={pack.id}
              type="button"
              onClick={() => handleSelect(pack)}
              className="metacanon-starter-pack-card flex items-center gap-4 rounded-[20px] px-4 py-4 text-left transition-all"
              style={{ "--pack-color": pack.colorHex }}
            >
              <div className="metacanon-starter-pack-card__glyph flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-[12px] font-semibold uppercase tracking-[0.14em]">
                {pack.glyph}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-[15px] font-semibold text-theme-text-primary">
                    {pack.title}
                  </div>
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: pack.colorHex }}
                  />
                </div>
                <div className="mt-1 text-sm leading-6 text-theme-text-secondary">
                  {pack.subtitle}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
