import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  Wallet, TrendingUp, ArrowDownLeft, ArrowUpRight, RefreshCw,
  Search, Filter, ChevronLeft, ChevronRight, IndianRupee,
  CalendarDays, User, CreditCard, Smartphone, Building2,
  Plus, Trash2, CheckCircle, Clock, XCircle, AlertCircle,
  Gift, BarChart3, BadgePercent,
} from "lucide-react";

// ── helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const date = (s: string) => s ? new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const time = (s: string) => s ? new Date(s).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "";

const TX_TYPE_LABEL: Record<string, string> = {
  topup: "Top-up", payment: "Payment", earning: "Earning",
  payout: "Payout", refund: "Refund", commission: "Commission",
};
const TX_TYPE_COLOR: Record<string, string> = {
  topup: "bg-green-100 text-green-700",
  payment: "bg-red-100 text-red-700",
  earning: "bg-blue-100 text-blue-700",
  payout: "bg-purple-100 text-purple-700",
  refund: "bg-amber-100 text-amber-700",
  commission: "bg-orange-100 text-orange-700",
};
const STATUS_COLOR: Record<string, string> = {
  completed: "bg-green-100 text-green-700",
  pending: "bg-amber-100 text-amber-700",
  failed: "bg-red-100 text-red-700",
  processing: "bg-blue-100 text-blue-700",
};
const BOOKING_STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  in_progress: "bg-indigo-100 text-indigo-700",
};

