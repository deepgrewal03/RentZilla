import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { RefreshCw, ChevronLeft, ChevronRight, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Booking {
  id: string; customerName: string; customerEmail: string | null;
  listingTitle: string; listingCategory: string; startDate: string;
  endDate: string; totalDays: number; totalAmount: number;
  status: string; paymentStatus: string; createdAt: string;
}

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const PAY_COLOR: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  paid: "bg-green-100 text-green-700",
  refunded: "bg-purple-100 text-purple-700",
};

export default function Bookings() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ bookings: Booking[]; total: number }>({
    queryKey: ["admin-bookings", page, statusFilter],
    queryFn: () => {
      const p = new URLSearchParams({ page: String(page), limit: "15" });
      if (statusFilter) p.set("status", statusFilter);
      return api.get(`/admin/bookings?${p}`);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/bookings/${id}`, { status: "cancelled" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-bookings"] }); toast({ title: "Booking cancelled" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const totalPages = Math.ceil((data?.total || 0) / 15);

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
          <p className="text-gray-500 text-sm mt-0.5">{data?.total || 0} total bookings</p>
        </div>
        <div className="flex gap-2">
          {["", "pending", "confirmed", "completed", "cancelled"].map(s => (
            <button key={s || "all"}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${statusFilter === s ? "bg-orange-500 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
            >
              {s || "All"}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left">
                {["Booking ID", "Customer", "Listing", "Dates", "Amount", "Status", "Payment", "Actions"].map(h => (
                  <th key={h} className="px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">
                  <RefreshCw size={20} className="animate-spin mx-auto mb-2" />Loading...
                </td></tr>
              ) : data?.bookings.map(b => (
                <tr key={b.id} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="text-sm font-mono font-bold text-gray-900">#{b.id.slice(-8)}</div>
                    <div className="text-xs text-gray-400">
                      {new Date(b.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="text-sm font-medium text-gray-900">{b.customerName}</div>
                    <div className="text-xs text-gray-400">{b.customerEmail || "—"}</div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="text-sm font-medium text-gray-900 max-w-32 truncate">{b.listingTitle}</div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 inline-block ${
                      { cars: "bg-blue-100 text-blue-700", equipment: "bg-amber-100 text-amber-700", services: "bg-violet-100 text-violet-700" }[b.listingCategory] || "bg-gray-100 text-gray-600"
                    }`}>{b.listingCategory}</span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="text-sm text-gray-700">{b.startDate} → {b.endDate}</div>
                    <div className="text-xs text-gray-400">{b.totalDays} day{b.totalDays !== 1 ? "s" : ""}</div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="text-sm font-bold text-gray-900">₹{b.totalAmount.toLocaleString("en-IN")}</div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_COLOR[b.status] || "bg-gray-100 text-gray-600"}`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${PAY_COLOR[b.paymentStatus] || "bg-gray-100 text-gray-600"}`}>
                      {b.paymentStatus}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {!["cancelled", "completed"].includes(b.status) && (
                      <button
                        onClick={() => { if (confirm("Cancel this booking?")) cancelMutation.mutate(b.id); }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-medium transition-colors"
                      >
                        <XCircle size={12} /> Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!isLoading && !data?.bookings.length && (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">No bookings found</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">Page {page} of {totalPages} · {data?.total} total</p>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-40">
                <ChevronLeft size={16} />
              </button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-40">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
