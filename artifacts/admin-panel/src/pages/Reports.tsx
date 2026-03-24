import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { RefreshCw, ShieldCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Report {
  id: string; reporterId: string; reportedUserId: string;
  reportedUserName: string | null; reason: string;
  description: string | null; status: string; createdAt: string;
}

const REASON_LABEL: Record<string, string> = {
  spam: "Spam",
  fraud: "Fraud",
  abuse: "Abuse",
  fake_listing: "Fake Listing",
  other: "Other",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  reviewed: "bg-blue-100 text-blue-700",
  resolved: "bg-green-100 text-green-700",
};

const REASON_COLOR: Record<string, string> = {
  spam: "bg-gray-100 text-gray-700",
  fraud: "bg-red-100 text-red-700",
  abuse: "bg-rose-100 text-rose-700",
  fake_listing: "bg-orange-100 text-orange-700",
  other: "bg-gray-100 text-gray-700",
};

export default function Reports() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("pending");
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ reports: Report[]; total: number }>({
    queryKey: ["admin-reports", page, statusFilter],
    queryFn: () => {
      const p = new URLSearchParams({ page: String(page), limit: "20" });
      if (statusFilter) p.set("status", statusFilter);
      return api.get(`/admin/reports?${p}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/admin/reports/${id}`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-reports"] }); toast({ title: "Report updated" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const totalPages = Math.ceil((data?.total || 0) / 20);

  return (
    <div className="space-y-5 animate-fadeIn">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Safety Reports</h1>
        <p className="text-gray-500 text-sm mt-0.5">{data?.total || 0} reports</p>
      </div>

      <div className="flex gap-2">
        {["pending", "reviewed", "resolved", ""].map(s => (
          <button key={s || "all"}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${statusFilter === s ? "bg-orange-500 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
          >
            {s ? s.charAt(0).toUpperCase() + s.slice(1) : "All"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><RefreshCw size={24} className="animate-spin text-orange-500" /></div>
      ) : !data?.reports.length ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <ShieldCheck size={40} className="text-green-400 mx-auto mb-3" />
          <p className="text-gray-500">No reports found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.reports.map(r => (
            <div key={r.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${REASON_COLOR[r.reason] || "bg-gray-100"}`}>
                      {REASON_LABEL[r.reason] || r.reason}
                    </span>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_COLOR[r.status] || "bg-gray-100"}`}>
                      {r.status}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 mt-2">
                    Reported user: {r.reportedUserName || `#${r.reportedUserId.slice(-8)}`}
                  </p>
                  {r.description && (
                    <p className="text-sm text-gray-500 mt-1">"{r.description}"</p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    Reporter: #{r.reporterId.slice(-8)} ·{" "}
                    {new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>

                {r.status === "pending" && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => updateMutation.mutate({ id: r.id, status: "reviewed" })}
                      className="px-3 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-xs font-medium transition-colors"
                    >
                      Mark Reviewed
                    </button>
                    <button
                      onClick={() => updateMutation.mutate({ id: r.id, status: "resolved" })}
                      className="px-3 py-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-xl text-xs font-medium transition-colors"
                    >
                      Resolve
                    </button>
                  </div>
                )}
                {r.status === "reviewed" && (
                  <button
                    onClick={() => updateMutation.mutate({ id: r.id, status: "resolved" })}
                    className="px-3 py-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-xl text-xs font-medium flex-shrink-0 transition-colors"
                  >
                    Resolve
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-2xl px-5 py-4 border border-gray-100">
          <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
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
  );
}
