import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Bell, Send, Clock, Users, User, Package, RefreshCw, CheckCircle,
  ChevronLeft, ChevronRight, Zap, Gift, Car, Wrench, Briefcase,
  MessageSquare, Brain, Cake, ToggleLeft, ToggleRight, Smartphone,
  Save, ArrowRight,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── Types ─────────────────────────────────────────────────────────────────────
interface AdminNotification {
  id: string; title: string; message: string; target_role: string;
  target_user_id: string | null; type: string; status: string;
  sent_count: number; scheduled_at: string | null;
  creator_email: string | null; created_at: string;
}
interface NotifConfig { enabled: boolean; channel: "push" | "whatsapp" | "both"; }

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  sent: "bg-green-100 text-green-700",
  pending: "bg-amber-100 text-amber-700",
  failed: "bg-red-100 text-red-700",
};

const AUTOMATION_GROUPS = [
  {
    label: "Booking Related", icon: "📅", color: "orange",
    items: [
      { key: "booking_confirmed", label: "Booking Confirmed", desc: "Send when a booking is confirmed" },
      { key: "booking_cancelled", label: "Booking Cancelled", desc: "Send when a booking is cancelled" },
      { key: "booking_reminder", label: "Booking Reminder", desc: "2 hours before booking start time" },
    ],
  },
  {
    label: "Payment", icon: "💳", color: "green",
    items: [
      { key: "payment_success", label: "Payment Successful", desc: "Confirm payment receipt to customer" },
      { key: "payment_failed", label: "Payment Failed", desc: "Alert customer about failed payment" },
    ],
  },
  {
    label: "Engagement", icon: "⭐", color: "blue",
    items: [
      { key: "review_reminder", label: "Review Reminder", desc: "Prompt review after booking completes" },
      { key: "rebook_suggestion", label: "Re-book Suggestion", desc: "Suggest re-booking 7 days after last booking" },
    ],
  },
  {
    label: "Promotions", icon: "🎁", color: "purple",
    items: [
      { key: "discount_offers", label: "Discount Offers", desc: "Send promotional discount notifications" },
      { key: "festival_offers", label: "Festival Offers", desc: "Diwali, Holi, Baisakhi special campaigns" },
    ],
  },
  {
    label: "Account", icon: "👤", color: "teal",
    items: [
      { key: "new_user_welcome", label: "New User Welcome", desc: "Send welcome message to new sign-ups" },
      { key: "inactive_reminder", label: "Inactive User Reminder", desc: "Re-engage users inactive for 7+ days" },
    ],
  },
];

const SMART_TRIGGERS = [
  {
    key: "inactive", icon: "⏳", label: "Re-engagement",
    desc: "Target users with no bookings in the last 7 days",
    preview: "👋 We miss you on RentZilla! Browse the latest deals near you.",
    color: "bg-amber-50 border-amber-200",
    badge: "bg-amber-100 text-amber-700",
  },
  {
    key: "abandoned", icon: "🛒", label: "Abandoned Booking",
    desc: "Users who started but didn't complete a booking",
    preview: "🛒 Complete your booking! Finish now and get instant confirmation.",
    color: "bg-blue-50 border-blue-200",
    badge: "bg-blue-100 text-blue-700",
  },
  {
    key: "highintent", icon: "⭐", label: "Loyal Customers",
    desc: "Users with 3+ bookings — send exclusive premium offers",
    preview: "⭐ Exclusive offer for our loyal customers! Thank you for choosing us.",
    color: "bg-violet-50 border-violet-200",
    badge: "bg-violet-100 text-violet-700",
  },
  {
    key: "newlisting", icon: "🆕", label: "New Listings Alert",
    desc: "Notify all active customers about fresh listings",
    preview: "🆕 Fresh listings just added near you! Check them out now.",
    color: "bg-green-50 border-green-200",
    badge: "bg-green-100 text-green-700",
  },
];

