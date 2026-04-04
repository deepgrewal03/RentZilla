import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  LayoutDashboard, Users, Package, CalendarDays, FileCheck,
  AlertTriangle, Settings, LogOut, Menu, X, Bell, ChevronRight,
  Shield, Activity, Calendar, UserPlus, FileText, Flag,
  CheckCheck, ExternalLink, BadgePercent, CircleDollarSign, Tag, Wallet, Trophy,
} from "lucide-react";

const NAV = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/users", label: "Users", icon: Users },
  { path: "/listings", label: "Listings", icon: Package },
  { path: "/bookings", label: "Bookings", icon: CalendarDays },
  { path: "/documents", label: "Documents", icon: FileCheck },
  { path: "/reports", label: "Reports", icon: AlertTriangle },
  { path: "/notifications", label: "Notifications", icon: Bell },
  { path: "/logs", label: "Activity Log", icon: Activity },
  { path: "/pricing", label: "Pricing & Commission", icon: BadgePercent },
  { path: "/provider-prices", label: "Provider Prices", icon: CircleDollarSign },
  { path: "/promo-codes", label: "Promo Codes", icon: Tag },
  { path: "/platform-wallet", label: "Platform Wallet", icon: Wallet },
  { path: "/gold-analytics", label: "Gold Membership", icon: Trophy },
  { path: "/settings", label: "Settings", icon: Settings },
];

