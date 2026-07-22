import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, getApiBase } from "@/lib/api";
import {
  RefreshCw, CheckCircle, XCircle, ShieldCheck, User,
  Clock, Eye, ZoomIn, X, Download, FileText, ChevronRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VerifRow {
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  gov_id_status: string;
  gov_id_doc_id: string | null;
  gov_id_url: string | null;
  selfie_status: string;
  selfie_doc_id: string | null;
  selfie_url: string | null;
  address_status: string;
  address_doc_id: string | null;
  address_url: string | null;
  admin_note: string | null;
  updated_at: string;
}

const DOC_TYPES: { key: "gov_id" | "selfie" | "address"; label: string; icon: string; points: number }[] = [
  { key: "gov_id",  label: "Government ID",  icon: "🪪", points: 30 },
  { key: "selfie",  label: "Selfie",          icon: "🤳", points: 20 },
  { key: "address", label: "Address Proof",   icon: "📄", points: 15 },
];

const STATUS_CHIP: Record<string, string> = {
  approved: "bg-green-100 text-green-700",
  rejected:  "bg-red-100 text-red-700",
  pending:   "bg-amber-100 text-amber-700",
  none:      "bg-gray-100 text-gray-500",
};

function resolveFileUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const base = getApiBase().replace(/\/api$/, "");
  return `${base}${url}`;
}

function isImage(url: string | null): boolean {
  return !!url?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
}

function isPdf(url: string | null): boolean {
  return !!url?.match(/\.pdf$/i);
}

function ImageLightbox({ url, label, onClose }: { url: string; label: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full max-h-[90vh] flex flex-col items-center"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between w-full mb-3">
          <span className="text-white font-semibold text-sm bg-white/10 px-3 py-1.5 rounded-full">{label}</span>
          <div className="flex items-center gap-2">
            <a
              href={url}
              download
              className="flex items-center gap-1.5 text-white text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition-colors"
              onClick={e => e.stopPropagation()}
            >
              <Download size={13} /> Download
            </a>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-white text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition-colors"
              onClick={e => e.stopPropagation()}
            >
              <ZoomIn size={13} /> Open full
            </a>
            <button
              onClick={onClose}
              className="text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <img
          src={url}
          alt={label}
          className="max-h-[78vh] max-w-full rounded-xl object-contain shadow-2xl border border-white/10"
        />
      </div>
    </div>
  );
}

