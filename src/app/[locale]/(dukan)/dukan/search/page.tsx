import { SearchPage } from "@/features/ordering/search/search-page";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <SearchPage searchParams={searchParams} />;
}
