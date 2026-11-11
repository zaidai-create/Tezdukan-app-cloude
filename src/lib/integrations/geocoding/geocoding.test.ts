import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheLife: () => undefined }));

import { formatAddressLine, geocodingProvider, reverseGeocode, searchPlaces } from "./index";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("formatAddressLine", () => {
  it("gives road, mohalla and city, without country or postcode", () => {
    expect(
      formatAddressLine({
        road: "Prince Ali Road",
        neighbourhood: "Heerabad",
        city: "Hyderabad",
      }),
    ).toBe("Prince Ali Road, Heerabad, Hyderabad");
  });

  it("puts a named place first and keeps the house number with the road", () => {
    expect(
      formatAddressLine(
        { house_number: "12", road: "Auto Bhan Road", suburb: "Latifabad", city: "Hyderabad" },
        "Boulevard Mall",
      ),
    ).toBe("Boulevard Mall, 12 Auto Bhan Road, Latifabad, Hyderabad");
  });

  it("does not repeat a part that says the same thing twice", () => {
    expect(formatAddressLine({ suburb: "Hyderabad", city: "Hyderabad" })).toBe("Hyderabad");
  });

  it("writes the city one plain way, in the language asked for", () => {
    expect(
      formatAddressLine({ neighbourhood: "Dadan Shah", county: "Hyderabad City Taluka" }),
    ).toBe("Dadan Shah, Hyderabad");
    expect(formatAddressLine({ road: "Bakhtawar Colony Road", city: "حیدرآباد" })).toBe(
      "Bakhtawar Colony Road, Hyderabad",
    );
    expect(formatAddressLine({ road: "Station Road", city: "Hyderabad" }, null, "ur,en")).toBe(
      "Station Road, حیدرآباد",
    );
    expect(formatAddressLine({ road: "Main Road", county: "Kotri Taluka" })).toBe(
      "Main Road, Kotri",
    );
  });

  it("falls back to the place name, then to nothing", () => {
    expect(formatAddressLine(null, "Rani Bagh")).toBe("Rani Bagh");
    expect(formatAddressLine({})).toBeNull();
  });
});

describe("geocoder", () => {
  it("uses OpenStreetMap unless told to run in Sandbox", () => {
    expect(geocodingProvider()).toBe("nominatim");
    vi.stubEnv("GEOCODING_PROVIDER", "sandbox");
    expect(geocodingProvider()).toBe("sandbox");
  });

  it("makes no network call in Sandbox", async () => {
    vi.stubEnv("GEOCODING_PROVIDER", "sandbox");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await reverseGeocode(25.396, 68.358, "en")).toBeNull();
    expect(await searchPlaces("Latifabad", "en")).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads the address at a pin and identifies the app to the geocoder", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          display_name: "Prince Ali Road, Heerabad, Hyderabad, Sindh, 71000, Pakistan",
          address: { road: "Prince Ali Road", neighbourhood: "Heerabad", city: "Hyderabad" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    expect(await reverseGeocode(25.39412, 68.37133, "en")).toBe(
      "Prince Ali Road, Heerabad, Hyderabad",
    );
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe("/reverse");
    expect(url.searchParams.get("lat")).toBe("25.3941");
    expect(new Headers(init.headers).get("User-Agent")).toContain("TezDukan");
  });

  it("answers with nothing, not an error, when the geocoder is down", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("busy", { status: 503 })));
    expect(await reverseGeocode(25.4, 68.36, "en")).toBeNull();
    expect(await searchPlaces("Qasimabad", "ur")).toEqual([]);
  });

  it("searches inside Hyderabad only, and not for one or two letters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            lat: "25.3792",
            lon: "68.3683",
            name: "Latifabad",
            display_name: "Latifabad, Hyderabad, Sindh, Pakistan",
            address: { suburb: "Latifabad", city: "Hyderabad" },
          },
        ]),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    expect(await searchPlaces("la", "en")).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await searchPlaces("  Latifabad ", "en")).toEqual([
      { label: "Latifabad, Hyderabad", lat: 25.3792, lng: 68.3683 },
    ]);
    const [url] = fetchMock.mock.calls[0] as [URL];
    expect(url.searchParams.get("bounded")).toBe("1");
    expect(url.searchParams.get("countrycodes")).toBe("pk");
  });
});
