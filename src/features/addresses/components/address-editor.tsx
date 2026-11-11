"use client";

import { cn } from "cn";
import {
  ArrowLeft,
  Check,
  CircleAlert,
  Loader2,
  LocateFixed,
  MapPin,
  Search,
  Store,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useOffline } from "next/offline";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { PinMap, type MapPoint, type PinMapHandle } from "@/components/maps/pin-map";
import { Button } from "@/components/ui/button";
import { ChoiceChips } from "@/components/ui/choice-chips";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StickyActionBar } from "@/components/ui/sticky-action-bar";
import { Textarea } from "@/components/ui/textarea";
import { rememberDeliveryPoint } from "@/features/storefront/use-delivery-point";
import { Link, useRouter } from "@/i18n/navigation";
import { GeolocationProblem, getPosition } from "@/lib/geolocation";
import { haptic } from "@/lib/haptics";
import type { GeocodedPlace } from "@/lib/integrations/geocoding";
import {
  deleteAddress,
  describePin,
  findPlaces,
  saveAddress,
  type PinDescription,
} from "../actions";
import {
  addressLabels,
  addressText,
  labelKey,
  MAX_ADDRESSES,
  metresBetween,
  type AddressLabel,
  type SavedAddress,
} from "../schemas";

// Zooming the map nudges its centre by a few metres; that is not a new place.
const SAME_PLACE_M = 8;
const SETTLE_MS = 450;

/**
 * One screen to add or change a delivery address: slide the map until the pin is on the
 * door (or let the phone find it), check the address it reads, add the house or flat and a
 * landmark. As the pin moves the screen says how many dukans deliver there, so nobody saves
 * an address and only then learns that nothing reaches it.
 */
