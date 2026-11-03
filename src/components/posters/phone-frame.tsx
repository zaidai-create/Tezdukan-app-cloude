import { cn } from "cn";
import Image from "next/image";

/**
 * A real app screen in a phone, turned a little in 3D like product marketing shots. The tilt
 * mirrors in RTL so the phone always faces the copy.
 */
export function PhoneFrame({
  src,
  className,
  tilt = "end",
  priority = false,
  sizes = "200px",
}: {
  src: string;
  className?: string;
  tilt?: "start" | "end" | "none";
  priority?: boolean;
  sizes?: string;
}) {
  return (
    <div className={cn("[perspective:1100px]", className)} aria-hidden>
      <div
        className={cn(
          "relative aspect-[390/844] w-full rounded-[18%/8.4%] bg-ink p-[3.2%] shadow-float [transform-style:preserve-3d]",
          tilt === "end" &&
            "[transform:rotateY(-16deg)_rotateX(5deg)_rotateZ(2deg)] rtl:[transform:rotateY(16deg)_rotateX(5deg)_rotateZ(-2deg)]",
          tilt === "start" &&
            "[transform:rotateY(16deg)_rotateX(5deg)_rotateZ(-2deg)] rtl:[transform:rotateY(-16deg)_rotateX(5deg)_rotateZ(2deg)]",
        )}
      >
        <div className="relative h-full w-full overflow-hidden rounded-[15%/7%] bg-surface">
          <Image
            src={src}
            alt=""
            fill
            sizes={sizes}
            priority={priority}
            className="object-cover object-top"
          />
        </div>
        <span className="absolute start-1/2 top-[2.2%] h-[2.6%] w-[30%] -translate-x-1/2 rounded-full bg-ink rtl:translate-x-1/2" />
        {/* Edge light: the glass catches the top-left light like the app's buttons. */}
        <span className="pointer-events-none absolute inset-0 rounded-[18%/8.4%] bg-gradient-to-br from-on-forest/15 via-transparent to-transparent" />
      </div>
    </div>
  );
}
