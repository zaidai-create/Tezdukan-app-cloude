import { Search } from "lucide-react";
import Form from "next/form";
import { getTranslations } from "next-intl/server";

/** Search across nearby dukans; submits to the Categories tab. */
export async function SearchBar({ defaultValue }: { defaultValue?: string }) {
  const t = await getTranslations("storefront");
  return (
    <Form action="/categories" role="search" className="relative">
      <label htmlFor="storefront-search" className="sr-only">
        {t("searchLabel")}
      </label>
      <Search
        aria-hidden
        className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-muted"
      />
      <input
        id="storefront-search"
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder={t("searchPlaceholder")}
        className="h-13 w-full rounded-full border border-border bg-surface ps-12 pe-4 text-base text-ink shadow-card outline-none placeholder:text-muted focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring [&::-webkit-search-cancel-button]:hidden"
      />
    </Form>
  );
}
