import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Users, Trophy, TrendingUp, Gift } from "lucide-react";

type Stats = {
  totalReferrals: number;
  totalCompleted: number;
  totalRewards: number;
  topReferrers: Array<{ name: string; email: string; referral_count: number; completed_count: number }>;
};

export default function ReferralAnalytics() {
  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ["referral-admin-stats"],
    queryFn: () => api.get("/referral/admin/stats"),
    refetchInterval: 30000,
  });

  const conversionRate = stats && stats.totalReferrals > 0
    ? ((stats.totalCompleted / stats.totalReferrals) * 100).toFixed(1)
    : "0.0";

  const statCards = [
    { label: "Total Referrals", value: stats?.totalReferrals ?? 0, icon: Users, color: "bg-blue-50 text-blue-600" },
    { label: "Completed (First Booking)", value: stats?.totalCompleted ?? 0, icon: TrendingUp, color: "bg-green-50 text-green-600" },
    { label: "Rewards Unlocked", value: stats?.totalRewards ?? 0, icon: Trophy, color: "bg-yellow-50 text-yellow-600" },
    { label: "Conversion Rate", value: `${conversionRate}%`, icon: Gift, color: "bg-orange-50 text-orange-600" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Referral Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">
          Track referral performance — 5 completions unlock 10% reward for referrers
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <div className={`inline-flex p-2 rounded-lg ${s.color.split(" ")[0]} mb-3`}>
              <s.icon size={18} className={s.color.split(" ")[1]} />
            </div>
            <div className="text-2xl font-bold text-gray-900">{isLoading ? "—" : s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* How it works banner */}
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
        <Gift size={20} className="text-orange-500 mt-0.5 flex-shrink-0" />
        <div>
          <div className="font-semibold text-orange-800">Referral Rules</div>
          <div className="text-sm text-orange-700 mt-1">
            Users share a unique referral code → referred friends sign up → complete their first booking/job → referrer's progress increments.
            After <strong>5 completions</strong>, referrer gets <strong>10% off</strong> their next booking (added to promo vault). Cycle resets automatically.
          </div>
        </div>
      </div>

      {/* Top Referrers */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Top Referrers Leaderboard</h2>
          <p className="text-xs text-gray-500 mt-0.5">Ranked by completed referrals</p>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
          </div>
        ) : !stats?.topReferrers?.length ? (
          <div className="text-center py-12 text-gray-400">
            <Gift size={40} className="mx-auto mb-3 opacity-30" />
            <p>No referral data yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {stats.topReferrers.map((r, i) => (
              <div key={r.email} className="px-6 py-4 flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                  i === 0 ? "bg-yellow-100 text-yellow-700" :
                  i === 1 ? "bg-gray-100 text-gray-600" :
                  i === 2 ? "bg-orange-100 text-orange-700" : "bg-blue-50 text-blue-600"
                }`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">{r.name || "—"}</div>
                  <div className="text-xs text-gray-400 truncate">{r.email}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold text-gray-900">{r.completed_count} completed</div>
                  <div className="text-xs text-gray-400">{r.referral_count} referred</div>
                </div>
                <div className="w-24 ml-2 hidden sm:block">
                  <div className="text-xs text-gray-400 mb-1">
                    {r.referral_count > 0 ? Math.round((r.completed_count / r.referral_count) * 100) : 0}% conv.
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-400 rounded-full"
                      style={{ width: `${r.referral_count > 0 ? Math.min(100, Math.round((r.completed_count / r.referral_count) * 100)) : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Program Settings Note */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-600">
        <strong className="text-gray-800">Program Config:</strong> Threshold = 5 friends · Reward = 10% off next booking ·
        Rewards expire in 30 days · Anti-fraud: self-referrals and duplicate codes blocked.
      </div>
    </div>
  );
}
