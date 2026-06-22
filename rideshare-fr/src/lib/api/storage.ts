import { API_CONFIG } from "./config";
import type { User } from "./types";

const isBrowser = typeof window !== "undefined";

export const tokenStorage = {
  getAccess(): string | null {
    if (!isBrowser) return null;
    return localStorage.getItem(API_CONFIG.storage.accessToken);
  },
  getRefresh(): string | null {
    if (!isBrowser) return null;
    return localStorage.getItem(API_CONFIG.storage.refreshToken);
  },
  setTokens(access: string, refresh?: string) {
    if (!isBrowser) return;
    localStorage.setItem(API_CONFIG.storage.accessToken, access);
    if (refresh) localStorage.setItem(API_CONFIG.storage.refreshToken, refresh);
  },
  clear() {
    if (!isBrowser) return;
    localStorage.removeItem(API_CONFIG.storage.accessToken);
    localStorage.removeItem(API_CONFIG.storage.refreshToken);
    localStorage.removeItem(API_CONFIG.storage.user);
  },
  getUser(): User | null {
    if (!isBrowser) return null;
    const raw = localStorage.getItem(API_CONFIG.storage.user);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  },
  setUser(user: User) {
    if (!isBrowser) return;
    localStorage.setItem(API_CONFIG.storage.user, JSON.stringify(user));
  },
};