export function AddressEditor({
  address,
  start,
  startKnown,
  selected,
  next,
}: {
  /** The saved address being changed; null for a new one. */
  address: SavedAddress | null;
  /** Where the map opens. */
  start: MapPoint;
  /** False when that is only the city centre, because nothing better is known yet. */
  startKnown: boolean;
  /** Orders already go to this address, so saving must refresh the delivery point. */
  selected: boolean;
  /** Where to go once the address is saved. */
  next: string;
}) {
  const t = useTranslations("addresses");
  const tLabels = useTranslations("storefront.cart.labels");
  const router = useRouter();
  const offline = useOffline();
  const map = useRef<PinMapHandle>(null);

  const [label, setLabel] = useState<AddressLabel>(address ? labelKey(address.label) : "Home");
  const [line1, setLine1] = useState(address?.line1 ?? "");
  const [line2, setLine2] = useState(address?.line2 ?? "");
  const [landmark, setLandmark] = useState(address?.landmark ?? "");
  const [point, setPoint] = useState<MapPoint>(start);
  // A pin on the bare city centre is nobody's address: the person has to place it first.
  const [pinned, setPinned] = useState(startKnown);
  // The address text follows the map until the person types their own words.
  const [followMap, setFollowMap] = useState(!address);
  const follow = useRef(!address);
  const [info, setInfo] = useState<PinDescription | null>(null);
  // True from the start when there is a known point: it is described as the screen opens.
  const [looking, setLooking] = useState(startKnown);
  const [locating, setLocating] = useState(false);
  const [problem, setProblem] = useState<"denied" | "failed" | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodedPlace[] | null>(null);
  const [searching, startSearching] = useTransition();
  const [saving, startSaving] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, startDeleting] = useTransition();

  const request = useRef(0);
  const described = useRef<MapPoint | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const setFollow = (value: boolean) => {
    follow.current = value;
    setFollowMap(value);
  };

  // Asks what is at the pin. State changes only when the answer arrives, so it is safe to
  // call from the mount effect.
  const ask = useCallback((target: MapPoint) => {
    const id = ++request.current;
    described.current = target;
    describePin(target)
      .then((result) => {
        // The pin has moved on since this was asked.
        if (id !== request.current) return;
        setLooking(false);
        if (!result.ok) return;
        setInfo(result.data);
        if (follow.current && result.data.line) setLine1(result.data.line);
      })
      .catch(() => {
        if (id === request.current) setLooking(false);
      });
  }, []);

  const describe = useCallback(
    (target: MapPoint) => {
      setLooking(true);
      ask(target);
    },
    [ask],
  );

  useEffect(() => {
    // A known starting point is worth describing at once; the bare city centre is not.
    if (startKnown) ask(start);
    return () => clearTimeout(timer.current);
    // Runs once: the starting point never changes while the screen is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const settle = useCallback(
    (where: MapPoint) => {
      if (described.current && metresBetween(described.current, where) < SAME_PLACE_M) return;
      setPoint(where);
      setPinned(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => describe(where), SETTLE_MS);
    },
    [describe],
  );

  const goTo = (target: MapPoint) => {
    setFollow(true);
    setPinned(true);
    // The map reports the move itself; without a map yet, describe the point directly.
    if (!map.current?.moveTo(target)) {
      setPoint(target);
      describe(target);
    }
  };

  const locate = async () => {
    setLocating(true);
    setProblem(null);
    try {
      const position = await getPosition();
      haptic("success");
      goTo({ lat: position.lat, lng: position.lng });
    } catch (error) {
      haptic("warning");
      setProblem(error instanceof GeolocationProblem ? error.problem : "failed");
    } finally {
      setLocating(false);
    }
  };

  const search = () => {
    if (query.trim().length < 2) return;
    startSearching(async () => {
      const found = await findPlaces(query);
      setResults(found.ok ? found.data : []);
    });
  };

  const canSave = pinned && line1.trim().length >= 5;

  const save = () => {
    if (!pinned) {
      haptic("warning");
      toast.error(t("pinFirst"));
      return;
    }
    startSaving(async () => {
      const result = await saveAddress({
        id: address?.id,
        label,
        line1,
        line2: line2.trim() || undefined,
        landmark: landmark.trim() || undefined,
        lat: point.lat,
        lng: point.lng,
      });
      if (!result.ok) {
        haptic("warning");
        toast.error(t(`errors.${result.error}`, { count: MAX_ADDRESSES }));
        return;
      }
      // A new address is where the next order goes; an edited one only if it already was.
      if (!address || selected) {
        rememberDeliveryPoint({
          lat: point.lat,
          lng: point.lng,
          label: result.data.line1,
          addressId: result.data.id,
        });
      }
      haptic("success");
      toast.success(t("saved"));
      router.replace(next);
      router.refresh();
    });
  };

  const remove = () => {
    if (!address) return;
    startDeleting(async () => {
      const result = await deleteAddress(address.id);
      if (!result.ok) {
        haptic("warning");
        toast.error(t("errors.generic"));
        return;
      }
      // The delivery point stays where it was, but it is no longer a saved address.
      if (selected) {
        rememberDeliveryPoint({ lat: point.lat, lng: point.lng, label: address.line1 });
      }
      haptic("success");
      toast.success(t("deleted"));
      router.replace(next);
      router.refresh();
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pt-5 pb-8">
      <header className="flex items-center gap-3">
        <Link
          href={next}
          aria-label={t("back")}
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface text-ink shadow-card"
        >
          <ArrowLeft aria-hidden className="size-5 rtl:-scale-x-100" strokeWidth={1.75} />
        </Link>
        <h1 className="font-heading text-2xl font-bold text-ink">
          {address ? t("editTitle") : t("addTitle")}
        </h1>
      </header>

      <form
        role="search"
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          search();
        }}
      >
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute start-3.5 top-1/2 size-5 -translate-y-1/2 text-muted"
            strokeWidth={1.75}
          />
          <Input
            type="search"
            enterKeyHint="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value.slice(0, 80));
              setResults(null);
            }}
            placeholder={t("search")}
            aria-label={t("search")}
            className="ps-11"
          />
        </div>
        <Button type="submit" variant="soft" loading={searching} disabled={query.trim().length < 2}>
          {t("searchButton")}
        </Button>
      </form>
      {results ? (
        results.length > 0 ? (
          <ul className="-mt-2 flex flex-col overflow-hidden rounded-lg border border-border/70 bg-surface shadow-card">
            {results.map((place) => (
              <li
                key={`${place.lat},${place.lng}`}
                className="border-b border-border/60 last:border-0"
              >
                <button
                  type="button"
                  onClick={() => {
                    haptic("tap");
                    setResults(null);
                    setQuery("");
                    goTo(place);
                  }}
                  className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-start active:bg-subtle"
                >
                  <MapPin aria-hidden className="size-5 shrink-0 text-primary" strokeWidth={1.75} />
                  <span className="min-w-0 flex-1 text-sm font-semibold text-ink">
                    {place.label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p role="status" className="-mt-2 text-sm text-muted">
            {t("searchEmpty")}
          </p>
        )
      ) : null}

      <div className="flex flex-col gap-2">
        <PinMap
          ref={map}
          initial={start}
          initialZoom={startKnown ? 17 : 13}
          onSettle={settle}
          label={t("mapLabel")}
          className="h-[38dvh] max-h-96 min-h-60"
        >
          <p className="w-fit max-w-full rounded-full bg-surface/95 px-3 py-1.5 text-sm font-semibold text-ink shadow-raised">
            {t("mapHint")}
          </p>
        </PinMap>
        {offline ? (
          <p role="status" className="rounded-md bg-awning-soft px-3 py-2 text-sm text-awning-ink">
            {t("offline")}
          </p>
        ) : null}
        <Button
          type="button"
          variant="soft"
          size="lg"
          block
          loading={locating}
          onClick={() => void locate()}
        >
          <LocateFixed aria-hidden />
          {locating ? t("locating") : t("useCurrent")}
        </Button>
        {problem ? (
          <p role="alert" className="rounded-md bg-awning-soft px-3 py-2 text-sm text-awning-ink">
            {problem === "denied" ? t("denied") : t("failed")}
          </p>
        ) : null}
        <Coverage pinned={pinned} looking={looking} info={info} />
      </div>

      <section className="flex flex-col gap-4 rounded-lg border border-border/60 bg-surface p-4 shadow-card">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="address-line1">{t("line1")}</Label>
            {info?.sandbox ? (
              <span className="rounded-full bg-awning-soft px-2.5 py-0.5 text-xs font-bold text-awning-ink">
                {t("sandbox")}
              </span>
            ) : null}
          </div>
          <Textarea
            id="address-line1"
            rows={2}
            dir="auto"
            value={line1}
            maxLength={200}
            autoComplete="street-address"
            placeholder={t("line1Placeholder")}
            onChange={(event) => {
              setFollow(false);
              setLine1(event.target.value);
            }}
          />
          <p className="text-sm text-muted">
            {info?.sandbox ? t("sandboxHint") : followMap ? t("line1Hint") : t("line1Typed")}
          </p>
          {!followMap && info?.line && info.line !== line1.trim() ? (
            <button
              type="button"
              onClick={() => {
                setFollow(true);
                setLine1(info.line ?? "");
              }}
              className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-full bg-primary-soft px-4 text-sm font-semibold text-primary-strong"
            >
              <MapPin aria-hidden className="size-4" strokeWidth={1.75} />
              {t("fromMap")}
            </button>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="address-line2">{t("line2")}</Label>
          <Input
            id="address-line2"
            dir="auto"
            value={line2}
            maxLength={80}
            autoComplete="address-line2"
            placeholder={t("line2Placeholder")}
            onChange={(event) => setLine2(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="address-landmark">{t("landmark")}</Label>
          <Input
            id="address-landmark"
            dir="auto"
            value={landmark}
            maxLength={120}
            placeholder={t("landmarkPlaceholder")}
            onChange={(event) => setLandmark(event.target.value)}
          />
          <p className="text-sm text-muted">{t("landmarkHint")}</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-semibold text-ink">{t("saveAs")}</p>
          <ChoiceChips
            options={addressLabels}
            value={label}
            onChange={setLabel}
            label={t("saveAs")}
            render={(option) => tLabels(option)}
          />
        </div>
      </section>

      {address ? (
        <Button
          type="button"
          variant="danger-soft"
          block
          onClick={() => setConfirmDelete(true)}
          disabled={saving}
        >
          <Trash2 aria-hidden />
          {t("delete")}
        </Button>
      ) : null}

      <StickyActionBar className="bottom-[calc(var(--safe-bottom)+12px)]">
        <Button size="lg" block loading={saving} disabled={!canSave} onClick={save}>
          <Check aria-hidden />
          {t("save")}
        </Button>
      </StickyActionBar>

      {address ? (
        <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("deleteConfirmTitle")}</DialogTitle>
              <DialogDescription>
                {tLabels(labelKey(address.label))}: {addressText(address)}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                {t("keep")}
              </Button>
              <Button variant="danger" loading={deleting} onClick={remove}>
                <Trash2 aria-hidden />
                {t("delete")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

/** "3 dukans deliver here", read out as the pin settles. */
function Coverage({
  pinned,
  looking,
  info,
}: {
  pinned: boolean;
  looking: boolean;
  info: PinDescription | null;
}) {
  const t = useTranslations("addresses");
  if (!pinned) {
    return (
      <p className="flex items-center gap-2 rounded-md bg-subtle px-3 py-2.5 text-sm font-semibold text-ink">
        <MapPin aria-hidden className="size-5 shrink-0 text-primary" strokeWidth={1.75} />
        {t("pinFirst")}
      </p>
    );
  }
  // Nothing could be read (no connection): the address fields below still work.
  if (!looking && info === null) return null;
  const none = info !== null && info.dukans === 0;
  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        "flex min-h-11 items-center gap-2 rounded-md px-3 py-2.5 text-sm font-semibold",
        none ? "bg-awning-soft text-awning-ink" : "bg-primary-soft text-primary-strong",
      )}
    >
      {looking || info === null ? (
        <>
          <Loader2
            aria-hidden
            className="size-5 shrink-0 animate-spin motion-reduce:animate-none"
          />
          {t("looking")}
        </>
      ) : none ? (
        <>
          <CircleAlert aria-hidden className="size-5 shrink-0" strokeWidth={1.75} />
          {t("noCoverage")}
        </>
      ) : (
        <>
          <Store aria-hidden className="size-5 shrink-0" strokeWidth={1.75} />
          <span className="num">{t("coverage", { count: info.dukans })}</span>
        </>
      )}
    </p>
  );
}
