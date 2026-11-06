import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, Line, Path, Pattern, Rect } from "react-native-svg";
import { colors } from "../theme/theme";

// A faint repeating pattern of small WAY-themed doodles (wave, speech
// bubble, star, heart, paper plane, sun) behind a chat thread — the same
// idea as WhatsApp's classic chat wallpaper, redrawn in our own brand
// icons instead of generic ones, and tuned pale/subtle to sit behind this
// app's light theme instead of a dark one.
const TILE = 140;
const ICON_COLOR = colors.horizonDeep;
const ICON_OPACITY = 0.07;

export function ChatWallpaper() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="wayChatDoodles" width={TILE} height={TILE} patternUnits="userSpaceOnUse">
            {/* wave */}
            <Path
              d="M8 20 Q16 12 24 20 T40 20"
              stroke={ICON_COLOR}
              strokeWidth={1.4}
              fill="none"
              opacity={ICON_OPACITY}
              strokeLinecap="round"
            />
            {/* speech bubble */}
            <Path
              d="M70 8 h22 a4 4 0 0 1 4 4 v12 a4 4 0 0 1 -4 4 h-14 l-6 6 v-6 h-2 a4 4 0 0 1 -4 -4 v-12 a4 4 0 0 1 4 -4 z"
              stroke={ICON_COLOR}
              strokeWidth={1.2}
              fill="none"
              opacity={ICON_OPACITY}
            />
            {/* star */}
            <Path
              d="M112 52 l2.4 5 5.5 0.6 -4 3.8 1 5.4 -4.9 -2.6 -4.9 2.6 1 -5.4 -4 -3.8 5.5 -0.6 z"
              stroke={ICON_COLOR}
              strokeWidth={1.1}
              fill="none"
              opacity={ICON_OPACITY}
              strokeLinejoin="round"
            />
            {/* heart */}
            <Path
              d="M20 72 c-4 -5 -11 -2 -11 4 c0 6 7 10 11 14 c4 -4 11 -8 11 -14 c0 -6 -7 -9 -11 -4 z"
              stroke={ICON_COLOR}
              strokeWidth={1.2}
              fill="none"
              opacity={ICON_OPACITY}
              strokeLinejoin="round"
            />
            {/* paper plane */}
            <Path
              d="M55 95 l32 -14 -12 32 -6 -12 -14 2 z"
              stroke={ICON_COLOR}
              strokeWidth={1.2}
              fill="none"
              opacity={ICON_OPACITY}
              strokeLinejoin="round"
            />
            {/* sun */}
            <Circle cx={115} cy={112} r={6} stroke={ICON_COLOR} strokeWidth={1.2} fill="none" opacity={ICON_OPACITY} />
            <Line x1={115} y1={100} x2={115} y2={103} stroke={ICON_COLOR} strokeWidth={1.2} opacity={ICON_OPACITY} strokeLinecap="round" />
            <Line x1={115} y1={121} x2={115} y2={124} stroke={ICON_COLOR} strokeWidth={1.2} opacity={ICON_OPACITY} strokeLinecap="round" />
            <Line x1={103} y1={112} x2={106} y2={112} stroke={ICON_COLOR} strokeWidth={1.2} opacity={ICON_OPACITY} strokeLinecap="round" />
            <Line x1={124} y1={112} x2={127} y2={112} stroke={ICON_COLOR} strokeWidth={1.2} opacity={ICON_OPACITY} strokeLinecap="round" />
            {/* small dot accents for texture variety */}
            <Circle cx={45} cy={45} r={1.4} fill={ICON_COLOR} opacity={ICON_OPACITY} />
            <Circle cx={95} cy={35} r={1.4} fill={ICON_COLOR} opacity={ICON_OPACITY} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#wayChatDoodles)" />
      </Svg>
    </View>
  );
}
