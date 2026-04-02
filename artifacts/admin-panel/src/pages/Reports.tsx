import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { RefreshCw, ShieldCheck, ChevronLeft, ChevronRight, AlertCircle, Flag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Report {
  id: string; reporterId: string; reportedUserId: string;
  reportedUserName: string | null; reason: string;
  description: string | null; status: string; createdAt: string;
  reporterName: string | null; reporterRole: string | null;
}

interface Issue {
  id: string; userId: string; category: string;
  description: string; status: string; createdAt: string;
  userName: string | null; userRole: string | null;
}

const REASON_LABEL: Record<string, string> = {
  spam: "Spam", fraud: "Fraud", abuse: "Abuse",
  fake_listing: "Fake Listing", other: "Other",
};

const ISSUE_LABEL: Record<string, string> = {
  payment: "💳 Payment", booking: "📅 Booking",
  driver: "🚗 Driver", app_bug: "🐛 App Bug", other: "📝 Other",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  reviewed: "bg-blue-100 text-blue-700",
  resolved: "bg-green-100 text-green-700",
  open: "bg-amber-100 text-amber-700",
  closed: "bg-green-100 text-green-700",
};

const REASON_COLOR: Record<string, string> = {
  spam: "bg-gray-100 text-gray-700", fraud: "bg-red-100 text-red-700",
  abuse: "bg-rose-100 text-rose-700", fake_listing: "bg-orange-100 text-orange-700",
  other: "bg-gray-100 text-gray-700",
};

const ISSUE_COLOR: Record<string, string> = {
  payment: "bg-purple-100 text-purple-700", booking: "bg-blue-100 text-blue-700",
  driver: "bg-orange-100 text-orange-700", app_bug: "bg-red-100 text-red-700",
  other: "bg-gray-100 text-gray-700",
};

const ROLE_BADGE: Record<string, string> = {
  customer: "bg-sky-100 text-sky-700",
  provider: "bg-emerald-100 text-emerald-700",
};

function roleLabel(role: string | null) {
  if (!role) return "User";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export default function Reports() {
  const [tab, setTab] = useState<"reports" | "issues">("reports");
  const [page, setPage]               = useState(1);
  const [statusFilter, setStatusFilter] = useState("pending");
  const qc = useQueryClient();
  const { toast } = useToast();

  // ── Safety Reports ──────────────────────────────────────────────────────────
  const { data: reportData, isLoading: rLoading } = useQuery<{ reports: Report[]; total: number }>({
    queryKey: ["admin-reports", page, statusFilter, tab],
    queryFn: () => {
      if (tab !== "reports") return Promise.resolve({ reports: [], total: 0 });
      const p = new URLSearchParams({ page: String(page), limit: "20" });
      if (statusFilter) p.set("status", statusFilter);
      return api.get(`/admin/reports?${p}`);
    },
  });

  const reportMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/admin/reports/${id}`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-reports"] }); toast({ title: "Report updated" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // ── App Issues ──────────────────────────────────────────────────────────────
  const [issueStatus, setIssueStatus] = useState("open");
  const [issuePage, setIssuePage]     = useState(1);

  const { data: issueData, isLoading: iLoading } = useQuery<{ issues: Issue[]; total: number }>({
    queryKey: ["admin-issues", issuePage, issueStatus, tab],
    queryFn: () => {
      if (tab !== "issues") return Promise.resolve({ issues: [], total: 0 });
      const p = new URLSearchParams({ page: String(issuePage), limit: "20" });
      if (issueStatus) p.set("status", issueStatus);
      return api.get(`/admin/issues?${p}`);
    },
  });

  const issueMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/admin/issues/${id}`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-issues"] }); toast({ title: "Issue updated" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const totalReportPages = Math.ceil((reportData?.total || 0) / 20);
  const totalIssuePages  = Math.ceil((issueData?.total  || 0) / 20);
  const isLoading        = tab === "reports" ? rLoading : iLoading;

  return (
    <div className="space-y-5 animate-fadeIn">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports & Issues</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          {tab === "reports" ? `${reportData?.total || 0} safety reports` : `${issueData?.total || 0} app issues`}
        </p>
      </div>

      {/* Main tab switch */}
      <div className="flex gap-2 border-b border-gray-200 pb-0">
        <button
          onClick={() => { setTab("reports"); setPage(1); setStatusFilter("pending"); }}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${tab === "reports" ? "border-orange-500 text-orange-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          <Flag size={15} /> Safety Reports
        </button>
        <button
          onClick={() => { setTab("issues"); setIssuePage(1); setIssueStatus("open"); }}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${tab === "issues" ? "border-orange-500 text-orange-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
        >
          <AlertCircle size={15} /> App Issues
        </button>
      </div>

      {/* Status filters */}
      {tab === "reports" && (
        <div className="flex gap-2 flex-wrap">
          {["pending", "reviewed", "resolved", ""].map(s => (
            <button key={s || "all"}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${statusFilter === s ? "bg-orange-500 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
            >
              {s ? s.charAt(0).toUpperCase() + s.slice(1) : "All"}
            </button>
          ))}
        </div>
      )}

      {tab === "issues" && (
        <div className="flex gap-2 flex-wrap">
          {["open", "closed", ""].map(s => (
            <button key={s || "all"}
              onClick={() => { setIssueStatus(s); setIssuePage(1); }}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${issueStatus === s ? "bg-orange-500 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
            >
              {s ? s.charAt(0).toUpperCase() + s.slice(1) : "All"}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-12"><RefreshCw size={24} className="animate-spin text-orange-500" /></div>
      ) : tab === "reports" ? (
        !(reportData?.reports || []).length ? (
          <EmptyState icon={<ShieldCheck size={40} className="text-green-400 mx-auto mb-3" />} text="No safety reports found" />
        ) : (
          <div className="space-y-3">
            {(reportData?.reports || []).map(r => (
              <div key={r.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Badges */}
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${REASON_COLOR[r.reason] || "bg-gray-100"}`}>
                        {REASON_LABEL[r.reason] || r.reason}
                      </span>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_COLOR[r.status] || "bg-gray-100"}`}>
                        {r.status}
                      </span>
                    </div>

                    {/* Reported user */}
                    <p className="text-sm font-semibold text-gray-900">
                      Reported: {r.reportedUserName || `User #${r.reportedUserId.slice(-8)}`}
                    </p>

                    {/* Description */}
                    {r.description && (
                      <p className="text-sm text-gray-500 mt-1 italic">"{r.description}"</p>
                    )}

                    {/* Reporter info */}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-xs text-gray-400">Reported by:</span>
                      <span className="text-xs font-semibold text-gray-700">
                        {r.reporterName || `User #${r.reporterId.slice(-8)}`}
                      </span>
                      {r.reporterRole && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${ROLE_BADGE[r.reporterRole] || "bg-gray-100 text-gray-600"}`}>
                          {roleLabel(r.reporterRole)}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs text-gray-400">
                        {new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-shrink-0 flex-col items-end">
                    {r.status === "pending" && (
                      <>
                        <button onClick={() => reportMutation.mutate({ id: r.id, status: "reviewed" })}
                          className="px-3 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-xs font-medium transition-colors">
                          Mark Reviewed
                        </button>
                        <button onClick={() => reportMutation.mutate({ id: r.id, status: "resolved" })}
                          className="px-3 py-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-xl text-xs font-medium transition-colors">
                          Resolve
                        </button>
                      </>
                    )}
                    {r.status === "reviewed" && (
                      <button onClick={() => reportMutation.mutate({ id: r.id, status: "resolved" })}
                        className="px-3 py-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-xl text-xs font-medium transition-colors">
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        !(issueData?.issues || []).length ? (
          <EmptyState icon={<AlertCircle size={40} className="text-gray-300 mx-auto mb-3" />} text="No issues found" />
        ) : (
          <div className="space-y-3">
            {(issueData?.issues || []).map(i => (
              <div key={i.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Badges */}
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${ISSUE_COLOR[i.category] || "bg-gray-100"}`}>
                        {ISSUE_LABEL[i.category] || i.category}
                      </span>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_COLOR[i.status] || "bg-gray-100"}`}>
                        {i.status}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-gray-800 leading-relaxed">"{i.description}"</p>

                    {/* Sender info */}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-xs text-gray-400">Sent by:</span>
                      <span className="text-xs font-semibold text-gray-700">
                        {i.userName || `User #${i.userId.slice(-8)}`}
                      </span>
                      {i.userRole && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${ROLE_BADGE[i.userRole] || "bg-gray-100 text-gray-600"}`}>
                          {roleLabel(i.userRole)}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs text-gray-400">
                        {new Date(i.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0">
                    {i.status === "open" && (
                      <button onClick={() => issueMutation.mutate({ id: i.id, status: "closed" })}
                        className="px-3 py-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-xl text-xs font-medium transition-colors">
                        Mark Closed
                      </button>
                    )}
                    {i.status === "closed" && (
                      <button onClick={() => issueMutation.mutate({ id: i.id, status: "open" })}
                        className="px-3 py-2 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-xl text-xs font-medium transition-colors">
                        Reopen
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Pagination — Reports */}
      {tab === "reports" && totalReportPages > 1 && (
        <Pagination page={page} total={totalReportPages} onPrev={() => setPage(p => p - 1)} onNext={() => setPage(p => p + 1)} />
      )}

      {/* Pagination — Issues */}
      {tab === "issues" && totalIssuePages > 1 && (
        <Pagination page={issuePage} total={totalIssuePages} onPrev={() => setIssuePage(p => p - 1)} onNext={() => setIssuePage(p => p + 1)} />
      )}
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
      {icon}
      <p className="text-gray-500">{text}</p>
    </div>
  );
}

function Pagination({ page, total, onPrev, onNext }: { page: number; total: number; onPrev: () => void; onNext: () => void }) {
  return (
    <div className="flex items-center justify-between bg-white rounded-2xl px-5 py-4 border border-gray-100">
      <p className="text-sm text-gray-500">Page {page} of {total}</p>
      <div className="flex gap-2">
        <button disabled={page <= 1} onClick={onPrev}
          className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-40">
          <ChevronLeft size={16} />
        </button>
        <button disabled={page >= total} onClick={onNext}
          className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-40">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
