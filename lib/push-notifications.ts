import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { apiRequest } from "@/lib/query-client";

const PUSH_TOKEN_KEY = "taskquest_push_token";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export type NotificationNavigationTarget =
  | { type: "task"; taskId: string }
  | { type: "invite"; token: string }
  | { type: "notifications" };

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function getInviteToken(data: Record<string, unknown>): string | null {
  const directToken =
    readString(data.token) || readString(data.inviteToken) || readString(data.invite_token);

  if (directToken) {
    return directToken;
  }

  const invitePath = readString(data.invitePath) || readString(data.invite_path) || readString(data.path);
  if (!invitePath) {
    return null;
  }

  const match = invitePath.match(/invites\/(.+)$/);
  return match?.[1] ? match[1] : null;
}

export function getNotificationNavigationTarget(data: unknown): NotificationNavigationTarget {
  if (!data || typeof data !== "object") {
    return { type: "notifications" };
  }

  const payload = data as Record<string, unknown>;
  const taskId = readString(payload.taskId) || readString(payload.task_id);
  if (taskId) {
    return { type: "task", taskId };
  }

  const token = getInviteToken(payload);
  if (token) {
    return { type: "invite", token };
  }

  return { type: "notifications" };
}

function getProjectId(): string | undefined {
  const expoProjectId = Constants.expoConfig?.extra?.eas?.projectId;
  const easProjectId = Constants.easConfig?.projectId;
  return readString(expoProjectId) || readString(easProjectId) || undefined;
}

export async function registerForPushToken(): Promise<string | null> {
  if (Platform.OS !== "ios") {
    return null;
  }

  const permissions = await Notifications.getPermissionsAsync();
  let finalStatus = permissions.status;

  if (finalStatus !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  const projectId = getProjectId();
  const tokenResponse = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();

  return readString(tokenResponse.data);
}

export async function syncPushTokenWithBackend(): Promise<void> {
  try {
    const token = await registerForPushToken();
    if (!token) {
      return;
    }

    if (__DEV__) {
      console.log("[push] Expo token", token);
    }

    const cachedToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (cachedToken === token) {
      return;
    }

    await apiRequest("POST", "/api/push/register", {
      token,
      platform: Platform.OS,
      provider: "expo",
      appVersion: Constants.expoConfig?.version || null,
    });

    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
  } catch (error) {
    console.warn("[push] Failed to sync push token", error);
  }
}

export async function unregisterPushTokenFromBackend(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (!token) {
      return;
    }

    await apiRequest("POST", "/api/push/unregister", {
      token,
      platform: Platform.OS,
      provider: "expo",
    });
  } catch (error) {
    console.warn("[push] Failed to unregister push token", error);
  } finally {
    await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
  }
}
