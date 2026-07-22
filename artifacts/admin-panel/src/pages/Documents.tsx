import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, getApiBase } from "@/lib/api";
import { RefreshCw, CheckCircle, XCircle, Eye, Download, X, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Document {
  id: string; user_id: string; user_name: string; user_email: string;
  document_type: string; service_type: string; file_path: string;
  file_url: string; file_name: string; mime_type: string; status: string;
  rejection_reason: string | null; admin_note: string | null; created_at: string;
}

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

function getFullFileUrl(doc: Document): string {
  const raw = doc.file_url || (doc.file_path ? `/uploads/${doc.file_path.split("/").pop()}` : "");
  if (!raw) return "";
  if (raw.startsWith("http")) return raw;
  // file_url is like /uploads/uuid.ext — extract filename and use proxy-safe /api/documents/file/:filename
  const filename = raw.split("/").pop();
  if (!filename) return "";
  return `${getApiBase()}/documents/file/${filename}`;
}

function isImage(doc: Document): boolean {
  if (doc.mime_type) return doc.mime_type.startsWith("image/");
  const url = doc.file_url || doc.file_path || "";
  return /\.(jpg|jpeg|png)$/i.test(url);
}

function isPdf(doc: Document): boolean {
  if (doc.mime_type) return doc.mime_type === "application/pdf";
  const url = doc.file_url || doc.file_path || "";
  return /\.pdf$/i.test(url);
}

function FileViewerModal({ doc, onClose }: { doc: Document; onClose: () => void }) {
  const fileUrl = getFullFileUrl(doc);
  const fileName = doc.file_name || doc.file_url?.split("/").pop() || "document";

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleDownload = async () => {
    try {
      const res = await fetch(fileUrl);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = window.document.createElement("a");
      a.href = objectUrl;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(fileUrl, "_blank");
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-3xl max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="min-w-0">
            <h3 className="font-bold text-gray-900 truncate">{doc.document_type}</h3>
            <p className="text-xs text-gray-400 truncate mt-0.5">{fileName}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-medium transition-colors"
            >
              <Download size={14} /> Download
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* File Content */}
        <div className="flex-1 overflow-auto bg-gray-50 flex items-center justify-center min-h-[300px]">
          {!fileUrl ? (
            <div className="flex flex-col items-center gap-3 py-16 text-gray-400">
              <FileText size={48} />
              <p className="text-sm">File URL not available</p>
            </div>
          ) : isImage(doc) ? (
            <img
              src={fileUrl}
              alt={doc.document_type}
              className="max-w-full max-h-[65vh] object-contain rounded-lg shadow"
              onError={e => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : isPdf(doc) ? (
            <iframe
              src={`${fileUrl}#toolbar=1&navpanes=0`}
              title={doc.document_type}
              className="w-full h-[65vh] border-0"
            />
          ) : (
            <div className="flex flex-col items-center gap-4 py-16 text-gray-500">
              <FileText size={56} className="text-orange-300" />
              <p className="text-sm font-medium">{fileName}</p>
              <p className="text-xs text-gray-400">Preview not available for this file type</p>
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-medium transition-colors"
              >
                <Download size={14} /> Download File
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<Document[]>({
    queryKey: ["admin-documents", statusFilter],
    queryFn: () => {
      const p = new URLSearchParams();
      if (statusFilter) p.set("status", statusFilter);
      return api.get(`/documents/admin/all?${p}`);
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      api.patch(`/documents/admin/${id}/approve`, { note: note ?? null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-documents"] });
      toast({ title: "Document approved ✅" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.patch(`/documents/admin/${id}/reject`, { note: reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-documents"] });
      toast({ title: "Document rejected" });
      setRejectDocId(null);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const docs = Array.isArray(data) ? data : [];

  return (
    <div className="space-y-5 animate-fadeIn">
      {viewingDoc && (
        <FileViewerModal doc={viewingDoc} onClose={() => setViewingDoc(null)} />
      )}
      {rejectDocId && (
        <RejectModal
          docId={rejectDocId}
          onClose={() => setRejectDocId(null)}
          onReject={(reason) => rejectMutation.mutate({ id: rejectDocId, reason })}
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
      ) : docs.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <CheckCircle size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No documents found for this filter</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {docs.map((doc: any) => (
            <div key={doc.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-4">
              {/* Preview thumbnail — clickable to open modal */}
              <button
                onClick={() => setViewingDoc(doc)}
                className="sm:w-24 sm:h-24 w-full h-32 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 relative group cursor-pointer border-2 border-transparent hover:border-orange-400 transition-all"
                title="Click to view file"
              >
                {isImage(doc) ? (
                  <img
                    src={getFullFileUrl(doc)}
                    className="w-full h-full object-cover"
                    alt={doc.document_type}
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl">📄</div>
                )}
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Eye size={20} className="text-white" />
                </div>
              </button>

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

                <div className="flex items-center gap-2 text-xs text-gray-400 mb-3 flex-wrap">
                  <span className="bg-gray-100 px-2 py-0.5 rounded-full">{doc.service_type}</span>
                  <span>·</span>
                  <span>{doc.created_at ? new Date(doc.created_at).toLocaleDateString("en-IN") : "—"}</span>
                  {(doc.file_url || doc.file_path) && (
                    <>
                      <span>·</span>
                      <button
                        onClick={() => setViewingDoc(doc)}
                        className="text-orange-500 hover:text-orange-600 flex items-center gap-0.5 font-medium hover:underline"
                      >
                        <Eye size={11} /> View File
                      </button>
                    </>
                  )}
                </div>

                {(doc.admin_note || doc.rejection_reason) && doc.status === "rejected" && (
                  <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2 text-xs text-red-700 mb-3">
                    Rejection reason: {doc.admin_note || doc.rejection_reason}
                  </div>
                )}

                {doc.status === "pending" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => approveMutation.mutate({ id: doc.id })}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      className="flex items-center gap-1.5 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      <CheckCircle size={14} /> Approve
                    </button>
                    <button
                      onClick={() => setRejectDocId(doc.id)}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
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
