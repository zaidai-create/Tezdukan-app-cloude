import { Skeleton } from "@/components/ui/skeleton";

function AuthHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6 flex flex-col gap-2">
      <h1 className="font-heading text-3xl font-bold text-ink">{title}</h1>
      {subtitle ? <p className="text-base text-muted">{subtitle}</p> : null}
    </div>
  );
}

/** Matches a two-field auth form while it streams in. */
function AuthFormSkeleton({ fields = 2 }: { fields?: number }) {
  return (
    <div className="flex flex-col gap-5" aria-hidden>
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-12 w-full" />
        </div>
      ))}
      <Skeleton className="h-14 w-full" />
    </div>
  );
}

export { AuthFormSkeleton, AuthHeading };
