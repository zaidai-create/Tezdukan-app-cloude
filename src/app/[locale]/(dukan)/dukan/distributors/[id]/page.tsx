import { DistributorListing } from "@/features/ordering/listing/distributor-listing";

export default function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <DistributorListing params={params} searchParams={searchParams} />;
}
