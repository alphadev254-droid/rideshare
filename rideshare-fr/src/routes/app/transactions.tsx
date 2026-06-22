import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { LoadingState } from "@/components/loading-state";
import { TransactionList } from "@/components/transactions/transaction-list";
import { paymentService } from "@/lib/api";

export const Route = createFileRoute("/app/transactions")({
  component: PassengerTransactions,
});

function PassengerTransactions() {
  const { data, isLoading } = useQuery({
    queryKey: ["payments", "my"],
    queryFn: () => paymentService.myTransactions({ limit: 50 }),
  });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Payments" title="My transactions" description="Ride payments, fees and payment status." />
      {isLoading ? (
        <LoadingState />
      ) : (
        <TransactionList transactions={data ?? []} detailBase="/app/transactions/$id" viewMode="dialog" />
      )}
    </div>
  );
}
