import { Image } from "expo-image";
import { useTheme } from "@/theme/theme";

// Transparent wordmarks generated from the source logos (one per background); the theme picks the readable one.
const DARK = require("../../assets/images/wordmark-on-dark.png");
const LIGHT = require("../../assets/images/wordmark-on-light.png");
const RATIO = 1784 / 292;

export function Wordmark({ height = 30 }: { height?: number }) {
  const t = useTheme();
  return <Image source={t.scheme === "dark" ? DARK : LIGHT} style={{ height, width: Math.round(height * RATIO) }} contentFit="contain" accessibilityRole="image" accessibilityLabel="MoneyMgr" />;
}
