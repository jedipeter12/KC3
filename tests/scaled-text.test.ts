import { StyleSheet } from "react-native";

import { getScaledTextStyle } from "../src/components/ScaledText";

describe("scaled native text", () => {
  it("scales font size and line height through layout at accessibility sizes", () => {
    const style = getScaledTextStyle(
      { fontSize: 16, lineHeight: 23 },
      3.1,
      "ios",
    );

    expect(StyleSheet.flatten(style)).toMatchObject({
      fontSize: 16 * 3.1,
      lineHeight: 23 * 3.1,
    });
  });

  it("leaves Web typography to the browser", () => {
    const original = { fontSize: 16, lineHeight: 23 };
    expect(getScaledTextStyle(original, 3.1, "web")).toBe(original);
  });
});
