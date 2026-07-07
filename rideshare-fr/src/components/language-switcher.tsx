import { Globe2 } from "lucide-react";
import { languages, useI18n, type AppLanguage } from "@/lib/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function LanguageSwitcher({ compact = false, mobileNav = false }: { compact?: boolean; mobileNav?: boolean }) {
  const { language, setLanguage, t } = useI18n();

  return (
    <Select value={language} onValueChange={(value) => setLanguage(value as AppLanguage)}>
      <SelectTrigger
        className={
          mobileNav
            ? "h-9 w-[174px] justify-start gap-2 px-2.5 text-xs"
            : compact
              ? "h-9 w-full justify-start gap-2"
              : "h-9 w-[190px] justify-start gap-2"
        }
        aria-label={t("nav.changeLanguage")}
      >
        <Globe2 className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="whitespace-nowrap">
          {compact ? languages.find((item) => item.code === language)?.label : t("nav.changeLanguage")}
        </span>
      </SelectTrigger>
      <SelectContent>
        {languages.map((item) => (
          <SelectItem key={item.code} value={item.code}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
