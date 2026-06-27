import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AUTH_UNAUTHORIZED_EVENT, authService, tokenStorage, userService, type User } from "@/lib/api";

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setSession: (tokens: { accessToken: string; refreshToken: string; user: User }) => void;
  setUser: (user: User) => void;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    function handleUnauthorized() {
      setUserState(null);
      setIsLoading(false);
    }

    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  useEffect(() => {
    const cached = tokenStorage.getUser();
    if (cached) setUserState(cached);
    const token = tokenStorage.getAccess();
    if (token) {
      userService
        .me()
        .then((u) => {
          setUserState(u);
          tokenStorage.setUser(u);
        })
        .catch(() => {
          /* token may be invalid; client handles refresh */
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const setSession = useCallback<AuthContextValue["setSession"]>((t) => {
    tokenStorage.setTokens(t.accessToken, t.refreshToken);
    tokenStorage.setUser(t.user);
    setUserState(t.user);
  }, []);

  const setUser = useCallback((u: User) => {
    tokenStorage.setUser(u);
    setUserState(u);
  }, []);

  const refreshUser = useCallback(async () => {
    const u = await userService.me();
    tokenStorage.setUser(u);
    setUserState(u);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      /* ignore */
    }
    tokenStorage.clear();
    setUserState(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      setSession,
      setUser,
      refreshUser,
      logout,
    }),
    [user, isLoading, setSession, setUser, refreshUser, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

