import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL ?? "";

type Ticket = {
  id: string; user_id: string | null; name: string; contact: string;
  issue_type: string; message: string; status: "pending" | "in_progress" | "resolved";
  admin_notes: string | null; created_at: string; resolved_at: string | null;
};

const ISSUE_COLORS: Record<string, string> = {
  "Booking Issue": "#F59E0B", "Payment Refund": "#10B981", "Provider Verification": "#8B5CF6",
  "Listing Problem": "#3B82F6", "Technical Bug": "#EF4444", "Safety Report": "#DC2626", "Other": "#6B7280",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "#F59E0B", in_progress: "#3B82F6", resolved: "#10B981",
};

function fmt(d: string) {
  return new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function SupportTickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const token = localStorage.getItem("adminToken") || sessionStorage.getItem("adminToken");

  async function load() {
    setLoading(true);
    try {
      const q = filter !== "all" ? `?status=${filter}` : "";
      const r = await fetch(`${API}/api/admin/support-tickets${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json();
      setTickets(Array.isArray(data) ? data : []);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [filter]);

  async function updateTicket(id: string, status: string) {
    setSaving(true);
    await fetch(`${API}/api/admin/support-tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status, admin_notes: notes }),
    });
    setSaving(false);
    setSelected(null);
    load();
  }

  const pending = tickets.filter(t => t.status === "pending").length;
  const inProgress = tickets.filter(t => t.status === "in_progress").length;
  const resolved = tickets.filter(t => t.status === "resolved").length;

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Support Tickets</h2>
      <p style={{ color: "#6B7280", marginBottom: 20 }}>Manage user support requests sent to info.rentzilla@gmail.com</p>

      {/* Stats */}
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Pending", count: pending, color: "#F59E0B", bg: "#FFFBEB" },
          { label: "In Progress", count: inProgress, color: "#3B82F6", bg: "#EFF6FF" },
          { label: "Resolved", count: resolved, color: "#10B981", bg: "#ECFDF5" },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: s.bg, border: `1px solid ${s.color}30`, borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: 13, color: s.color, fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {["all", "pending", "in_progress", "resolved"].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "6px 16px", borderRadius: 20, border: "1.5px solid",
              borderColor: filter === f ? "#FF7A18" : "#E5E7EB",
              background: filter === f ? "#FF7A18" : "#fff",
              color: filter === f ? "#fff" : "#374151",
              fontWeight: 600, fontSize: 13, cursor: "pointer",
            }}
          >{f.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}</button>
        ))}
        <button onClick={load} style={{ marginLeft: "auto", padding: "6px 16px", borderRadius: 20, border: "1.5px solid #E5E7EB", background: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
          ↺ Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#9CA3AF" }}>Loading tickets...</div>
      ) : tickets.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#9CA3AF" }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
          <div style={{ fontWeight: 600 }}>No support tickets found</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {tickets.map(t => (
            <div
              key={t.id}
              onClick={() => { setSelected(t); setNotes(t.admin_notes ?? ""); }}
              style={{
                background: "#fff", border: "1.5px solid #F3F4F6", borderRadius: 14,
                padding: "16px 20px", cursor: "pointer", transition: "box-shadow 0.15s",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 20, background: "#FF7A1820",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, flexShrink: 0,
                }}>📩</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>{t.name}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20,
                      background: (ISSUE_COLORS[t.issue_type] ?? "#6B7280") + "20",
                      color: ISSUE_COLORS[t.issue_type] ?? "#6B7280",
                    }}>{t.issue_type}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20, marginLeft: "auto",
                      background: (STATUS_COLORS[t.status] ?? "#6B7280") + "20",
                      color: STATUS_COLORS[t.status] ?? "#6B7280",
                    }}>{t.status.replace("_", " ")}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>{t.contact}</div>
                  <div style={{ fontSize: 14, color: "#374151", marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.message}
                  </div>
                  <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 6 }}>{fmt(t.created_at)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
        >
          <div style={{ background: "#fff", borderRadius: 20, padding: 28, width: 560, maxHeight: "90vh", overflowY: "auto", position: "relative" }}>
            <button onClick={() => setSelected(null)} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#6B7280" }}>✕</button>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Ticket #{selected.id.slice(-8)}</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              {[
                { label: "Name", value: selected.name },
                { label: "Contact", value: selected.contact },
                { label: "Issue Type", value: selected.issue_type },
                { label: "Submitted", value: fmt(selected.created_at) },
              ].map(f => (
                <div key={f.label} style={{ background: "#F9FAFB", borderRadius: 10, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginBottom: 2 }}>{f.label}</div>
                  <div style={{ fontSize: 14, color: "#111827", fontWeight: 600 }}>{f.value}</div>
                </div>
              ))}
            </div>

            <div style={{ background: "#F9FAFB", borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginBottom: 6 }}>MESSAGE</div>
              <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{selected.message}</div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Admin Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Add internal notes..."
                style={{ width: "100%", borderRadius: 10, border: "1.5px solid #E5E7EB", padding: "10px 14px", fontSize: 14, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              {selected.status !== "in_progress" && (
                <button
                  onClick={() => updateTicket(selected.id, "in_progress")}
                  disabled={saving}
                  style={{ flex: 1, padding: "12px", borderRadius: 12, border: "none", background: "#3B82F6", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}
                >
                  Mark In Progress
                </button>
              )}
              {selected.status !== "resolved" && (
                <button
                  onClick={() => updateTicket(selected.id, "resolved")}
                  disabled={saving}
                  style={{ flex: 1, padding: "12px", borderRadius: 12, border: "none", background: "#10B981", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}
                >
                  ✓ Mark Resolved
                </button>
              )}
              {selected.status === "resolved" && (
                <button
                  onClick={() => updateTicket(selected.id, "pending")}
                  disabled={saving}
                  style={{ flex: 1, padding: "12px", borderRadius: 12, border: "none", background: "#F59E0B", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}
                >
                  Reopen
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
