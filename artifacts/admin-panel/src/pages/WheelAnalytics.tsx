import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Dices, TrendingUp, Gift, Calendar, Users, IndianRupee } from "lucide-react";

interface WheelData {
  totalSpins: number;
  todaySpins: number;
  paidSpins: number;
  freeSpins: number;
  spinRevenue: number;
  todayRevenue: number;
  rewardsGiven: number;
  recentSpins: {
    id: string; spinType: string; rewardLabel: string;
    discountValue: number; paymentAmount: number;
    userName: string; userEmail: string; createdAt: string;
  }[];
}

function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function timeAgo(s: string) {
  const d = Math.floor((Date.now() - new Date(s).getTime()) / 1000);
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

const STAT_CARDS = [
  { key: "totalSpins",   label: "Total Spins",         icon: Dices,       color: "text-orange-600",  bg: "bg-orange-50",  prefix: "",  suffix: " spins" },
  { key: "todaySpins",   label: "Spins Today",         icon: Calendar,    color: "text-blue-600",    bg: "bg-blue-50",    prefix: "",  suffix: " spins" },
  { key: "paidSpins",    label: "Paid Spins",          icon: IndianRupee, color: "text-green-600",   bg: "bg-green-50",   prefix: "",  suffix: " spins" },
  { key: "freeSpins",    label: "Free Spins",          icon: Gift,        color: "text-purple-600",  bg: "bg-purple-50",  prefix: "",  suffix: " spins" },
  { key: "spinRevenue",  label: "Total Spin Revenue",  icon: TrendingUp,  color: "text-amber-600",   bg: "bg-amber-50",   prefix: "₹", suffix: "" },
  { key: "rewardsGiven", label: "Rewards Distributed", icon: Users,       color: "text-pink-600",    bg: "bg-pink-50",    prefix: "",  suffix: " promos" },
];

export default function WheelAnalytics() {
  const { data, isLoading, isError } = useQuery<WheelData>({
    queryKey: ["wheel-analytics"],
    queryFn: () => api.get("/admin/wheel-analytics"),
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-orange-400 border-t-transparent rounded-full" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <p>Could not load Wheel Analytics. Try refreshing.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
          <Dices size={20} className="text-orange-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Wheel of Fortune</h1>
          <p className="text-sm text-slate-500">Spin analytics and paid revenue</p>
        </div>
        <div className="ml-auto flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-3 py-1.5">
          <IndianRupee size={13} className="text-green-600" />
          <span className="text-sm font-semibold text-green-700">₹{fmt(data.todayRevenue)} today</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {STAT_CARDS.map(card => {
          const Icon = card.icon;
          const value = data[card.key as keyof WheelData] as number;
          return (
            <div key={card.key} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-9 h-9 rounded-xl ${card.bg} flex items-center justify-center`}>
                  <Icon size={17} className={card.color} />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900">
                {card.prefix}{typeof value === "number" && card.prefix === "₹" ? fmt(value) : value.toLocaleString("en-IN")}{card.suffix}
              </p>
              <p className="text-xs text-slate-500 mt-1">{card.label}</p>
            </div>
          );
        })}
      </div>

      {/* Paid vs Free breakdown */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <h2 className="text-base font-semibold text-slate-800 mb-4">Spin Breakdown</h2>
        <div className="flex gap-4">
          <div className="flex-1 bg-green-50 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-green-700">{data.paidSpins}</p>
            <p className="text-sm text-green-600 mt-1">Paid Spins</p>
            <p className="text-xs text-green-500">₹{fmt(data.spinRevenue)} revenue</p>
          </div>
          <div className="flex-1 bg-purple-50 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-purple-700">{data.freeSpins}</p>
            <p className="text-sm text-purple-600 mt-1">Free Spins</p>
            <p className="text-xs text-purple-500">No revenue</p>
          </div>
          <div className="flex-1 bg-orange-50 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-orange-700">{data.rewardsGiven}</p>
            <p className="text-sm text-orange-600 mt-1">Rewards Won</p>
            <p className="text-xs text-orange-500">
              {data.totalSpins > 0 ? `${((data.rewardsGiven / data.totalSpins) * 100).toFixed(0)}% win rate` : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Recent spins */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
        <div className="p-5 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">Recent Spins</h2>
        </div>
        <div className="divide-y divide-slate-50">
          {data.recentSpins.length === 0 ? (
            <div className="p-8 text-center text-slate-400">No spins yet</div>
          ) : data.recentSpins.map(s => (
            <div key={s.id} className="flex items-center gap-3 px-5 py-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg
                ${s.spinType === "paid" ? "bg-green-50" : "bg-purple-50"}`}>
                {s.spinType === "paid" ? "💰" : "🎁"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{s.userName}</p>
                <p className="text-xs text-slate-400 truncate">{s.userEmail}</p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${s.discountValue > 0 ? "text-green-700" : "text-slate-400"}`}>
                  {s.discountValue > 0 ? `${s.discountValue}% OFF` : "No Win"}
                </p>
                <p className="text-xs text-slate-400">{timeAgo(s.createdAt)}</p>
              </div>
              {s.spinType === "paid" && (
                <div className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-1 rounded-full">
                  ₹{s.paymentAmount}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
