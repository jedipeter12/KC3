import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { APP_NAME } from "../../config/app";
import {
  listPublicPlaces,
  PUBLIC_PLACES_ERROR_MESSAGE,
} from "../../data/publicPlaces";
import type { PlaceType, PublicPlace } from "../../types/database";

const PLACE_TYPE_LABELS: Record<PlaceType, string> = {
  coffee_shop: "Coffee shop",
  cafe: "Cafe",
  boba_tea: "Boba & tea",
  library: "Library",
  coworking: "Coworking",
  park: "Park",
};

type PlaceListState =
  | { status: "loading" }
  | { status: "loaded"; places: PublicPlace[] }
  | { status: "error" };

export type PlaceListScreenProps = Readonly<{
  loadPlaces?: () => Promise<PublicPlace[]>;
}>;

function PlaceRow({ place }: Readonly<{ place: PublicPlace }>) {
  return (
    <View style={styles.card} testID={`place-row-${place.id}`}>
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
  const requestIdRef = useRef(0);

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
            data={state.places}
            keyExtractor={(place) => place.id}
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
