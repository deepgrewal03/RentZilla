import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Search, RefreshCw, ChevronLeft, ChevronRight, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
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

const UNIT_LABEL: Record<string, string> = {
  per_day: "/day",
  per_hour: "/hr",
};

export default function Listings() {
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Listings</h1>
        <p className="text-gray-500 text-sm mt-0.5">{data?.total || 0} total listings</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <form className="flex gap-2 flex-1" onSubmit={e => { e.preventDefault(); setSearch(searchInput); setPage(1); }}>
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
              placeholder="Search listings..." className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-orange-400" />
          </div>
          <button type="submit" className="px-4 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600">Search</button>
        </form>
        <select value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}
          className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none">
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
                {["Listing", "Category", "Price", "Location", "Listed", "Status", "Actions"].map(h => (
                  <th key={h} className="px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">
                  <RefreshCw size={20} className="animate-spin mx-auto mb-2" />Loading...
                </td></tr>
              ) : data?.listings.map(l => (
                <tr key={l.id} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      {l.images?.[0] ? (
                        <img src={l.images[0]} className="w-10 h-10 rounded-xl object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 text-lg">📦</div>
                      )}
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{l.title}</div>
                        <div className="text-xs text-gray-400">{l.subcategory || "—"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${CAT_COLOR[l.category] || "bg-gray-100 text-gray-600"}`}>
                      {l.category}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="text-sm font-bold text-gray-900">₹{l.price.toLocaleString("en-IN")}</div>
                    <div className="text-xs text-gray-400">{UNIT_LABEL[l.priceUnit] || l.priceUnit}</div>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600">{l.location}</td>
                  <td className="px-5 py-4 text-sm text-gray-500">
                    {new Date(l.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${l.isAvailable ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {l.isAvailable ? "Available" : "Unlisted"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
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
                </tr>
              ))}
              {!isLoading && !data?.listings.length && (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">No listings found</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
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
    </div>
  );
}
