import { StatusBar } from "expo-status-bar";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";

import { APP_NAME } from "./config/app";

export default function App() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          {APP_NAME}
        </Text>
        <Text style={styles.subtitle}>
          Find your next third place in Kansas City.
        </Text>
      </View>
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f5f1e8",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    color: "#173f35",
    fontSize: 48,
    fontWeight: "700",
  },
  subtitle: {
    marginTop: 12,
    color: "#3e5b53",
    fontSize: 18,
    textAlign: "center",
  },
});
