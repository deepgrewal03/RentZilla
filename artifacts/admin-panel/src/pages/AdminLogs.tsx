import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Activity, RefreshCw, ChevronLeft, ChevronRight, Shield } from "lucide-react";

interface AdminLog {
  id: string; admin_id: string; admin_email: string; action: string;
  target_type: string | null; target_id: string | null;
  details: any; created_at: string;
}

const ACTION_COLORS: Record<string, string> = {
  ADMIN_LOGIN: "bg-blue-100 text-blue-700",
  SUSPEND_USER: "bg-red-100 text-red-700",
  UNSUSPEND_USER: "bg-green-100 text-green-700",
  DELETE_LISTING: "bg-rose-100 text-rose-700",
  TOGGLE_LISTING: "bg-amber-100 text-amber-700",
  APPROVE_DOCUMENT: "bg-green-100 text-green-700",
  REJECT_DOCUMENT: "bg-red-100 text-red-700",
  UPDATE_BOOKING_STATUS: "bg-blue-100 text-blue-700",
  UPDATE_REPORT: "bg-teal-100 text-teal-700",
  SEND_NOTIFICATION: "bg-orange-100 text-orange-700",
  SCHEDULE_NOTIFICATION: "bg-purple-100 text-purple-700",
};

const ACTION_ICONS: Record<string, string> = {
  ADMIN_LOGIN: "🔐",
  SUSPEND_USER: "🚫",
  UNSUSPEND_USER: "✅",
  DELETE_LISTING: "🗑️",
  TOGGLE_LISTING: "↕️",
  APPROVE_DOCUMENT: "✅",
  REJECT_DOCUMENT: "❌",
  UPDATE_BOOKING_STATUS: "📅",
  UPDATE_REPORT: "🛡️",
  SEND_NOTIFICATION: "📢",
  SCHEDULE_NOTIFICATION: "🕐",
};

function formatAction(action: string): string {
  return action.replace(/_/g, " ").toLowerCase().replace(/^./, c => c.toUpperCase());
}

export default function AdminLogs() {
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useQuery<{ logs: AdminLog[]; total: number }>({
    queryKey: ["admin-logs", page],
    queryFn: () => api.get(`/admin/logs?page=${page}&limit=50`),
    refetchInterval: 30_000,
  });

  const totalPages = Math.ceil((data?.total || 0) / 50);

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Activity Log</h1>
          <p className="text-gray-500 text-sm mt-0.5">Track all super admin actions · {data?.total || 0} total entries</p>
        </div>
        <button onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        {["admin@rentzilla.com", "admin1@rentzilla.com", "admin2@rentzilla.com"].map((email, i) => (
          <div key={email} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold">{i + 1}</div>
              <span className="text-xs text-gray-500 truncate">{email}</span>
            </div>
            <p className="text-xs text-gray-400">Super Admin</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center"><RefreshCw size={24} className="animate-spin text-orange-500 mx-auto" /></div>
        ) : !data?.logs?.length ? (
          <div className="py-16 text-center">
            <Activity size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No activity logged yet</p>
            <p className="text-gray-400 text-sm mt-1">Actions taken by super admins will appear here</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {data.logs.map((log: any) => (
              <div key={log.id} className="flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                {/* Action icon */}
                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 text-base">
                  {ACTION_ICONS[log.action] || "📋"}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${ACTION_COLORS[log.action] || "bg-gray-100 text-gray-600"}`}>
                      {formatAction(log.action)}
                    </span>
                    {log.target_type && (
                      <span className="text-xs text-gray-400">
                        {log.target_type} {log.target_id ? `#${String(log.target_id).slice(-8)}` : ""}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400">
                    <Shield size={11} className="text-orange-400" />
                    <span className="font-medium text-gray-600">{log.admin_email}</span>
                    <span>·</span>
                    <span>
                      {new Date(log.created_at).toLocaleDateString("en-IN", {
                        day: "numeric", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit", second: "2-digit",
                      })}
                    </span>
                  </div>

                  {log.details && Object.keys(log.details).length > 0 && (
                    <div className="mt-1.5 bg-gray-50 rounded-lg px-2.5 py-1.5 text-xs text-gray-500 font-mono">
                      {Object.entries(log.details).map(([k, v]) => (
                        <span key={k} className="mr-3">{k}: <span className="text-gray-700">{String(v)}</span></span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">Page {page} of {totalPages} · {data?.total} entries</p>
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
