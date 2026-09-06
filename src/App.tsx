import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { PlaceListScreen } from "./features/places/PlaceListScreen";

export default function App() {
  return (
    <>
      <SafeAreaProvider>
        <PlaceListScreen />
      </SafeAreaProvider>
      <StatusBar style="auto" />
    </>
  );
}