// ── Summary cards ─────────────────────────────────────────────────────────────
function SummaryCards() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["admin-wallet-summary"],
    queryFn: () => api.get("/wallet/admin/summary"),
  });

  const cards = [
    {
      label: "Total Commission Collected",
      value: fmt(data?.totalCommission || 0),
      icon: BadgePercent,
      color: "from-orange-500 to-amber-400",
      text: "text-white",
      sub: "All time platform earnings",
    },
    {
      label: "This Month",
      value: fmt(data?.monthCommission || 0),
      icon: TrendingUp,
      color: "from-blue-600 to-blue-400",
      text: "text-white",
      sub: "Commission earned this month",
    },
    {
      label: "Total Payouts Made",
      value: fmt(data?.totalPayouts || 0),
      icon: ArrowUpRight,
      color: "from-violet-600 to-violet-400",
      text: "text-white",
      sub: "Paid out to providers",
    },
    {
      label: "Platform Balance",
      value: fmt(Math.max(0, (data?.totalCommission || 0) - (data?.totalPayouts || 0))),
      icon: Wallet,
      color: "from-green-600 to-emerald-400",
      text: "text-white",
      sub: "Commission − payouts",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map(c => (
        <div key={c.label} className={`bg-gradient-to-br ${c.color} rounded-xl p-5 shadow`}>
          <div className="flex items-center justify-between mb-3">
            <span className={`text-sm font-medium ${c.text} opacity-90`}>{c.label}</span>
            <c.icon size={20} className={`${c.text} opacity-80`} />
          </div>
          {isLoading
            ? <div className="h-7 w-24 bg-white/30 rounded animate-pulse" />
            : <p className={`text-2xl font-bold ${c.text}`}>{c.value}</p>
          }
          <p className={`text-xs ${c.text} opacity-70 mt-1`}>{c.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ── Transactions tab ──────────────────────────────────────────────────────────
function TransactionsTab() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["admin-wallet-txs", page, status, type, search],
    queryFn: () => api.get(`/wallet/admin/transactions?page=${page}&limit=20&status=${status}&type=${type}&search=${encodeURIComponent(search)}`),
  });

  const txs: any[] = data?.transactions || [];
  const total = data?.total || 0;
  const pages = Math.ceil(total / 20);

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { setSearch(searchInput); setPage(1); } }}
            placeholder="Search user name or email…"
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
        </div>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300">
          <option value="">All Status</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="processing">Processing</option>
        </select>
        <select value={type} onChange={e => { setType(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300">
          <option value="">All Types</option>
          <option value="topup">Top-up</option>
          <option value="payment">Payment</option>
          <option value="earning">Earning</option>
          <option value="payout">Payout</option>
          <option value="refund">Refund</option>
        </select>
        <button onClick={() => refetch()} className="p-2 border rounded-lg hover:bg-gray-50">
          <RefreshCw size={15} className="text-gray-500" />
        </button>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-left font-semibold text-gray-600">User</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Role</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Type</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Amount</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Balance After</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Description</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Date</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : txs.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">No transactions found</td></tr>
              ) : txs.map(tx => (
                <tr key={tx.id} className="border-b hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{tx.userName || "—"}</div>
                    <div className="text-xs text-gray-400">{tx.userEmail || ""}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs capitalize text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">{tx.userRole}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TX_TYPE_COLOR[tx.type] || "bg-gray-100 text-gray-600"}`}>
                      {TX_TYPE_LABEL[tx.type] || tx.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    <span className={tx.type === "payment" || tx.type === "payout" ? "text-red-600" : "text-green-600"}>
                      {tx.type === "payment" || tx.type === "payout" ? "−" : "+"}{fmt(tx.amount)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{fmt(tx.balanceAfter)}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-[180px] truncate" title={tx.description}>{tx.description || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[tx.status] || "bg-gray-100 text-gray-600"}`}>
                      {tx.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {date(tx.createdAt)}<br /><span className="text-xs">{time(tx.createdAt)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
            <span className="text-sm text-gray-500">{total} total transactions</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 border rounded hover:bg-white disabled:opacity-40">
                <ChevronLeft size={14} />
              </button>
              <span className="text-sm text-gray-600">Page {page} of {pages}</span>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                className="p-1.5 border rounded hover:bg-white disabled:opacity-40">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Upcoming Bookings tab ─────────────────────────────────────────────────────
function UpcomingBookingsTab() {
  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["admin-upcoming-bookings"],
    queryFn: () => api.get("/wallet/admin/upcoming-bookings"),
  });

  const bookings: any[] = data?.bookings || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-2 flex items-center gap-3">
          <BarChart3 size={18} className="text-orange-600" />
          <span className="text-sm text-orange-800 font-medium">
            Expected commission from upcoming bookings:&nbsp;
            <strong>{fmt(data?.totalExpectedCommission || 0)}</strong>
          </span>
        </div>
        <button onClick={() => refetch()} className="p-2 border rounded-lg hover:bg-gray-50">
          <RefreshCw size={15} className="text-gray-500" />
        </button>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Listing</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Customer</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Provider</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Date</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Amount</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Est. Commission (15%)</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : bookings.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">No upcoming bookings</td></tr>
              ) : bookings.map(b => (
                <tr key={b.id} className="border-b hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800">{b.listingTitle || "—"}</div>
                    <div className="text-xs text-gray-400 capitalize">{b.category}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{b.customerName || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{b.providerName || "—"}</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{date(b.bookingDate)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-800">{fmt(b.totalAmount)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-orange-600">{fmt(b.expectedCommission)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${BOOKING_STATUS_COLOR[b.status] || "bg-gray-100 text-gray-600"}`}>
                      {b.status.replace("_", " ")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Refund tab ────────────────────────────────────────────────────────────────
function RefundTab() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [targetUserId, setTargetUserId] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const { data: usersData, isLoading: usersLoading } = useQuery<any>({
    queryKey: ["admin-users-search", userSearch],
    queryFn: () => api.get(`/admin/users?q=${encodeURIComponent(userSearch)}&limit=10`),
    enabled: userSearch.length >= 2,
  });

  const refundMutation = useMutation({
    mutationFn: (body: any) => api.post("/wallet/admin/refund", body),
    onSuccess: (data: any) => {
      toast({ title: "Refund issued", description: `${fmt(Number(amount))} refunded to ${data.refundedTo}` });
      qc.invalidateQueries({ queryKey: ["admin-wallet-txs"] });
      qc.invalidateQueries({ queryKey: ["admin-wallet-summary"] });
      setTargetUserId(""); setBookingId(""); setAmount(""); setReason("");
      setSelectedUser(null); setUserSearch("");
    },
    onError: (err: any) => toast({ title: "Refund failed", description: err.message, variant: "destructive" }),
  });

  const users: any[] = usersData?.users || [];

  function handleRefund() {
    if (!targetUserId) { toast({ title: "Select a user first", variant: "destructive" }); return; }
    if (!amount || Number(amount) <= 0) { toast({ title: "Enter a valid amount", variant: "destructive" }); return; }
    if (!reason.trim()) { toast({ title: "Enter refund reason", variant: "destructive" }); return; }
    refundMutation.mutate({ targetUserId, bookingId: bookingId.trim() || undefined, amount: Number(amount), reason });
  }

  return (
    <div className="max-w-xl">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex gap-3">
        <AlertCircle size={18} className="text-amber-600 mt-0.5 shrink-0" />
        <p className="text-sm text-amber-800">
          Refunds are credited instantly to the user's wallet balance. Optionally link a booking ID
          to mark its payment status as <strong>refunded</strong>.
        </p>
      </div>

      <div className="bg-white border rounded-xl p-6 space-y-5">
        {/* User search */}
        <div>
          <label className="text-sm font-semibold text-gray-700 block mb-1.5">Search User</label>
          <input
            value={userSearch}
            onChange={e => { setUserSearch(e.target.value); setSelectedUser(null); setTargetUserId(""); }}
            placeholder="Type name or email…"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
          {userSearch.length >= 2 && !selectedUser && (
            <div className="border rounded-lg mt-1 bg-white shadow-sm max-h-48 overflow-y-auto">
              {usersLoading ? (
                <div className="px-4 py-3 text-sm text-gray-400">Searching…</div>
              ) : users.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-400">No users found</div>
              ) : users.map((u: any) => (
                <button key={u.id} onClick={() => { setSelectedUser(u); setTargetUserId(u.id); setUserSearch(u.name || u.email); }}
                  className="w-full text-left px-4 py-2.5 hover:bg-orange-50 transition-colors border-b last:border-0">
                  <div className="font-medium text-sm text-gray-800">{u.name || "—"}</div>
                  <div className="text-xs text-gray-400">{u.email} · {u.role}</div>
                </button>
              ))}
            </div>
          )}
          {selectedUser && (
            <div className="mt-2 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircle size={14} className="text-green-600" />
              <span className="text-sm text-green-800 font-medium">{selectedUser.name || selectedUser.email}</span>
              <span className="text-xs text-green-600 ml-auto capitalize">{selectedUser.role}</span>
            </div>
          )}
        </div>

        {/* Booking ID (optional) */}
        <div>
          <label className="text-sm font-semibold text-gray-700 block mb-1.5">Booking ID <span className="font-normal text-gray-400">(optional)</span></label>
          <input
            value={bookingId}
            onChange={e => setBookingId(e.target.value)}
            placeholder="Link a booking to mark as refunded"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
        </div>

        {/* Amount */}
        <div>
          <label className="text-sm font-semibold text-gray-700 block mb-1.5">Refund Amount (₹)</label>
          <div className="relative">
            <IndianRupee size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full pl-8 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
          </div>
        </div>

        {/* Reason */}
        <div>
          <label className="text-sm font-semibold text-gray-700 block mb-1.5">Reason</label>
          <textarea
            value={reason} onChange={e => setReason(e.target.value)} rows={3}
            placeholder="e.g. Provider did not show up, booking cancelled by admin…"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
          />
        </div>

        <button
          onClick={handleRefund}
          disabled={refundMutation.isPending || !targetUserId || !amount || !reason}
          className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 flex items-center justify-center gap-2 transition-colors"
        >
          {refundMutation.isPending ? <RefreshCw size={16} className="animate-spin" /> : <Gift size={16} />}
          Issue Refund
        </button>
      </div>
    </div>
  );
}

// ── Payment Methods tab ───────────────────────────────────────────────────────
function PaymentMethodsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState("upi");
  const [label, setLabel] = useState("");
  const [upiId, setUpiId] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [ifsc, setIfsc] = useState("");

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["admin-payment-methods"],
    queryFn: () => api.get("/wallet/admin/payment-methods"),
  });

  const addMutation = useMutation({
    mutationFn: (body: any) => api.post("/wallet/admin/payment-methods", body),
    onSuccess: () => {
      toast({ title: "Payment method added" });
      qc.invalidateQueries({ queryKey: ["admin-payment-methods"] });
      setShowForm(false); setLabel(""); setUpiId(""); setCardNumber(""); setCardName(""); setBankName(""); setAccountNo(""); setIfsc("");
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/wallet/admin/payment-methods/${id}`),
    onSuccess: () => { toast({ title: "Removed" }); qc.invalidateQueries({ queryKey: ["admin-payment-methods"] }); },
    onError: () => toast({ title: "Error removing method", variant: "destructive" }),
  });

  const methods: any[] = data?.methods || [];

  const typeIcon = { upi: Smartphone, card: CreditCard, bank: Building2 };

  function buildDetails() {
    if (type === "upi") return { upiId };
    if (type === "card") return { cardNumber: cardNumber.slice(-4), cardName };
    return { bankName, accountNo: accountNo.slice(-4), ifsc };
  }

  function handleAdd() {
    if (!label.trim()) { toast({ title: "Enter a label", variant: "destructive" }); return; }
    addMutation.mutate({ type, label, details: buildDetails() });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-gray-500">Linked payment methods for receiving commission payouts and transferring platform balance.</p>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          <Plus size={15} /> Add Method
        </button>
      </div>

      {showForm && (
        <div className="bg-white border rounded-xl p-5 mb-5">
          <h3 className="font-semibold text-gray-800 mb-4">Add Payment Method</h3>
          <div className="space-y-4">
            {/* Type tabs */}
            <div className="flex gap-2">
              {(["upi", "card", "bank"] as const).map(t => {
                const Icon = typeIcon[t];
                return (
                  <button key={t} onClick={() => setType(t)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors ${type === t ? "bg-orange-50 border-orange-400 text-orange-700" : "hover:bg-gray-50 text-gray-600"}`}>
                    <Icon size={15} />{t === "upi" ? "UPI" : t === "card" ? "Card" : "Bank"}
                  </button>
                );
              })}
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1.5">Label / Nickname</label>
              <input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Primary UPI, Business Card"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
            </div>

            {type === "upi" && (
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">UPI ID</label>
                <input value={upiId} onChange={e => setUpiId(e.target.value)} placeholder="yourname@upi"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
              </div>
            )}
            {type === "card" && (
              <>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1.5">Card Number</label>
                  <input value={cardNumber} onChange={e => setCardNumber(e.target.value)} placeholder="•••• •••• •••• 1234" maxLength={19}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1.5">Cardholder Name</label>
                  <input value={cardName} onChange={e => setCardName(e.target.value)} placeholder="Name on card"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
                </div>
              </>
            )}
            {type === "bank" && (
              <>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1.5">Bank Name</label>
                  <input value={bankName} onChange={e => setBankName(e.target.value)} placeholder="State Bank of India"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1.5">Account Number</label>
                  <input value={accountNo} onChange={e => setAccountNo(e.target.value)} placeholder="Account number"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1.5">IFSC Code</label>
                  <input value={ifsc} onChange={e => setIfsc(e.target.value)} placeholder="SBIN0001234"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300" />
                </div>
              </>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowForm(false)} className="flex-1 border rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={handleAdd} disabled={addMutation.isPending}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg py-2 flex items-center justify-center gap-2 transition-colors">
                {addMutation.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {[1, 2].map(i => <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : methods.length === 0 ? (
        <div className="bg-white border rounded-xl py-14 text-center">
          <CreditCard size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No payment methods linked</p>
          <p className="text-sm text-gray-400 mt-1">Add a UPI ID, card, or bank account to receive payouts</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {methods.map(m => {
            const Icon = typeIcon[m.type as keyof typeof typeIcon] || CreditCard;
            return (
              <div key={m.id} className="bg-white border rounded-xl p-5 flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                  <Icon size={20} className="text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-800">{m.label}</div>
                  <div className="text-xs text-gray-400 uppercase mt-0.5">{m.type}</div>
                  {m.type === "upi" && <div className="text-sm text-gray-600 mt-1">{m.details?.upiId}</div>}
                  {m.type === "card" && <div className="text-sm text-gray-600 mt-1">•••• {m.details?.cardNumber} · {m.details?.cardName}</div>}
                  {m.type === "bank" && <div className="text-sm text-gray-600 mt-1">{m.details?.bankName} · •••• {m.details?.accountNo} · {m.details?.ifsc}</div>}
                  <div className="text-xs text-gray-400 mt-1">Added {date(m.createdAt)}</div>
                </div>
                <button onClick={() => deleteMutation.mutate(m.id)}
                  disabled={deleteMutation.isPending}
                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
type Tab = "transactions" | "upcoming" | "refund" | "payment-methods";

export default function PlatformWallet() {
  const [tab, setTab] = useState<Tab>("transactions");

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "transactions", label: "All Transactions", icon: ArrowDownLeft },
    { id: "upcoming", label: "Upcoming Bookings", icon: CalendarDays },
    { id: "refund", label: "Issue Refund", icon: Gift },
    { id: "payment-methods", label: "Payment Methods", icon: CreditCard },
  ];

  return (
    <div className="p-6">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center shadow">
          <Wallet size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Platform Wallet</h1>
          <p className="text-sm text-gray-500">Commission earnings, transactions, refunds &amp; payment methods</p>
        </div>
      </div>

      {/* Summary cards */}
      <SummaryCards />

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${tab === t.id ? "bg-white text-orange-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "transactions" && <TransactionsTab />}
      {tab === "upcoming" && <UpcomingBookingsTab />}
      {tab === "refund" && <RefundTab />}
      {tab === "payment-methods" && <PaymentMethodsTab />}
    </div>
  );
}
