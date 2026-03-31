import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  CircleDollarSign, Search, TrendingUp, TrendingDown, Minus,
  ArrowUpDown, Filter, Users, ChevronDown, BarChart3, IndianRupee,
  RefreshCw, ArrowUp, ArrowDown,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(v: number) { return `₹${Number(v).toLocaleString("en-IN")}`; }
function pctColor(diff: number) {
  if (diff > 5) return "text-red-500";
  if (diff < -5) return "text-green-600";
  return "text-gray-500";
}
function pctBg(diff: number) {
  if (diff > 5) return "bg-red-50 text-red-600";
  if (diff < -5) return "bg-green-50 text-green-700";
  return "bg-gray-100 text-gray-600";
}
function timeAgo(d: string) {
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

const CATEGORY_LABELS: Record<string, string> = {
  services: "Services", professions: "Professions", equipment: "Equipment",
};
const ALL_CATEGORIES = ["all", "services", "professions", "equipment"];

// ── Insight Card ──────────────────────────────────────────────────────────────
function InsightCard({ row }: { row: any }) {
  const diff = Number(row.avg_diff_pct);
  const Icon = diff > 5 ? TrendingUp : diff < -5 ? TrendingDown : Minus;
  const iconColor = diff > 5 ? "text-red-500" : diff < -5 ? "text-green-600" : "text-gray-400";
  const catLabel = CATEGORY_LABELS[row.category] ?? row.category;
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{catLabel}</p>
          <p className="text-sm font-bold text-gray-900 mt-0.5">{row.subcategory}</p>
        </div>
        <Icon size={18} className={iconColor} />
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-orange-50 rounded-xl py-2 px-1">
          <p className="text-[10px] text-orange-500 font-semibold">Avg Ask</p>
          <p className="text-sm font-black text-orange-700">{fmt(Number(row.avg_price))}</p>
        </div>
        <div className="bg-gray-50 rounded-xl py-2 px-1">
          <p className="text-[10px] text-gray-400 font-semibold">Min</p>
          <p className="text-sm font-black text-gray-700">{fmt(Number(row.min_price))}</p>
        </div>
        <div className="bg-gray-50 rounded-xl py-2 px-1">
          <p className="text-[10px] text-gray-400 font-semibold">Max</p>
          <p className="text-sm font-black text-gray-700">{fmt(Number(row.max_price))}</p>
        </div>
      </div>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
        <span className="text-xs text-gray-400">{Number(row.count)} providers</span>
        {Number(row.avg_admin_price) > 0 && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pctBg(diff)}`}>
            {diff >= 0 ? "+" : ""}{diff.toFixed(1)}% vs admin
          </span>
        )}
      </div>
    </div>
  );
}

// ── Filters bar ───────────────────────────────────────────────────────────────
function Select({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 bg-white outline-none focus:border-orange-400 cursor-pointer pr-8"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ProviderPrices() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("date_desc");
  const [insightCat, setInsightCat] = useState("all");

  const params = new URLSearchParams({ sort });
  if (category !== "all") params.set("category", category);
  if (search.trim()) params.set("search", search.trim());

  const { data: records = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["provider-prices", category, sort, search],
    queryFn: () => api.get(`/admin/provider-prices?${params}`),
  });

  const { data: insights = [] } = useQuery<any[]>({
    queryKey: ["provider-price-insights"],
    queryFn: () => api.get("/admin/provider-price-insights"),
    staleTime: 60_000,
  });

  const filteredInsights = useMemo(() =>
    insightCat === "all" ? insights : insights.filter((i: any) => i.category === insightCat),
    [insights, insightCat]
  );

  // Stats from records
  const stats = useMemo(() => {
    if (!records.length) return null;
    const prices = records.map((r: any) => Number(r.provider_price));
    const above = records.filter((r: any) => Number(r.difference_percent) > 5).length;
    const below = records.filter((r: any) => Number(r.difference_percent) < -5).length;
    return {
      total: records.length,
      avgPrice: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
      maxPrice: Math.max(...prices),
      above, below,
    };
  }, [records]);

  const sortOptions = [
    { value: "date_desc", label: "Newest First" },
    { value: "date_asc", label: "Oldest First" },
    { value: "price_desc", label: "Price: High → Low" },
    { value: "price_asc", label: "Price: Low → High" },
    { value: "diff_desc", label: "Biggest Difference" },
    { value: "diff_asc", label: "Closest to Admin" },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center shadow-md">
            <CircleDollarSign size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900">Provider Prices</h1>
            <p className="text-sm text-gray-500 mt-0.5">Market reference data from providers — never shown to customers</p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Stat strip */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Records", value: stats.total, icon: Users, bg: "bg-blue-50", color: "text-blue-600" },
            { label: "Average Ask Price", value: fmt(stats.avgPrice), icon: IndianRupee, bg: "bg-orange-50", color: "text-orange-600" },
            { label: "Above Admin Price", value: `${stats.above} providers`, icon: ArrowUp, bg: "bg-red-50", color: "text-red-600" },
            { label: "Below Admin Price", value: `${stats.below} providers`, icon: ArrowDown, bg: "bg-green-50", color: "text-green-700" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center`}>
                <s.icon size={18} className={s.color} />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">{s.label}</p>
                <p className="text-sm font-black text-gray-900 mt-0.5">{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Insights section */}
      {insights.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <BarChart3 size={18} className="text-orange-500" />
              <span className="font-bold text-gray-900">Market Insights</span>
              <span className="text-xs text-gray-400 ml-1">Category-wise provider price trends</span>
            </div>
            <div className="flex gap-2">
              {["all", "services", "professions", "equipment"].map(c => (
                <button
                  key={c}
                  onClick={() => setInsightCat(c)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    insightCat === c
                      ? "bg-orange-500 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {c === "all" ? "All" : CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {filteredInsights.map((row: any) => (
              <InsightCard key={`${row.category}-${row.subcategory}`} row={row} />
            ))}
            {filteredInsights.length === 0 && (
              <div className="col-span-full flex items-center justify-center py-10 text-gray-400">
                <p className="text-sm">No provider pricing data yet</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-48 relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search provider name or type..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-orange-400"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={15} className="text-gray-400" />
            <Select
              value={category}
              options={ALL_CATEGORIES.map(c => ({ value: c, label: c === "all" ? "All Categories" : CATEGORY_LABELS[c] }))}
              onChange={setCategory}
            />
            <Select
              value={sort}
              options={sortOptions}
              onChange={setSort}
            />
          </div>
          <span className="text-xs text-gray-400 ml-auto">{records.length} records</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw size={24} className="animate-spin text-orange-400" />
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <CircleDollarSign size={40} className="mb-3 text-gray-200" />
            <p className="text-sm font-semibold">No provider price data yet</p>
            <p className="text-xs mt-1 text-gray-300">Prices will appear here as providers create listings</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {["Provider", "Category", "Type", "Provider Price", "Admin Price", "Difference", "Date"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {records.map((r: any) => {
                  const diff = Number(r.difference_percent);
                  const hasAdmin = Number(r.admin_price_snapshot) > 0;
                  return (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 text-xs font-bold flex-shrink-0">
                            {(r.provider_name || "?")[0].toUpperCase()}
                          </div>
                          <span className="text-sm font-semibold text-gray-900 truncate max-w-32">{r.provider_name || "—"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium capitalize text-gray-600 bg-gray-100 px-2 py-1 rounded-lg">
                          {CATEGORY_LABELS[r.category] ?? r.category}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-700 font-medium">{r.subcategory || "—"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-bold text-gray-900">{fmt(Number(r.provider_price))}</span>
                      </td>
                      <td className="px-4 py-3">
                        {hasAdmin ? (
                          <span className="text-sm font-bold text-blue-700">{fmt(Number(r.admin_price_snapshot))}</span>
                        ) : (
                          <span className="text-xs text-gray-400">Not set</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {hasAdmin ? (
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${pctBg(diff)}`}>
                            {diff >= 0 ? "+" : ""}{diff.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-400">{timeAgo(r.created_at)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-gray-400 pb-2">
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-400" /> Provider asking more than admin price (&gt;5%)</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-400" /> Provider asking less than admin price (&gt;5%)</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-gray-300" /> Within 5% of admin price</div>
      </div>
    </div>
  );
}
