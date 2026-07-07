import type { PaymentMethod } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const mobileMoneyMethods: Array<{ value: PaymentMethod; label: string }> = [
  { value: "airtel_money", label: "Airtel Money" },
  { value: "tnm_mpamba", label: "TNM Mpamba" },
];

function inferMobileMoneyMethod(phone: string): PaymentMethod | null {
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("265") ? `0${digits.slice(3)}` : digits.length === 9 ? `0${digits}` : digits;
  if (/^0?8[89]/.test(local)) return "tnm_mpamba";
  if (/^0?9[789]/.test(local)) return "airtel_money";
  return null;
}

export function PaymentMethodFields({
  method,
  phone,
  onMethodChange,
  onPhoneChange,
  disabled,
}: {
  method: PaymentMethod;
  phone: string;
  onMethodChange: (value: PaymentMethod) => void;
  onPhoneChange: (value: string) => void;
  disabled?: boolean;
}) {
  function handlePhoneChange(value: string) {
    onPhoneChange(value);
    const inferred = inferMobileMoneyMethod(value);
    if (inferred) onMethodChange(inferred);
  }

  return (
    <div className="grid gap-3 sm:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-1.5">
        <Label className="label-eyebrow">Payment operator</Label>
        <Select value={method} onValueChange={(value) => onMethodChange(value as PaymentMethod)} disabled={disabled}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {mobileMoneyMethods.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="label-eyebrow">Mobile money number</Label>
        <Input
          value={phone}
          onChange={(event) => handlePhoneChange(event.target.value)}
          placeholder="0991234567"
          inputMode="tel"
          disabled={disabled}
        />
        <p className="text-[11px] text-muted-foreground">
          Use the number that will approve the payment prompt.
        </p>
      </div>
    </div>
  );
}
