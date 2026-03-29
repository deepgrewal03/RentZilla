import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Bell, Send, Clock, Users, User, Package, RefreshCw, CheckCircle, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AdminNotification {
  id: string; title: string; message: string; target_role: string;
  target_user_id: string | null; type: string; status: string;
  sent_count: number; scheduled_at: string | null;
  creator_email: string | null; created_at: string;
}

const AUDIENCE_OPTIONS = [
  { value: "all", label: "All Users", icon: Users, color: "bg-blue-100 text-blue-700" },
  { value: "customer", label: "Customers Only", icon: User, color: "bg-green-100 text-green-700" },
  { value: "provider", label: "Providers Only", icon: Package, color: "bg-purple-100 text-purple-700" },
];

const TYPE_OPTIONS = [
  { value: "admin", label: "📢 Announcement" },
  { value: "promotion", label: "🎁 Promotion" },
  { value: "safety", label: "⚠️ Safety Alert" },
  { value: "system", label: "⚙️ System Update" },
];

const STATUS_COLOR: Record<string, string> = {
  sent: "bg-green-100 text-green-700",
  pending: "bg-amber-100 text-amber-700",
  failed: "bg-red-100 text-red-700",
};

function ComposeForm() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [targetRole, setTargetRole] = useState("all");
  const [type, setType] = useState("admin");
  const [deepLink, setDeepLink] = useState("");
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [specificUserId, setSpecificUserId] = useState("");
  const [audienceType, setAudienceType] = useState<"all" | "customer" | "provider" | "specific">("all");

  const sendMutation = useMutation({
    mutationFn: (data: any) => api.post(scheduleMode ? "/admin/notifications/schedule" : "/admin/notifications/send", data),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["admin-notif-history"] });
      toast({ title: scheduleMode ? "Notification scheduled!" : `Sent to ${res.sentCount} users!`, description: scheduleMode ? `Will be delivered at ${scheduledAt}` : undefined });
      setTitle(""); setMessage(""); setDeepLink(""); setSpecificUserId(""); setScheduledAt("");
    },
    onError: (err: any) => toast({ title: "Failed to send", description: err.message, variant: "destructive" }),
  });

  function handleSend() {
    if (!title.trim() || !message.trim()) { toast({ title: "Title and message are required", variant: "destructive" }); return; }
    if (scheduleMode && !scheduledAt) { toast({ title: "Please select a schedule time", variant: "destructive" }); return; }
    if (audienceType === "specific" && !specificUserId.trim()) { toast({ title: "Please enter a user ID", variant: "destructive" }); return; }
    sendMutation.mutate({
      title: title.trim(),
      message: message.trim(),
      targetRole: audienceType === "specific" ? "all" : audienceType,
      targetUserId: audienceType === "specific" ? specificUserId.trim() : undefined,
      type,
      deepLink: deepLink.trim() || undefined,
      scheduledAt: scheduleMode ? scheduledAt : undefined,
    });
  }

  const charCount = message.length;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <Bell size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-white font-bold">Compose Notification</h2>
            <p className="text-orange-100 text-xs">Broadcast to your users in real-time</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Audience */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Target Audience</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {AUDIENCE_OPTIONS.map(opt => (
              <button key={opt.value}
                onClick={() => { setAudienceType(opt.value as any); setTargetRole(opt.value); }}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                  audienceType === opt.value
                    ? "border-orange-500 bg-orange-50 text-orange-700"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                <opt.icon size={15} />
                <span className="truncate">{opt.label}</span>
              </button>
            ))}
            <button
              onClick={() => setAudienceType("specific")}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                audienceType === "specific"
                  ? "border-orange-500 bg-orange-50 text-orange-700"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              <User size={15} />
              <span>Specific User</span>
            </button>
          </div>
          {audienceType === "specific" && (
            <input
              value={specificUserId}
              onChange={e => setSpecificUserId(e.target.value)}
              placeholder="Enter user ID..."
              className="mt-2 w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-400"
            />
          )}
        </div>

        {/* Type */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Notification Type</label>
          <div className="flex flex-wrap gap-2">
            {TYPE_OPTIONS.map(opt => (
              <button key={opt.value}
                onClick={() => setType(opt.value)}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${
                  type === opt.value
                    ? "border-orange-500 bg-orange-50 text-orange-700"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Title *</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. 🎉 Special Offer for You!"
            maxLength={100}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-400 transition-colors"
          />
          <p className="text-xs text-gray-400 mt-1 text-right">{title.length}/100</p>
        </div>

        {/* Message */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Message *</label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Write your notification message here..."
            maxLength={500}
            rows={4}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-400 resize-none transition-colors"
          />
          <p className="text-xs text-gray-400 mt-1 text-right">{charCount}/500</p>
        </div>

        {/* Deep Link */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Deep Link <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            value={deepLink}
            onChange={e => setDeepLink(e.target.value)}
            placeholder="e.g. rentzilla://listings, rentzilla://rides"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-400 transition-colors"
          />
        </div>

        {/* Schedule toggle */}
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={() => setScheduleMode(!scheduleMode)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
              scheduleMode ? "border-orange-500 bg-orange-50 text-orange-700" : "border-gray-200 text-gray-600"
            }`}
          >
            <Clock size={15} />
            {scheduleMode ? "Scheduled" : "Send Now"}
          </button>
          {scheduleMode && (
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400"
            />
          )}
        </div>

        {/* Preview */}
        {(title || message) && (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
            <p className="text-xs text-gray-400 font-medium mb-2 uppercase tracking-wide">Preview</p>
            <div className="flex gap-3 items-start">
              <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center text-white text-sm flex-shrink-0">🛵</div>
              <div>
                <p className="text-sm font-bold text-gray-900">{title || "Notification title"}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{message || "Notification message will appear here..."}</p>
              </div>
            </div>
          </div>
        )}

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={sendMutation.isPending || !title.trim() || !message.trim()}
          className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl text-sm font-bold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {sendMutation.isPending
            ? <><RefreshCw size={16} className="animate-spin" /> Sending...</>
            : scheduleMode
            ? <><Clock size={16} /> Schedule Notification</>
            : <><Send size={16} /> Send Now</>
          }
        </button>
      </div>
    </div>
  );
}

function NotificationHistory() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery<{ notifications: AdminNotification[]; total: number }>({
    queryKey: ["admin-notif-history", page],
    queryFn: () => api.get(`/admin/notifications/history?page=${page}&limit=10`),
    refetchInterval: 15_000,
  });

  const totalPages = Math.ceil((data?.total || 0) / 10);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-900">Notification History</h2>
        <span className="text-sm text-gray-500">{data?.total || 0} total</span>
      </div>

      <div className="divide-y divide-gray-50">
        {isLoading ? (
          <div className="py-12 text-center"><RefreshCw size={20} className="animate-spin text-orange-500 mx-auto" /></div>
        ) : !data?.notifications?.length ? (
          <div className="py-12 text-center">
            <Bell size={36} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No notifications sent yet</p>
          </div>
        ) : (data?.notifications || []).map((n: any) => (
          <div key={n.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base ${
                n.type === "safety" ? "bg-red-100" : n.type === "promotion" ? "bg-green-100" : "bg-orange-100"
              }`}>
                {n.type === "safety" ? "⚠️" : n.type === "promotion" ? "🎁" : n.type === "system" ? "⚙️" : "📢"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-gray-900">{n.title}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[n.status] || "bg-gray-100 text-gray-600"}`}>
                    {n.status}
                  </span>
                  {n.scheduled_at && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium flex items-center gap-1">
                      <Clock size={10} /> Scheduled
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{n.message}</p>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                  <span>→ {n.target_role === "all" ? "All Users" : n.target_role === "customer" ? "Customers" : n.target_user_id ? `User #${n.target_user_id.slice(-8)}` : "Providers"}</span>
                  {n.sent_count > 0 && <span className="text-green-600 font-medium flex items-center gap-1"><CheckCircle size={10} /> {n.sent_count} delivered</span>}
                  <span>{formatTime(n.created_at)}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
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

export default function Notifications() {
  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Push Notifications</h1>
        <p className="text-gray-500 text-sm mt-0.5">Broadcast messages to customers, providers, or specific users</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <ComposeForm />
        <NotificationHistory />
      </div>
    </div>
  );
}
