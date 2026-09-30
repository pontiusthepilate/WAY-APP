import { useEffect, useRef } from "react";
import type { FlatList } from "react-native";
import type { AutoScrollSpeed } from "../types";

const PIXELS_PER_TICK: Record<AutoScrollSpeed, number> = {
  off: 0,
  slow: 0.5,
  medium: 1.2,
  fast: 2.5,
};
const TICK_MS = 50;

// Drives a FlatList's scroll position on a timer so the feed slides on its
// own — the WAY Button's auto-scroll function. Tracks the live offset via
// onScroll so it keeps going smoothly even if the user nudges it manually.
export function useAutoScroll(listRef: React.RefObject<FlatList<any> | null>, speed: AutoScrollSpeed) {
  const offsetRef = useRef(0);

  useEffect(() => {
    if (speed === "off") return;
    const perTick = PIXELS_PER_TICK[speed];
    const id = setInterval(() => {
      offsetRef.current += perTick;
      listRef.current?.scrollToOffset({ offset: offsetRef.current, animated: false });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [speed, listRef]);

  return {
    onScroll: (y: number) => {
      offsetRef.current = y;
    },
  };
}
