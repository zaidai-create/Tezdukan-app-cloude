import { cn } from "cn";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { PhoneFrame } from "./phone-frame";

export type PosterTone = "forest" | "mint" | "awning";
export type PosterChip = { icon: LucideIcon; title: string; sub?: string };

const tones: Record<PosterTone, { card: string; muted: string; cta: string; chipIcon: string }> = {
  forest: {
    card: "bg-forest text-on-forest",
    muted: "text-on-forest/80",
    cta: "bg-mint text-forest",
    chipIcon: "bg-primary-soft text-primary-strong",
  },
  mint: {
    card: "bg-mint-soft text-ink",
    muted: "text-ink/70",
    cta: "bg-forest text-on-forest",
    chipIcon: "bg-primary-soft text-primary-strong",
  },
  awning: {
    card: "bg-awning-soft text-ink",
    muted: "text-ink/70",
    cta: "bg-awning text-on-awning",
    chipIcon: "bg-awning-soft text-awning-ink",
  },
};

/** A floating notification-style card resting on the poster's phone. */
export function PosterChipCard({
  chip,
  tone,
  className,
}: {
  chip: PosterChip;
  tone: PosterTone;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex items-center gap-2 rounded-2xl bg-surface py-2 ps-2 pe-3 text-start text-ink shadow-raised motion-safe:animate-float",
        className,
      )}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-xl",
          tones[tone].chipIcon,
        )}
      >
        <chip.icon className="size-4" strokeWidth={1.75} />
      </span>
      <span className="min-w-0">
        <span className="block text-xs leading-tight font-bold whitespace-nowrap">
          {chip.title}
        </span>
        {chip.sub ? (
          <span className="num block text-[11px] leading-tight whitespace-nowrap text-muted">
            {chip.sub}
          </span>
        ) : null}
      </span>
    </div>
  );
}

/**
 * A promotional poster: short copy and one action on the start side, the real app screen in a
 * tilted phone on the end side, with up to two floating cards that show the moment it's about.
 */
export function Poster({
  tone,
  eyebrow,
  title,
  body,
  cta,
  screen,
  chips = [],
  priority = false,
}: {
  tone: PosterTone;
  eyebrow?: string;
  title: string;
  body: string;
  cta?: { href: string; label: string };
  screen: string;
  chips?: PosterChip[];
  priority?: boolean;
}) {
  const style = tones[tone];
  const [first, second] = chips;
  return (
    <article
      className={cn(
        "sheen relative isolate flex min-h-60 overflow-hidden rounded-[22px] p-5 shadow-raised inset-shadow-edge sm:min-h-64",
        style.card,
      )}
    >
      <div className="relative z-10 flex w-[58%] flex-col items-start sm:w-1/2">
        {eyebrow ? (
          <p className={cn("text-xs font-bold tracking-wide uppercase", style.muted)}>{eyebrow}</p>
        ) : null}
        <h3 className="mt-1 font-heading text-[22px] leading-[1.15] font-extrabold sm:text-2xl">
          {title}
        </h3>
        <p className={cn("mt-2 text-sm leading-snug", style.muted)}>{body}</p>
        {cta ? (
          <Link
            href={cta.href}
            className={cn(
              "relative mt-auto inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm font-bold shadow-card after:absolute after:-inset-1 sm:mt-4",
              style.cta,
            )}
          >
            {cta.label}
            <ArrowRight aria-hidden className="size-4 rtl:-scale-x-100" />
          </Link>
        ) : null}
      </div>

      <PhoneFrame
        src={screen}
        priority={priority}
        sizes="180px"
        className="absolute end-[-6px] top-6 w-[38%] max-w-44 sm:end-4"
      />
      {/* On phones one card sits on the phone's foot, clear of the copy; wide posters fit two. */}
      {first ? (
        <PosterChipCard
          chip={first}
          tone={tone}
          className="absolute end-3 bottom-4 z-10 max-w-[44%] sm:end-[22%] sm:top-[34%] sm:bottom-auto sm:max-w-[27%]"
        />
      ) : null}
      {second ? (
        <PosterChipCard
          chip={second}
          tone={tone}
          className="absolute end-3 bottom-4 z-10 hidden [animation-delay:-3s] sm:flex"
        />
      ) : null}
    </article>
  );
}
