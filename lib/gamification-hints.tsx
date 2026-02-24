import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInUp, FadeOutUp, LinearTransition } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { apiRequest } from "@/lib/query-client";
import { useAuth } from "@/lib/auth-context";
import type { LedgerEntry } from "@/lib/types";

type HintItem = {
  id: string;
  entry: LedgerEntry;
};

interface GamificationHintsContextType {
  syncFromLedger: () => Promise<void>;
}

const MAX_VISIBLE_HINTS = 2;
const MAX_REMEMBERED_LEDGER_IDS = 60;
const MAX_LEDGER_FETCH = 12;

const GamificationHintsContext = createContext<GamificationHintsContextType | null>(null);

function humanizeSource(source: string) {
  return source.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

function formatHintTitle(entry: LedgerEntry) {
  const isXp = entry.resourceType === "xp";
  const isCredit = entry.direction === "credit";

  if (isXp) {
    return isCredit ? "XP ganho" : "XP gasto";
  }

  return isCredit ? "Energia recuperada" : "Energia gasta";
}

function formatHintAmount(entry: LedgerEntry) {
  const signal = entry.direction === "credit" ? "+" : "-";
  const suffix = entry.resourceType === "xp" ? "XP" : "ENERGIA";
  return `${signal}${entry.amount} ${suffix}`;
}

function HintCard({
  item,
  index,
  topInset,
  onDone,
}: {
  item: HintItem;
  index: number;
  topInset: number;
  onDone: (id: string) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDone(item.id);
    }, 1900);

    return () => clearTimeout(timer);
  }, [item.id, onDone]);

  const isXp = item.entry.resourceType === "xp";
  const isCredit = item.entry.direction === "credit";
  const accent = isXp ? Colors.xp : Colors.energy;
  const amountColor = isCredit ? Colors.success : Colors.danger;

  return (
    <Animated.View
      entering={FadeInUp.duration(260)}
      exiting={FadeOutUp.duration(220)}
      layout={LinearTransition.springify().damping(15).stiffness(190)}
      style={[
        styles.hint,
        {
          top: topInset + index * 76,
          borderColor: accent + "66",
          backgroundColor: Colors.surface,
        },
      ]}
    >
      <View style={[styles.leftAccent, { backgroundColor: accent }]} />
      <View style={[styles.iconWrap, { backgroundColor: accent + "20" }]}>
        <Ionicons name={isXp ? "diamond" : "flash"} size={14} color={accent} />
      </View>
      <View style={styles.hintTextWrap}>
        <Text style={styles.hintTitle}>{formatHintTitle(item.entry)}</Text>
        <Text style={styles.hintSubtitle} numberOfLines={1}>
          {humanizeSource(item.entry.sourceType)}
        </Text>
      </View>
      <Text style={[styles.hintAmount, { color: amountColor }]}>{formatHintAmount(item.entry)}</Text>
    </Animated.View>
  );
}

export function GamificationHintsProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [visibleHints, setVisibleHints] = useState<HintItem[]>([]);

  const queueRef = useRef<HintItem[]>([]);
  const seenLedgerIdsRef = useRef<string[]>([]);
  const initializedRef = useRef(false);
  const syncingRef = useRef(false);
  const syncQueuedRef = useRef(false);

  useEffect(() => {
    seenLedgerIdsRef.current = [];
    queueRef.current = [];
    setVisibleHints([]);
    initializedRef.current = false;
  }, [user?.id]);

  const flushQueueToVisible = useCallback(() => {
    setVisibleHints((current) => {
      if (current.length >= MAX_VISIBLE_HINTS || queueRef.current.length === 0) return current;
      const room = MAX_VISIBLE_HINTS - current.length;
      const next = queueRef.current.slice(0, room);
      queueRef.current = queueRef.current.slice(room);
      return [...current, ...next];
    });
  }, []);

  const hideHint = useCallback(
    (id: string) => {
      setVisibleHints((current) => current.filter((item) => item.id !== id));
      setTimeout(() => {
        flushQueueToVisible();
      }, 0);
    },
    [flushQueueToVisible],
  );

  const enqueueHints = useCallback(
    (entries: LedgerEntry[]) => {
      if (entries.length === 0) return;
      const timestamp = Date.now();
      const nextItems = entries.map((entry, index) => ({
        id: `${entry.id}-${timestamp}-${index}`,
        entry,
      }));

      queueRef.current = [...queueRef.current, ...nextItems];
      flushQueueToVisible();
    },
    [flushQueueToVisible],
  );

  const syncFromLedger = useCallback(async () => {
    if (!user?.id) return;

    if (syncingRef.current) {
      syncQueuedRef.current = true;
      return;
    }

    syncingRef.current = true;

    try {
      do {
        syncQueuedRef.current = false;
        const response = await apiRequest("GET", "/api/v1/me/ledger");
        const payload = (await response.json()) as { data?: LedgerEntry[] };
        const ledger = payload.data?.slice(0, MAX_LEDGER_FETCH) || [];

        if (!initializedRef.current) {
          seenLedgerIdsRef.current = ledger.map((entry) => entry.id).slice(0, MAX_REMEMBERED_LEDGER_IDS);
          initializedRef.current = true;
          continue;
        }

        const seenSet = new Set(seenLedgerIdsRef.current);
        const freshEntries: LedgerEntry[] = [];
        for (const entry of ledger) {
          if (seenSet.has(entry.id)) break;
          freshEntries.push(entry);
        }

        if (freshEntries.length > 0) {
          enqueueHints(freshEntries.reverse());
        }

        seenLedgerIdsRef.current = [
          ...ledger.map((entry) => entry.id),
          ...seenLedgerIdsRef.current,
        ].slice(0, MAX_REMEMBERED_LEDGER_IDS);
      } while (syncQueuedRef.current);
    } catch {
    } finally {
      syncingRef.current = false;
    }
  }, [enqueueHints, user?.id]);

  useEffect(() => {
    syncFromLedger();
  }, [syncFromLedger]);

  const value = useMemo(
    () => ({
      syncFromLedger,
    }),
    [syncFromLedger],
  );

  return (
    <GamificationHintsContext.Provider value={value}>
      {children}
      <View pointerEvents="box-none" style={styles.overlay}>
        {visibleHints.map((item, index) => (
          <HintCard
            key={item.id}
            item={item}
            index={index}
            topInset={insets.top + 10}
            onDone={hideHint}
          />
        ))}
      </View>
    </GamificationHintsContext.Provider>
  );
}

export function useGamificationHints() {
  const context = useContext(GamificationHintsContext);
  if (!context) {
    throw new Error("useGamificationHints must be used within GamificationHintsProvider");
  }
  return context;
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: "box-none",
    zIndex: 999,
  },
  hint: {
    position: "absolute",
    left: 10,
    minHeight: 64,
    maxWidth: 340,
    width: "92%",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: 10,
    gap: 10,
    overflow: "hidden",
  },
  leftAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 2,
  },
  hintTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  hintTitle: {
    color: Colors.text,
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    lineHeight: 15,
  },
  hintSubtitle: {
    color: Colors.textMuted,
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    lineHeight: 14,
    textTransform: "capitalize",
    marginTop: 1,
  },
  hintAmount: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
  },
});