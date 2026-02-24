import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import * as Notifications from "expo-notifications";
import { useQuery } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/lib/auth-context";
import type { NotificationResponse, Notification } from "@/lib/types";

const LAST_SEEN_KEY = "taskquest_last_seen_notif";
const POLL_INTERVAL = 30_000;

const NOTIF_TITLES: Record<string, string> = {
  task_assigned: "Nova tarefa atribuída",
  task_pending_approval: "Tarefa aguardando aprovação",
  task_approved: "Tarefa aprovada!",
  task_rejected: "Tarefa rejeitada",
  list_invite_received: "Convite recebido",
  user_level_up: "Level up! 🎉",
};

function buildNotifData(notification: Notification): Record<string, unknown> {
  const data: Record<string, unknown> = { ...notification.payload };
  if (notification.taskId) {
    data.taskId = notification.taskId;
  }
  return data;
}

async function getLastSeenTimestamp(): Promise<number> {
  const stored = await AsyncStorage.getItem(LAST_SEEN_KEY);
  return stored ? Number(stored) : 0;
}

async function setLastSeenTimestamp(ts: number): Promise<void> {
  await AsyncStorage.setItem(LAST_SEEN_KEY, String(ts));
}

async function scheduleLocalNotifications(notifications: Notification[]): Promise<void> {
  const lastSeen = await getLastSeenTimestamp();
  let maxTs = lastSeen;

  const newNotifs = notifications.filter((n) => {
    const ts = new Date(n.createdAt).getTime();
    return !n.isRead && ts > lastSeen;
  });

  if (newNotifs.length === 0) {
    return;
  }

  for (const n of newNotifs) {
    const ts = new Date(n.createdAt).getTime();
    if (ts > maxTs) {
      maxTs = ts;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: NOTIF_TITLES[n.type] || n.title,
        body: n.message,
        data: buildNotifData(n),
        sound: "default",
      },
      trigger: null,
    });
  }

  await setLastSeenTimestamp(maxTs);
}

export function useLocalNotificationBridge() {
  const { isAuthenticated } = useAuth();
  const appState = useRef<AppStateStatus>(AppState.currentState);

  const { data } = useQuery<NotificationResponse>({
    queryKey: ["/api/v1/notifications"],
    enabled: isAuthenticated,
    refetchInterval: POLL_INTERVAL,
  });

  const latestData = useRef(data);
  latestData.current = data;

  // Schedule local notifications whenever new data arrives
  useEffect(() => {
    if (!data?.data || data.data.length === 0) {
      return;
    }

    void scheduleLocalNotifications(data.data);
  }, [data]);

  // Re-fetch and schedule when app comes back to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === "active") {
        if (latestData.current?.data) {
          void scheduleLocalNotifications(latestData.current.data);
        }
      }
      appState.current = nextState;
    });

    return () => {
      subscription.remove();
    };
  }, []);
}
