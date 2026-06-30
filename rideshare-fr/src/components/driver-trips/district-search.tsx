import { useEffect, useRef } from "react";
import { MapPin, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

export function DistrictSearch({
  value,
  search,
  onSearch,
  onPick,
  onClear,
  open,
  setOpen,
  districts,
  placeholder,
  invalid,
}: {
  value: string;
  search: string;
  onSearch: (value: string) => void;
  onPick: (district: string) => void;
  onClear: () => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  districts: string[];
  placeholder: string;
  invalid?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, setOpen]);

  return (
    <div className="relative" ref={containerRef}>
      {value ? (
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`flex w-full items-center gap-1 rounded-md border bg-surface-2 px-3 py-2 pr-9 text-left ${
              invalid ? "border-destructive" : "border-border"
            }`}
          >
            <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 text-sm">{value}</span>
          </button>
          <button
            type="button"
            onClick={onClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            onFocus={() => setOpen(true)}
            placeholder={placeholder}
            className={`pl-9 ${invalid ? "border-destructive" : ""}`}
            aria-invalid={invalid}
          />
          {open && districts.length > 0 && (
            <div className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-border bg-card shadow-lg">
              {districts.map((district) => (
                <button
                  key={district}
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-2"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    onPick(district);
                  }}
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  {district}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {value && open && districts.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-border bg-card shadow-lg">
          {districts.map((district) => (
            <button
              key={district}
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-2"
              onMouseDown={(event) => {
                event.preventDefault();
                onPick(district);
              }}
            >
              <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              {district}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
