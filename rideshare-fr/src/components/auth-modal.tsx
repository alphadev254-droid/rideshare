import { useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { getPendingTripId } from "@/lib/pending-trip";

export function AuthModal() {
  const { open, mode, intentRole, pendingPhone, closeModal, setMode } = useAuthModal();
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : closeModal())}>
      <DialogContent className="max-w-md border-border bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {mode === "login" && "Welcome back"}
            {mode === "register" && "Create your account"}
            {mode === "verify" && "Verify your number"}
            {mode === "forgot" && "Reset your password"}
            {mode === "reset" && "Enter reset code"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {mode === "login" && "Sign in with your phone or email and password."}
            {mode === "register" && "We'll send a one-time code to your email."}
            {mode === "verify" && `Enter the 6-digit code sent to your email.`}
            {mode === "forgot" && "Enter your phone or email and we will send a reset code."}
            {mode === "reset" && "Enter the code sent to your email and choose a new password."}
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
        {mode === "verify" && pendingPhone && (
          <VerifyForm phone={pendingPhone} onDone={closeModal} />
        )}
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
        toast.info("Account not verified Ã¢â‚¬â€ OTP sent to your email");
        onNeedsVerify(result.phone);
        return;
      }
      setSession(result);
      toast.success(`Welcome back, ${result.user.fullName.split(" ")[0]}`);
      onDone();
      navigateAfterAuth(navigate, result.user);
    } catch (e) {
      setError(extractApiError(e, "Unable to sign in"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <Field id="identifier" label="Phone or email">
        <Input
          id="identifier"
          required
          placeholder="+265 99 123 4567 or you@example.com"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
        />
      </Field>
      <PasswordField id="login-password" label="Password" value={password} onChange={setPassword} />
      <div className="text-right">
        <button
          type="button"
          className="text-xs text-primary underline-offset-4 hover:underline"
          onClick={onForgot}
        >
          Forgot password?
        </button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Sign in
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        New here?{" "}
        <button
          type="button"
          className="text-primary underline-offset-4 hover:underline"
          onClick={onSwitch}
        >
          Create an account
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
      setError(extractApiError(e, "Unable to request password reset"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <Field id="reset-identifier" label="Phone or email">
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
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send reset code
      </Button>
      <button
        type="button"
        className="w-full text-center text-sm text-primary underline-offset-4 hover:underline"
        onClick={onSwitch}
      >
        Back to sign in
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
      setError(extractApiError(e, "Unable to reset password"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <Field id="reset-otp" label="6-digit code">
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
        label="New password"
        value={password}
        onChange={setPassword}
        placeholder="At least 8 characters"
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Reset password
      </Button>
      <button
        type="button"
        className="w-full text-center text-sm text-primary underline-offset-4 hover:underline"
        onClick={onBack}
      >
        Send a new code
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
      toast.success("OTP sent to your email");
      onSent(phone);
    } catch (e) {
      setError(extractApiError(e, "Unable to register"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="grid grid-cols-2 gap-2 rounded-md border bg-surface-2 p-1">
        {(["passenger", "driver"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            className={`rounded px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
              role === r
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {r === "passenger" ? "Find a ride" : "Drive"}
          </button>
        ))}
      </div>
      <Field id="fullName" label="Full name">
        <Input
          id="fullName"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Chimwemwe Banda"
        />
      </Field>
      <Field id="email" label="Email address">
        <Input
          id="email"
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </Field>
      <Field id="phone" label="Phone number">
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
        label="Password"
        value={password}
        onChange={setPassword}
        placeholder="At least 8 characters"
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send OTP
      </Button>
      <div className="space-y-2 text-center text-sm text-muted-foreground">
        <p>
          Already registered?{" "}
          <button
            type="button"
            className="text-primary underline-offset-4 hover:underline"
            onClick={onSwitch}
          >
            Sign in
          </button>
        </p>
        <button
          type="button"
          className="text-primary underline-offset-4 hover:underline"
          onClick={onForgot}
        >
          Forgot password?
        </button>
      </div>
    </form>
  );
}

function VerifyForm({ phone, onDone }: { phone: string; onDone: () => void }) {
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
      toast.success("You're verified");
      onDone();
      navigateAfterAuth(navigate, tokens.user);
    } catch (e) {
      setError(extractApiError(e, "Invalid OTP"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-xs text-primary">
        <ShieldCheck className="h-4 w-4" />
        Secure verification via email Ã¢â‚¬â€ never share your code.
      </div>
      <Field id="otp" label="6-digit code">
        <Input
          id="otp"
          inputMode="numeric"
          maxLength={6}
          required
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
          className="text-center font-mono text-2xl tracking-[0.5em]"
          placeholder="Ã¢â‚¬Â¢ Ã¢â‚¬Â¢ Ã¢â‚¬Â¢ Ã¢â‚¬Â¢ Ã¢â‚¬Â¢ Ã¢â‚¬Â¢"
        />
      </Field>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Verify
      </Button>
    </form>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
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






