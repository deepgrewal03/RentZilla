import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  RefreshCw, ChevronLeft, ChevronRight, XCircle, X,
  User, Package, CalendarDays, IndianRupee, MapPin, Phone, Mail,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Booking {
  id: string; customerName: string; customerEmail: string | null;
  listingTitle: string; listingCategory: string; startDate: string;
  endDate: string; totalDays: number; totalAmount: number;
  status: string; paymentStatus: string; createdAt: string;
}

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const PAY_COLOR: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  paid: "bg-green-100 text-green-700",
  refunded: "bg-purple-100 text-purple-700",
};

const CAT_COLOR: Record<string, string> = {
  cars: "bg-blue-100 text-blue-700",
  equipment: "bg-amber-100 text-amber-700",
  services: "bg-violet-100 text-violet-700",
};

// ── Booking Detail Modal ──────────────────────────────────────────────────────
function BookingDetailModal({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{
    booking: any; customer: any; listing: any;
  }>({
    queryKey: ["admin-booking-detail", bookingId],
    queryFn: () => api.get(`/admin/bookings/${bookingId}`),
  });

  const updateMutation = useMutation({
    mutationFn: (status: string) => api.patch(`/admin/bookings/${bookingId}`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-bookings"] });
      qc.invalidateQueries({ queryKey: ["admin-booking-detail", bookingId] });
      toast({ title: "Booking updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const b = data?.booking;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl animate-fadeIn max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Booking Details</h2>
            {b && <p className="text-xs text-gray-400 font-mono">#{b.id}</p>}
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition-colors"><X size={18} /></button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw size={24} className="animate-spin text-orange-500" />
          </div>
        ) : b ? (
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
            {/* Status + payment */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`text-sm px-3 py-1.5 rounded-full font-semibold ${STATUS_COLOR[b.status] || "bg-gray-100 text-gray-600"}`}>
                {b.status.charAt(0).toUpperCase() + b.status.slice(1)}
              </span>
              <span className={`text-sm px-3 py-1.5 rounded-full font-semibold ${PAY_COLOR[b.paymentStatus] || "bg-gray-100 text-gray-600"}`}>
                Payment: {b.paymentStatus}
              </span>
              <span className="text-xs text-gray-400 ml-auto">
                Created {new Date(b.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>

            {/* Booking dates + amount */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-orange-50 rounded-xl px-4 py-3 text-center">
                <div className="text-xs text-gray-500 mb-1">Check-in</div>
                <div className="text-sm font-bold text-gray-900">{b.startDate}</div>
              </div>
              <div className="bg-orange-50 rounded-xl px-4 py-3 text-center">
                <div className="text-xs text-gray-500 mb-1">Check-out</div>
                <div className="text-sm font-bold text-gray-900">{b.endDate}</div>
              </div>
              <div className="bg-orange-50 rounded-xl px-4 py-3 text-center">
                <div className="text-xs text-gray-500 mb-1">Duration</div>
                <div className="text-sm font-bold text-gray-900">{b.totalDays} day{b.totalDays !== 1 ? "s" : ""}</div>
              </div>
            </div>

            {/* Amount */}
            <div className="flex items-center justify-between bg-gray-50 rounded-xl px-5 py-4">
              <div className="flex items-center gap-2 text-gray-600">
                <IndianRupee size={16} />
                <span className="text-sm font-medium">Total Amount</span>
              </div>
              <div className="text-2xl font-bold text-orange-500">₹{b.totalAmount?.toLocaleString("en-IN")}</div>
            </div>

            {/* Customer */}
            {data?.customer && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <User size={15} className="text-orange-500" />
                  <h4 className="text-sm font-bold text-gray-900">Customer</h4>
                </div>
                <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                    {data.customer.name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900">{data.customer.name}</div>
                    <div className="flex gap-3 mt-0.5">
                      {data.customer.email && (
                        <span className="flex items-center gap-1 text-xs text-gray-500"><Mail size={11} />{data.customer.email}</span>
                      )}
                      {data.customer.phone && (
                        <span className="flex items-center gap-1 text-xs text-gray-500"><Phone size={11} />{data.customer.phone}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Listing */}
            {data?.listing && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Package size={15} className="text-orange-500" />
                  <h4 className="text-sm font-bold text-gray-900">Listing</h4>
                </div>
                <div className="flex items-start gap-3 bg-gray-50 rounded-xl px-4 py-3">
                  {data.listing.images?.[0] ? (
                    <img src={data.listing.images[0]} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-gray-100" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-gray-200 flex items-center justify-center flex-shrink-0">
                      <Package size={20} className="text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900">{data.listing.title}</div>
                    <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5"><MapPin size={11} />{data.listing.location}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${CAT_COLOR[data.listing.category] || "bg-gray-100 text-gray-600"}`}>
                        {data.listing.category}
                      </span>
                      <span className="text-xs text-gray-500">₹{data.listing.price?.toLocaleString("en-IN")}/{data.listing.priceUnit?.replace("per_", "")}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Admin actions */}
            {!["cancelled", "completed"].includes(b.status) && (
              <div className="flex gap-3 pt-1 pb-1">
                {b.status === "pending" && (
                  <button
                    onClick={() => updateMutation.mutate("confirmed")}
                    disabled={updateMutation.isPending}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-blue-500 hover:bg-blue-600 text-white transition-colors disabled:opacity-50"
                  >
                    Confirm Booking
                  </button>
                )}
                {b.status === "confirmed" && (
                  <button
                    onClick={() => updateMutation.mutate("completed")}
                    disabled={updateMutation.isPending}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-green-500 hover:bg-green-600 text-white transition-colors disabled:opacity-50"
                  >
                    Mark Completed
                  </button>
                )}
                <button
                  onClick={() => { if (confirm("Cancel this booking?")) updateMutation.mutate("cancelled"); }}
                  disabled={updateMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-red-50 hover:bg-red-100 text-red-600 transition-colors disabled:opacity-50"
                >
                  <XCircle size={15} /> Cancel Booking
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="py-12 text-center text-gray-500">Booking not found</div>
        )}
      </div>
    </div>
  );
}

// ── Bookings Page ─────────────────────────────────────────────────────────────
export default function Bookings() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ bookings: Booking[]; total: number }>({
    queryKey: ["admin-bookings", page, statusFilter],
    queryFn: () => {
      const p = new URLSearchParams({ page: String(page), limit: "15" });
      if (statusFilter) p.set("status", statusFilter);
      return api.get(`/admin/bookings?${p}`);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/bookings/${id}`, { status: "cancelled" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-bookings"] }); toast({ title: "Booking cancelled" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const totalPages = Math.ceil((data?.total || 0) / 15);

  return (
    <div className="space-y-5 animate-fadeIn">
      {selectedId && <BookingDetailModal bookingId={selectedId} onClose={() => setSelectedId(null)} />}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
          <p className="text-gray-500 text-sm mt-0.5">{data?.total || 0} total bookings · click any row to view details</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {["", "pending", "confirmed", "completed", "cancelled"].map(s => (
            <button key={s || "all"}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors capitalize ${statusFilter === s ? "bg-orange-500 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
            >
              {s || "All"}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-left">
                {["Booking ID", "Customer", "Listing", "Dates", "Amount", "Status", "Payment", "Actions", ""].map((h, i) => (
                  <th key={i} className="px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="text-center py-12 text-gray-400">
                  <RefreshCw size={20} className="animate-spin mx-auto mb-2" />Loading...
                </td></tr>
              ) : (data?.bookings || []).map(b => (
                <tr
                  key={b.id}
                  onClick={() => setSelectedId(b.id)}
                  className="border-t border-gray-50 hover:bg-orange-50/40 transition-colors cursor-pointer group"
                >
                  <td className="px-5 py-4">
                    <div className="text-sm font-mono font-bold text-gray-900 group-hover:text-orange-600 transition-colors">#{b.id.slice(-8)}</div>
                    <div className="text-xs text-gray-400">
                      {new Date(b.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="text-sm font-medium text-gray-900">{b.customerName}</div>
                    <div className="text-xs text-gray-400">{b.customerEmail || "—"}</div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="text-sm font-medium text-gray-900 max-w-32 truncate">{b.listingTitle}</div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 inline-block ${CAT_COLOR[b.listingCategory] || "bg-gray-100 text-gray-600"}`}>
                      {b.listingCategory}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="text-sm text-gray-700 whitespace-nowrap">{b.startDate} → {b.endDate}</div>
                    <div className="text-xs text-gray-400">{b.totalDays} day{b.totalDays !== 1 ? "s" : ""}</div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="text-sm font-bold text-gray-900">₹{b.totalAmount.toLocaleString("en-IN")}</div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_COLOR[b.status] || "bg-gray-100 text-gray-600"}`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${PAY_COLOR[b.paymentStatus] || "bg-gray-100 text-gray-600"}`}>
                      {b.paymentStatus}
                    </span>
                  </td>
                  <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                    {!["cancelled", "completed"].includes(b.status) && (
                      <button
                        onClick={() => { if (confirm("Cancel this booking?")) cancelMutation.mutate(b.id); }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-xs font-medium transition-colors"
                      >
                        <XCircle size={12} /> Cancel
                      </button>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs text-orange-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">View →</span>
                  </td>
                </tr>
              ))}
              {!isLoading && !(data?.bookings || []).length && (
                <tr><td colSpan={9} className="text-center py-12 text-gray-400">No bookings found</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">Page {page} of {totalPages} · {data?.total} total</p>
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
