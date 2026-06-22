import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { TransactionList } from "@/components/transactions/transaction-list";
import { paymentService } from "@/lib/api";

export const Route = createFileRoute("/driver/transactions")({
  component: DriverTransactions,
});

function DriverTransactions() {
  const { data, isLoading } = useQuery({
    queryKey: ["payments", "driver"],
    queryFn: () => paymentService.driverTransactions({ limit: 50 }),
  });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Payments" title="Ride transactions" description="Passenger payments, system fee and your driver amount." />
      {isLoading ? (
        <LoadingState />
      ) : (
        <TransactionList
          transactions={data ?? []}
          detailBase="/driver/transactions/$id"
          viewMode="dialog"
          variant="driver"
        />
      )}
    </div>
  );
}
