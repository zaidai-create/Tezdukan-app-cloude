"use client";

export type PositionProblem = "denied" | "failed";

function once(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

/**
 * The phone's position. GPS first; when it cannot get a fix in time (indoors, weak signal) the
 * network position is used instead, which is close enough to pick nearby dukans. A refused
 * permission is reported as "denied" so the screen can say how to turn it on.
 */
export async function getPosition(): Promise<{ lat: number; lng: number; accuracy: number }> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    throw new GeolocationProblem("failed");
  }
  const read = (position: GeolocationPosition) => ({
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: position.coords.accuracy,
  });
  try {
    return read(await once({ enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 }));
  } catch (error) {
    if (isDenied(error)) throw new GeolocationProblem("denied");
  }
  try {
    return read(await once({ enableHighAccuracy: false, timeout: 15_000, maximumAge: 600_000 }));
  } catch (error) {
    throw new GeolocationProblem(isDenied(error) ? "denied" : "failed");
  }
}

function isDenied(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as GeolocationPositionError).code === 1
  );
}

export class GeolocationProblem extends Error {
  constructor(readonly problem: PositionProblem) {
    super(problem);
  }
}
