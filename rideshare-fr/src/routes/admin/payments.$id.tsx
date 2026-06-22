import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { TransactionDetail } from "@/components/transactions/transaction-detail";
import { Button } from "@/components/ui/button";
import { adminService, paymentService } from "@/lib/api";

export const Route = createFileRoute("/admin/payments/$id")({
  component: AdminPaymentDetail,
});

function AdminPaymentDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["payments", "admin", id],
    queryFn: () => paymentService.transactionById(id),
  });
  const refund = useMutation({
    mutationFn: () => adminService.refundPayment(id),
    onSuccess: () => {
      toast.success("Refund marked");
      qc.invalidateQueries({ queryKey: ["payments"] });
    },
    onError: (error: Error) => toast.error(error.message || "Could not refund"),
  });

  if (isLoading) return <LoadingState />;
  if (!data) return <div className="rounded-md border border-border p-6 text-sm">Transaction not found.</div>;

  return (
    <div className="space-y-6">
      <Link to="/admin/payments" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Transactions
      </Link>
      <PageHeader
        eyebrow="Admin"
        title="Transaction details"
        description={data.route ?? undefined}
        actions={
          <Button
            variant="outline"
            className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10"
            disabled={refund.isPending || data.status === "refunded"}
            onClick={() => refund.mutate()}
          >
            <Undo2 className="h-4 w-4" />
            Refund
          </Button>
        }
      />
      <TransactionDetail transaction={data} variant="admin" />
    </div>
  );
}
