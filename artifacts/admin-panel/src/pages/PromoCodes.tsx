import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface PromoCode {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  min_order: number;
  max_uses: number;
  used_count: number;
  is_active: boolean;
  description: string | null;
  expires_at: string | null;
  created_at: string;
}

const INITIAL_FORM = {
  code: "",
  type: "percent" as "percent" | "fixed",
  value: "",
  minOrder: "",
  maxUses: "100",
  description: "",
  expiresAt: "",
};

export default function PromoCodes() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => { loadCodes(); }, []);

  async function loadCodes() {
    setLoading(true);
    try {
      const data = await api.get<PromoCode[]>("/admin/promo-codes");
      setCodes(data || []);
    } catch {
      setCodes([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.code.trim()) { setFormError("Promo code is required"); return; }
    if (!form.value || isNaN(Number(form.value))) { setFormError("Value is required"); return; }
    if (form.type === "percent" && (Number(form.value) < 1 || Number(form.value) > 100)) {
      setFormError("Percentage must be between 1 and 100"); return;
    }
    setSaving(true);
    try {
      await api.post("/admin/promo-codes", {
        code: form.code.trim().toUpperCase(),
        type: form.type,
        value: Number(form.value),
        minOrder: form.minOrder ? Number(form.minOrder) : 0,
        maxUses: form.maxUses ? Number(form.maxUses) : 100,
        description: form.description || null,
        expiresAt: form.expiresAt || null,
      });
      setForm(INITIAL_FORM);
      setShowForm(false);
      await loadCodes();
    } catch (err: any) {
      setFormError(err?.message || "Failed to create promo code");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(code: PromoCode) {
    setToggling(code.id);
    try {
      await api.patch(`/admin/promo-codes/${code.id}`, { isActive: !code.is_active });
      await loadCodes();
    } catch {
    } finally {
      setToggling(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this promo code? This action cannot be undone.")) return;
    setDeleting(id);
    try {
      await api.delete(`/admin/promo-codes/${id}`);
      await loadCodes();
    } catch {
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Promo Codes</h1>
          <p className="text-gray-500 text-sm mt-1">Create and manage discount codes for customers</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setFormError(""); }}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
        >
          {showForm ? "✕ Cancel" : "+ New Code"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Codes", value: codes.length, color: "text-gray-800" },
          { label: "Active", value: codes.filter(c => c.is_active).length, color: "text-green-600" },
          { label: "Inactive", value: codes.filter(c => !c.is_active).length, color: "text-red-500" },
          { label: "Total Uses", value: codes.reduce((a, c) => a + Number(c.used_count || 0), 0), color: "text-orange-500" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-orange-200 p-6">
          <h2 className="text-base font-bold text-gray-900 mb-4">Create New Promo Code</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                <input
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g. SAVE20"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Discount Type *</label>
                <select
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value as "percent" | "fixed" }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  <option value="percent">Percentage (%)</option>
                  <option value="fixed">Fixed Amount (₹)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {form.type === "percent" ? "Discount % *" : "Discount ₹ *"}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-sm text-gray-400">{form.type === "percent" ? "%" : "₹"}</span>
                  <input
                    type="number" value={form.value}
                    onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                    placeholder={form.type === "percent" ? "e.g. 20" : "e.g. 100"}
                    min={1} max={form.type === "percent" ? 100 : undefined}
                    className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Order (₹)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-sm text-gray-400">₹</span>
                  <input
                    type="number" value={form.minOrder}
                    onChange={e => setForm(f => ({ ...f, minOrder: e.target.value }))}
                    placeholder="0 (no minimum)" min={0}
                    className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Uses</label>
                <input
                  type="number" value={form.maxUses}
                  onChange={e => setForm(f => ({ ...f, maxUses: e.target.value }))}
                  placeholder="100" min={1}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                <input
                  type="date" value={form.expiresAt}
                  onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
              <input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="e.g. First-time user discount"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{formError}</div>
            )}
            <div className="flex gap-3">
              <button
                type="submit" disabled={saving}
                className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50"
              >
                {saving ? "Creating..." : "Create Code"}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setForm(INITIAL_FORM); setFormError(""); }}
                className="px-6 py-2 rounded-lg font-semibold text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : codes.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-4xl mb-3">🏷️</p>
            <p className="font-medium">No promo codes yet</p>
            <p className="text-sm mt-1">Create your first discount code to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Code</th>
                  <th className="px-4 py-3 text-left">Discount</th>
                  <th className="px-4 py-3 text-left">Min Order</th>
                  <th className="px-4 py-3 text-left">Usage</th>
                  <th className="px-4 py-3 text-left">Expires</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {codes.map(c => (
                  <tr key={c.id} className={`hover:bg-gray-50 transition-colors ${!c.is_active ? "opacity-60" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-mono font-bold text-gray-900 tracking-widest text-sm">{c.code}</span>
                        {c.description && <span className="text-xs text-gray-400 mt-0.5">{c.description}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                        c.type === "percent" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
                      }`}>
                        {c.type === "percent" ? `${c.value}% OFF` : `₹${Number(c.value).toLocaleString("en-IN")} OFF`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {Number(c.min_order) > 0 ? `₹${Number(c.min_order).toLocaleString("en-IN")}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-700">{c.used_count}/{c.max_uses}</span>
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full mt-1">
                          <div
                            className="h-full bg-orange-400 rounded-full"
                            style={{ width: `${Math.min(100, (Number(c.used_count) / Number(c.max_uses)) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {c.expires_at
                        ? new Date(c.expires_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                        : <span className="text-gray-400">No expiry</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(c)}
                        disabled={toggling === c.id}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                          c.is_active
                            ? "bg-green-100 text-green-700 hover:bg-green-200"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        {toggling === c.id ? "..." : c.is_active ? "✓ Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(c.id)}
                        disabled={deleting === c.id}
                        className="text-red-400 hover:text-red-600 text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        {deleting === c.id ? "..." : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
