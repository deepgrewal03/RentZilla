import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Search, UserX, UserCheck, RefreshCw, ChevronLeft, ChevronRight,
  X, Phone, Mail, MapPin, Calendar, Package, CalendarDays, Shield, Trophy,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: string; name: string; email: string | null; phone: string;
  role: string; location: string | null; isAdmin: boolean;
  isSuspended: boolean; adminNotes: string | null; createdAt: string;
  isGoldMember?: boolean;
}

const ROLE_COLOR: Record<string, string> = {
  provider: "bg-purple-100 text-purple-700",
  customer: "bg-blue-100 text-blue-700",
  admin: "bg-orange-100 text-orange-700",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

// ── User Detail Modal ─────────────────────────────────────────────────────────
function UserDetailModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [notes, setNotes] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ user: User; bookings: any[]; listings: any[] }>({
    queryKey: ["admin-user-detail", userId],
    queryFn: () => api.get(`/admin/users/${userId}`),
  });

  const user = data?.user;
  const currentNotes = notes ?? (user?.adminNotes || "");

  const updateMutation = useMutation({
    mutationFn: (payload: any) => api.patch(`/admin/users/${userId}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-user-detail", userId] });
      toast({ title: "User updated successfully" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl animate-fadeIn max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-900">User Details</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition-colors"><X size={18} /></button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw size={24} className="animate-spin text-orange-500" />
          </div>
        ) : user ? (
          <div className="overflow-y-auto flex-1">
            {/* Profile */}
            <div className="px-6 py-5 border-b border-gray-50">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                  {user.name?.[0]?.toUpperCase() || "?"}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-bold text-gray-900">{user.name}</h3>
                    {user.isAdmin && (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-semibold">
                        <Shield size={10} /> Super Admin
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${ROLE_COLOR[user.role] || "bg-gray-100 text-gray-600"}`}>
                      {user.role}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${user.isSuspended ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                      {user.isSuspended ? "Suspended" : "Active"}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-500">
                    {user.email && <span className="flex items-center gap-1"><Mail size={13} /> {user.email}</span>}
                    {user.phone && <span className="flex items-center gap-1"><Phone size={13} /> {user.phone}</span>}
                    {user.location && <span className="flex items-center gap-1"><MapPin size={13} /> {user.location}</span>}
                    <span className="flex items-center gap-1"><Calendar size={13} /> Joined {new Date(user.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
              <div className="px-6 py-4 text-center">
                <div className="text-2xl font-bold text-gray-900">{data?.bookings?.length ?? 0}</div>
                <div className="text-xs text-gray-500 mt-0.5">Bookings</div>
              </div>
              <div className="px-6 py-4 text-center">
                <div className="text-2xl font-bold text-gray-900">{data?.listings?.length ?? 0}</div>
                <div className="text-xs text-gray-500 mt-0.5">Listings</div>
              </div>
              <div className="px-6 py-4 text-center">
                <div className="text-2xl font-bold text-gray-900">
                  ₹{(data?.bookings?.reduce((s: number, b: any) => s + (b.totalAmount || 0), 0) || 0).toLocaleString("en-IN")}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">Total Spent</div>
              </div>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Bookings */}
              {(data?.bookings?.length ?? 0) > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <CalendarDays size={15} className="text-orange-500" />
                    <h4 className="text-sm font-bold text-gray-900">Recent Bookings</h4>
                  </div>
                  <div className="space-y-2">
                    {(data?.bookings || []).slice(0, 5).map((b: any) => (
                      <div key={b.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                        <div>
                          <div className="text-sm font-medium text-gray-900">#{b.id.slice(-8)}</div>
                          <div className="text-xs text-gray-500">{b.startDate} → {b.endDate}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-gray-900">₹{b.totalAmount?.toLocaleString("en-IN")}</div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[b.status] || "bg-gray-100 text-gray-600"}`}>
                            {b.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Listings */}
              {(data?.listings?.length ?? 0) > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Package size={15} className="text-orange-500" />
                    <h4 className="text-sm font-bold text-gray-900">Listings</h4>
                  </div>
                  <div className="space-y-2">
                    {(data?.listings || []).slice(0, 5).map((l: any) => (
                      <div key={l.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{l.title}</div>
                          <div className="text-xs text-gray-500">{l.location}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-gray-900">₹{l.price?.toLocaleString("en-IN")}</div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${l.isAvailable ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                            {l.isAvailable ? "Live" : "Unlisted"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Admin Notes */}
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Admin Notes</label>
                <textarea
                  value={currentNotes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-orange-400 resize-none"
                  placeholder="Add private notes about this user..."
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pb-1">
                <button
                  onClick={() => updateMutation.mutate({ isSuspended: !user.isSuspended, adminNotes: currentNotes })}
                  disabled={updateMutation.isPending || user.isAdmin}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
                    user.isSuspended
                      ? "bg-green-500 hover:bg-green-600 text-white"
                      : "bg-red-50 hover:bg-red-100 text-red-600"
                  }`}
                >
                  {user.isSuspended ? <UserCheck size={15} /> : <UserX size={15} />}
                  {user.isSuspended ? "Unsuspend User" : "Suspend User"}
                </button>
                <button
                  onClick={() => updateMutation.mutate({ adminNotes: currentNotes })}
                  disabled={updateMutation.isPending}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white transition-colors disabled:opacity-50"
                >
                  Save Notes
                </button>
              </div>
              {user.isAdmin && <p className="text-xs text-gray-400 text-center -mt-2">Super admin accounts cannot be suspended</p>}
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-gray-500">User not found</div>
        )}
      </div>
    </div>
  );
}

// ── Users Page ────────────────────────────────────────────────────────────────
export default function Users() {
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ users: User[]; total: number }>({
    queryKey: ["admin-users", page, roleFilter, search],
    queryFn: () => {
      const p = new URLSearchParams({ page: String(page), limit: "20" });
      if (roleFilter) p.set("role", roleFilter);
      if (search) p.set("q", search);
      return api.get(`/admin/users?${p}`);
    },
  });

  const totalPages = Math.ceil((data?.total || 0) / 20);

  return (
    <div className="space-y-5 animate-fadeIn">
      {selectedUserId && <UserDetailModal userId={selectedUserId} onClose={() => setSelectedUserId(null)} />}

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <p className="text-gray-500 text-sm mt-0.5">{data?.total || 0} total users · click any row to view details</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form className="flex gap-2 flex-1" onSubmit={e => { e.preventDefault(); setSearch(searchInput); setPage(1); }}>
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
              placeholder="Search name, email or phone..." className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-orange-400" />
          </div>
          <button type="submit" className="px-4 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors">Search</button>
        </form>
        <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
          className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none cursor-pointer">
          <option value="">All Roles</option>
          <option value="customer">Customers</option>
          <option value="provider">Providers</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left">
                {["User", "Email", "Phone", "Role", "Location", "Joined", "Status", ""].map((h, i) => (
                  <th key={i} className="px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">
                  <RefreshCw size={20} className="animate-spin mx-auto mb-2" /> Loading...
                </td></tr>
              ) : (data?.users || []).map(u => (
                <tr
                  key={u.id}
                  onClick={() => setSelectedUserId(u.id)}
                  className="border-t border-gray-50 hover:bg-orange-50/40 transition-colors cursor-pointer group"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {u.name?.[0]?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-semibold text-gray-900 group-hover:text-orange-600 transition-colors">{u.name || "—"}</span>
                          {u.isGoldMember && <Trophy size={12} className="text-yellow-500 flex-shrink-0" {...({ title: "Gold Member" } as any)} />}
                        </div>
                        {u.isAdmin && <div className="text-xs text-orange-500 font-medium">Admin</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600">{u.email || "—"}</td>
                  <td className="px-5 py-4 text-sm text-gray-600">{u.phone || "—"}</td>
                  <td className="px-5 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${ROLE_COLOR[u.role] || "bg-gray-100 text-gray-600"}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600">{u.location || "—"}</td>
                  <td className="px-5 py-4 text-sm text-gray-500">
                    {new Date(u.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" })}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${u.isSuspended ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                      {u.isSuspended ? "Suspended" : "Active"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs text-orange-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">View →</span>
                  </td>
                </tr>
              ))}
              {!isLoading && !(data?.users || []).length && (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">Page {page} of {totalPages} · {data?.total} users</p>
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
    </div>
  );
}
