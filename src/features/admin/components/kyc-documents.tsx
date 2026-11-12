import { FileWarning, IdCard } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatCnic } from "@/features/onboarding/schemas";

export type KycView = {
  cnicNumber: string;
  ntn: string | null;
  strn: string | null;
  /** Short-lived signed links (null when a file could not be signed). */
  front: string | null;
  back: string | null;
  place: string | null;
};

/**
 * What a dukan or distributor sent to register: the CNIC number, both sides and the shop (or
 * warehouse) photo, each opening full size in a new tab. Used on Approvals and on every dukan
 * and distributor, whatever its status. Renders on the server or the client.
 */
export function KycDocuments({ documents }: { documents: KycView | null }) {
  const t = useTranslations("admin.approvals");
  if (!documents) {
    return (
      <p className="flex items-start gap-2 rounded-md bg-awning-soft p-3 text-sm text-awning-ink">
        <FileWarning aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
        {t("noDocuments")}
      </p>
    );
  }
  const photos = [
    { key: "front", label: t("cnicFront"), url: documents.front },
    { key: "back", label: t("cnicBack"), url: documents.back },
    { key: "place", label: t("placePhoto"), url: documents.place },
  ];
  return (
    <section
      className="flex flex-col gap-2 rounded-md bg-subtle/60 p-3"
      aria-label={t("documents")}
    >
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <IdCard aria-hidden className="size-4 text-primary-strong" strokeWidth={1.75} />
          {t("cnic")}{" "}
          <span dir="ltr" className="num tracking-wide">
            {formatCnic(documents.cnicNumber)}
          </span>
        </span>
        {documents.ntn ? (
          <span>
            {t("ntn")}{" "}
            <span dir="ltr" className="num">
              {documents.ntn}
            </span>
          </span>
        ) : null}
        {documents.strn ? (
          <span>
            {t("strn")}{" "}
            <span dir="ltr" className="num">
              {documents.strn}
            </span>
          </span>
        ) : null}
      </p>
      <ul className="grid grid-cols-3 gap-2">
        {photos.map((photo) => (
          <li key={photo.key} className="flex flex-col gap-1">
            {photo.url ? (
              <a
                href={photo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block aspect-[4/3] overflow-hidden rounded-md border border-border/60 bg-surface"
              >
                {/* A signed link that expires in minutes: the image optimiser would keep a
                    copy of a private document, so the browser loads it directly. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={photo.label} className="size-full object-cover" />
              </a>
            ) : (
              <span className="flex aspect-[4/3] items-center justify-center rounded-md border border-dashed border-border bg-surface">
                <FileWarning aria-hidden className="size-5 text-muted" strokeWidth={1.75} />
              </span>
            )}
            <span className="truncate text-xs font-semibold text-muted">{photo.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
