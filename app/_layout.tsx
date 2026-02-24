import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import * as Notifications from "expo-notifications";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { StatusBar } from "expo-status-bar";
import Colors from "@/constants/colors";
import { GamificationHintsProvider } from "@/lib/gamification-hints";
import {
  getNotificationNavigationTarget,
  syncPushTokenWithBackend,
} from "@/lib/push-notifications";
import { useLocalNotificationBridge } from "@/lib/use-local-notification-bridge";

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: "Back",
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ presentation: "modal", headerShown: false }} />
      <Stack.Screen name="task/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="invite/[token]" options={{ headerShown: false }} />
      <Stack.Screen
        name="create-task"
        options={{
          presentation: "formSheet",
          sheetAllowedDetents: [0.95],
          sheetGrabberVisible: true,
          headerShown: false,
          contentStyle: { backgroundColor: Colors.surface },
        }}
      />
      <Stack.Screen
        name="create-list"
        options={{
          presentation: "formSheet",
          sheetAllowedDetents: [0.5],
          sheetGrabberVisible: true,
          headerShown: false,
          contentStyle: { backgroundColor: Colors.surface },
        }}
      />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

function PushNotificationsBootstrap() {
  const { isAuthenticated } = useAuth();

  useLocalNotificationBridge();

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    void syncPushTokenWithBackend();

    const handleResponse = (response: Notifications.NotificationResponse) => {
      const target = getNotificationNavigationTarget(response.notification.request.content.data);

      if (target.type === "task") {
        router.push({ pathname: "/task/[id]", params: { id: target.taskId } });
        return;
      }

      if (target.type === "invite") {
        router.push({ pathname: "/invite/[token]", params: { token: target.token } });
        return;
      }

      router.push("/(tabs)/notifications");
    };

    const responseListener = Notifications.addNotificationResponseReceivedListener(handleResponse);

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        handleResponse(response);
      }
    });

    return () => {
      responseListener.remove();
    };
  }, [isAuthenticated]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.background }}>
          <KeyboardProvider>
            <AuthProvider>
              <GamificationHintsProvider>
                <StatusBar style="light" />
                <PushNotificationsBootstrap />
                <RootLayoutNav />
              </GamificationHintsProvider>
            </AuthProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
