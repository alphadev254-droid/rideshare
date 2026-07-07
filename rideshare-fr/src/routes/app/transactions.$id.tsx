import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { TransactionDetail } from "@/components/transactions/transaction-detail";
import { paymentService } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/app/transactions/$id")({
  component: PassengerTransactionDetail,
});

function PassengerTransactionDetail() {
  const { t } = useI18n();
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["payments", "detail", id],
    queryFn: () => paymentService.transactionById(id),
  });

  if (isLoading) return <LoadingState />;
  if (!data) return <div className="rounded-md border border-border p-6 text-sm">{t("transactions.notFound")}</div>;

  return (
    <div className="space-y-6">
      <Link to="/app/transactions" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> {t("passengerNav.transactions")}
      </Link>
      <PageHeader eyebrow={t("transactions.transaction")} title={t("transactions.paymentDetails")} description={data.route ?? undefined} />
      <TransactionDetail transaction={data} />
    </div>
  );
}
