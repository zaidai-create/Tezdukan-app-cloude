"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";
import { requestAccountDeletion } from "../actions";

/** The final step: an optional reason, an explicit "I understand", then the request. */
export function DeletionForm() {
  const t = useTranslations("dataDeletion");
  const [reason, setReason] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <form
      className="flex flex-col gap-4 rounded-lg border border-danger/25 bg-surface p-4 shadow-card"
      onSubmit={(event) => {
        event.preventDefault();
        if (!understood) return;
        setFailed(false);
        startTransition(async () => {
          const result = await requestAccountDeletion(reason);
          if (!result.ok) return setFailed(true);
          // Signed out now: replace the page so nothing of the old session stays on screen.
          router.replace("/data-deletion?done=1");
          router.refresh();
        });
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-ink">{t("reasonLabel")}</span>
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={1000}
          placeholder={t("reasonPlaceholder")}
        />
      </label>
      <label className="flex min-h-12 items-start gap-3">
        <Checkbox
          checked={understood}
          onCheckedChange={(value) => setUnderstood(value === true)}
          className="mt-0.5"
        />
        <span className="text-sm text-ink">{t("confirm")}</span>
      </label>
      {failed ? (
        <p role="alert" className="text-sm font-semibold text-danger-ink">
          {t("error")}
        </p>
      ) : null}
      <Button
        type="submit"
        variant="danger"
        size="lg"
        block
        loading={pending}
        disabled={!understood}
      >
        <Trash2 aria-hidden />
        {t("button")}
      </Button>
    </form>
  );
}
