import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetch } from "expo/fetch";
import type { UserProfile, AuthResponse } from "./types";
import { getApiUrl, setAuthToken, queryClient } from "./query-client";

const TOKEN_KEY = "taskquest_token";

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateUser: (user: UserProfile) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  async function loadStoredAuth() {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (token) {
        setAuthToken(token);
        const profile = await fetchProfile(token);
        if (profile) {
          setUser(profile);
        } else {
          await AsyncStorage.removeItem(TOKEN_KEY);
          setAuthToken(null);
        }
      }
    } catch {
      await AsyncStorage.removeItem(TOKEN_KEY);
      setAuthToken(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchProfile(token: string): Promise<UserProfile | null> {
    try {
      const baseUrl = getApiUrl();
      const url = new URL("/api/v1/auth/me", baseUrl);
      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return (await res.json()) as UserProfile;
    } catch {
      return null;
    }
  }

  async function login(email: string, password: string) {
    const baseUrl = getApiUrl();
    const url = new URL("/api/v1/auth/login", baseUrl);
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      throw new Error(errorData?.error?.message || "Login failed");
    }

    const data = (await res.json()) as AuthResponse;
    await AsyncStorage.setItem(TOKEN_KEY, data.accessToken);
    setAuthToken(data.accessToken);
    setUser(data.user);
    queryClient.clear();
  }

  async function register(name: string, email: string, password: string) {
    const baseUrl = getApiUrl();
    const url = new URL("/api/v1/auth/register", baseUrl);
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      throw new Error(errorData?.error?.message || "Registration failed");
    }

    const data = (await res.json()) as AuthResponse;
    await AsyncStorage.setItem(TOKEN_KEY, data.accessToken);
    setAuthToken(data.accessToken);
    setUser(data.user);
    queryClient.clear();
  }

  async function logout() {
    await AsyncStorage.removeItem(TOKEN_KEY);
    setAuthToken(null);
    setUser(null);
    queryClient.clear();
  }

  async function refreshProfile() {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (token) {
      const profile = await fetchProfile(token);
      if (profile) setUser(profile);
    }
  }

  function updateUser(updatedUser: UserProfile) {
    setUser(updatedUser);
  }

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      register,
      logout,
      refreshProfile,
      updateUser,
    }),
    [user, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
