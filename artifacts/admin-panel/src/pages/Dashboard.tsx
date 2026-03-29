import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import {
  Users, Package, CalendarDays, IndianRupee,
  FileCheck, AlertTriangle, Clock, XCircle, RefreshCw, ArrowRight
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface DashboardData {
  stats: {
    totalUsers: number; totalCustomers: number; totalProviders: number;
    totalListings: number; totalBookings: number; pendingBookings: number;
    completedBookings: number; cancelledBookings: number;
    totalRevenue: number; pendingDocs: number; pendingReports: number;
  };
  dailyEarnings: { date: string; amount: number }[];
  recentUsers: any[];
  recentBookings: any[];
}

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

function StatCard({ icon: Icon, label, value, sub, color, href }: any) {
  const [, navigate] = useLocation();
  return (
    <button
      onClick={() => href && navigate(href)}
      className={`bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-left w-full transition-all hover:shadow-md hover:-translate-y-0.5 ${href ? "cursor-pointer group" : ""}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500 font-medium">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
      {href && (
        <div className="flex items-center gap-1 mt-3 text-xs font-medium text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity">
          View all <ArrowRight size={12} />
        </div>
      )}
    </button>
  );
}

export default function Dashboard() {
  const [, navigate] = useLocation();
  const { data, isLoading, refetch } = useQuery<DashboardData>({
    queryKey: ["admin-dashboard"],
    queryFn: () => api.get("/admin/dashboard"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw size={24} className="animate-spin text-orange-500" />
      </div>
    );
  }

  const s = data?.stats;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Welcome back · Real-time platform overview</p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* Primary stats — all clickable */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Users" value={s?.totalUsers ?? 0}
          sub={`${s?.totalCustomers ?? 0} customers · ${s?.totalProviders ?? 0} providers`}
          color="bg-blue-500" href="/users" />
        <StatCard icon={Package} label="Total Listings" value={s?.totalListings ?? 0}
          sub="Active across all categories" color="bg-violet-500" href="/listings" />
        <StatCard icon={CalendarDays} label="Total Bookings" value={s?.totalBookings ?? 0}
          sub={`${s?.completedBookings ?? 0} completed`} color="bg-orange-500" href="/bookings" />
        <StatCard icon={IndianRupee} label="Total Revenue"
          value={`₹${((s?.totalRevenue ?? 0) / 1000).toFixed(1)}K`}
          sub="From paid bookings" color="bg-green-500" />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Clock} label="Pending Bookings" value={s?.pendingBookings ?? 0}
          sub="Awaiting confirmation" color="bg-amber-500" href="/bookings" />
        <StatCard icon={XCircle} label="Cancelled" value={s?.cancelledBookings ?? 0}
          sub="Total cancellations" color="bg-red-500" href="/bookings" />
        <StatCard icon={FileCheck} label="Pending Docs" value={s?.pendingDocs ?? 0}
          sub="Verification required" color="bg-teal-500" href="/documents" />
        <StatCard icon={AlertTriangle} label="Open Reports" value={s?.pendingReports ?? 0}
          sub="Safety reports pending" color="bg-rose-500" href="/reports" />
      </div>

      {/* Chart + Recent Bookings */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-base font-bold text-gray-900 mb-4">Daily Earnings (Last 7 Days)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data?.dailyEarnings || []} barSize={36}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false}
                tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
              <Tooltip formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Revenue"]}
                contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }} />
              <Bar dataKey="amount" fill="#FF7A18" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-gray-900">Recent Bookings</h2>
            <button onClick={() => navigate("/bookings")} className="text-xs text-orange-500 hover:underline font-medium flex items-center gap-1">
              View all <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-2">
            {(data?.recentBookings || []).map((b: any) => (
              <button
                key={b.id}
                onClick={() => navigate("/bookings")}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors text-left group"
              >
                <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                  <CalendarDays size={14} className="text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">#{b.id.slice(-8)}</div>
                  <div className="text-xs text-gray-500">₹{b.totalAmount?.toLocaleString("en-IN")}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${STATUS_COLOR[b.status] || "bg-gray-100 text-gray-600"}`}>
                  {b.status}
                </span>
              </button>
            ))}
            {!data?.recentBookings?.length && <p className="text-sm text-gray-400 text-center py-4">No bookings yet</p>}
          </div>
        </div>
      </div>

      {/* Recent Users — clickable rows */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-900">Recently Joined Users</h2>
          <button onClick={() => navigate("/users")} className="text-xs text-orange-500 hover:underline font-medium flex items-center gap-1">
            View all <ArrowRight size={12} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-gray-100">
                <th className="pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">User</th>
                <th className="pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                <th className="pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                <th className="pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Joined</th>
                <th className="pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recentUsers || []).map((u: any) => (
                <tr
                  key={u.id}
                  onClick={() => navigate("/users")}
                  className="border-b border-gray-50 hover:bg-orange-50/40 transition-colors cursor-pointer group"
                >
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-xs font-bold">
                        {u.name?.[0]?.toUpperCase() || "?"}
                      </div>
                      <span className="text-sm font-medium text-gray-900 group-hover:text-orange-600 transition-colors">{u.name || "Unknown"}</span>
                    </div>
                  </td>
                  <td className="py-3 text-sm text-gray-500">{u.email || "—"}</td>
                  <td className="py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.role === "provider" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3 text-sm text-gray-500">
                    {new Date(u.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </td>
                  <td className="py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.isSuspended ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                      {u.isSuspended ? "Suspended" : "Active"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data?.recentUsers?.length && <p className="text-sm text-gray-400 text-center py-6">No users found</p>}
        </div>
      </div>
    </div>
  );
}
