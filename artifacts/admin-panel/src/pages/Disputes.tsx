import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  Shield, AlertTriangle, CheckCircle2, Clock, MessageSquare,
  ChevronDown, RefreshCw, X, Send, DollarSign, User
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Dispute {
  id: string;
  dispute_status: "open" | "under_review" | "resolved";
  dispute_reason: string;
  dispute_opened_at: string;
  dispute_resolution?: string;
  dispute_resolved_at?: string;
  refund_amount: number;
  total_amount: number;
  final_amount: number;
  booking_status: string;
  listing_title: string;
  listing_images: string[];
  customer_name: string;
  customer_photo?: string;
  customer_id: string;
  provider_name: string;
  provider_photo?: string;
  provider_id: string;
  message_count: number;
}

interface DisputeMessage {
  id: string;
  sender_role: string;
  sender_name: string;
  content: string;
  created_at: string;
}

const STATUS_META = {
  open:         { label: "Open",         icon: AlertTriangle, color: "text-red-600",    bg: "bg-red-50",     border: "border-red-200"    },
  under_review: { label: "Under Review", icon: Clock,         color: "text-amber-600",  bg: "bg-amber-50",   border: "border-amber-200"  },
  resolved:     { label: "Resolved",     icon: CheckCircle2,  color: "text-emerald-600",bg: "bg-emerald-50", border: "border-emerald-200"},
};

