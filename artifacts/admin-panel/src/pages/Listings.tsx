import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Search, RefreshCw, ChevronLeft, ChevronRight,
  ToggleLeft, ToggleRight, Trash2, X,
  MapPin, CalendarDays, Star, User, Image as ImageIcon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Listing {
  id: string; providerId: string; title: string; category: string;
  subcategory: string | null; price: number; priceUnit: string;
  location: string; isAvailable: boolean; images: string[]; createdAt: string;
}

const CAT_COLOR: Record<string, string> = {
  cars: "bg-blue-100 text-blue-700",
  equipment: "bg-amber-100 text-amber-700",
  services: "bg-violet-100 text-violet-700",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const UNIT_LABEL: Record<string, string> = { per_day: "/day", per_hour: "/hr" };

// ── Listing Detail Modal ──────────────────────────────────────────────────────
function ListingDetailModal({ listingId, onClose }: { listingId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{
    listing: any; provider: any; stats: any; recentBookings: any[];
  }>({
    queryKey: ["admin-listing-detail", listingId],
    queryFn: () => api.get(`/admin/listings/${listingId}`),
  });

  const toggleMutation = useMutation({
    mutationFn: (isAvailable: boolean) => api.patch(`/admin/listings/${listingId}`, { isAvailable }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-listings"] });
      qc.invalidateQueries({ queryKey: ["admin-listing-detail", listingId] });
      toast({ title: "Listing updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/admin/listings/${listingId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-listings"] });
      toast({ title: "Listing deleted" });
      onClose();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const l = data?.listing;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl animate-fadeIn max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-900">Listing Details</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition-colors"><X size={18} /></button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw size={24} className="animate-spin text-orange-500" />
          </div>
        ) : l ? (
          <div className="overflow-y-auto flex-1">
            {/* Image preview */}
            {l.images?.length > 0 ? (
              <div className="flex gap-2 px-6 pt-5 overflow-x-auto pb-2">
                {l.images.slice(0, 4).map((img: string, i: number) => (
                  <img key={i} src={img} alt={`img-${i}`} className="w-28 h-20 rounded-xl object-cover flex-shrink-0 border border-gray-100" />
                ))}
                {l.images.length > 4 && (
                  <div className="w-28 h-20 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 text-gray-400 text-sm font-medium">
                    +{l.images.length - 4}
                  </div>
                )}
              </div>
            ) : (
              <div className="mx-6 mt-5 h-20 rounded-xl bg-gray-50 flex items-center justify-center text-gray-300">
                <ImageIcon size={32} />
              </div>
            )}

            {/* Main info */}
            <div className="px-6 py-4 border-b border-gray-50">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{l.title}</h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${CAT_COLOR[l.category] || "bg-gray-100 text-gray-600"}`}>
                      {l.category}
                    </span>
                    {l.subcategory && <span className="text-xs text-gray-500">{l.subcategory}</span>}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${l.isAvailable ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {l.isAvailable ? "Available" : "Unlisted"}
                    </span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-2xl font-bold text-orange-500">₹{l.price?.toLocaleString("en-IN")}</div>
                  <div className="text-xs text-gray-500">{UNIT_LABEL[l.priceUnit] || l.priceUnit}</div>
                </div>
              </div>
              <div className="flex items-center gap-1 mt-2 text-sm text-gray-500">
                <MapPin size={13} /> {l.location}
              </div>
              {l.description && <p className="mt-2 text-sm text-gray-600 leading-relaxed">{l.description}</p>}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
              <div className="px-6 py-4 text-center">
                <div className="text-2xl font-bold text-gray-900">{data?.stats?.totalBookings ?? 0}</div>
                <div className="text-xs text-gray-500 mt-0.5">Bookings</div>
              </div>
              <div className="px-6 py-4 text-center">
                <div className="flex items-center justify-center gap-1">
                  <Star size={16} className="text-amber-400 fill-amber-400" />
                  <span className="text-2xl font-bold text-gray-900">{data?.stats?.totalReviews ?? 0}</span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">Reviews</div>
              </div>
              <div className="px-6 py-4 text-center">
                <div className="text-xs text-gray-500 mt-1">Listed</div>
                <div className="text-sm font-semibold text-gray-900">
                  {new Date(l.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </div>
              </div>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Provider */}
              {data?.provider && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <User size={15} className="text-orange-500" />
                    <h4 className="text-sm font-bold text-gray-900">Provider</h4>
                  </div>
                  <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                      {data.provider.name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{data.provider.name}</div>
                      <div className="text-xs text-gray-500">{data.provider.email || data.provider.phone}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Recent bookings */}
              {(data?.recentBookings?.length ?? 0) > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <CalendarDays size={15} className="text-orange-500" />
                    <h4 className="text-sm font-bold text-gray-900">Recent Bookings</h4>
                  </div>
                  <div className="space-y-2">
                    {data!.recentBookings.map((b: any) => (
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

              {/* Actions */}
              <div className="flex gap-3 pb-1">
                <button
                  onClick={() => toggleMutation.mutate(!l.isAvailable)}
                  disabled={toggleMutation.isPending}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
                    l.isAvailable ? "bg-gray-100 hover:bg-gray-200 text-gray-700" : "bg-green-500 hover:bg-green-600 text-white"
                  }`}
                >
                  {l.isAvailable ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                  {l.isAvailable ? "Unlist" : "Make Available"}
                </button>
                <button
                  onClick={() => { if (confirm("Permanently delete this listing?")) deleteMutation.mutate(); }}
                  disabled={deleteMutation.isPending}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-red-50 hover:bg-red-100 text-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <Trash2 size={15} /> Delete
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-gray-500">Listing not found</div>
        )}
      </div>
    </div>
  );
}

// ── Listings Page ─────────────────────────────────────────────────────────────
export default function Listings() {
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ listings: Listing[]; total: number }>({
    queryKey: ["admin-listings", page, category, search],
    queryFn: () => {
      const p = new URLSearchParams({ page: String(page), limit: "15" });
      if (category) p.set("category", category);
      if (search) p.set("q", search);
      return api.get(`/admin/listings?${p}`);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isAvailable }: { id: string; isAvailable: boolean }) =>
      api.patch(`/admin/listings/${id}`, { isAvailable }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-listings"] }); toast({ title: "Listing updated" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/listings/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-listings"] }); toast({ title: "Listing deleted" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const totalPages = Math.ceil((data?.total || 0) / 15);

  return (
    <div className="space-y-5 animate-fadeIn">
      {selectedId && <ListingDetailModal listingId={selectedId} onClose={() => setSelectedId(null)} />}

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Listings</h1>
        <p className="text-gray-500 text-sm mt-0.5">{data?.total || 0} total listings · click any row to view details</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <form className="flex gap-2 flex-1" onSubmit={e => { e.preventDefault(); setSearch(searchInput); setPage(1); }}>
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
              placeholder="Search listings..." className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-orange-400" />
          </div>
          <button type="submit" className="px-4 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600 transition-colors">Search</button>
        </form>
        <select value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}
          className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none cursor-pointer">
          <option value="">All Categories</option>
          <option value="cars">Cars</option>
          <option value="equipment">Equipment</option>
          <option value="services">Services</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left">
                {["Listing", "Category", "Provider ID", "Price", "Location", "Status", "Actions", ""].map((h, i) => (
                  <th key={i} className="px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">
                  <RefreshCw size={20} className="animate-spin mx-auto mb-2" /> Loading...
                </td></tr>
              ) : (data?.listings || []).map(l => (
                <tr
                  key={l.id}
                  className="border-t border-gray-50 hover:bg-orange-50/40 transition-colors cursor-pointer group"
                  onClick={() => setSelectedId(l.id)}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      {l.images?.[0] ? (
                        <img src={l.images[0]} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0 border border-gray-100" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <ImageIcon size={16} className="text-gray-400" />
                        </div>
                      )}
                      <div className="text-sm font-semibold text-gray-900 group-hover:text-orange-600 transition-colors">{l.title}</div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${CAT_COLOR[l.category] || "bg-gray-100 text-gray-600"}`}>
                      {l.category}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-xs text-gray-400 font-mono">{l.providerId.slice(-10)}…</td>
                  <td className="px-5 py-4 text-sm font-bold text-gray-900">
                    ₹{l.price.toLocaleString("en-IN")}
                    <span className="text-xs text-gray-400 font-normal ml-1">{UNIT_LABEL[l.priceUnit] || l.priceUnit}</span>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600">{l.location}</td>
                  <td className="px-5 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${l.isAvailable ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {l.isAvailable ? "Available" : "Unlisted"}
                    </span>
                  </td>
                  <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleMutation.mutate({ id: l.id, isAvailable: !l.isAvailable })}
                        className={`p-1.5 rounded-lg transition-colors ${l.isAvailable ? "text-green-500 hover:bg-green-50" : "text-gray-400 hover:bg-gray-100"}`}
                        title={l.isAvailable ? "Unlist" : "List"}
                      >
                        {l.isAvailable ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                      </button>
                      <button
                        onClick={() => { if (confirm("Delete this listing?")) deleteMutation.mutate(l.id); }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs text-orange-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">View →</span>
                  </td>
                </tr>
              ))}
              {!isLoading && !(data?.listings || []).length && (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">No listings found</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
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
    </div>
  );
}
