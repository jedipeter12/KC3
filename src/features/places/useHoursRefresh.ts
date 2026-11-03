import { useEffect, useRef, useState } from "react";
import { AppState, Platform } from "react-native";

import type { PublicPlaceSummary } from "../../types/database";

const MINUTE_MS = 60_000;
const HOURS_FRESHNESS_MS = 14 * 24 * 60 * MINUTE_MS;

/** Refresh only the visible screen; open-state calculation stays in PostgreSQL. */
export function useHoursRefresh(
  places: readonly PublicPlaceSummary[],
  refresh: () => Promise<void>,
  enabled: boolean,
): Date {
  const [now, setNow] = useState(() => new Date());
  const wasEnabled = useRef(false);
  const hadLoadedPlaces = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setNow(new Date()), 0);
    return () => clearTimeout(timer);
  }, [enabled, places]);

  useEffect(() => {
    if (!enabled) {
      wasEnabled.current = false;
      if (places.length > 0) hadLoadedPlaces.current = true;
      return;
    }
    if (!wasEnabled.current && hadLoadedPlaces.current) void refresh();
    wasEnabled.current = true;
    hadLoadedPlaces.current = true;
  }, [enabled, places, refresh]);

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let active =
      Platform.OS === "web"
        ? typeof document === "undefined" || !document.hidden
        : AppState.currentState === null || AppState.currentState === "active";

    const schedule = () => {
      if (!active) return;
      const currentTime = Date.now();
      let due = currentTime + MINUTE_MS;
      for (const place of places) {
        const transition = place.regular_hours_next_transition_at
          ? Date.parse(place.regular_hours_next_transition_at)
          : NaN;
        const stale =
          place.regular_hours_rule === "weekly" &&
          place.regular_hours_observed_at
            ? Date.parse(place.regular_hours_observed_at) +
              HOURS_FRESHNESS_MS +
              1
            : NaN;
        for (const boundary of [transition, stale]) {
          if (boundary > currentTime) due = Math.min(due, boundary);
        }
      }
      timer = setTimeout(() => {
        setNow(new Date());
        void refresh();
      }, due - currentTime);
    };
    const changeActivity = (nextActive: boolean) => {
      if (nextActive === active) return;
      active = nextActive;
      clearTimeout(timer);
      if (active) {
        setNow(new Date());
        void refresh();
        schedule();
      }
    };
    const visibilityChanged = () => changeActivity(!document.hidden);
    const subscription =
      Platform.OS === "web"
        ? undefined
        : AppState.addEventListener("change", (state) =>
            changeActivity(state === "active"),
          );
    if (Platform.OS === "web" && typeof document !== "undefined") {
      document.addEventListener("visibilitychange", visibilityChanged);
    }
    schedule();
    return () => {
      clearTimeout(timer);
      subscription?.remove();
      if (Platform.OS === "web" && typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", visibilityChanged);
      }
    };
  }, [enabled, now, places, refresh]);

  return now;
}