function Avatar({ src, name, size = 8 }: { src?: string; name?: string; size?: number }) {
  const s = `w-${size} h-${size}`;
  if (src) return <img src={src} className={`${s} rounded-full object-cover`} />;
  return (
    <div className={`${s} rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm`}>
      {name?.[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

function RolePill({ role }: { role: string }) {
  const map: Record<string, string> = {
    customer: "bg-blue-100 text-blue-700",
    provider: "bg-purple-100 text-purple-700",
    admin:    "bg-amber-100 text-amber-700",
  };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${map[role] ?? map.customer}`}>
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  );
}

function DisputeDetail({ dispute, onClose }: { dispute: Dispute; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [message, setMessage] = useState("");
  const [resolution, setResolution] = useState<"refund_customer"|"refund_provider"|"dismiss">("refund_customer");
  const [refundAmount, setRefundAmount] = useState(String(dispute.final_amount ?? dispute.total_amount ?? 0));
  const [resolving, setResolving] = useState(false);
  const [adminNote, setAdminNote] = useState("");
  const [showResolveForm, setShowResolveForm] = useState(false);

  const { data } = useQuery<{ messages: DisputeMessage[] }>({
    queryKey: ["dispute-thread", dispute.id],
    queryFn: () => api.get(`/disputes/${dispute.id}`),
    refetchInterval: 10_000,
  });

  const messages = data?.messages ?? [];
  const canMessage = dispute.dispute_status === "open" || dispute.dispute_status === "under_review";

  const sendMsg = useMutation({
    mutationFn: () => api.post(`/disputes/${dispute.id}/message`, { content: message }),
    onSuccess: () => {
      setMessage("");
      qc.invalidateQueries({ queryKey: ["dispute-thread", dispute.id] });
      toast({ title: "Message sent" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  async function resolve() {
    const amt = parseFloat(refundAmount) || 0;
    if (resolution !== "dismiss" && amt <= 0) {
      toast({ title: "Enter refund amount", variant: "destructive" }); return;
    }
    setResolving(true);
    try {
      await api.patch(`/disputes/${dispute.id}/resolve`, {
        resolution, refundAmount: amt,
        refundTo: resolution === "refund_provider" ? "provider" : "customer",
        adminNote: adminNote.trim() || undefined,
      });
      toast({ title: "Dispute resolved ✅" });
      qc.invalidateQueries({ queryKey: ["admin-disputes"] });
      qc.invalidateQueries({ queryKey: ["dispute-thread", dispute.id] });
      onClose();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setResolving(false);
    }
  }

  const meta = STATUS_META[dispute.dispute_status] ?? STATUS_META.open;
  const StatusIcon = meta.icon;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-end">
      <div className="bg-white w-full max-w-xl h-full flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-400 px-5 py-4 flex items-center gap-3">
          <Shield size={18} className="text-white" />
          <div className="flex-1">
            <div className="text-white font-bold text-base">Dispute Thread</div>
            <div className="text-white/80 text-xs truncate">{dispute.listing_title} · #{dispute.id.slice(-8).toUpperCase()}</div>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${meta.bg} ${meta.color} flex items-center gap-1`}>
            <StatusIcon size={11} />
            {meta.label}
          </span>
          <button onClick={onClose} className="text-white/80 hover:text-white ml-1">
            <X size={18} />
          </button>
        </div>

        {/* Parties */}
        <div className="grid grid-cols-2 gap-px bg-gray-100 border-b border-gray-100">
          <div className="bg-white px-4 py-3 flex items-center gap-2">
            <Avatar src={dispute.customer_photo} name={dispute.customer_name} />
            <div>
              <div className="text-[10px] text-gray-400 font-medium">Customer</div>
              <div className="text-xs font-semibold text-gray-800">{dispute.customer_name}</div>
            </div>
          </div>
          <div className="bg-white px-4 py-3 flex items-center gap-2">
            <Avatar src={dispute.provider_photo} name={dispute.provider_name} />
            <div>
              <div className="text-[10px] text-gray-400 font-medium">Provider</div>
              <div className="text-xs font-semibold text-gray-800">{dispute.provider_name}</div>
            </div>
          </div>
        </div>

        {/* Reason strip */}
        <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100 flex items-start gap-2">
          <AlertTriangle size={13} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-800 leading-relaxed">
            <span className="font-semibold">Reason: </span>{dispute.dispute_reason}
          </p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <MessageSquare size={28} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">No messages yet</p>
            </div>
          ) : (
            messages.map(msg => (
              <div key={msg.id} className={`flex gap-2 ${msg.sender_role === "admin" ? "justify-center" : ""}`}>
                {msg.sender_role === "admin" ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 max-w-[88%]">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Shield size={12} className="text-amber-600" />
                      <span className="text-xs font-bold text-amber-700">Admin</span>
                      <span className="text-[10px] text-gray-400 ml-auto">
                        {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-xs text-amber-900 leading-relaxed">{msg.content}</p>
                  </div>
                ) : (
                  <>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-gray-700">{msg.sender_name}</span>
                        <RolePill role={msg.sender_role} />
                        <span className="text-[10px] text-gray-400 ml-auto">
                          {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <div className="bg-white border border-gray-200 rounded-xl rounded-tl-none px-3 py-2.5 shadow-sm">
                        <p className="text-sm text-gray-800 leading-relaxed">{msg.content}</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* Resolve form */}
        {showResolveForm && dispute.dispute_status !== "resolved" && (
          <div className="border-t border-gray-100 bg-gray-50 px-4 py-4 space-y-3">
            <div className="text-xs font-bold text-gray-700 flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-500" />
              Resolve Dispute
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(["refund_customer","refund_provider","dismiss"] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setResolution(r)}
                  className={`text-[10px] font-bold py-2 px-2 rounded-lg border transition-all ${
                    resolution === r
                      ? "bg-orange-500 text-white border-orange-500"
                      : "bg-white text-gray-600 border-gray-200 hover:border-orange-300"
                  }`}
                >
                  {r === "refund_customer" ? "Refund Customer" : r === "refund_provider" ? "Credit Provider" : "Dismiss"}
                </button>
              ))}
            </div>
            {resolution !== "dismiss" && (
              <div className="flex items-center gap-2">
                <DollarSign size={14} className="text-gray-500" />
                <div className="flex items-center flex-1 border border-gray-200 rounded-lg overflow-hidden bg-white">
                  <span className="px-3 text-sm text-gray-500 font-medium">₹</span>
                  <input
                    type="number"
                    value={refundAmount}
                    onChange={e => setRefundAmount(e.target.value)}
                    className="flex-1 py-2 pr-3 text-sm outline-none"
                    placeholder="0.00"
                  />
                </div>
              </div>
            )}
            <textarea
              value={adminNote}
              onChange={e => setAdminNote(e.target.value)}
              placeholder="Admin note (optional, visible to both parties)"
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 resize-none outline-none focus:ring-1 focus:ring-orange-400 bg-white"
              rows={2}
            />
            <div className="flex gap-2">
              <button onClick={() => setShowResolveForm(false)} className="px-4 py-2 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={resolve}
                disabled={resolving}
                className="flex-1 py-2 text-xs font-bold rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
              >
                {resolving ? "Processing…" : "Confirm Resolution"}
              </button>
            </div>
          </div>
        )}

        {/* Message input or action bar */}
        <div className="border-t border-gray-100 px-4 py-3 bg-white">
          {canMessage ? (
            <div className="flex gap-2">
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Reply as admin…"
                className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 resize-none outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50"
                rows={2}
              />
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => sendMsg.mutate()}
                  disabled={!message.trim() || sendMsg.isPending}
                  className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center disabled:opacity-40 hover:bg-orange-600 transition-colors"
                >
                  <Send size={16} />
                </button>
                {dispute.dispute_status !== "resolved" && (
                  <button
                    onClick={() => setShowResolveForm(v => !v)}
                    className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition-colors"
                    title="Resolve dispute"
                  >
                    <CheckCircle2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 py-2 text-emerald-600">
              <CheckCircle2 size={16} />
              <span className="text-sm font-semibold">Dispute Resolved</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Disputes() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<Dispute | null>(null);
  const qc = useQueryClient();

  const { data: disputes = [], isLoading, refetch } = useQuery<Dispute[]>({
    queryKey: ["admin-disputes", statusFilter],
    queryFn: () => api.get(`/disputes?status=${statusFilter}`),
    refetchInterval: 30_000,
  });

  const openCount = disputes.filter(d => d.dispute_status === "open").length;
  const underReviewCount = disputes.filter(d => d.dispute_status === "under_review").length;
  const resolvedCount = disputes.filter(d => d.dispute_status === "resolved").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Disputes</h1>
          <p className="text-sm text-gray-500 mt-0.5">Arbitrate customer–provider disputes</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Open", count: openCount, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50", border: "border-red-100" },
          { label: "Under Review", count: underReviewCount, icon: Clock, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
          { label: "Resolved", count: resolvedCount, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100" },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={`${s.bg} ${s.border} border rounded-2xl p-4 flex items-center gap-3`}>
              <div className={`w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm`}>
                <Icon size={18} className={s.color} />
              </div>
              <div>
                <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
                <div className="text-xs text-gray-500 font-medium">{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {["all","open","under_review","resolved"].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              statusFilter === s
                ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                : "bg-white text-gray-600 border border-gray-200 hover:border-orange-300"
            }`}
          >
            {s === "all" ? "All" : s === "under_review" ? "Under Review" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center text-gray-400">
            <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading disputes…
          </div>
        ) : disputes.length === 0 ? (
          <div className="py-20 text-center text-gray-400">
            <Shield size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No disputes found</p>
            <p className="text-xs mt-1">All bookings are running smoothly</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {disputes.map(d => {
              const meta = STATUS_META[d.dispute_status] ?? STATUS_META.open;
              const StatusIcon = meta.icon;
              return (
                <div
                  key={d.id}
                  onClick={() => setSelected(d)}
                  className="px-5 py-4 hover:bg-orange-50/40 cursor-pointer transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
                      {d.listing_images?.[0] ? (
                        <img src={d.listing_images[0]} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Shield size={20} className="text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-gray-900 truncate">{d.listing_title}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${meta.bg} ${meta.color}`}>
                          <StatusIcon size={10} />
                          {meta.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-2 line-clamp-1">{d.dispute_reason}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <User size={11} />
                          {d.customer_name} vs {d.provider_name}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare size={11} />
                          {d.message_count} messages
                        </span>
                        {d.refund_amount > 0 && (
                          <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                            ₹{Number(d.refund_amount).toFixed(0)} refunded
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-bold text-gray-700">₹{Number(d.final_amount || d.total_amount || 0).toFixed(0)}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        {d.dispute_opened_at ? formatDistanceToNow(new Date(d.dispute_opened_at), { addSuffix: true }) : "—"}
                      </div>
                      <ChevronDown size={14} className="text-gray-400 ml-auto mt-1 rotate-[-90deg]" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selected && <DisputeDetail dispute={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
