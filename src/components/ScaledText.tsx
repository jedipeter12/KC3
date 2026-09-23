import { forwardRef } from "react";
import type { ComponentRef } from "react";
import {
  Platform,
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  useWindowDimensions,
} from "react-native";
import type {
  StyleProp,
  TextInputProps,
  TextProps,
  TextStyle,
} from "react-native";

export function getScaledTextStyle(
  style: StyleProp<TextStyle>,
  fontScale: number,
  platform: typeof Platform.OS,
): StyleProp<TextStyle> {
  if (platform === "web") return style;
  const flattenedStyle = StyleSheet.flatten(style);

  return [
    style,
    {
      fontSize:
        flattenedStyle?.fontSize === undefined
          ? undefined
          : flattenedStyle.fontSize * fontScale,
      lineHeight:
        flattenedStyle?.lineHeight === undefined
          ? undefined
          : flattenedStyle.lineHeight * fontScale,
    },
  ];
}

function useScaledTextStyle(style: StyleProp<TextStyle>) {
  const { fontScale } = useWindowDimensions();
  return getScaledTextStyle(style, fontScale, Platform.OS);
}

export const ScaledText = forwardRef<
  ComponentRef<typeof NativeText>,
  TextProps
>(function ScaledText({ style, ...props }, ref) {
  const scaledStyle = useScaledTextStyle(style);

  return (
    <NativeText
      {...props}
      allowFontScaling={Platform.OS === "web"}
      ref={ref}
      style={scaledStyle}
    />
  );
});

export const ScaledTextInput = forwardRef<
  ComponentRef<typeof NativeTextInput>,
  TextInputProps
>(function ScaledTextInput({ style, ...props }, ref) {
  const scaledStyle = useScaledTextStyle(style);

  return (
    <NativeTextInput
      {...props}
      allowFontScaling={Platform.OS === "web"}
      ref={ref}
      style={scaledStyle}
    />
  );
});