function RejectModal({ onClose, onReject }: { onClose: () => void; onReject: (r: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-1">Reject Verification</h3>
        <p className="text-sm text-gray-500 mb-4">Provide a reason so the user can resubmit the correct document.</p>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-red-400 resize-none h-24 mb-4"
          placeholder="e.g. Image is blurry, document is expired..."
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 hover:bg-gray-200 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => reason.trim() && onReject(reason)}
            disabled={!reason.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

function DocRow({
  dt, row, onApprove, onReject, onViewImage, isPending: isMutating,
}: {
  dt: typeof DOC_TYPES[0];
  row: VerifRow;
  onApprove: () => void;
  onReject: () => void;
  onViewImage: (url: string, label: string) => void;
  isPending: boolean;
}) {
  const status = (row as any)[`${dt.key}_status`] as string ?? "none";
  const rawUrl = (row as any)[`${dt.key}_url`] as string | null;
  const fileUrl = resolveFileUrl(rawUrl);

  if (status === "none") return null;

  return (
    <div className="flex items-center gap-4 px-5 py-4">
      {/* Thumbnail / Preview */}
      <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200">
        {fileUrl && isImage(fileUrl) ? (
          <img
            src={fileUrl}
            className="w-full h-full object-cover cursor-zoom-in hover:opacity-90 transition-opacity"
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
            onClick={() => onViewImage(fileUrl, `${dt.label} — ${row.user_name || "User"}`)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl">{dt.icon}</div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm text-gray-900">{dt.label}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${STATUS_CHIP[status] || STATUS_CHIP.none}`}>
            {status}
          </span>
          <span className="text-xs text-orange-500 font-medium">+{dt.points} pts</span>
        </div>

        {row.admin_note && status === "rejected" && (
          <div className="mt-1 text-xs text-red-600 bg-red-50 rounded-lg px-2 py-1">
            Reason: {row.admin_note}
          </div>
        )}

        {/* View buttons */}
        <div className="flex items-center gap-2 mt-1.5">
          {fileUrl && isImage(fileUrl) && (
            <button
              onClick={() => onViewImage(fileUrl, `${dt.label} — ${row.user_name || "User"}`)}
              className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-medium"
            >
              <Eye size={11} /> View image
            </button>
          )}
          {fileUrl && isPdf(fileUrl) && (
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-medium"
            >
              <FileText size={11} /> View PDF
            </a>
          )}
          {fileUrl && !isImage(fileUrl) && !isPdf(fileUrl) && (
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-medium"
            >
              <ChevronRight size={11} /> View file
            </a>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-shrink-0">
        {status === "pending" && (
          <>
            <button
              onClick={onApprove}
              disabled={isMutating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-medium transition-colors disabled:opacity-50"
            >
              <CheckCircle size={12} /> Approve
            </button>
            <button
              onClick={onReject}
              disabled={isMutating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-medium transition-colors disabled:opacity-50"
            >
              <XCircle size={12} /> Reject
            </button>
          </>
        )}
        {status === "approved" && (
          <button
            onClick={onReject}
            disabled={isMutating}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-xl text-xs font-medium transition-colors disabled:opacity-50"
          >
            <XCircle size={12} /> Revoke
          </button>
        )}
      </div>
    </div>
  );
}

export default function Verification() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [tab, setTab] = useState<"pending" | "approved">("pending");
  const [rejectTarget, setRejectTarget] = useState<{ userId: string; type: string } | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null);

  const { data: pendingData, isLoading: pendingLoading, refetch: refetchPending } = useQuery<VerifRow[]>({
    queryKey: ["admin-verification", "pending"],
    queryFn: () => api.get("/verification/admin/all?filter=pending"),
    refetchInterval: 60_000,
  });

  const { data: approvedData, isLoading: approvedLoading, refetch: refetchApproved } = useQuery<VerifRow[]>({
    queryKey: ["admin-verification", "approved"],
    queryFn: () => api.get("/verification/admin/all?filter=approved"),
    refetchInterval: 120_000,
  });

  const approveMutation = useMutation({
    mutationFn: ({ userId, type }: { userId: string; type: string }) =>
      api.patch(`/verification/admin/${userId}/${type}/approve`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-verification"] });
      toast({ title: "Verification approved ✅" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ userId, type, reason }: { userId: string; type: string; reason: string }) =>
      api.patch(`/verification/admin/${userId}/${type}/reject`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-verification"] });
      toast({ title: "Verification rejected" });
      setRejectTarget(null);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const isMutating = approveMutation.isPending || rejectMutation.isPending;
  const pendingRows = Array.isArray(pendingData) ? pendingData : [];
  const approvedRows = Array.isArray(approvedData) ? approvedData : [];
  const rows = tab === "pending" ? pendingRows : approvedRows;
  const isLoading = tab === "pending" ? pendingLoading : approvedLoading;

  const pendingCount = DOC_TYPES.reduce((acc, dt) =>
    acc + pendingRows.filter(r => (r as any)[`${dt.key}_status`] === "pending").length, 0);

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Lightbox */}
      {lightbox && (
        <ImageLightbox url={lightbox.url} label={lightbox.label} onClose={() => setLightbox(null)} />
      )}

      {/* Reject modal */}
      {rejectTarget && (
        <RejectModal
          onClose={() => setRejectTarget(null)}
          onReject={reason => rejectMutation.mutate({ ...rejectTarget, reason })}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="text-orange-500" size={24} /> Verification Management
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">Review, approve and audit user Trust &amp; Verification documents</p>
        </div>
        <button
          onClick={() => tab === "pending" ? refetchPending() : refetchApproved()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-50 text-orange-600 hover:bg-orange-100 text-sm font-medium transition-colors"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {DOC_TYPES.map(dt => {
          const p = pendingRows.filter(r => (r as any)[`${dt.key}_status`] === "pending").length;
          const a = approvedRows.filter(r => (r as any)[`${dt.key}_status`] === "approved").length;
          return (
            <div key={dt.key} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="text-2xl mb-1">{dt.icon}</div>
              <div className="flex items-end gap-3">
                <div>
                  <div className="text-xl font-bold text-amber-600">{p}</div>
                  <div className="text-xs text-gray-500">pending</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-green-600">{a}</div>
                  <div className="text-xs text-gray-500">verified</div>
                </div>
              </div>
              <div className="text-xs font-semibold text-gray-700 mt-1.5">{dt.label}</div>
              <div className="text-xs text-orange-500 font-medium">+{dt.points} trust pts</div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab("pending")}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
            tab === "pending"
              ? "bg-white text-amber-700 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Clock size={15} />
          Pending Review
          {pendingCount > 0 && (
            <span className="bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("approved")}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
            tab === "approved"
              ? "bg-white text-green-700 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <CheckCircle size={15} />
          Verified Documents
          {approvedRows.length > 0 && (
            <span className="bg-green-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
              {approvedRows.length}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={28} className="animate-spin text-orange-500" />
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl p-16 text-center border border-gray-100">
          {tab === "pending" ? (
            <>
              <CheckCircle size={48} className="text-green-300 mx-auto mb-4" />
              <p className="text-lg font-semibold text-gray-700">All caught up!</p>
              <p className="text-gray-400 text-sm mt-1">No pending verification requests right now</p>
            </>
          ) : (
            <>
              <ShieldCheck size={48} className="text-gray-300 mx-auto mb-4" />
              <p className="text-lg font-semibold text-gray-700">No verified documents yet</p>
              <p className="text-gray-400 text-sm mt-1">Approved documents will appear here for future review</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {tab === "approved" && (
            <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-2.5 flex items-center gap-2">
              <ShieldCheck size={15} className="text-green-600" />
              <p className="text-sm text-green-700 font-medium">
                Showing {approvedRows.length} users with at least one verified document. Click any image to view full size. You can revoke approval if needed.
              </p>
            </div>
          )}
          {rows.map(row => {
            const hasAny = DOC_TYPES.some(dt => {
              const status = (row as any)[`${dt.key}_status`];
              return tab === "pending" ? status === "pending" : status === "approved";
            });
            if (!hasAny) return null;
            return (
              <div key={row.user_id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {/* User header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50 bg-gray-50/50">
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <User size={18} className="text-orange-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{row.user_name || "Unknown User"}</p>
                    <p className="text-xs text-gray-500 truncate">{row.user_email || "—"}</p>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {row.updated_at ? new Date(row.updated_at).toLocaleDateString("en-IN") : "—"}
                  </span>
                </div>

                {/* Documents */}
                <div className="divide-y divide-gray-50">
                  {DOC_TYPES.map(dt => {
                    const status = (row as any)[`${dt.key}_status`];
                    if (tab === "pending" && status !== "pending") return null;
                    if (tab === "approved" && status !== "approved") return null;
                    return (
                      <DocRow
                        key={dt.key}
                        dt={dt}
                        row={row}
                        onApprove={() => approveMutation.mutate({ userId: row.user_id, type: dt.key })}
                        onReject={() => setRejectTarget({ userId: row.user_id, type: dt.key })}
                        onViewImage={(url, label) => setLightbox({ url, label })}
                        isPending={isMutating}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
