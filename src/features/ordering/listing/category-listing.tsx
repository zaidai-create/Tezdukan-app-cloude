import Image from "next/image";
import { getLocale } from "next-intl/server";
import { connection } from "next/server";
import { Suspense } from "react";
import { getCategoryBySlug, requireDukan } from "../data";
import { storageUrl } from "../images";
import { localName } from "../labels";
import { first } from "./params";
import { ListingSkeleton, ProductListing } from "./product-listing";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function CategoryContent({ params, searchParams }: Props) {
  await connection();
  const { slug } = await params;
  const { shopId } = await requireDukan(`/dukan/categories/${slug}`);
  const [category, query, locale] = await Promise.all([
    getCategoryBySlug(slug),
    searchParams,
    getLocale(),
  ]);
  const image = storageUrl(category.image_path);
  return (
    <ProductListing
      shopId={shopId}
      title={localName(category, locale)}
      basePath={`/dukan/categories/${slug}`}
      backHref="/dukan/categories"
      params={{ sort: first(query.sort), stock: first(query.stock), schemes: first(query.schemes) }}
      browse={{ categoryId: category.id }}
      visual={
        image ? (
          <span className="relative size-14 shrink-0 overflow-hidden rounded-md shadow-card">
            <Image src={image} alt="" fill sizes="56px" className="object-cover" />
          </span>
        ) : null
      }
    />
  );
}

export function CategoryListing(props: Props) {
  return (
    <Suspense fallback={<ListingSkeleton />}>
      <CategoryContent {...props} />
    </Suspense>
  );
}
