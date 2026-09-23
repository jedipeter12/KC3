import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentRef } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  BackHandler,
  findNodeHandle,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  ScaledText as Text,
  ScaledTextInput as TextInput,
} from "../../components/ScaledText";
import { APP_NAME } from "../../config/app";
import {
  getPublicPlaceDetail,
  listPublicPlaceSummaries,
  PUBLIC_PLACES_ERROR_MESSAGE,
} from "../../data/publicPlaces";
import type {
  PlaceType,
  PublicPlaceDetail,
  PublicPlaceSummary,
} from "../../types/database";
import { PlaceDetailScreen } from "./PlaceDetailScreen";
import {
  DEFAULT_PLACE_FILTERS,
  filterPlaces,
  getPlaceFilterOptions,
  hasNonDefaultPlaceFilters,
  type PlaceFilters,
} from "./placeFilters";
import {
  getCompactKc3Summary,
  getHoursStatus,
  PLACE_TYPE_LABELS,
} from "./placePresentation";

const EMPTY_PLACES: readonly PublicPlaceSummary[] = [];
const ATTRIBUTE_FILTERS: readonly [keyof PlaceFilters, string][] = [
  ["openNow", "Open now"],
  ["goodForWork", "Good for work"],
  ["wifiAvailable", "Wi-Fi available"],
  ["outletsAvailable", "Outlets available"],
  ["foodAvailable", "Food or drinks available"],
  ["phoneCallsAllowed", "Phone calls okay"],
  ["bathroomAvailable", "Bathroom available"],
  ["driveThruAvailable", "Drive-thru available"],
  ["hideDriveThruOnly", "Hide drive-thru-only places"],
];

type PlaceListState =
  | { status: "loading" }
  | { status: "loaded"; places: PublicPlaceSummary[] }
  | { status: "error" };

export type PlaceListScreenProps = Readonly<{
  loadPlaceDetail?: (placeId: string) => Promise<PublicPlaceDetail | null>;
  loadPlaces?: () => Promise<PublicPlaceSummary[]>;
}>;

type FilterChipProps = Readonly<{
  label: string;
  onPress: () => void;
  selected: boolean;
}>;

type WebKeyEvent = Readonly<{
  key?: string;
  nativeEvent?: Readonly<{ key?: string }>;
  preventDefault?: () => void;
}>;

function FilterChip({ label, onPress, selected }: FilterChipProps) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      {...(Platform.OS === "web" ? { "aria-pressed": selected } : {})}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        selected && styles.filterChipSelected,
        focused && styles.focusedControl,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.filterChipText,
          selected && styles.filterChipTextSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

type FilterGroupsProps = Readonly<{
  cities: readonly string[];
  filters: PlaceFilters;
  onChange: (filters: PlaceFilters) => void;
  placeTypes: readonly PlaceType[];
  showClear: boolean;
}>;

function FilterGroups({
  cities,
  filters,
  onChange,
  placeTypes,
  showClear,
}: FilterGroupsProps) {
  const update = <Key extends keyof PlaceFilters>(
    key: Key,
    value: PlaceFilters[Key],
  ) => onChange({ ...filters, [key]: value });

  return (
    <View>
      <View style={styles.filtersHeading}>
        <Text
          accessibilityRole="header"
          style={styles.filtersTitle}
          {...(Platform.OS === "web" ? { "aria-level": 2 } : {})}
        >
          Refine places
        </Text>
        {showClear ? (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              onChange({
                ...DEFAULT_PLACE_FILTERS,
                nameQuery: filters.nameQuery,
              })
            }
            style={styles.clearButton}
          >
            <Text style={styles.clearButtonText}>Clear all</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.filterLabel}>City</Text>
      <View accessibilityLabel="City filters" style={styles.filterChipGroup}>
        <FilterChip
          label="All cities"
          onPress={() => update("city", null)}
          selected={filters.city === null}
        />
        {cities.map((city) => (
          <FilterChip
            key={city}
            label={city}
            onPress={() => update("city", city)}
            selected={filters.city === city}
          />
        ))}
      </View>

      <Text style={styles.filterLabel}>Place type</Text>
      <View
        accessibilityLabel="Place type filters"
        style={styles.filterChipGroup}
      >
        <FilterChip
          label="All types"
          onPress={() => update("placeType", null)}
          selected={filters.placeType === null}
        />
        {placeTypes.map((placeType) => (
          <FilterChip
            key={placeType}
            label={PLACE_TYPE_LABELS[placeType]}
            onPress={() => update("placeType", placeType)}
            selected={filters.placeType === placeType}
          />
        ))}
      </View>

      <Text style={styles.filterLabel}>Needs and preferences</Text>
      <View
        accessibilityLabel="Attribute filters"
        style={styles.filterChipGroup}
      >
        {ATTRIBUTE_FILTERS.map(([key, label]) => (
          <FilterChip
            key={key}
            label={label}
            onPress={() => update(key, !filters[key] as never)}
            selected={filters[key] as boolean}
          />
        ))}
      </View>
    </View>
  );
}

