import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AccessibilityInfo,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { APP_NAME } from "../../config/app";
import {
  listPublicPlaces,
  PUBLIC_PLACES_ERROR_MESSAGE,
} from "../../data/publicPlaces";
import type { PlaceType, PublicPlace } from "../../types/database";
import { filterPlaces, getPlaceFilterOptions } from "./placeFilters";

const PLACE_TYPE_LABELS: Record<PlaceType, string> = {
  coffee_shop: "Coffee shop",
  cafe: "Cafe",
  boba_tea: "Boba & tea",
  library: "Library",
  coworking: "Coworking",
  park: "Park",
};

const EMPTY_PLACES: readonly PublicPlace[] = [];

type PlaceListState =
  | { status: "loading" }
  | { status: "loaded"; places: PublicPlace[] }
  | { status: "error" };

export type PlaceListScreenProps = Readonly<{
  loadPlaces?: () => Promise<PublicPlace[]>;
}>;

type FilterChipProps = Readonly<{
  label: string;
  onPress: () => void;
  selected: boolean;
}>;

function FilterChip({ label, onPress, selected }: FilterChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      {...(Platform.OS === "web" ? { "aria-pressed": selected } : {})}
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        selected && styles.filterChipSelected,
        pressed && styles.filterChipPressed,
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

type PlaceFiltersProps = Readonly<{
  cities: readonly string[];
  hasActiveFilters: boolean;
  nameQuery: string;
  onChangeNameQuery: (query: string) => void;
  onClear: () => void;
  onSelectCity: (city: string | null) => void;
  onSelectPlaceType: (placeType: PlaceType | null) => void;
  placeTypes: readonly PlaceType[];
  selectedCity: string | null;
  selectedPlaceType: PlaceType | null;
}>;

function PlaceFilters({
  cities,
  hasActiveFilters,
  nameQuery,
  onChangeNameQuery,
  onClear,
  onSelectCity,
  onSelectPlaceType,
  placeTypes,
  selectedCity,
  selectedPlaceType,
}: PlaceFiltersProps) {
  return (
    <View style={styles.filters}>
      <View style={styles.filtersHeading}>
        <Text accessibilityRole="header" style={styles.filtersTitle}>
          Refine places
        </Text>
        {hasActiveFilters ? (
          <Pressable
            accessibilityRole="button"
            onPress={onClear}
            style={({ pressed }) => [
              styles.clearButton,
              pressed && styles.clearButtonPressed,
            ]}
          >
            <Text style={styles.clearButtonText}>Clear filters</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.filterLabel}>Search by name</Text>
      <TextInput
        accessibilityLabel="Search places by name"
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={onChangeNameQuery}
        placeholder="Enter a place name"
        placeholderTextColor="#52665f"
        returnKeyType="search"
        style={styles.searchInput}
        value={nameQuery}
      />

      <Text style={styles.filterLabel}>City</Text>
      <View accessibilityLabel="City filters" style={styles.filterChipGroup}>
        <FilterChip
          label="All cities"
          onPress={() => onSelectCity(null)}
          selected={selectedCity === null}
        />
        {cities.map((city) => (
          <FilterChip
            key={city}
            label={city}
            onPress={() => onSelectCity(city)}
            selected={selectedCity === city}
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
          onPress={() => onSelectPlaceType(null)}
          selected={selectedPlaceType === null}
        />
        {placeTypes.map((placeType) => (
          <FilterChip
            key={placeType}
            label={PLACE_TYPE_LABELS[placeType]}
            onPress={() => onSelectPlaceType(placeType)}
            selected={selectedPlaceType === placeType}
          />
        ))}
      </View>
    </View>
  );
}

function PlaceRow({ place }: Readonly<{ place: PublicPlace }>) {
  return (
    <View
      {...(Platform.OS === "web" ? { role: "listitem" as const } : {})}
      style={styles.card}
      testID={`place-row-${place.id}`}
    >
      <Text accessibilityRole="header" style={styles.placeName}>
        {place.name}
      </Text>
      <Text style={styles.placeType}>
        {PLACE_TYPE_LABELS[place.place_type]}
      </Text>
      <Text style={styles.placeLocation}>{place.city}</Text>
      <Text style={styles.placeAddress}>{place.address}</Text>
    </View>
  );
}

export function PlaceListScreen({
  loadPlaces = listPublicPlaces,
}: PlaceListScreenProps) {
  const [state, setState] = useState<PlaceListState>({ status: "loading" });
  const [nameQuery, setNameQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedPlaceType, setSelectedPlaceType] = useState<PlaceType | null>(
    null,
  );
  const requestIdRef = useRef(0);

  const loadedPlaces = state.status === "loaded" ? state.places : EMPTY_PLACES;
  const filterOptions = useMemo(
    () => getPlaceFilterOptions(loadedPlaces),
    [loadedPlaces],
  );
  const visiblePlaces = useMemo(
    () =>
      filterPlaces(loadedPlaces, {
        city: selectedCity,
        nameQuery,
        placeType: selectedPlaceType,
      }),
    [loadedPlaces, nameQuery, selectedCity, selectedPlaceType],
  );
  const hasActiveFilters =
    nameQuery.length > 0 || selectedCity !== null || selectedPlaceType !== null;

  useEffect(() => {
    // Native live regions are Android-only; VoiceOver needs an explicit update.
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

  const requestPlaces = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    try {
      const places = await loadPlaces();
      if (requestId === requestIdRef.current) {
        setState({ status: "loaded", places });
      }
    } catch {
      if (requestId === requestIdRef.current) {
        setState({ status: "error" });
      }
    }
  }, [loadPlaces]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    void requestPlaces();
  }, [requestPlaces]);

  const clearFilters = useCallback(() => {
    setNameQuery("");
    setSelectedCity(null);
    setSelectedPlaceType(null);
  }, []);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    void loadPlaces().then(
      (places) => {
        if (requestId === requestIdRef.current) {
          setState({ status: "loaded", places });
        }
      },
      () => {
        if (requestId === requestIdRef.current) {
          setState({ status: "error" });
        }
      },
    );

    return () => {
      requestIdRef.current += 1;
    };
  }, [loadPlaces]);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.shell}>
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
            {...(Platform.OS === "web" ? { role: "alert" as const } : {})}
            accessibilityLiveRegion="assertive"
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
              onPress={retry}
              style={({ pressed }) => [
                styles.retryButton,
                pressed && styles.retryButtonPressed,
              ]}
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
              Check back soon as we add more Kansas City third places.
            </Text>
          </View>
        ) : null}

        {state.status === "loaded" && state.places.length > 0 ? (
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
                  Try changing or clearing your filters.
                </Text>
              </View>
            }
            ListHeaderComponent={
              <PlaceFilters
                cities={filterOptions.cities}
                hasActiveFilters={hasActiveFilters}
                nameQuery={nameQuery}
                onChangeNameQuery={setNameQuery}
                onClear={clearFilters}
                onSelectCity={setSelectedCity}
                onSelectPlaceType={setSelectedPlaceType}
                placeTypes={filterOptions.placeTypes}
                selectedCity={selectedCity}
                selectedPlaceType={selectedPlaceType}
              />
            }
            renderItem={({ item }) => <PlaceRow place={item} />}
            showsVerticalScrollIndicator={false}
            style={styles.list}
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f5f1e8",
  },
  shell: {
    flex: 1,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    paddingHorizontal: 20,
  },
  header: {
    paddingBottom: 18,
    paddingTop: 24,
  },
  title: {
    color: "#173f35",
    fontSize: 40,
    fontWeight: "700",
    letterSpacing: -1,
  },
  subtitle: {
    marginTop: 4,
    color: "#3e5b53",
    fontSize: 17,
  },
  filters: {
    borderColor: "#d9d2c3",
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: "#fffdf8",
    padding: 16,
  },
  filtersHeading: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
  },
  filtersTitle: {
    color: "#173f35",
    fontSize: 18,
    fontWeight: "700",
  },
  clearButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  clearButtonPressed: {
    opacity: 0.65,
  },
  clearButtonText: {
    color: "#176b55",
    fontSize: 14,
    fontWeight: "700",
  },
  filterLabel: {
    marginBottom: 7,
    marginTop: 14,
    color: "#273c36",
    fontSize: 14,
    fontWeight: "700",
  },
  searchInput: {
    minHeight: 48,
    borderColor: "#bfc9c4",
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: "#ffffff",
    color: "#173f35",
    fontSize: 16,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  filterChipGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterChip: {
    minHeight: 44,
    justifyContent: "center",
    borderColor: "#aebdb6",
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  filterChipSelected: {
    borderColor: "#176b55",
    backgroundColor: "#176b55",
  },
  filterChipPressed: {
    opacity: 0.75,
  },
  filterChipText: {
    color: "#315248",
    fontSize: 14,
    fontWeight: "600",
  },
  filterChipTextSelected: {
    color: "#ffffff",
  },
  list: {
    flex: 1,
    width: "100%",
  },
  listContent: {
    gap: 12,
    paddingBottom: 24,
  },
  card: {
    width: "100%",
    borderColor: "#d9d2c3",
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: "#fffdf8",
    padding: 18,
  },
  placeName: {
    color: "#173f35",
    fontSize: 20,
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
  placeAddress: {
    marginTop: 3,
    color: "#52665f",
    fontSize: 15,
    lineHeight: 21,
  },
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
    minHeight: 220,
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
  retryButtonPressed: {
    opacity: 0.8,
  },
  retryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
});
