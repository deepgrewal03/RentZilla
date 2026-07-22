import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  Shield, AlertTriangle, RefreshCw, User, TrendingUp, CheckCircle2,
  X, AlertCircle, Info, ChevronDown, Scan, Ban
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface FraudFactor {
  code: string;
  label: string;
  points: number;
  severity: "info" | "warn" | "danger" | "critical";
}

interface FraudUser {
  user_id?: string;
  userId?: string;
  name?: string;
  email?: string;
  profile_image?: string;
  role?: string;
  is_suspended?: boolean;
  score: number;
  risk_level: "low" | "medium" | "high" | "critical";
  riskLevel?: "low" | "medium" | "high" | "critical";
  factors: FraudFactor[];
  computed_at?: string;
  computedAt?: string;
  user_created_at?: string;
}

const RISK_META = {
  low:      { label: "Low Risk",      color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", bar: "bg-emerald-500", emoji: "🟢" },
  medium:   { label: "Medium Risk",   color: "text-yellow-600",  bg: "bg-yellow-50",  border: "border-yellow-200",  bar: "bg-yellow-500",  emoji: "🟡" },
  high:     { label: "High Risk",     color: "text-orange-600",  bg: "bg-orange-50",  border: "border-orange-200",  bar: "bg-orange-500",  emoji: "🔶" },
  critical: { label: "Critical Risk", color: "text-red-600",     bg: "bg-red-50",     border: "border-red-200",     bar: "bg-red-600",     emoji: "🔴" },
};

const FACTOR_META = {
  info:     { color: "text-blue-600",   bg: "bg-blue-50",   icon: Info },
  warn:     { color: "text-amber-600",  bg: "bg-amber-50",  icon: AlertCircle },
  danger:   { color: "text-orange-600", bg: "bg-orange-50", icon: AlertTriangle },
  critical: { color: "text-red-600",    bg: "bg-red-50",    icon: AlertTriangle },
};

function ScoreBar({ score }: { score: number }) {
  const level = score >= 70 ? "critical" : score >= 45 ? "high" : score >= 20 ? "medium" : "low";
  const meta = RISK_META[level];
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-gray-700">Risk Score</span>
        <span className={`text-sm font-black ${meta.color}`}>{score}/100</span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${meta.bar}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function UserDetail({ user, onClose }: { user: FraudUser; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const uid = user.user_id ?? user.userId ?? "";
  const level = user.risk_level ?? user.riskLevel ?? "low";
  const meta = RISK_META[level];

  const { data: fresh, isLoading } = useQuery<FraudUser>({
    queryKey: ["fraud-detail", uid],
    queryFn: () => api.get(`/admin/fraud/score/${uid}`),
  });

  const display = fresh ?? user;
  const displayLevel = display.risk_level ?? display.riskLevel ?? "low";
  const displayMeta = RISK_META[displayLevel];
  const factors: FraudFactor[] = display.factors ?? [];

  async function suspendUser() {
    if (!confirm(`Suspend ${user.name}? They won't be able to book or list.`)) return;
    try {
      await api.patch(`/users/${uid}/suspend`, { suspended: true });
      toast({ title: "User suspended" });
      qc.invalidateQueries({ queryKey: ["fraud-users"] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className={`${displayMeta.bg} ${displayMeta.border} border-b px-5 py-4 flex items-center gap-3`}>
          <div className="w-12 h-12 rounded-xl bg-white shadow-sm overflow-hidden flex-shrink-0 flex items-center justify-center">
            {user.profile_image ? (
              <img src={user.profile_image} className="w-full h-full object-cover" />
            ) : (
              <User size={20} className="text-gray-400" />
            )}
          </div>
          <div className="flex-1">
            <div className="font-bold text-gray-900">{user.name ?? "Unknown"}</div>
            <div className="text-xs text-gray-500">{user.email}</div>
          </div>
          <div className={`text-3xl font-black ${displayMeta.color} mr-2`}>{display.score}</div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {/* Score bar */}
        <div className="px-5 py-4 border-b border-gray-100">
          <ScoreBar score={display.score ?? 0} />
          <div className="flex items-center gap-2 mt-3">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${displayMeta.bg} ${displayMeta.color} ${displayMeta.border} border`}>
              {displayMeta.emoji} {displayMeta.label}
            </span>
            {user.is_suspended && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                🚫 Suspended
              </span>
            )}
          </div>
        </div>

        {/* Factors */}
        <div className="px-5 py-4 max-h-64 overflow-y-auto space-y-2">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Risk Factors</div>
          {isLoading ? (
            <div className="text-center py-4 text-gray-400 text-sm">Computing score…</div>
          ) : factors.length === 0 ? (
            <div className="text-center py-4 text-gray-400 text-sm">No risk factors found</div>
          ) : (
            factors.map((f, i) => {
              const fm = FACTOR_META[f.severity] ?? FACTOR_META.info;
              const FactorIcon = fm.icon;
              return (
                <div key={i} className={`flex items-start gap-3 px-3 py-2.5 rounded-xl ${fm.bg}`}>
                  <FactorIcon size={14} className={`${fm.color} mt-0.5 flex-shrink-0`} />
                  <span className="flex-1 text-xs leading-relaxed text-gray-800">{f.label}</span>
                  <span className={`text-xs font-black ml-2 ${f.points < 0 ? "text-emerald-600" : fm.color}`}>
                    {f.points > 0 ? `+${f.points}` : f.points}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-semibold rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            Close
          </button>
          {!user.is_suspended && (
            <button
              onClick={suspendUser}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-colors"
            >
              <Ban size={14} />
              Suspend User
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FraudCenter() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [riskFilter, setRiskFilter] = useState("all");
  const [selected, setSelected] = useState<FraudUser | null>(null);

  const { data: users = [], isLoading, refetch } = useQuery<FraudUser[]>({
    queryKey: ["fraud-users", riskFilter],
    queryFn: () => api.get(`/admin/fraud/users?risk=${riskFilter}`),
    refetchInterval: 60_000,
  });

  const scanMutation = useMutation({
    mutationFn: () => api.post("/admin/fraud/scan", {}),
    onSuccess: (d: any) => {
      toast({ title: `Scanning ${d.scanning} users`, description: "Scores will refresh in ~30 seconds" });
      setTimeout(() => { qc.invalidateQueries({ queryKey: ["fraud-users"] }); refetch(); }, 15_000);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const criticalCount = users.filter(u => (u.risk_level ?? u.riskLevel) === "critical").length;
  const highCount = users.filter(u => (u.risk_level ?? u.riskLevel) === "high").length;
  const mediumCount = users.filter(u => (u.risk_level ?? u.riskLevel) === "medium").length;
  const lowCount = users.filter(u => (u.risk_level ?? u.riskLevel) === "low").length;
  const avgScore = users.length > 0 ? Math.round(users.reduce((s, u) => s + (u.score ?? 0), 0) / users.length) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fraud Center</h1>
          <p className="text-sm text-gray-500 mt-0.5">AI-powered risk scoring for all platform users</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            <Scan size={14} />
            {scanMutation.isPending ? "Scanning…" : "Scan All Users"}
          </button>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Critical", count: criticalCount, ...RISK_META.critical },
          { label: "High",     count: highCount,     ...RISK_META.high     },
          { label: "Medium",   count: mediumCount,   ...RISK_META.medium   },
          { label: "Low Risk", count: lowCount,      ...RISK_META.low      },
        ].map(s => (
          <div key={s.label} className={`${s.bg} ${s.border} border rounded-2xl p-4`}>
            <div className={`text-2xl font-black ${s.color}`}>{s.emoji} {s.count}</div>
            <div className="text-xs text-gray-500 font-medium mt-1">{s.label}</div>
          </div>
        ))}
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
          <div className="text-2xl font-black text-gray-700 flex items-center gap-1">
            <TrendingUp size={18} className="text-orange-500" />
            {avgScore}
          </div>
          <div className="text-xs text-gray-500 font-medium mt-1">Avg Score</div>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4">
        <div className="flex items-start gap-3">
          <Info size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-sm font-bold text-blue-800 mb-1">How Fraud Scoring Works</div>
            <div className="text-xs text-blue-700 leading-relaxed">
              Scores are computed automatically using rule-based signals: safety reports (+25–40), fraud holds (+30),
              high cancellation rates (+12–20), failed payments (+8–15), new unverified accounts (+8–15), and suspensions (+35).
              Trust signals reduce scores: verified ID (−15), verified selfie (−8), Gold membership (−5), completed bookings (−8 to −12).
              Scores 0–19 = Low, 20–44 = Medium, 45–69 = High, 70+ = Critical.
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {["all","critical","high","medium","low"].map(r => (
          <button
            key={r}
            onClick={() => setRiskFilter(r)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all capitalize ${
              riskFilter === r
                ? "bg-orange-500 text-white shadow-md shadow-orange-500/20"
                : "bg-white text-gray-600 border border-gray-200 hover:border-orange-300"
            }`}
          >
            {r === "all" ? "All Users" : r === "low" ? "Low Risk" : `${r.charAt(0).toUpperCase() + r.slice(1)} Risk`}
          </button>
        ))}
      </div>

      {/* User list */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center text-gray-400">
            <div className="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm">Computing fraud scores…</p>
          </div>
        ) : users.length === 0 ? (
          <div className="py-20 text-center text-gray-400">
            <Shield size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No scores yet</p>
            <p className="text-xs mt-1">Click "Scan All Users" to compute risk scores</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {/* Table header */}
            <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-gray-50 text-xs font-bold text-gray-400 uppercase tracking-wider">
              <div className="col-span-4">User</div>
              <div className="col-span-3">Risk Score</div>
              <div className="col-span-3">Risk Level</div>
              <div className="col-span-2">Factors</div>
            </div>
            {users.map(u => {
              const uid = u.user_id ?? u.userId ?? "";
              const level = u.risk_level ?? u.riskLevel ?? "low";
              const um = RISK_META[level];
              const factorCount = u.factors?.length ?? 0;
              const riskFactors = u.factors?.filter(f => f.points > 0) ?? [];

              return (
                <div
                  key={uid}
                  onClick={() => setSelected(u)}
                  className="grid grid-cols-12 gap-4 px-5 py-4 hover:bg-orange-50/40 cursor-pointer transition-colors items-center"
                >
                  <div className="col-span-4 flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                      {u.profile_image ? (
                        <img src={u.profile_image} className="w-full h-full object-cover" />
                      ) : (
                        <User size={16} className="text-gray-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 truncate">{u.name ?? "Unknown"}</div>
                      <div className="text-xs text-gray-400 truncate">{u.email}</div>
                    </div>
                  </div>
                  <div className="col-span-3">
                    <div className="flex items-center gap-2">
                      <div className={`text-lg font-black ${um.color}`}>{u.score}</div>
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${um.bar}`} style={{ width: `${u.score}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="col-span-3">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${um.bg} ${um.color} ${um.border} border`}>
                      {um.emoji} {um.label}
                    </span>
                    {u.is_suspended && (
                      <span className="ml-1.5 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">Suspended</span>
                    )}
                  </div>
                  <div className="col-span-2 flex items-center gap-1">
                    <span className={`text-xs font-bold ${riskFactors.length > 0 ? "text-orange-600" : "text-gray-400"}`}>
                      {riskFactors.length}
                    </span>
                    <span className="text-xs text-gray-400">flags</span>
                    <ChevronDown size={13} className="text-gray-400 ml-auto rotate-[-90deg]" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selected && <UserDetail user={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
