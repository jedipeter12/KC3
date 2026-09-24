import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentRef } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  findNodeHandle,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScaledText as Text } from "../../components/ScaledText";
import {
  getPublicPlaceDetail,
  PUBLIC_PLACE_DETAILS_ERROR_MESSAGE,
} from "../../data/publicPlaces";
import type {
  PublicPlaceDetail,
  PublicPlaceSummary,
  PublicRegularHoursRow,
} from "../../types/database";
import {
  buildMapsUrl,
  DAY_LABELS,
  FOOD_LABELS,
  formatDate,
  formatHoursRows,
  getHoursStatus,
  OUTLET_LABELS,
  PLACE_TYPE_LABELS,
  WIFI_LABELS,
  WORK_LABELS,
} from "./placePresentation";

type DetailState =
  | { status: "loading" }
  | { status: "loaded"; place: PublicPlaceDetail }
  | { status: "missing" }
  | { status: "error" };

function openWithLinking(url: string): Promise<unknown> {
  return Linking.openURL(url);
}

export type PlaceDetailScreenProps = Readonly<{
  cachedSummary?: PublicPlaceSummary;
  loadPlaceDetail?: (placeId: string) => Promise<PublicPlaceDetail | null>;
  onBack: () => void;
  openExternalUrl?: (url: string) => Promise<unknown>;
  placeId: string;
}>;

function DetailValue({
  label,
  value,
}: Readonly<{ label: string; value: string }>) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function booleanLabel(value: boolean | null, yes: string, no: string): string {
  return value === null ? "Not yet KC3-verified" : value ? yes : no;
}

function rowsForDay(
  rows: readonly PublicRegularHoursRow[],
  day: number,
): PublicRegularHoursRow[] {
  return rows.filter((row) => row.day_of_week === day);
}

function VerificationCopy({ place }: Readonly<{ place: PublicPlaceDetail }>) {
  if (place.kc3_verification_state === "unverified") {
    return <Text style={styles.note}>KC3 details not yet verified</Text>;
  }
  if (place.kc3_verification_state === "stale") {
    return (
      <Text style={styles.warning}>
        KC3 details may have changed · Last verified{" "}
        {formatDate(place.kc3_last_verified_at!)}
      </Text>
    );
  }
  return (
    <Text style={styles.note}>
      KC3-verified {formatDate(place.kc3_last_verified_at!)}
    </Text>
  );
}

