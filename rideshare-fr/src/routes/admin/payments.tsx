import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { TransactionList } from "@/components/transactions/transaction-list";
import { AdminPagination } from "@/components/admin-pagination";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { paymentService, type PaymentStatus } from "@/lib/api";

export const Route = createFileRoute("/admin/payments")({
  component: AdminPayments,
});

const DEFAULT_PAGE_SIZE = 70;

function AdminPayments() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<PaymentStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["payments", "admin", search, status, page, limit],
    queryFn: () => paymentService.adminTransactions({ page, limit, search: search || undefined, status }),
  });

  const transactions = data?.data ?? [];
  const totalTransactions = data?.total ?? 0;

  useEffect(() => {
    setPage(1);
  }, [search, status]);

  function changeLimit(nextLimit: number) {
    setLimit(nextLimit);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Admin" title="Transactions" description="All passenger payments, transaction cost rates, system fee rates and driver amounts." />

      <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search passenger, driver or reference" />
        <Select value={status} onValueChange={(value) => setStatus(value as PaymentStatus | "all")}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="initiated">Initiated</SelectItem>
            <SelectItem value="escrow_held">Held in escrow</SelectItem>
            <SelectItem value="released">Released</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : (
        <>
          <TransactionList
            transactions={transactions}
            detailBase="/admin/payments/$id"
            variant="admin"
            viewMode="dialog"
          />
          <AdminPagination
            page={page}
            limit={limit}
            total={totalTransactions}
            isFetching={isFetching}
            onPageChange={setPage}
            onLimitChange={changeLimit}
          />
        </>
      )}
    </div>
  );
}
