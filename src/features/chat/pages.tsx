import { cn } from "cn";
import { ChevronRight, LifeBuoy, MessageCircle, MessagesSquare } from "lucide-react";
import { getMessages, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { EmptyState } from "@/components/states/empty-state";
import { ListRowSkeleton } from "@/components/states/skeletons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { requireDistributor } from "@/features/distributor/data";
import { requireDukan, getShopDistributors } from "@/features/ordering/data";
import { storageUrl } from "@/features/ordering/images";
import { Link } from "@/i18n/navigation";
import { requireRole, requireSession } from "@/lib/auth/session";
import { businessDay, formatDate, formatTime } from "@/lib/format";
import { ChatThread } from "./components/chat-thread";
import { getConversation, getConversations, openConversation } from "./data";
import type { ConversationCard } from "./schemas";

/**
 * Chat screens. The same pieces serve the dukan (/dukan/chat), the distributor
 * (/distributor/chat), the customer (/account/support) and TezDukan staff (/admin/support).
 */
export type ChatArea = "dukan" | "distributor" | "admin";

const base: Record<ChatArea, string> = {
  dukan: "/dukan/chat",
  distributor: "/distributor/chat",
  admin: "/admin/support",
};
const orderBase: Record<ChatArea, string | null> = {
  dukan: "/dukan/orders",
  distributor: "/distributor/orders",
  admin: null,
};

function ListSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-5" aria-hidden>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-20 w-full rounded-lg" />
      <div className="rounded-lg border border-border bg-surface px-4">
        <ListRowSkeleton />
        <ListRowSkeleton />
        <ListRowSkeleton />
      </div>
    </div>
  );
}

function ThreadSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 py-4" aria-hidden>
      <Skeleton className="h-14 w-full rounded-lg" />
      <Skeleton className="h-12 w-2/3 rounded-2xl" />
      <Skeleton className="ms-auto h-12 w-1/2 rounded-2xl" />
      <Skeleton className="h-16 w-3/4 rounded-2xl" />
    </div>
  );
}

/** Quick replies are a message group ({r1, r2, ...}); read them in order. */
function replies(group: unknown): string[] {
  return Object.values(z.record(z.string(), z.string()).catch({}).parse(group));
}

function when(iso: string | null): string {
  if (!iso) return "";
  return businessDay(iso) === businessDay() ? formatTime(iso) : formatDate(iso);
}

async function ConversationRow({ card, area }: { card: ConversationCard; area: ChatArea }) {
  const t = await getTranslations("chat");
  const support = card.kind === "support" && card.my_side !== "staff";
  const name = support ? t("support") : card.counterpart.name;
  const preview =
    card.last_message_preview === "support_auto_reply" ? t("autoReply") : card.last_message_preview;
  return (
    <li>
      <Link
        href={`${base[area]}/${card.id}`}
        className="flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-subtle"
      >
        <Avatar className="size-12">
          {card.counterpart.image_path && !support ? (
            <AvatarImage
              src={storageUrl(card.counterpart.image_path, "shop-media") ?? undefined}
              alt=""
            />
          ) : null}
          <AvatarFallback
            name={name}
            className={support ? "bg-action text-on-action" : undefined}
          />
        </Avatar>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span
              className={cn(
                "truncate text-base text-ink",
                card.unread ? "font-bold" : "font-semibold",
              )}
            >
              {name}
            </span>
            <span className="num shrink-0 text-xs text-muted">
              {`⁦${when(card.last_message_at)}⁩`}
            </span>
          </span>
          <span className="flex items-center justify-between gap-2">
            <span className={cn("truncate text-sm", card.unread ? "text-ink" : "text-muted")}>
              {preview
                ? `${card.last_sender_side === card.my_side ? `${t("you")}: ` : ""}${preview}`
                : support
                  ? t("supportHint")
                  : ""}
            </span>
            {card.unread ? (
              <span className="num flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-action px-1.5 text-xs font-bold text-on-action">
                {card.unread}
                <span className="sr-only">{` ${t("unread", { count: card.unread })}`}</span>
              </span>
            ) : null}
          </span>
        </span>
      </Link>
    </li>
  );
}

