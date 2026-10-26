"use client";

import { useCallback, useRef, useState } from "react";

/**
 * A form's current error plus an attempt number that changes on every failure. Use the attempt
 * as the alert's `key`: the same error twice in a row then shakes again instead of sitting
 * still (updates inside one async transition are committed together, so clearing the error
 * first is not enough).
 */
export function useFormError<T = string>() {
  const attempts = useRef(0);
  const [error, setErrorState] = useState<{ value: T; attempt: number } | null>(null);
  const setError = useCallback((value: T | null) => {
    if (value === null) {
      setErrorState(null);
      return;
    }
    attempts.current += 1;
    setErrorState({ value, attempt: attempts.current });
  }, []);
  return [error, setError] as const;
}
