import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Trophy, Users, TrendingUp, Calendar, Star, DollarSign } from "lucide-react";

interface GoldData {
  memberCount: number;
  totalRevenue: number;
  todayRevenue: number;
  monthRevenue: number;
  totalSavingsGiven: number;
  goldBookingCount: number;
  goldBookingSavingsTotal: number;
  recentMembers: { id: string; name: string; email: string; activatedAt: string; totalSaved: number }[];
  recentPurchases: { id: string; amount: number; createdAt: string; userName: string; userEmail: string }[];
}

function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function timeAgo(s: string) {
  const d = Math.floor((Date.now() - new Date(s).getTime()) / 1000);
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const STAT_CARDS = [
  { key: "memberCount",          label: "Total Gold Members",     icon: Users,        color: "text-yellow-600", bg: "bg-yellow-50",  prefix: "", suffix: " members" },
  { key: "totalRevenue",         label: "All-Time Revenue",       icon: TrendingUp,   color: "text-green-600",  bg: "bg-green-50",   prefix: "₹", suffix: "" },
  { key: "monthRevenue",         label: "This Month's Revenue",   icon: Calendar,     color: "text-blue-600",   bg: "bg-blue-50",    prefix: "₹", suffix: "" },
  { key: "todayRevenue",         label: "Today's Revenue",        icon: Star,         color: "text-orange-600", bg: "bg-orange-50",  prefix: "₹", suffix: "" },
  { key: "goldBookingCount",     label: "Bookings with Discount", icon: DollarSign,   color: "text-purple-600", bg: "bg-purple-50",  prefix: "", suffix: " bookings" },
  { key: "totalSavingsGiven",    label: "Total Savings Given",    icon: Trophy,       color: "text-amber-600",  bg: "bg-amber-50",   prefix: "₹", suffix: "" },
];

export default function GoldAnalytics() {
  const { data, isLoading, isError } = useQuery<GoldData>({
    queryKey: ["gold-analytics"],
    queryFn: () => api.get("/admin/gold-analytics"),
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <p>Could not load Gold Analytics. Try refreshing.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center shadow-lg">
          <Trophy size={24} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gold Membership Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">One-time ₹2.49 lifetime membership — 4% off every booking</p>
        </div>
      </div>

      {/* Stat Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {STAT_CARDS.map(card => {
          const Icon = card.icon;
          const rawVal = (data as any)[card.key];
          const displayVal = typeof rawVal === "number" && card.prefix === "₹"
            ? `₹${fmt(rawVal)}`
            : `${card.prefix ?? ""}${rawVal?.toLocaleString("en-IN") ?? 0}${card.suffix ?? ""}`;
          return (
            <div key={card.key} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center`}>
                  <Icon size={18} className={card.color} />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900">{displayVal}</div>
              <div className="text-sm text-gray-500 mt-1">{card.label}</div>
            </div>
          );
        })}
      </div>

      {/* Two columns: recent members + recent purchases */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent Members */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-yellow-50 flex items-center justify-center">
              <Users size={14} className="text-yellow-600" />
            </div>
            <h2 className="font-semibold text-gray-800">Recent Gold Members</h2>
            <span className="ml-auto text-xs font-semibold text-yellow-700 bg-yellow-50 px-2.5 py-1 rounded-full">
              {data.memberCount} total
            </span>
          </div>
          {data.recentMembers.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">No gold members yet</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {data.recentMembers.map(m => (
                <div key={m.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {(m.name?.[0] || "?").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-gray-800 truncate">{m.name}</p>
                      <Trophy size={12} className="text-yellow-500 flex-shrink-0" />
                    </div>
                    <p className="text-xs text-gray-400 truncate">{m.email}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {m.totalSaved > 0 && (
                      <p className="text-xs font-semibold text-green-600">Saved ₹{fmt(m.totalSaved)}</p>
                    )}
                    <p className="text-xs text-gray-400">{m.activatedAt ? timeAgo(m.activatedAt) : ""}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Purchases */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center">
              <DollarSign size={14} className="text-green-600" />
            </div>
            <h2 className="font-semibold text-gray-800">Recent Purchases</h2>
            <span className="ml-auto text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
              ₹{fmt(data.totalRevenue)} total
            </span>
          </div>
          {data.recentPurchases.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">No purchases yet</div>
          ) : (
            <div className="divide-y divide-gray-50 max-h-[420px] overflow-y-auto">
              {data.recentPurchases.map(p => (
                <div key={p.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {(p.userName?.[0] || "?").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{p.userName}</p>
                    <p className="text-xs text-gray-400 truncate">{p.userEmail}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-yellow-700">₹{fmt(p.amount)}</p>
                    <p className="text-xs text-gray-400">{timeAgo(p.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
