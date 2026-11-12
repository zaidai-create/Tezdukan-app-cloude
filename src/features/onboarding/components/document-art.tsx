/**
 * Line drawings that show what photo goes in each box before one is taken: the front of a CNIC,
 * its back, and a dukan photographed from the street with a phone. Drawn in the theme's
 * tokens, so they sit quietly behind the camera button in light and dark mode. They show real
 * objects, so they do not mirror in Urdu.
 */

/** A CNIC front: chip, text lines and the photo on the end side. */
export function CnicFrontArt() {
  return (
    <svg aria-hidden viewBox="0 0 160 100" className="size-full">
      <rect
        x="1"
        y="1"
        width="158"
        height="98"
        rx="12"
        className="fill-subtle/60 stroke-border-strong/50"
        strokeWidth="1.5"
      />
      <rect x="14" y="14" width="22" height="9" rx="4.5" className="fill-border/80" />
      <rect x="42" y="16" width="56" height="5" rx="2.5" className="fill-border/80" />
      <rect
        x="14"
        y="38"
        width="22"
        height="16"
        rx="3"
        className="fill-awning-soft stroke-awning/50"
        strokeWidth="1"
      />
      <path d="M20 38v16M30 38v16M14 46h22" className="stroke-awning/50" strokeWidth="1" />
      <rect x="44" y="38" width="20" height="4" rx="2" className="fill-border" />
      <rect x="70" y="38" width="34" height="4" rx="2" className="fill-border/70" />
      <rect x="44" y="47" width="20" height="4" rx="2" className="fill-border" />
      <rect x="70" y="47" width="28" height="4" rx="2" className="fill-border/70" />
      <rect x="44" y="56" width="20" height="4" rx="2" className="fill-border" />
      <rect x="70" y="56" width="22" height="4" rx="2" className="fill-border/70" />
      <rect x="112" y="34" width="34" height="42" rx="5" className="fill-subtle" />
      <circle cx="129" cy="50" r="7" className="fill-border-strong/30" />
      <path d="M116 76c2-9 7-13 13-13s11 4 13 13" className="fill-border-strong/30" />
      <rect x="14" y="80" width="80" height="5" rx="2.5" className="fill-border/60" />
    </svg>
  );
}

/** A CNIC back: a small photo, address lines and a code square. */
export function CnicBackArt() {
  return (
    <svg aria-hidden viewBox="0 0 160 100" className="size-full">
      <rect
        x="1"
        y="1"
        width="158"
        height="98"
        rx="12"
        className="fill-subtle/60 stroke-border-strong/50"
        strokeWidth="1.5"
      />
      <rect x="14" y="13" width="15" height="19" rx="3" className="fill-subtle" />
      <circle cx="21.5" cy="20" r="3.5" className="fill-border-strong/30" />
      <path d="M15.5 32c1-4 3.5-6 6-6s5 2 6 6" className="fill-border-strong/30" />
      <rect x="38" y="16" width="62" height="5" rx="2.5" className="fill-border/80" />
      <rect x="38" y="25" width="44" height="4" rx="2" className="fill-border/60" />
      <rect x="22" y="44" width="78" height="4" rx="2" className="fill-border" />
      <rect x="22" y="53" width="70" height="4" rx="2" className="fill-border/80" />
      <rect x="22" y="62" width="60" height="4" rx="2" className="fill-border/70" />
      <rect x="112" y="40" width="34" height="34" rx="4" className="fill-subtle" />
      <path
        d="M117 45h9v9h-9zM132 45h9v9h-9zM117 60h9v9h-9zM132 60h4v4h-4zM137 65h4v4h-4z"
        className="fill-border-strong/40"
      />
      <rect x="14" y="82" width="132" height="4" rx="2" className="fill-border/60" />
    </svg>
  );
}

/** A dukan with its awning and signboard, framed by a phone held up to photograph it. */
export function ShopFrontArt({ sign }: { sign: string }) {
  const stripes = Array.from({ length: 10 }, (_, index) => index);
  return (
    <svg aria-hidden viewBox="0 0 320 150" className="size-full">
      {/* Street and the shops on either side. */}
      <rect x="0" y="132" width="320" height="18" className="fill-subtle" />
      <rect
        x="12"
        y="44"
        width="60"
        height="88"
        rx="3"
        className="fill-surface stroke-border/80"
        strokeWidth="1.5"
      />
      <rect
        x="248"
        y="44"
        width="60"
        height="88"
        rx="3"
        className="fill-surface stroke-border/80"
        strokeWidth="1.5"
      />
      <rect x="22" y="58" width="40" height="30" rx="2" className="fill-subtle" />
      <rect x="258" y="58" width="40" height="30" rx="2" className="fill-subtle" />
      {/* The dukan. */}
      <rect
        x="84"
        y="22"
        width="152"
        height="110"
        rx="4"
        className="fill-surface stroke-border-strong/50"
        strokeWidth="1.5"
      />
      <rect
        x="96"
        y="30"
        width="128"
        height="20"
        rx="4"
        className="fill-primary-soft stroke-primary/40"
        strokeWidth="1"
      />
      <text
        x="160"
        y="44"
        textAnchor="middle"
        className="fill-primary-strong font-heading"
        style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.6 }}
      >
        {sign}
      </text>
      {stripes.map((index) => (
        <path
          key={index}
          d={`M${84 + index * 15.2} 56h15.2v12a7.6 7.6 0 0 1-15.2 0z`}
          className={index % 2 === 0 ? "fill-awning" : "fill-surface"}
        />
      ))}
      <path d="M84 56h152" className="stroke-awning-ink/30" strokeWidth="1" />
      <rect x="100" y="80" width="56" height="52" rx="2" className="fill-subtle" />
      <rect x="166" y="80" width="54" height="40" rx="2" className="fill-subtle" />
      <path d="M128 80v52" className="stroke-border-strong/40" strokeWidth="1" />
      {/* The phone taking the photo. */}
      <rect x="118" y="70" width="84" height="74" rx="9" className="fill-ink" />
      <rect x="123" y="75" width="74" height="64" rx="5" className="fill-surface" />
      <rect x="128" y="81" width="64" height="9" rx="2" className="fill-primary-soft" />
      {stripes.slice(0, 8).map((index) => (
        <path
          key={index}
          d={`M${128 + index * 8} 93h8v5a4 4 0 0 1-8 0z`}
          className={index % 2 === 0 ? "fill-awning" : "fill-subtle"}
        />
      ))}
      <rect x="133" y="104" width="22" height="30" rx="1.5" className="fill-subtle" />
      <rect x="161" y="104" width="26" height="20" rx="1.5" className="fill-subtle" />
    </svg>
  );
}
