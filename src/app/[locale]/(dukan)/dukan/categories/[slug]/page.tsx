import { CategoryListing } from "@/features/ordering/listing/category-listing";

export default function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CategoryListing params={params} searchParams={searchParams} />;
}
