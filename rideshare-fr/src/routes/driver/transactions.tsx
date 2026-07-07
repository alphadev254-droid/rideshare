import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { TransactionList } from "@/components/transactions/transaction-list";
import { paymentService } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/driver/transactions")({
  component: DriverTransactions,
});

function DriverTransactions() {
  const { t } = useI18n();
  const { data, isLoading } = useQuery({
    queryKey: ["payments", "driver"],
    queryFn: () => paymentService.driverTransactions({ limit: 50 }),
  });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t("driverTransactions.eyebrow")} title={t("driverTransactions.title")} description={t("driverTransactions.description")} />
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
