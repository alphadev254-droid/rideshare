import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DEFAULT_PAGE_SIZE_OPTIONS = [25, 50, 70, 100];

type AdminPaginationProps = {
  page: number;
  limit: number;
  total: number;
  isFetching?: boolean;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  pageSizeOptions?: number[];
};

export function AdminPagination({
  page,
  limit,
  total,
  isFetching = false,
  onPageChange,
  onLimitChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}: AdminPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * limit + 1;
  const end = Math.min(total, safePage * limit);

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-md border border-border bg-card p-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
      <div>
        Showing <span className="font-medium text-foreground">{start}-{end}</span> of{" "}
        <span className="font-medium text-foreground">{total}</span> records
        <span className="mx-2 text-border">|</span>
        Page <span className="font-medium text-foreground">{safePage}</span> of{" "}
        <span className="font-medium text-foreground">{totalPages}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {onLimitChange ? (
          <Select value={String(limit)} onValueChange={(value) => onLimitChange(Number(value))}>
            <SelectTrigger className="h-9 w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={safePage <= 1 || isFetching}
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={safePage >= totalPages || isFetching}
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