function NavItem({ path, label, icon: Icon, onClick }: { path: string; label: string; icon: any; onClick?: () => void }) {
  const [isActive] = useRoute(path === "/" ? "/" : `${path}*`);
  return (
    <Link href={path} onClick={onClick}>
      <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl mx-2 mb-1 cursor-pointer transition-all
        ${isActive
          ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30"
          : "text-slate-400 hover:bg-white/10 hover:text-white"
        }`}
      >
        <Icon size={18} />
        <span className="text-sm font-medium">{label}</span>
        {isActive && <ChevronRight size={14} className="ml-auto" />}
      </div>
    </Link>
  );
}

// ── Activity helpers ──────────────────────────────────────────────────────────
function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const TYPE_META: Record<string, { bg: string; iconColor: string; Icon: any }> = {
  booking:  { bg: "bg-orange-50",  iconColor: "text-orange-500", Icon: Calendar   },
  user:     { bg: "bg-blue-50",    iconColor: "text-blue-500",   Icon: UserPlus   },
  report:   { bg: "bg-red-50",     iconColor: "text-red-500",    Icon: Flag       },
  document: { bg: "bg-yellow-50",  iconColor: "text-yellow-600", Icon: FileText   },
};

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  sub: string;
  href: string;
  createdAt: string;
  status?: string;
}

// ── Bell Dropdown ─────────────────────────────────────────────────────────────
function BellDropdown({ readAt, onClose }: { readAt: number; onClose: () => void }) {
  const [, navigate] = useLocation();
  const { data, isLoading } = useQuery<{ items: ActivityItem[]; freshCount: number }>({
    queryKey: ["admin-activity-feed"],
  });

  const items = data?.items ?? [];

  function goTo(href: string) {
    onClose();
    navigate(href);
  }

  return (
    <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-orange-500 to-amber-400">
        <div className="flex items-center gap-2">
          <Bell size={15} className="text-white" />
          <span className="text-sm font-bold text-white">Live Activity</span>
          <span className="text-xs bg-white/25 text-white px-2 py-0.5 rounded-full font-semibold">
            All read
          </span>
        </div>
        <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
          <X size={15} />
        </button>
      </div>

      {/* Items */}
      <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-50">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <div className="animate-spin w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400">
            <CheckCheck size={28} className="mb-2 text-gray-300" />
            <p className="text-sm font-medium">All caught up!</p>
            <p className="text-xs mt-0.5">No activity in the last 24 hours</p>
          </div>
        ) : (
          items.map(item => {
            const meta = TYPE_META[item.type] ?? TYPE_META["booking"];
            const Icon = meta.Icon;
            return (
              <div
                key={item.id}
                onClick={() => goTo(item.href)}
                className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <div className={`w-9 h-9 rounded-xl ${meta.bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon size={16} className={meta.iconColor} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{item.title}</p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{item.sub}</p>
                  <p className="text-xs text-gray-400 mt-1">{timeAgo(item.createdAt)}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {items.length > 0 && (
        <div className="border-t border-gray-100 px-4 py-2.5 flex justify-center">
          <button
            onClick={() => goTo("/logs")}
            className="text-xs text-orange-500 hover:text-orange-600 font-semibold flex items-center gap-1 transition-colors"
          >
            View full activity log <ExternalLink size={11} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Live Bell Button ──────────────────────────────────────────────────────────
function LiveBell() {
  const [open, setOpen] = useState(false);
  // Start from 24h ago so items from today show as unread on first load
  const [readAt, setReadAt] = useState<number>(() => {
    try {
      return Number(localStorage.getItem("rz_bell_read_at") || "0");
    } catch {
      return 0;
    }
  });
  const ref = useRef<HTMLDivElement>(null);

  const { data } = useQuery<{ items: ActivityItem[]; freshCount: number }>({
    queryKey: ["admin-activity-feed"],
    queryFn: () => api.get("/admin/activity/feed"),
    refetchInterval: 30_000,
    staleTime: 25_000,
  });

  // Badge = items newer than readAt (cleared when bell is opened)
  const badgeCount = (data?.items ?? []).filter(
    i => new Date(i.createdAt).getTime() > readAt
  ).length;

  const markRead = useCallback(() => {
    const now = Date.now();
    setReadAt(now);
    try { localStorage.setItem("rz_bell_read_at", String(now)); } catch {}
  }, []);

  const handleOpen = useCallback(() => {
    setOpen(v => {
      if (!v) markRead();   // mark all read the moment bell opens
      return !v;
    });
  }, [markRead]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const hasBadge = badgeCount > 0;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className={`relative w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${
          open
            ? "bg-orange-50 border-orange-200"
            : "bg-gray-50 border-gray-200 hover:bg-gray-100"
        }`}
      >
        <Bell
          size={16}
          className={hasBadge ? "text-orange-500" : "text-gray-600"}
        />
        {hasBadge && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-orange-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 shadow-md animate-bounce">
            {badgeCount > 9 ? "9+" : badgeCount}
          </span>
        )}
        {!hasBadge && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-green-400 rounded-full" />
        )}
      </button>
      {open && <BellDropdown readAt={readAt} onClose={() => setOpen(false)} />}
    </div>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────
export function Layout({ children }: { children: React.ReactNode }) {
  const { auth, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-[#F5F6FA] overflow-hidden">
      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-[#0F1F3D] flex flex-col
        transition-transform duration-300 ease-in-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        lg:relative lg:translate-x-0 lg:flex-shrink-0
      `}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
          <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center shadow-lg">
            <Shield size={20} className="text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-base leading-tight">RentZilla</div>
            <div className="text-orange-400 text-xs font-medium">Admin Panel</div>
          </div>
          <button className="ml-auto text-white/60 hover:text-white lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        {/* Admin info */}
        <div className="px-4 py-3 mx-2 mt-3 mb-2 rounded-xl bg-white/8 border border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold">
              {auth?.admin.name?.[0]?.toUpperCase() || "A"}
            </div>
            <div className="overflow-hidden">
              <div className="text-white text-xs font-semibold truncate">{auth?.admin.name}</div>
              <div className="text-slate-400 text-xs truncate">{auth?.admin.email}</div>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-2">
          {NAV.map(item => (
            <NavItem key={item.path} {...item} onClick={() => setSidebarOpen(false)} />
          ))}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-4 py-2.5 rounded-xl text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
          >
            <LogOut size={18} />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-100 px-4 lg:px-6 py-3 flex items-center gap-4 flex-shrink-0 shadow-sm">
          <button className="lg:hidden text-gray-500 hover:text-gray-700" onClick={() => setSidebarOpen(true)}>
            <Menu size={22} />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <LiveBell />
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-50 border border-orange-100">
              <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold">
                {auth?.admin.name?.[0]?.toUpperCase() || "A"}
              </div>
              <span className="text-sm font-medium text-gray-700">{auth?.admin.name}</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
