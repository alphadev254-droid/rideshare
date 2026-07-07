import { useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuthModal } from "@/lib/auth-modal-context";
import { useAuth } from "@/lib/auth-context";
import { authService, extractApiError } from "@/lib/api";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { homeForRole } from "@/lib/role-home";
import { getPendingTripId, getPendingTripReturn } from "@/lib/pending-trip";
import { useI18n } from "@/lib/i18n";

export function AuthModal() {
  const { open, mode, intentRole, pendingPhone, closeModal, setMode } = useAuthModal();
  const { t } = useI18n();

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : closeModal())}>
      <DialogContent className="max-w-md border-border bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {mode === "login" && t("auth.login.title")}
            {mode === "register" && t("auth.register.title")}
            {mode === "verify" && t("auth.verify.title")}
            {mode === "forgot" && t("auth.forgot.title")}
            {mode === "reset" && t("auth.reset.title")}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {mode === "login" && t("auth.login.description")}
            {mode === "register" && t("auth.register.description")}
            {mode === "verify" && t("auth.verify.description")}
            {mode === "forgot" && t("auth.forgot.description")}
            {mode === "reset" && t("auth.reset.description")}
          </DialogDescription>
        </DialogHeader>

        {mode === "login" && (
          <LoginForm
            onSwitch={() => setMode("register")}
            onDone={closeModal}
            onNeedsVerify={(phone) => setMode("verify", phone)}
            onForgot={() => setMode("forgot")}
          />
        )}
        {mode === "register" && (
          <RegisterForm
            defaultRole={intentRole}
            onSwitch={() => setMode("login")}
            onForgot={() => setMode("forgot")}
            onSent={(phone) => setMode("verify", phone)}
          />
        )}
        {mode === "verify" && pendingPhone && <VerifyForm phone={pendingPhone} onDone={closeModal} />}
        {mode === "forgot" && (
          <ForgotPasswordForm
            onSwitch={() => setMode("login")}
            onSent={(identifier) => setMode("reset", identifier)}
          />
        )}
        {mode === "reset" && pendingPhone && (
          <ResetPasswordForm
            identifier={pendingPhone}
            onDone={() => setMode("login")}
            onBack={() => setMode("forgot")}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function navigateAfterAuth(navigate: ReturnType<typeof useNavigate>, user: Parameters<typeof homeForRole>[0]) {
  const returnPath = getPendingTripReturn();
  if (user.role === "passenger" && returnPath) {
    window.location.replace(returnPath);
    return;
  }
  const pendingTripId = getPendingTripId();
  if (user.role === "passenger" && pendingTripId) {
    navigate({ to: "/app", search: {} });
    return;
  }
  navigate({ to: homeForRole(user) });
}

function useSubmit() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return { loading, setLoading, error, setError };
}

function LoginForm({
  onSwitch,
  onDone,
  onNeedsVerify,
  onForgot,
}: {
  onSwitch: () => void;
  onDone: () => void;
  onNeedsVerify: (phone: string) => void;
  onForgot: () => void;
}) {
  const { t } = useI18n();
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const { loading, setLoading, error, setError } = useSubmit();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await authService.login({ identifier, password });
      if ("needsVerification" in result) {
        toast.info(t("auth.toast.notVerified"));
        onNeedsVerify(result.phone);
        return;
      }
      setSession(result);
      toast.success(`Welcome back, ${result.user.fullName.split(" ")[0]}`);
      onDone();
      navigateAfterAuth(navigate, result.user);
    } catch (e) {
      setError(extractApiError(e, t("auth.error.signIn")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <Field id="identifier" label={t("auth.phoneOrEmail")}>
        <Input
          id="identifier"
          required
          placeholder="+265 99 123 4567 or you@example.com"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
        />
      </Field>
      <PasswordField id="login-password" label={t("auth.password")} value={password} onChange={setPassword} />
      <div className="text-right">
        <button
          type="button"
          className="text-xs text-primary underline-offset-4 hover:underline"
          onClick={onForgot}
        >
          {t("auth.forgotPassword")}
        </button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t("auth.signIn")}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {t("auth.newHere")}{" "}
        <button
          type="button"
          className="text-primary underline-offset-4 hover:underline"
          onClick={onSwitch}
        >
          {t("auth.createAccount")}
        </button>
      </p>
    </form>
  );
}

function ForgotPasswordForm({
  onSwitch,
  onSent,
}: {
  onSwitch: () => void;
  onSent: (identifier: string) => void;
}) {
  const { t } = useI18n();
  const { loading, setLoading, error, setError } = useSubmit();
  const [identifier, setIdentifier] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await authService.forgotPassword({ identifier });
      toast.success(result.message);
      onSent(identifier);
    } catch (e) {
      setError(extractApiError(e, t("auth.error.resetRequest")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <Field id="reset-identifier" label={t("auth.phoneOrEmail")}>
        <Input
          id="reset-identifier"
          required
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="+265 99 123 4567 or you@example.com"
        />
      </Field>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t("auth.sendReset")}
      </Button>
      <button
        type="button"
        className="w-full text-center text-sm text-primary underline-offset-4 hover:underline"
        onClick={onSwitch}
      >
        {t("auth.backToSignIn")}
      </button>
    </form>
  );
}

function ResetPasswordForm({
  identifier,
  onDone,
  onBack,
}: {
  identifier: string;
  onDone: () => void;
  onBack: () => void;
}) {
  const { t } = useI18n();
  const { loading, setLoading, error, setError } = useSubmit();
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await authService.resetPassword({ identifier, otp, password });
      toast.success(result.message);
      onDone();
    } catch (e) {
      setError(extractApiError(e, t("auth.error.reset")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <Field id="reset-otp" label={t("auth.code")}>
        <Input
          id="reset-otp"
          inputMode="numeric"
          maxLength={6}
          required
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
          className="text-center font-mono text-2xl tracking-[0.5em]"
        />
      </Field>
      <PasswordField
        id="new-password"
        label={t("auth.newPassword")}
        value={password}
        onChange={setPassword}
        placeholder="At least 8 characters"
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t("auth.resetPassword")}
      </Button>
      <button
        type="button"
        className="w-full text-center text-sm text-primary underline-offset-4 hover:underline"
        onClick={onBack}
      >
        {t("auth.sendNewCode")}
      </button>
    </form>
  );
}

function RegisterForm({
  defaultRole,
  onSwitch,
  onForgot,
  onSent,
}: {
  defaultRole: "passenger" | "driver";
  onSwitch: () => void;
  onForgot: () => void;
  onSent: (phone: string) => void;
}) {
  const { t } = useI18n();
  const { loading, setLoading, error, setError } = useSubmit();
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"passenger" | "driver">(defaultRole);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await authService.register({ phone, email, fullName, password, role });
      toast.success(t("auth.toast.otpSent"));
      onSent(phone);
    } catch (e) {
      setError(extractApiError(e, t("auth.error.register")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="grid grid-cols-2 gap-2 rounded-md border bg-surface-2 p-1">
        {(["passenger", "driver"] as const).map((r) => {
          const isPassenger = r === "passenger";
          return (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`rounded px-3 py-2 text-left transition-colors ${
                role === r
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="block text-sm font-semibold">
                {isPassenger ? t("auth.findRide") : t("auth.createTrips")}
              </span>
              <span className="mt-0.5 block text-[11px] leading-4 opacity-80">
                {isPassenger ? t("auth.passengerAccount") : t("auth.driverAccount")}
              </span>
            </button>
          );
        })}
      </div>
      <Field id="fullName" label={t("auth.fullName")}>
        <Input
          id="fullName"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Chimwemwe Banda"
        />
      </Field>
      <Field id="email" label={t("auth.email")}>
        <Input
          id="email"
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </Field>
      <Field id="phone" label={t("auth.phone")}>
        <Input
          id="phone"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+265 99 123 4567"
        />
      </Field>
      <PasswordField
        id="reg-password"
        label={t("auth.password")}
        value={password}
        onChange={setPassword}
        placeholder="At least 8 characters"
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t("auth.sendOtp")}
      </Button>
      <div className="space-y-2 text-center text-sm text-muted-foreground">
        <p>
          {t("auth.alreadyRegistered")}{" "}
          <button
            type="button"
            className="text-primary underline-offset-4 hover:underline"
            onClick={onSwitch}
          >
            {t("auth.signIn")}
          </button>
        </p>
        <button
          type="button"
          className="text-primary underline-offset-4 hover:underline"
          onClick={onForgot}
        >
          {t("auth.forgotPassword")}
        </button>
      </div>
    </form>
  );
}

function VerifyForm({ phone, onDone }: { phone: string; onDone: () => void }) {
  const { t } = useI18n();
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const { loading, setLoading, error, setError } = useSubmit();
  const [otp, setOtp] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const tokens = await authService.verifyOtp({ phone, otp });
      setSession(tokens);
      toast.success(t("auth.toast.verified"));
      onDone();
      navigateAfterAuth(navigate, tokens.user);
    } catch (e) {
      setError(extractApiError(e, t("auth.error.otp")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-xs text-primary">
        <ShieldCheck className="h-4 w-4" />
        {t("auth.verifyNote")}
      </div>
      <Field id="otp" label={t("auth.code")}>
        <Input
          id="otp"
          inputMode="numeric"
          maxLength={6}
          required
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
          className="text-center font-mono text-2xl tracking-[0.5em]"
          placeholder="• • • • • •"
        />
      </Field>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t("auth.verifyButton")}
      </Button>
    </form>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="label-eyebrow">
        {label}
      </Label>
      {children}
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <Field id={id} label={label}>
      <div className="relative">
        <Input
          id={id}
          required
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pr-10"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((s) => !s)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </Field>
  );
}
