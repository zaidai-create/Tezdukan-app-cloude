import { SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Awning } from "@/components/brand/awning";
import { Logo } from "@/components/brand/logo";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("states");
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <Awning height={16} stripe={20} />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-5 py-10">
        <Logo markClassName="size-10" />
        <EmptyState
          icon={SearchX}
          awning={false}
          title={t("notFoundTitle")}
          description={t("notFoundBody")}
          action={
            <Button asChild size="lg">
              <Link href="/">{t("goHome")}</Link>
            </Button>
          }
        />
      </div>
    </div>
  );
}