export function PlaceDetailScreen({
  cachedSummary,
  loadPlaceDetail = getPublicPlaceDetail,
  onBack,
  openExternalUrl = openWithLinking,
  placeId,
}: PlaceDetailScreenProps) {
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const headingRef = useRef<ComponentRef<typeof Text>>(null);
  const requestIdRef = useRef(0);

  const requestDetail = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    try {
      const place = await loadPlaceDetail(placeId);
      if (requestId !== requestIdRef.current) return;
      setState(place ? { status: "loaded", place } : { status: "missing" });
    } catch {
      if (requestId === requestIdRef.current) setState({ status: "error" });
    }
  }, [loadPlaceDetail, placeId]);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    void loadPlaceDetail(placeId).then(
      (place) => {
        if (requestId === requestIdRef.current) {
          setState(place ? { status: "loaded", place } : { status: "missing" });
        }
      },
      () => {
        if (requestId === requestIdRef.current) setState({ status: "error" });
      },
    );
    return () => {
      requestIdRef.current += 1;
    };
  }, [loadPlaceDetail, placeId]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const node = headingRef.current;
      if (!node) return;
      if (Platform.OS === "web") {
        (node as unknown as { focus?: () => void }).focus?.();
      } else {
        const handle = findNodeHandle(node);
        if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
      }
    }, 0);
    return () => clearTimeout(timeout);
  }, [placeId]);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const message =
      state.status === "loading"
        ? "Loading place details…"
        : state.status === "error"
          ? `Place details are unavailable. ${PUBLIC_PLACE_DETAILS_ERROR_MESSAGE}`
          : state.status === "missing"
            ? "Place unavailable"
            : `${state.place.name} details loaded`;
    AccessibilityInfo.announceForAccessibility(message);
  }, [state]);

  const visiblePlace = state.status === "loaded" ? state.place : cachedSummary;
  const weeklyRows = useMemo(() => {
    if (state.status !== "loaded") return [];
    return DAY_LABELS.map((label, day) => ({
      day,
      label,
      value: formatHoursRows(rowsForDay(state.place.regular_hours, day)),
    }));
  }, [state]);

  const retry = () => {
    setState({ status: "loading" });
    void requestDetail();
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.shell}>
        <Pressable
          accessibilityRole="button"
          onPress={onBack}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.backText}>‹ Places</Text>
        </Pressable>
        <ScrollView contentContainerStyle={styles.content}>
          {visiblePlace ? (
            <View style={styles.identity}>
              <Text
                accessibilityRole="header"
                ref={headingRef}
                style={styles.title}
                {...(Platform.OS === "web" ? { tabIndex: -1 } : {})}
              >
                {visiblePlace.name}
              </Text>
              <Text style={styles.type}>
                {PLACE_TYPE_LABELS[visiblePlace.place_type]}
              </Text>
              <Text style={styles.city}>{visiblePlace.city}</Text>
              {visiblePlace.address_precision === "approximate" ? (
                <Text style={styles.qualifier}>Approximate location</Text>
              ) : null}
              <Text style={styles.address}>{visiblePlace.address}</Text>
              <Text style={styles.hoursState}>
                {getHoursStatus(visiblePlace)}
              </Text>
              {visiblePlace.drive_thru_only === true ? (
                <Text style={styles.warning}>
                  Drive-thru only · no place to stay inside
                </Text>
              ) : null}
              <Pressable
                accessibilityRole="link"
                onPress={() =>
                  void openExternalUrl(
                    buildMapsUrl(
                      visiblePlace,
                      Platform.OS === "ios" ? "apple" : "google",
                    ),
                  )
                }
                style={({ pressed }) => [
                  styles.mapsButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.mapsButtonText}>Open in Maps</Text>
              </Pressable>
            </View>
          ) : null}

          {state.status === "loading" ? (
            <View accessibilityLiveRegion="polite" style={styles.stateBox}>
              <ActivityIndicator color="#176b55" size="large" />
              <Text style={styles.stateTitle}>Loading place details…</Text>
            </View>
          ) : null}

          {state.status === "error" ? (
            <View
              accessibilityLiveRegion="assertive"
              {...(Platform.OS === "web" ? { role: "alert" as const } : {})}
              style={styles.stateBox}
            >
              <Text accessibilityRole="header" style={styles.stateTitle}>
                Place details are unavailable
              </Text>
              <Text style={styles.stateMessage}>
                {PUBLIC_PLACE_DETAILS_ERROR_MESSAGE}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={retry}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.primaryButtonText}>Try again</Text>
              </Pressable>
            </View>
          ) : null}

          {state.status === "missing" ? (
            <View style={styles.stateBox}>
              <Text accessibilityRole="header" style={styles.stateTitle}>
                Place unavailable
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={onBack}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>Back to places</Text>
              </Pressable>
            </View>
          ) : null}

          {state.status === "loaded" ? (
            <>
              <View style={styles.section}>
                <Text
                  accessibilityRole="header"
                  style={styles.sectionTitle}
                  {...(Platform.OS === "web" ? { "aria-level": 2 } : {})}
                >
                  Good to know
                </Text>
                <VerificationCopy place={state.place} />
                <DetailValue
                  label="Good for work"
                  value={WORK_LABELS[state.place.work_suitability]}
                />
                <DetailValue
                  label="Seating"
                  value={
                    state.place.seating_notes || "Seating not yet KC3-verified"
                  }
                />
                <DetailValue
                  label="Outlets"
                  value={OUTLET_LABELS[state.place.outlets]}
                />
                <DetailValue
                  label="Wi-Fi"
                  value={WIFI_LABELS[state.place.wifi]}
                />
                <DetailValue
                  label="Food and drinks"
                  value={FOOD_LABELS[state.place.food_beverage]}
                />
                <DetailValue
                  label="Phone calls"
                  value={booleanLabel(
                    state.place.phone_calls_allowed,
                    "Phone calls okay",
                    "Phone calls not suitable",
                  )}
                />
                <DetailValue
                  label="Bathroom"
                  value={booleanLabel(
                    state.place.bathroom_available,
                    "Public bathroom available",
                    "No public bathroom",
                  )}
                />
                <DetailValue
                  label="Drive-thru"
                  value={booleanLabel(
                    state.place.drive_thru_available,
                    "Drive-thru available",
                    "No drive-thru",
                  )}
                />
              </View>

              <View style={styles.section}>
                <Text
                  accessibilityRole="header"
                  style={styles.sectionTitle}
                  {...(Platform.OS === "web" ? { "aria-level": 2 } : {})}
                >
                  Regular hours
                </Text>
                {state.place.place_local_day_of_week !== null &&
                state.place.regular_hours_available ? (
                  <View style={styles.todayBox}>
                    <Text style={styles.detailLabel}>Today</Text>
                    <Text style={styles.detailValue}>
                      {formatHoursRows(
                        rowsForDay(
                          state.place.regular_hours,
                          state.place.place_local_day_of_week,
                        ),
                      )}
                    </Text>
                  </View>
                ) : null}
                {state.place.regular_hours_available ? (
                  weeklyRows.map((row) => (
                    <DetailValue
                      key={row.day}
                      label={row.label}
                      value={row.value}
                    />
                  ))
                ) : (
                  <Text style={styles.note}>Hours unavailable</Text>
                )}
              </View>

              <View style={styles.section}>
                <Text
                  accessibilityRole="header"
                  style={styles.sectionTitle}
                  {...(Platform.OS === "web" ? { "aria-level": 2 } : {})}
                >
                  About this information
                </Text>
                <VerificationCopy place={state.place} />
                {state.place.regular_hours_observed_at ? (
                  <Text style={styles.note}>
                    Regular hours last checked{" "}
                    {formatDate(state.place.regular_hours_observed_at)}
                  </Text>
                ) : (
                  <Text style={styles.note}>
                    Regular hours have not been checked
                  </Text>
                )}
                <Text style={styles.note}>
                  Regular hours can change on holidays or for special events.
                </Text>
              </View>
            </>
          ) : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f5f1e8" },
  shell: {
    flex: 1,
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    paddingHorizontal: 20,
  },
  backButton: {
    minHeight: 44,
    alignSelf: "flex-start",
    justifyContent: "center",
    marginTop: 8,
    paddingRight: 18,
  },
  backText: { color: "#176b55", fontSize: 17, fontWeight: "700" },
  content: { paddingBottom: 40 },
  identity: { paddingBottom: 22 },
  title: { color: "#173f35", fontSize: 34, lineHeight: 40, fontWeight: "700" },
  type: {
    alignSelf: "flex-start",
    marginTop: 12,
    borderRadius: 999,
    backgroundColor: "#dcebe3",
    color: "#245746",
    fontSize: 14,
    fontWeight: "600",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  city: { marginTop: 16, color: "#273c36", fontSize: 17, fontWeight: "700" },
  qualifier: {
    marginTop: 7,
    color: "#7a5314",
    fontSize: 14,
    fontWeight: "700",
  },
  address: { marginTop: 3, color: "#52665f", fontSize: 16, lineHeight: 23 },
  hoursState: {
    marginTop: 14,
    color: "#173f35",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 23,
  },
  warning: {
    marginTop: 9,
    color: "#8a3e18",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 22,
  },
  mapsButton: {
    minHeight: 48,
    alignSelf: "flex-start",
    justifyContent: "center",
    marginTop: 18,
    borderRadius: 12,
    backgroundColor: "#176b55",
    paddingHorizontal: 20,
  },
  mapsButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  pressed: { opacity: 0.72 },
  section: {
    marginBottom: 16,
    borderColor: "#d9d2c3",
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: "#fffdf8",
    padding: 18,
  },
  sectionTitle: {
    color: "#173f35",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 10,
  },
  detailRow: {
    paddingVertical: 10,
    borderTopColor: "#e8e2d7",
    borderTopWidth: 1,
  },
  detailLabel: { color: "#273c36", fontSize: 14, fontWeight: "700" },
  detailValue: { marginTop: 3, color: "#415a52", fontSize: 16, lineHeight: 23 },
  todayBox: {
    borderRadius: 10,
    backgroundColor: "#edf5f0",
    padding: 12,
    marginBottom: 8,
  },
  note: { color: "#52665f", fontSize: 15, lineHeight: 22, marginBottom: 8 },
  stateBox: {
    minHeight: 240,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  stateTitle: {
    marginTop: 14,
    color: "#173f35",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  stateMessage: {
    marginTop: 8,
    color: "#52665f",
    fontSize: 16,
    lineHeight: 23,
    textAlign: "center",
  },
  primaryButton: {
    minHeight: 48,
    minWidth: 128,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    borderRadius: 12,
    backgroundColor: "#176b55",
    paddingHorizontal: 20,
  },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