async function ChatListContent({ area }: { area: Exclude<ChatArea, "admin"> }) {
  await connection();
  const t = await getTranslations("chat");
  let cards: ConversationCard[];
  let starters: { id: string; name: string; logo: string | null }[] = [];
  if (area === "dukan") {
    const { shopId } = await requireDukan(base.dukan);
    const [list, distributors] = await Promise.all([
      getConversations({ shopId }),
      getShopDistributors(shopId),
    ]);
    cards = list;
    starters = distributors
      .filter((d) => !list.some((c) => c.kind === "trade" && c.org_id === d.org_id))
      .map((d) => ({ id: d.org_id, name: d.name, logo: d.logo_path }));
  } else {
    const { orgId } = await requireDistributor(base.distributor);
    cards = await getConversations({ orgId });
  }
  const trade = cards.filter((c) => c.kind === "trade");
  const support = cards.find((c) => c.kind === "support");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-5">
      <h1 className="font-heading text-2xl font-extrabold text-ink lg:text-3xl">{t("title")}</h1>

      {support ? (
        <ul className="rounded-lg border border-border/70 bg-surface px-2 shadow-card">
          <ConversationRow card={support} area={area} />
        </ul>
      ) : (
        <Link
          href={`${base[area]}/support`}
          className="flex items-center gap-3 rounded-lg border border-border/70 bg-surface p-4 shadow-card"
        >
          <span className="sheen flex size-12 shrink-0 items-center justify-center rounded-full bg-action text-on-action inset-shadow-edge">
            <LifeBuoy aria-hidden className="size-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-ink">{t("support")}</span>
            <span className="block text-sm text-muted">{t("supportHint")}</span>
          </span>
          <ChevronRight aria-hidden className="size-5 text-muted rtl:-scale-x-100" />
        </Link>
      )}

      {trade.length > 0 ? (
        <ul className="divide-y divide-border/70 rounded-lg border border-border/70 bg-surface px-2 shadow-card">
          {trade.map((card) => (
            <ConversationRow key={card.id} card={card} area={area} />
          ))}
        </ul>
      ) : starters.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title={t("empty")}
          description={area === "dukan" ? t("emptyHint") : t("emptyDistributor")}
        />
      ) : null}

      {starters.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-lg font-bold text-ink">{t("startTitle")}</h2>
          <p className="text-sm text-muted">{t("startHint")}</p>
          <ul className="flex flex-col gap-2">
            {starters.map((starter) => (
              <li key={starter.id}>
                <Link
                  href={`${base.dukan}/with/${starter.id}`}
                  className="flex items-center gap-3 rounded-lg border border-border/70 bg-surface p-3 shadow-card"
                >
                  <Avatar className="size-11">
                    {starter.logo ? (
                      <AvatarImage
                        src={storageUrl(starter.logo, "shop-media") ?? undefined}
                        alt=""
                      />
                    ) : null}
                    <AvatarFallback name={starter.name} />
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate font-semibold text-ink">
                    {starter.name}
                  </span>
                  <MessageCircle aria-hidden className="size-5 text-primary-strong" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export function ChatListPage({ area }: { area: Exclude<ChatArea, "admin"> }) {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <ChatListContent area={area} />
    </Suspense>
  );
}

async function ChatThreadContent({
  area,
  params,
}: {
  area: ChatArea;
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  if (area === "dukan") await requireDukan(`${base.dukan}/${id}`);
  else if (area === "distributor") await requireDistributor(`${base.distributor}/${id}`);
  else await requireRole("admin", `${base.admin}/${id}`);
  const [detail, messages] = await Promise.all([
    getConversation(id, area === "admin" ? "staff" : undefined),
    getMessages(),
  ]);
  const quickKey =
    detail.conversation.kind === "support"
      ? area === "admin"
        ? null
        : "support"
      : detail.conversation.my_side === "org"
        ? "org"
        : "shop";
  const quick: unknown = quickKey ? messages.chat.quick[quickKey] : {};
  return (
    <ChatThread
      initial={detail}
      backHref={base[area]}
      quickReplies={replies(quick)}
      orderBasePath={orderBase[area]}
      as={area === "admin" ? "staff" : undefined}
    />
  );
}

export function ChatThreadPage(props: { area: ChatArea; params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<ThreadSkeleton />}>
      <ChatThreadContent {...props} />
    </Suspense>
  );
}

/** "Chat" buttons land here: get or start the conversation and show it in place. */
async function OpenChatContent({
  area,
  with: withId,
}: {
  area: Exclude<ChatArea, "admin">;
  with: Promise<string | null>;
}) {
  await connection();
  const other = await withId;
  if (other !== null && !z.uuid().safeParse(other).success) notFound();
  let id: string;
  if (area === "dukan") {
    const { shopId } = await requireDukan(base.dukan);
    id = await openConversation(
      other ? { kind: "trade", shopId, orgId: other } : { kind: "support", shopId },
    );
  } else {
    const { orgId } = await requireDistributor(base.distributor);
    id = await openConversation(
      other ? { kind: "trade", shopId: other, orgId } : { kind: "support", orgId },
    );
  }
  const [detail, messages] = await Promise.all([getConversation(id), getMessages()]);
  const quickKey = other ? (area === "dukan" ? "shop" : "org") : "support";
  return (
    <ChatThread
      initial={detail}
      backHref={base[area]}
      quickReplies={replies(messages.chat.quick[quickKey])}
      orderBasePath={orderBase[area]}
    />
  );
}

export function OpenChatPage(props: {
  area: Exclude<ChatArea, "admin">;
  with: Promise<string | null>;
}) {
  return (
    <Suspense fallback={<ThreadSkeleton />}>
      <OpenChatContent {...props} />
    </Suspense>
  );
}

/** A customer's support chat, shown in place (one conversation per person). */
async function CustomerSupportContent() {
  await connection();
  await requireSession();
  const id = await openConversation({ kind: "support" });
  const [detail, messages] = await Promise.all([getConversation(id), getMessages()]);
  return (
    <ChatThread
      initial={detail}
      backHref="/account"
      quickReplies={replies(messages.chat.quick.support)}
      orderBasePath={null}
    />
  );
}

export function CustomerSupportPage() {
  return (
    <Suspense fallback={<ThreadSkeleton />}>
      <CustomerSupportContent />
    </Suspense>
  );
}

/** TezDukan staff: every support conversation, newest first. */
async function SupportQueueContent() {
  await connection();
  await requireRole("admin", base.admin);
  const [cards, t] = await Promise.all([
    getConversations({ supportQueue: true }),
    getTranslations("chat.queue"),
  ]);
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-5 lg:px-8">
      <h1 className="font-heading text-2xl font-extrabold text-ink lg:text-3xl">{t("title")}</h1>
      {cards.length === 0 ? (
        <EmptyState icon={LifeBuoy} title={t("empty")} />
      ) : (
        <ul className="divide-y divide-border/70 rounded-lg border border-border/70 bg-surface px-2 shadow-card">
          {cards.map((card) => (
            <ConversationRow key={card.id} card={card} area="admin" />
          ))}
        </ul>
      )}
    </div>
  );
}

export function SupportQueuePage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <SupportQueueContent />
    </Suspense>
  );
}
