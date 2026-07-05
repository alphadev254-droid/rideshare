import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { MessageSquareText, Search, Star } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { LoadingState } from "@/components/loading-state";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { reviewService, type AdminReview } from "@/lib/api";
import { formatDateTime, formatMwk } from "@/lib/format";
import { useDebounce } from "@/hooks/use-debounce";
import { AdminPagination } from "@/components/admin-pagination";

export const Route = createFileRoute("/admin/reviews")({
  component: AdminReviews,
});

const DEFAULT_PAGE_SIZE = 70;

function AdminReviews() {
  const [search, setSearch] = useState("");
  const [rating, setRating] = useState<"all" | "1" | "2" | "3" | "4" | "5">("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const debouncedSearch = useDebounce(search, 350);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["reviews", "admin", debouncedSearch, rating, page, limit],
    queryFn: () =>
      reviewService.admin({
        page,
        limit,
        search: debouncedSearch || undefined,
        rating: rating === "all" ? undefined : Number(rating),
      }),
  });

  const reviews = data?.data ?? [];
  const totalReviews = data?.total ?? 0;

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, rating]);

  function changeLimit(nextLimit: number) {
    setLimit(nextLimit);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Trip reviews"
        description="Passenger ratings and comments after completed rides."
      />

      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search passenger, driver, route or comment"
            className="pl-9"
          />
        </div>
        <Select value={rating} onValueChange={(value) => setRating(value as typeof rating)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All ratings</SelectItem>
            {[5, 4, 3, 2, 1].map((value) => (
              <SelectItem key={value} value={String(value)}>
                {value} star{value === 1 ? "" : "s"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : reviews.length === 0 ? (
        <EmptyState
          icon={<MessageSquareText className="h-5 w-5" />}
          title="No reviews found"
          description="Completed-trip comments will appear here."
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rating</TableHead>
                  <TableHead>Passenger</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Trip</TableHead>
                  <TableHead>Comment</TableHead>
                  <TableHead>Fare</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviews.map((review) => (
                  <ReviewRow key={review.id} review={review} />
                ))}
              </TableBody>
            </Table>
          </div>
          <AdminPagination
            page={page}
            limit={limit}
            total={totalReviews}
            isFetching={isFetching}
            onPageChange={setPage}
            onLimitChange={changeLimit}
          />
        </>
      )}
    </div>
  );
}

function ReviewRow({ review }: { review: AdminReview }) {
  return (
    <TableRow>
      <TableCell>
        <div className="inline-flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-2 py-1 text-sm font-semibold text-gold">
          <Star className="h-3.5 w-3.5 fill-current" />
          {review.rating}
        </div>
      </TableCell>
      <TableCell>
        <div className="font-medium">{review.passenger.fullName}</div>
        <div className="text-xs text-muted-foreground">{review.passenger.phone}</div>
      </TableCell>
      <TableCell>
        <div className="font-medium">{review.driver.user.fullName}</div>
        <div className="text-xs text-muted-foreground">
          {review.driver.user.rating ? `${Number(review.driver.user.rating).toFixed(1)} avg` : "No average"}
        </div>
      </TableCell>
      <TableCell>
        <div className="font-medium">
          {review.booking.trip.originName} to {review.booking.trip.destinationName}
        </div>
        <div className="text-xs text-muted-foreground">
          {formatDateTime(review.booking.trip.departureTime)}
        </div>
      </TableCell>
      <TableCell className="max-w-sm">
        <div className="line-clamp-2 text-sm">
          {review.comment?.trim() || <span className="text-muted-foreground">No comment</span>}
        </div>
      </TableCell>
      <TableCell className="tabular">{formatMwk(review.booking.fareMwk)}</TableCell>
      <TableCell>{formatDateTime(review.createdAt)}</TableCell>
      <TableCell className="text-right">
        <Button asChild size="sm" variant="outline">
          <Link to="/admin/bookings">Bookings</Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}
