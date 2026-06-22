import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type Mode = "login" | "register" | "verify";
interface AuthModalState {
  open: boolean;
  mode: Mode;
  intentRole: "passenger" | "driver";
  pendingPhone?: string;
}
interface AuthModalCtx extends AuthModalState {
  openModal: (opts?: { mode?: Mode; role?: "passenger" | "driver"; phone?: string }) => void;
  closeModal: () => void;
  setMode: (m: Mode, phone?: string) => void;
}

const Ctx = createContext<AuthModalCtx | null>(null);

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthModalState>({
    open: false,
    mode: "login",
    intentRole: "passenger",
  });

  const openModal = useCallback<AuthModalCtx["openModal"]>((opts) => {
    setState((s) => ({
      open: true,
      mode: opts?.mode ?? "login",
      intentRole: opts?.role ?? s.intentRole,
      pendingPhone: opts?.phone,
    }));
  }, []);
  const closeModal = useCallback(() => setState((s) => ({ ...s, open: false })), []);
  const setMode = useCallback(
    (mode: Mode, phone?: string) =>
      setState((s) => ({ ...s, mode, pendingPhone: phone ?? s.pendingPhone })),
    [],
  );

  const value = useMemo<AuthModalCtx>(
    () => ({ ...state, openModal, closeModal, setMode }),
    [state, openModal, closeModal, setMode],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuthModal() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuthModal must be used within AuthModalProvider");
  return ctx;
}
