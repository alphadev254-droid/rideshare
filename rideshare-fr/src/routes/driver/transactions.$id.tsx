import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { TransactionDetail } from "@/components/transactions/transaction-detail";
import { paymentService } from "@/lib/api";

export const Route = createFileRoute("/driver/transactions/$id")({
  component: DriverTransactionDetail,
});

function DriverTransactionDetail() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["payments", "driver", id],
    queryFn: () => paymentService.transactionById(id),
  });

  if (isLoading) return <LoadingState />;
  if (!data) return <div className="rounded-md border border-border p-6 text-sm">Transaction not found.</div>;

  return (
    <div className="space-y-6">
      <Link to="/driver/transactions" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Transactions
      </Link>
      <PageHeader eyebrow="Transaction" title="Payment details" description={data.route ?? undefined} />
      <TransactionDetail transaction={data} variant="driver" />
    </div>
  );
}