// ── Compose Tab ───────────────────────────────────────────────────────────────
function ComposeTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audienceType, setAudienceType] = useState<"all" | "customer" | "provider" | "cars" | "equipment" | "services" | "specific">("all");
  const [type, setType] = useState("admin");
  const [channel, setChannel] = useState<"push" | "whatsapp" | "both">("push");
  const [deepLink, setDeepLink] = useState("");
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [specificUserId, setSpecificUserId] = useState("");

  const AUDIENCE = [
    { value: "all", label: "All Users", icon: Users, color: "blue" },
    { value: "customer", label: "Customers", icon: User, color: "green" },
    { value: "provider", label: "Providers", icon: Package, color: "purple" },
    { value: "cars", label: "Cars Users", icon: Car, color: "sky" },
    { value: "equipment", label: "Equipment", icon: Wrench, color: "amber" },
    { value: "services", label: "Services", icon: Briefcase, color: "violet" },
    { value: "specific", label: "Specific User", icon: User, color: "orange" },
  ] as const;

  const TYPE_OPTIONS = [
    { value: "admin", label: "📢 Announcement" },
    { value: "promotion", label: "🎁 Promotion" },
    { value: "safety", label: "⚠️ Safety Alert" },
    { value: "system", label: "⚙️ System Update" },
  ];

  const CHANNEL_OPTIONS = [
    { value: "push", label: "📱 Push Only", icon: Smartphone },
    { value: "whatsapp", label: "💬 WhatsApp Only", icon: MessageSquare },
    { value: "both", label: "📲 Push + WhatsApp", icon: Zap },
  ] as const;

  const sendMutation = useMutation({
    mutationFn: (data: any) => api.post(scheduleMode ? "/admin/notifications/schedule" : "/admin/notifications/send", data),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["admin-notif-history"] });
      toast({
        title: scheduleMode ? "Notification scheduled!" : `Sent to ${res.sentCount} users!`,
        description: scheduleMode ? `Will be delivered at ${scheduledAt}` : `Via ${channel} channel`,
      });
      setTitle(""); setMessage(""); setDeepLink(""); setSpecificUserId(""); setScheduledAt("");
    },
    onError: (err: any) => toast({ title: "Failed to send", description: err.message, variant: "destructive" }),
  });

  function handleSend() {
    if (!title.trim() || !message.trim()) { toast({ title: "Title and message are required", variant: "destructive" }); return; }
    if (scheduleMode && !scheduledAt) { toast({ title: "Please select a schedule time", variant: "destructive" }); return; }
    if (audienceType === "specific" && !specificUserId.trim()) { toast({ title: "Please enter a user ID", variant: "destructive" }); return; }
    const isCategoryTarget = ["cars", "equipment", "services"].includes(audienceType);
    sendMutation.mutate({
      title: title.trim(),
      message: message.trim(),
      targetRole: (!isCategoryTarget && audienceType !== "specific") ? audienceType : "all",
      targetUserId: audienceType === "specific" ? specificUserId.trim() : undefined,
      targetCategory: isCategoryTarget ? audienceType : undefined,
      type,
      channel,
      deepLink: deepLink.trim() || undefined,
      scheduledAt: scheduleMode ? scheduledAt : undefined,
    });
  }

  return (
    <div className="grid lg:grid-cols-5 gap-6">
      <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <Bell size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-white font-bold">Compose Notification</h2>
            <p className="text-orange-100 text-xs">Broadcast messages in real-time</p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Audience */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Target Audience</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {AUDIENCE.map(opt => (
                <button key={opt.value} onClick={() => setAudienceType(opt.value as any)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-xs font-medium transition-all ${
                    audienceType === opt.value ? "border-orange-500 bg-orange-50 text-orange-700" : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <opt.icon size={14} /> <span className="truncate">{opt.label}</span>
                </button>
              ))}
            </div>
            {audienceType === "specific" && (
              <input value={specificUserId} onChange={e => setSpecificUserId(e.target.value)}
                placeholder="Enter user ID..." className="mt-2 w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-400" />
            )}
            {["cars", "equipment", "services"].includes(audienceType) && (
              <p className="mt-1.5 text-xs text-orange-600 font-medium">
                → Targeting users with bookings/listings in the <span className="capitalize">{audienceType}</span> category
              </p>
            )}
          </div>

          {/* Channel */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Delivery Channel</label>
            <div className="flex gap-2">
              {CHANNEL_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setChannel(opt.value)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-xs font-medium transition-all ${
                    channel === opt.value ? "border-orange-500 bg-orange-50 text-orange-700" : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <opt.icon size={13} /> {opt.label}
                </button>
              ))}
            </div>
            {channel !== "push" && (
              <div className="mt-2 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-xl border border-amber-200">
                <MessageSquare size={12} /> WhatsApp delivery uses Business API integration (configured in Settings)
              </div>
            )}
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Notification Type</label>
            <div className="flex flex-wrap gap-2">
              {TYPE_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setType(opt.value)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${
                    type === opt.value ? "border-orange-500 bg-orange-50 text-orange-700" : "border-gray-200 text-gray-600 hover:border-gray-300"
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
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. 🎉 Special Offer for You!" maxLength={100}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-400 transition-colors" />
            <p className="text-xs text-gray-400 mt-1 text-right">{title.length}/100</p>
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Message *</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)}
              placeholder="Write your notification message here..." maxLength={500} rows={4}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-400 resize-none transition-colors" />
            <p className="text-xs text-gray-400 mt-1 text-right">{message.length}/500</p>
          </div>

          {/* Deep Link */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Deep Link <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input value={deepLink} onChange={e => setDeepLink(e.target.value)}
              placeholder="e.g. rentzilla://listings, rentzilla://rides"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-400 transition-colors" />
          </div>

          {/* Schedule */}
          <div className="flex items-center gap-3">
            <button onClick={() => setScheduleMode(!scheduleMode)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                scheduleMode ? "border-orange-500 bg-orange-50 text-orange-700" : "border-gray-200 text-gray-600"
              }`}
            >
              <Clock size={15} /> {scheduleMode ? "Scheduled" : "Send Now"}
            </button>
            {scheduleMode && (
              <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400" />
            )}
          </div>

          {/* Send button */}
          <button onClick={handleSend} disabled={sendMutation.isPending || !title.trim() || !message.trim()}
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

      {/* Preview panel */}
      <div className="lg:col-span-2 space-y-4">
        {(title || message) && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-400 font-semibold mb-3 uppercase tracking-wide">Live Preview</p>
            {/* Push notification preview */}
            {(channel === "push" || channel === "both") && (
              <div className="bg-gray-900 rounded-2xl p-4 mb-3">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-md bg-orange-500 flex items-center justify-center text-xs">🛵</div>
                  <span className="text-gray-400 text-xs">RentZilla · now</span>
                </div>
                <p className="text-white text-sm font-semibold">{title || "Notification title"}</p>
                <p className="text-gray-400 text-xs mt-1 leading-relaxed">{message || "Your message here..."}</p>
              </div>
            )}
            {/* WhatsApp preview */}
            {(channel === "whatsapp" || channel === "both") && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare size={13} className="text-green-600" />
                  <span className="text-xs font-semibold text-green-700">WhatsApp Message</span>
                </div>
                <div className="bg-white rounded-xl p-3 shadow-sm">
                  <p className="text-sm text-gray-800 leading-relaxed">
                    *{title || "Notification title"}*{"\n"}{message || "Your message here..."}
                    {deepLink && `\n\n👉 ${deepLink}`}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Audience info card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Targeting Summary</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Audience</span>
              <span className="font-semibold text-gray-900 capitalize">
                {audienceType === "specific" ? "Specific User" :
                  audienceType === "all" ? "All Users" :
                  audienceType === "customer" ? "Customers Only" :
                  audienceType === "provider" ? "Providers Only" :
                  `${audienceType.charAt(0).toUpperCase() + audienceType.slice(1)} Category`}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Channel</span>
              <span className="font-semibold text-gray-900">
                {channel === "push" ? "📱 Push" : channel === "whatsapp" ? "💬 WhatsApp" : "📲 Both"}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Timing</span>
              <span className="font-semibold text-gray-900">{scheduleMode ? "Scheduled" : "Immediate"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Automation Tab ────────────────────────────────────────────────────────────
function AutomationTab() {
  const { toast } = useToast();
  const [localConfig, setLocalConfig] = useState<Record<string, { enabled: boolean; channel: string }> | null>(null);

  const { data: config, isLoading } = useQuery<Record<string, NotifConfig>>({
    queryKey: ["admin-notif-config"],
    queryFn: () => api.get("/admin/notifications/config"),
    onSuccess: (d: any) => { if (!localConfig) setLocalConfig(d); },
  } as any);

  const saveMutation = useMutation({
    mutationFn: (data: any) => api.patch("/admin/notifications/config", data),
    onSuccess: () => toast({ title: "Automation settings saved!" }),
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const effectiveConfig = localConfig ?? config ?? {};

  function toggleItem(key: string) {
    setLocalConfig(prev => {
      const c = prev ?? config ?? {};
      return { ...c, [key]: { ...c[key], enabled: !c[key]?.enabled } };
    });
  }

  function setItemChannel(key: string, ch: string) {
    setLocalConfig(prev => {
      const c = prev ?? config ?? {};
      return { ...c, [key]: { ...c[key], channel: ch } };
    });
  }

  const GROUP_COLORS: Record<string, string> = {
    orange: "bg-orange-100 text-orange-700",
    green: "bg-green-100 text-green-700",
    blue: "bg-blue-100 text-blue-700",
    purple: "bg-purple-100 text-purple-700",
    teal: "bg-teal-100 text-teal-700",
  };

  if (isLoading) return <div className="flex justify-center py-16"><RefreshCw size={24} className="animate-spin text-orange-500" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Automation Settings</h2>
          <p className="text-sm text-gray-500">Enable/disable automatic notification triggers for each event type</p>
        </div>
        <button
          onClick={() => saveMutation.mutate(localConfig)}
          disabled={saveMutation.isPending || !localConfig}
          className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {saveMutation.isPending ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
          Save Settings
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {AUTOMATION_GROUPS.map(group => (
          <div key={group.label} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-50 flex items-center gap-2">
              <span className="text-lg">{group.icon}</span>
              <h3 className="font-bold text-gray-900 text-sm">{group.label}</h3>
              <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-semibold ${GROUP_COLORS[group.color]}`}>
                {group.items.filter(i => effectiveConfig[i.key]?.enabled).length}/{group.items.length} active
              </span>
            </div>
            <div className="divide-y divide-gray-50">
              {group.items.map(item => {
                const conf = effectiveConfig[item.key] ?? { enabled: false, channel: "push" };
                return (
                  <div key={item.key} className="px-5 py-3.5 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-900">{item.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{item.desc}</div>
                      {conf.enabled && (
                        <div className="flex gap-1 mt-2">
                          {(["push", "whatsapp", "both"] as const).map(ch => (
                            <button key={ch} onClick={() => setItemChannel(item.key, ch)}
                              className={`px-2 py-0.5 rounded-md text-xs font-medium border transition-colors ${
                                conf.channel === ch ? "border-orange-400 bg-orange-50 text-orange-600" : "border-gray-200 text-gray-400 hover:border-gray-300"
                              }`}
                            >
                              {ch === "push" ? "📱" : ch === "whatsapp" ? "💬" : "📲"} {ch}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <button onClick={() => toggleItem(item.key)} className="flex-shrink-0 mt-0.5">
                      {conf.enabled
                        ? <ToggleRight size={28} className="text-orange-500" />
                        : <ToggleLeft size={28} className="text-gray-300" />
                      }
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Active count banner */}
      <div className="bg-orange-50 border border-orange-200 rounded-xl px-5 py-4 flex items-center gap-3">
        <Bell size={18} className="text-orange-500 flex-shrink-0" />
        <div className="flex-1">
          <span className="text-sm font-semibold text-gray-900">
            {AUTOMATION_GROUPS.flatMap(g => g.items).filter(i => effectiveConfig[i.key]?.enabled).length} automation{AUTOMATION_GROUPS.flatMap(g => g.items).filter(i => effectiveConfig[i.key]?.enabled).length !== 1 ? "s" : ""} active
          </span>
          <span className="text-sm text-gray-500"> — triggers will fire automatically based on user actions</span>
        </div>
        <button onClick={() => saveMutation.mutate(localConfig)} disabled={saveMutation.isPending || !localConfig}
          className="text-orange-500 text-sm font-semibold hover:underline flex items-center gap-1 disabled:opacity-50">
          Save <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Birthday & AI Tab ─────────────────────────────────────────────────────────
function BirthdayAITab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [bdChannel, setBdChannel] = useState<"push" | "whatsapp" | "both">("both");
  const [firingTrigger, setFiringTrigger] = useState<string | null>(null);

  const { data: bdCount } = useQuery<{ count: number }>({
    queryKey: ["admin-birthday-count"],
    queryFn: () => api.get("/admin/notifications/birthday-count"),
  });

  const birthdayMutation = useMutation({
    mutationFn: () => api.post("/admin/notifications/birthday", { channel: bdChannel }),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["admin-notif-history"] });
      if (res.sentCount === 0) {
        toast({ title: "No birthday users today", description: "No users have their birthday today" });
      } else {
        toast({ title: `🎉 Birthday notifications sent!`, description: `${res.sentCount} users notified via ${bdChannel}` });
      }
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const smartMutation = useMutation({
    mutationFn: (trigger: string) => api.post(`/admin/notifications/smart/${trigger}`, {}),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["admin-notif-history"] });
      setFiringTrigger(null);
      toast({ title: "Smart notification sent!", description: res.sentCount === 0 ? "No matching users found" : `${res.sentCount} users targeted` });
    },
    onError: (err: any) => { setFiringTrigger(null); toast({ title: "Error", description: err.message, variant: "destructive" }); },
  });

  function fireTrigger(key: string) {
    setFiringTrigger(key);
    smartMutation.mutate(key);
  }

  return (
    <div className="space-y-6">
      {/* Birthday Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-pink-500 to-rose-500 px-6 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <Cake size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-white font-bold">Birthday Notifications</h2>
            <p className="text-pink-100 text-xs">Detect & celebrate users' birthdays automatically</p>
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-center gap-4 mb-5">
            <div className="flex-1 bg-pink-50 border border-pink-200 rounded-2xl px-5 py-4 text-center">
              <div className="text-3xl font-bold text-pink-600">{bdCount?.count ?? 0}</div>
              <div className="text-xs text-gray-500 mt-0.5">Users with birthday today</div>
            </div>
            <div className="flex-1 bg-orange-50 border border-orange-200 rounded-2xl px-5 py-4">
              <p className="text-xs font-semibold text-gray-600 mb-2">Message preview:</p>
              <p className="text-sm text-gray-800">🎉 Happy Birthday from RentZilla! It's your special day! Enjoy exclusive birthday discounts on your next rental.</p>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Delivery Channel</label>
            <div className="flex gap-2">
              {(["push", "whatsapp", "both"] as const).map(ch => (
                <button key={ch} onClick={() => setBdChannel(ch)}
                  className={`flex-1 py-2.5 rounded-xl border-2 text-xs font-semibold transition-all ${
                    bdChannel === ch ? "border-pink-500 bg-pink-50 text-pink-700" : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {ch === "push" ? "📱 Push" : ch === "whatsapp" ? "💬 WhatsApp" : "📲 Both"}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => birthdayMutation.mutate()}
            disabled={birthdayMutation.isPending}
            className="w-full py-3.5 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white rounded-2xl text-sm font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {birthdayMutation.isPending
              ? <><RefreshCw size={16} className="animate-spin" /> Sending...</>
              : <><Gift size={16} /> Send Birthday Notifications</>
            }
          </button>
        </div>
      </div>

      {/* Smart AI Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Brain size={18} className="text-violet-500" />
          <h2 className="text-lg font-bold text-gray-900">Smart AI Notifications</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-semibold ml-1">AI Powered</span>
        </div>
        <p className="text-sm text-gray-500 mb-4">Intelligent targeting based on user behavior patterns. One click to reach the right audience.</p>

        <div className="grid md:grid-cols-2 gap-4">
          {SMART_TRIGGERS.map(trigger => {
            const isFiring = firingTrigger === trigger.key && smartMutation.isPending;
            return (
              <div key={trigger.key} className={`rounded-2xl border p-5 ${trigger.color}`}>
                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{trigger.icon}</span>
                    <h3 className="font-bold text-gray-900">{trigger.label}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${trigger.badge}`}>AI</span>
                  </div>
                  <p className="text-xs text-gray-600">{trigger.desc}</p>
                </div>

                <div className="bg-white/70 rounded-xl px-3 py-2 mb-4">
                  <p className="text-xs text-gray-600 italic">"{trigger.preview}"</p>
                </div>

                <button
                  onClick={() => fireTrigger(trigger.key)}
                  disabled={smartMutation.isPending}
                  className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isFiring
                    ? <><RefreshCw size={13} className="animate-spin" /> Sending...</>
                    : <><Zap size={13} /> Trigger Now</>
                  }
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── History Tab ───────────────────────────────────────────────────────────────
function HistoryTab() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery<{ notifications: AdminNotification[]; total: number }>({
    queryKey: ["admin-notif-history", page],
    queryFn: () => api.get(`/admin/notifications/history?page=${page}&limit=15`),
    refetchInterval: 15_000,
  });

  const totalPages = Math.ceil((data?.total || 0) / 15);
  const fmt = (d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const TYPE_ICON: Record<string, string> = { safety: "⚠️", promotion: "🎁", system: "⚙️", admin: "📢" };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-900">Notification History</h2>
        <span className="text-sm text-gray-500">{data?.total || 0} total sent</span>
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
                {TYPE_ICON[n.type] || "📢"}
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
                <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400 flex-wrap">
                  <span>→ {n.target_role === "all" ? "All Users" : n.target_role === "customer" ? "Customers" : n.target_user_id ? `User #${n.target_user_id.slice(-8)}` : "Providers"}</span>
                  {n.sent_count > 0 && (
                    <span className="text-green-600 font-medium flex items-center gap-1">
                      <CheckCircle size={10} /> {n.sent_count} delivered
                    </span>
                  )}
                  <span>{fmt(n.created_at)}</span>
                  {n.creator_email && <span className="text-gray-300">by {n.creator_email}</span>}
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
              className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors">
              <ChevronLeft size={16} />
            </button>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
              className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: "compose", label: "Compose", icon: Send },
  { id: "automation", label: "Automation", icon: ToggleRight },
  { id: "birthday", label: "Birthday & AI", icon: Brain },
  { id: "history", label: "History", icon: Bell },
] as const;

export default function Notifications() {
  const [activeTab, setActiveTab] = useState<"compose" | "automation" | "birthday" | "history">("compose");

  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Push Notifications</h1>
        <p className="text-gray-500 text-sm mt-0.5">Intelligent notification system with targeting, automation & AI triggers</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-gray-100 rounded-2xl p-1.5 shadow-sm w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === tab.id
                ? "bg-orange-500 text-white shadow-sm"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "compose" && <ComposeTab />}
      {activeTab === "automation" && <AutomationTab />}
      {activeTab === "birthday" && <BirthdayAITab />}
      {activeTab === "history" && <HistoryTab />}
    </div>
  );
}
