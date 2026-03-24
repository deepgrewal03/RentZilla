import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { RefreshCw, CheckCircle, XCircle, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Document {
  id: string; user_id: string; user_name: string; user_email: string;
  document_type: string; service_type: string; file_path: string;
  file_url: string; status: string; rejection_reason: string | null;
  created_at: string;
}

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

function RejectModal({ docId, onClose, onReject }: { docId: string; onClose: () => void; onReject: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 animate-fadeIn">
        <h3 className="text-lg font-bold text-gray-900 mb-1">Reject Document</h3>
        <p className="text-sm text-gray-500 mb-4">Provide a reason so the provider can fix and re-upload.</p>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-red-400 resize-none h-24 mb-4"
          placeholder="e.g. Document is expired, image is blurry..."
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 hover:bg-gray-200 transition-colors">Cancel</button>
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

export default function Documents() {
  const [statusFilter, setStatusFilter] = useState("pending");
  const [rejectDocId, setRejectDocId] = useState<string | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ documents: Document[]; total: number }>({
    queryKey: ["admin-documents", statusFilter],
    queryFn: () => {
      const p = new URLSearchParams();
      if (statusFilter) p.set("status", statusFilter);
      return api.get(`/admin/documents?${p}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status, rejectionReason }: { id: string; status: string; rejectionReason?: string }) =>
      api.patch(`/admin/documents/${id}`, { status, rejectionReason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-documents"] });
      toast({ title: "Document updated" });
      setRejectDocId(null);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-5 animate-fadeIn">
      {rejectDocId && (
        <RejectModal
          docId={rejectDocId}
          onClose={() => setRejectDocId(null)}
          onReject={(reason) => updateMutation.mutate({ id: rejectDocId, status: "rejected", rejectionReason: reason })}
        />
      )}

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Document Verification</h1>
        <p className="text-gray-500 text-sm mt-0.5">Review and verify provider documents</p>
      </div>

      <div className="flex gap-2">
        {["pending", "approved", "rejected", ""].map(s => (
          <button key={s || "all"}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${statusFilter === s ? "bg-orange-500 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
          >
            {s ? s.charAt(0).toUpperCase() + s.slice(1) : "All"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw size={24} className="animate-spin text-orange-500" />
        </div>
      ) : (data?.documents || []).length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <CheckCircle size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No documents found for this filter</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {(data?.documents || []).map((doc: any) => (
            <div key={doc.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-4">
              {/* Preview */}
              <div className="sm:w-24 sm:h-24 w-full h-32 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                {(doc.file_url || doc.file_path)?.match(/\.(jpg|jpeg|png)$/i) ? (
                  <img
                    src={doc.file_url || `/api/uploads/${doc.file_path?.split("/").pop()}`}
                    className="w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23f3f4f6'/%3E%3Ctext x='50%25' y='50%25' font-size='30' text-anchor='middle' dy='.3em'%3E📄%3C/text%3E%3C/svg%3E"; }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl">📄</div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{doc.document_type}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {doc.user_name || "Unknown"} · {doc.user_email || "—"}
                    </p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0 ${STATUS_COLOR[doc.status] || "bg-gray-100 text-gray-600"}`}>
                    {doc.status}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                  <span className="bg-gray-100 px-2 py-0.5 rounded-full">{doc.service_type}</span>
                  <span>·</span>
                  <span>{doc.created_at ? new Date(doc.created_at).toLocaleDateString("en-IN") : "—"}</span>
                  {(doc.file_url || doc.file_path) && (
                    <>
                      <span>·</span>
                      <a href={doc.file_url || `/api/uploads/${doc.file_path?.split("/").pop()}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-orange-500 hover:underline flex items-center gap-0.5"
                      >
                        View file <ExternalLink size={10} />
                      </a>
                    </>
                  )}
                </div>

                {doc.rejection_reason && (
                  <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2 text-xs text-red-700 mb-3">
                    Rejection reason: {doc.rejection_reason}
                  </div>
                )}

                {doc.status === "pending" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateMutation.mutate({ id: doc.id, status: "approved" })}
                      disabled={updateMutation.isPending}
                      className="flex items-center gap-1.5 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-medium transition-colors"
                    >
                      <CheckCircle size={14} /> Approve
                    </button>
                    <button
                      onClick={() => setRejectDocId(doc.id)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-sm font-medium transition-colors"
                    >
                      <XCircle size={14} /> Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
