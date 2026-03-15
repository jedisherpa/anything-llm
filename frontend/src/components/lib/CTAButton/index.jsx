import PrismHoverTarget from "@/components/PrismHoverTarget";

export default function CTAButton({
  children,
  disabled = false,
  onClick,
  className = "",
  type = "submit",
}) {
  return (
    <PrismHoverTarget>
      <button
        type={type}
        disabled={disabled}
        onClick={() => onClick?.()}
        className={`metacanon-cta-button border-none text-xs px-4 py-1 font-semibold rounded-lg h-[34px] -mr-8 whitespace-nowrap w-fit transition-all duration-200 ${className}`}
      >
        <div className="flex items-center justify-center gap-2">{children}</div>
      </button>
    </PrismHoverTarget>
  );
}