function parseDetailPath(): string | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  const pathname = window.location?.pathname;
  if (!pathname) return null;
  const match = pathname.match(/\/places\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : null;
}

type PlaceCardProps = Readonly<{
  focused: boolean;
  onBlur: () => void;
  onFocus: () => void;
  onPress: () => void;
  place: PublicPlaceSummary;
  setRef: (node: ComponentRef<typeof Pressable> | null) => void;
}>;

function PlaceCard({
  focused,
  onBlur,
  onFocus,
  onPress,
  place,
  setRef,
}: PlaceCardProps) {
  const hoursStatus = getHoursStatus(place);
  const accessibleName = [
    place.name,
    PLACE_TYPE_LABELS[place.place_type],
    place.city,
    hoursStatus,
    place.drive_thru_only === true ? "Drive-thru only" : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <View
      {...(Platform.OS === "web" ? { role: "listitem" as const } : {})}
      testID={`place-row-${place.id}`}
    >
      <Pressable
        accessibilityLabel={accessibleName}
        accessibilityRole="link"
        onBlur={onBlur}
        onFocus={onFocus}
        onPress={onPress}
        ref={setRef}
        style={({ pressed }) => [
          styles.card,
          focused && styles.focusedCard,
          pressed && styles.pressed,
        ]}
      >
        <Text
          accessibilityRole="header"
          style={styles.placeName}
          {...(Platform.OS === "web" ? { "aria-level": 2 } : {})}
        >
          {place.name}
        </Text>
        <Text style={styles.placeType}>
          {PLACE_TYPE_LABELS[place.place_type]}
        </Text>
        <Text style={styles.placeLocation}>{place.city}</Text>
        {place.address_precision === "approximate" ? (
          <Text style={styles.qualifier}>Approximate location</Text>
        ) : null}
        <Text style={styles.placeAddress}>{place.address}</Text>
        <Text style={styles.hoursState}>{hoursStatus}</Text>
        {place.drive_thru_only === true ? (
          <Text style={styles.warning}>
            Drive-thru only · no place to stay inside
          </Text>
        ) : null}
        <View style={styles.summary}>
          {getCompactKc3Summary(place).map((line) => (
            <Text key={line} style={styles.summaryText}>
              {line}
            </Text>
          ))}
          {place.kc3_verification_state === "stale" ? (
            <Text style={styles.warning}>KC3 details may have changed</Text>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

export function PlaceListScreen({
  loadPlaceDetail = getPublicPlaceDetail,
  loadPlaces = listPublicPlaceSummaries,
}: PlaceListScreenProps) {
  const { width } = useWindowDimensions();
  const wide = Platform.OS === "web" && width >= 960;
  const [state, setState] = useState<PlaceListState>({ status: "loading" });
  const [filters, setFilters] = useState<PlaceFilters>(DEFAULT_PLACE_FILTERS);
  const [draftFilters, setDraftFilters] = useState<PlaceFilters>(
    DEFAULT_PLACE_FILTERS,
  );
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(() =>
    parseDetailPath(),
  );
  const [focusedCardId, setFocusedCardId] = useState<string | null>(null);
  const [originCardId, setOriginCardId] = useState<string | null>(null);
  const listRef = useRef<FlatList<PublicPlaceSummary>>(null);
  const filtersButtonRef = useRef<ComponentRef<typeof Pressable>>(null);
  const resultsHeadingRef = useRef<ComponentRef<typeof Text>>(null);
  const cardRefs = useRef<
    Record<string, ComponentRef<typeof Pressable> | null>
  >({});
  const scrollOffsetRef = useRef(0);
  const requestIdRef = useRef(0);

  const loadedPlaces = state.status === "loaded" ? state.places : EMPTY_PLACES;
  const filterOptions = useMemo(
    () => getPlaceFilterOptions(loadedPlaces),
    [loadedPlaces],
  );
  const visiblePlaces = useMemo(
    () => filterPlaces(loadedPlaces, filters),
    [filters, loadedPlaces],
  );
  const hasActiveFilters = hasNonDefaultPlaceFilters(filters);

  const requestPlaces = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    try {
      const places = await loadPlaces();
      if (requestId === requestIdRef.current)
        setState({ status: "loaded", places });
    } catch {
      if (requestId === requestIdRef.current) setState({ status: "error" });
    }
  }, [loadPlaces]);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    void loadPlaces().then(
      (places) => {
        if (requestId === requestIdRef.current) {
          setState({ status: "loaded", places });
        }
      },
      () => {
        if (requestId === requestIdRef.current) setState({ status: "error" });
      },
    );
    return () => {
      requestIdRef.current += 1;
    };
  }, [loadPlaces]);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const message =
      state.status === "loading"
        ? "Finding places…"
        : state.status === "error"
          ? `Places are unavailable. ${PUBLIC_PLACES_ERROR_MESSAGE}`
          : state.places.length === 0
            ? "No places yet"
            : `${state.places.length} places loaded`;
    AccessibilityInfo.announceForAccessibility(message);
  }, [state]);

  useEffect(() => {
    if (state.status !== "loaded" || state.places.length === 0) return;
    const message = `${visiblePlaces.length} ${visiblePlaces.length === 1 ? "place" : "places"}`;
    if (Platform.OS === "ios")
      AccessibilityInfo.announceForAccessibility(message);
  }, [filters, state, visiblePlaces.length]);

  useEffect(() => {
    if (
      Platform.OS !== "web" ||
      typeof window === "undefined" ||
      !window.location ||
      !window.history
    ) {
      return;
    }
    const directId = parseDetailPath();
    if (directId) {
      const detailPath = window.location.pathname + window.location.search;
      window.history.replaceState({}, "", "/");
      window.history.pushState({}, "", detailPath);
    }
    const onPopState = () => setSelectedPlaceId(parseDetailPath());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const focusFiltersButton = useCallback(() => {
    setTimeout(() => {
      const button = filtersButtonRef.current;
      if (!button) return;
      if (Platform.OS === "web") {
        (button as unknown as { focus?: () => void }).focus?.();
      } else {
        const handle = findNodeHandle(button);
        if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
      }
    }, 0);
  }, []);

  const closeFilters = useCallback(() => {
    setFilterModalOpen(false);
    focusFiltersButton();
  }, [focusFiltersButton]);

  const focusResults = useCallback(() => {
    const heading = resultsHeadingRef.current;
    if (!heading) return;
    if (Platform.OS === "web") {
      (heading as unknown as { focus?: () => void }).focus?.();
    } else {
      const handle = findNodeHandle(heading);
      if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
    }
  }, []);

  const handleModalKeyDown = useCallback(
    (event: WebKeyEvent) => {
      if ((event.nativeEvent?.key ?? event.key) === "Escape") {
        event.preventDefault?.();
        closeFilters();
      }
    },
    [closeFilters],
  );

  useEffect(() => {
    if (
      Platform.OS !== "web" ||
      !filterModalOpen ||
      typeof document === "undefined"
    ) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeFilters();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = document.querySelector<HTMLElement>(
        '[aria-label="Filters"][aria-modal="true"]',
      );
      const focusable = dialog
        ? Array.from(
            dialog.querySelectorAll<HTMLElement>(
              'button,[href],input,[tabindex]:not([tabindex="-1"])',
            ),
          ).filter((element) => !element.hasAttribute("disabled"))
        : [];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeFilters, filterModalOpen]);

  const restoreListPositionAndFocus = useCallback(() => {
    setTimeout(() => {
      listRef.current?.scrollToOffset({
        animated: false,
        offset: scrollOffsetRef.current,
      });
      if (!originCardId) return;
      const card = cardRefs.current[originCardId];
      if (!card) return;
      if (Platform.OS === "web")
        (card as unknown as { focus?: () => void }).focus?.();
      else {
        const handle = findNodeHandle(card);
        if (handle) AccessibilityInfo.setAccessibilityFocus(handle);
      }
    }, 0);
  }, [originCardId]);

  const closeDetail = useCallback(() => {
    if (Platform.OS === "web" && typeof window !== "undefined")
      window.history.back();
    else setSelectedPlaceId(null);
    restoreListPositionAndFocus();
  }, [restoreListPositionAndFocus]);

  useEffect(() => {
    if (Platform.OS === "web" || !selectedPlaceId) return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        setSelectedPlaceId(null);
        restoreListPositionAndFocus();
        return true;
      },
    );
    return () => subscription.remove();
  }, [restoreListPositionAndFocus, selectedPlaceId]);

  const openDetail = (placeId: string) => {
    setOriginCardId(placeId);
    setSelectedPlaceId(placeId);
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.history.pushState(
        {},
        "",
        `/places/${encodeURIComponent(placeId)}`,
      );
    }
  };

  if (selectedPlaceId) {
    return (
      <PlaceDetailScreen
        cachedSummary={loadedPlaces.find(
          (place) => place.id === selectedPlaceId,
        )}
        loadPlaceDetail={loadPlaceDetail}
        onBack={closeDetail}
        placeId={selectedPlaceId}
      />
    );
  }

  const clearFilters = () => setFilters(DEFAULT_PLACE_FILTERS);
  const openFilters = () => {
    setDraftFilters(filters);
    setFilterModalOpen(true);
  };
  const applyFilters = () => {
    setFilters(draftFilters);
    closeFilters();
  };

  const discoveryHeader = (
    <View style={styles.discoveryHeader}>
      <Text style={styles.filterLabel}>Search by name</Text>
      <TextInput
        accessibilityLabel="Search places by name"
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={(nameQuery) =>
          setFilters((current) => ({ ...current, nameQuery }))
        }
        placeholder="Enter a place name"
        placeholderTextColor="#52665f"
        returnKeyType="search"
        style={styles.searchInput}
        value={filters.nameQuery}
      />
      <View style={styles.resultBar}>
        <Text
          accessibilityLiveRegion="polite"
          nativeID="place-results"
          ref={resultsHeadingRef}
          style={styles.resultCount}
          {...(Platform.OS === "web" ? { tabIndex: -1 } : {})}
        >
          {visiblePlaces.length}{" "}
          {visiblePlaces.length === 1 ? "place" : "places"}
        </Text>
        {!wide ? (
          <Pressable
            accessibilityRole="button"
            onPress={openFilters}
            ref={filtersButtonRef}
            style={styles.filtersButton}
          >
            <Text style={styles.filtersButtonText}>Filters</Text>
          </Pressable>
        ) : null}
        {hasActiveFilters ? (
          <Pressable
            accessibilityRole="button"
            onPress={clearFilters}
            style={styles.clearButton}
          >
            <Text style={styles.clearButtonText}>Clear filters</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  const filterSurface = (
    <View
      accessibilityLabel="Filters"
      accessibilityViewIsModal
      style={styles.modalDialog}
      {...(Platform.OS === "web"
        ? {
            "aria-modal": true,
            onKeyDown: handleModalKeyDown,
            role: "dialog" as const,
          }
        : {})}
    >
      <View style={styles.modalHeader}>
        <Text accessibilityRole="header" style={styles.modalTitle}>
          Filters
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={closeFilters}
          style={styles.modalAction}
        >
          <Text style={styles.clearButtonText}>Close</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.modalContent}>
        <FilterGroups
          cities={filterOptions.cities}
          filters={draftFilters}
          onChange={setDraftFilters}
          placeTypes={filterOptions.placeTypes}
          showClear={hasNonDefaultPlaceFilters(draftFilters)}
        />
      </ScrollView>
      <View style={styles.modalFooter}>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            setDraftFilters({
              ...DEFAULT_PLACE_FILTERS,
              nameQuery: filters.nameQuery,
            })
          }
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>Clear all</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={applyFilters}
          style={styles.applyButton}
        >
          <Text style={styles.applyButtonText}>Apply</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen}>
      <View
        accessibilityElementsHidden={filterModalOpen}
        importantForAccessibility={
          filterModalOpen ? "no-hide-descendants" : "auto"
        }
        style={[
          styles.shell,
          wide && styles.wideShell,
          Platform.OS === "web" && filterModalOpen && styles.hidden,
        ]}
        {...(Platform.OS === "web" ? { "aria-hidden": filterModalOpen } : {})}
      >
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>
            {APP_NAME}
          </Text>
          <Text style={styles.subtitle}>Find your next third place.</Text>
        </View>

        {state.status === "loading" ? (
          <View accessibilityLiveRegion="polite" style={styles.stateContainer}>
            <ActivityIndicator color="#176b55" size="large" />
            <Text style={styles.stateTitle}>Finding places…</Text>
          </View>
        ) : null}
        {state.status === "error" ? (
          <View
            accessibilityLiveRegion="assertive"
            {...(Platform.OS === "web" ? { role: "alert" as const } : {})}
            style={styles.stateContainer}
          >
            <Text accessibilityRole="header" style={styles.stateTitle}>
              Places are unavailable
            </Text>
            <Text style={styles.stateMessage}>
              {PUBLIC_PLACES_ERROR_MESSAGE}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setState({ status: "loading" });
                void requestPlaces();
              }}
              style={styles.retryButton}
            >
              <Text style={styles.retryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}
        {state.status === "loaded" && state.places.length === 0 ? (
          <View accessibilityLiveRegion="polite" style={styles.stateContainer}>
            <Text accessibilityRole="header" style={styles.stateTitle}>
              No places yet
            </Text>
            <Text style={styles.stateMessage}>
              Check back soon as we add more Lenexa, Overland Park, and Olathe
              third places.
            </Text>
          </View>
        ) : null}
        {state.status === "loaded" && state.places.length > 0 ? (
          <View
            style={[styles.resultsLayout, wide && styles.wideResultsLayout]}
          >
            {wide ? (
              <ScrollView
                contentContainerStyle={styles.railContent}
                style={styles.filterRail}
              >
                <Pressable
                  accessibilityRole="link"
                  onPress={focusResults}
                  style={styles.skipLink}
                >
                  <Text style={styles.skipLinkText}>Skip to results</Text>
                </Pressable>
                <FilterGroups
                  cities={filterOptions.cities}
                  filters={filters}
                  onChange={setFilters}
                  placeTypes={filterOptions.placeTypes}
                  showClear={hasActiveFilters}
                />
              </ScrollView>
            ) : null}
            <FlatList
              accessibilityRole="list"
              contentContainerStyle={styles.listContent}
              data={visiblePlaces}
              keyExtractor={(place) => place.id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View
                  accessibilityLiveRegion="polite"
                  style={styles.noMatchesContainer}
                >
                  <Text accessibilityRole="header" style={styles.stateTitle}>
                    No matching places
                  </Text>
                  <Text style={styles.stateMessage}>
                    Try changing or clearing your search and filters.
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={clearFilters}
                    style={styles.retryButton}
                  >
                    <Text style={styles.retryButtonText}>Clear filters</Text>
                  </Pressable>
                </View>
              }
              ListHeaderComponent={discoveryHeader}
              onScroll={(event) => {
                scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
              }}
              ref={listRef}
              renderItem={({ item }) => (
                <PlaceCard
                  focused={focusedCardId === item.id}
                  onBlur={() => setFocusedCardId(null)}
                  onFocus={() => setFocusedCardId(item.id)}
                  onPress={() => openDetail(item.id)}
                  place={item}
                  setRef={(node) => {
                    cardRefs.current[item.id] = node;
                  }}
                />
              )}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
              style={styles.list}
            />
          </View>
        ) : null}
      </View>

      {Platform.OS === "web" && filterModalOpen ? (
        <SafeAreaView style={styles.modalScreen}>{filterSurface}</SafeAreaView>
      ) : null}

      <Modal
        accessibilityViewIsModal
        animationType="slide"
        onRequestClose={closeFilters}
        presentationStyle="fullScreen"
        visible={Platform.OS !== "web" && filterModalOpen}
      >
        <SafeAreaView style={styles.modalScreen}>{filterSurface}</SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f5f1e8" },
  hidden: { display: "none" },
  shell: {
    flex: 1,
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    paddingHorizontal: 20,
  },
  wideShell: { maxWidth: 1240 },
  header: { paddingBottom: 16, paddingTop: 22 },
  title: {
    color: "#173f35",
    fontSize: 40,
    fontWeight: "700",
    letterSpacing: -1,
  },
  subtitle: { marginTop: 4, color: "#3e5b53", fontSize: 17 },
  resultsLayout: { flex: 1 },
  wideResultsLayout: { flexDirection: "row", gap: 24 },
  filterRail: {
    width: 320,
    flexGrow: 0,
    borderColor: "#d9d2c3",
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: "#fffdf8",
  },
  railContent: { padding: 16, paddingBottom: 24 },
  skipLink: { minHeight: 44, justifyContent: "center" },
  skipLinkText: { color: "#176b55", fontSize: 15, fontWeight: "700" },
  filtersHeading: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
  },
  filtersTitle: { color: "#173f35", fontSize: 19, fontWeight: "700" },
  clearButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  clearButtonText: { color: "#176b55", fontSize: 15, fontWeight: "700" },
  filterLabel: {
    marginBottom: 7,
    marginTop: 14,
    color: "#273c36",
    fontSize: 14,
    fontWeight: "700",
  },
  filterChipGroup: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filterChip: {
    minHeight: 44,
    justifyContent: "center",
    borderColor: "#aebdb6",
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  filterChipSelected: { borderColor: "#176b55", backgroundColor: "#176b55" },
  focusedControl: { borderColor: "#f08c35", borderWidth: 3 },
  filterChipText: { color: "#315248", fontSize: 14, fontWeight: "600" },
  filterChipTextSelected: { color: "#fff" },
  pressed: { opacity: 0.72 },
  discoveryHeader: { paddingBottom: 14 },
  searchInput: {
    minHeight: 48,
    borderColor: "#bfc9c4",
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: "#fff",
    color: "#173f35",
    fontSize: 16,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  resultBar: {
    minHeight: 54,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  resultCount: {
    flexGrow: 1,
    color: "#273c36",
    fontSize: 16,
    fontWeight: "700",
  },
  filtersButton: {
    minHeight: 44,
    justifyContent: "center",
    borderColor: "#176b55",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  filtersButtonText: { color: "#176b55", fontSize: 15, fontWeight: "700" },
  list: { flex: 1, width: "100%" },
  listContent: { gap: 12, paddingBottom: 24 },
  card: {
    width: "100%",
    borderColor: "#d9d2c3",
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: "#fffdf8",
    padding: 18,
  },
  focusedCard: { borderColor: "#f08c35", borderWidth: 3 },
  placeName: {
    color: "#173f35",
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700",
  },
  placeType: {
    alignSelf: "flex-start",
    marginTop: 10,
    borderRadius: 999,
    backgroundColor: "#dcebe3",
    color: "#245746",
    fontSize: 13,
    fontWeight: "600",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  placeLocation: {
    marginTop: 14,
    color: "#273c36",
    fontSize: 16,
    fontWeight: "600",
  },
  qualifier: {
    marginTop: 6,
    color: "#7a5314",
    fontSize: 14,
    fontWeight: "700",
  },
  placeAddress: {
    marginTop: 3,
    color: "#52665f",
    fontSize: 15,
    lineHeight: 21,
  },
  hoursState: {
    marginTop: 12,
    color: "#173f35",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 22,
  },
  warning: {
    marginTop: 7,
    color: "#8a3e18",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
  },
  summary: {
    marginTop: 12,
    borderTopColor: "#e8e2d7",
    borderTopWidth: 1,
    paddingTop: 10,
  },
  summaryText: { color: "#415a52", fontSize: 14, lineHeight: 21 },
  stateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 64,
    paddingHorizontal: 24,
  },
  noMatchesContainer: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 240,
    paddingBottom: 48,
    paddingHorizontal: 24,
  },
  stateTitle: {
    marginTop: 16,
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
  retryButton: {
    marginTop: 22,
    minHeight: 48,
    minWidth: 128,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#176b55",
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  retryButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  modalScreen: { flex: 1, backgroundColor: "#f5f1e8" },
  modalDialog: { flex: 1 },
  modalHeader: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomColor: "#d9d2c3",
    borderBottomWidth: 1,
    paddingHorizontal: 20,
  },
  modalTitle: { color: "#173f35", fontSize: 24, fontWeight: "700" },
  modalAction: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  modalContent: { padding: 20, paddingBottom: 32 },
  modalFooter: {
    flexDirection: "row",
    gap: 12,
    borderTopColor: "#d9d2c3",
    borderTopWidth: 1,
    padding: 16,
  },
  secondaryButton: {
    minHeight: 48,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderColor: "#176b55",
    borderRadius: 12,
    borderWidth: 1,
  },
  secondaryButtonText: { color: "#176b55", fontSize: 16, fontWeight: "700" },
  applyButton: {
    minHeight: 48,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#176b55",
  },
  applyButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
