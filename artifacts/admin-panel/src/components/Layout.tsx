import { useState } from "react";
import { Link, useRoute } from "wouter";
import { useAuth } from "@/lib/auth-context";
import {
  LayoutDashboard, Users, Package, CalendarDays, FileCheck,
  AlertTriangle, Settings, LogOut, Menu, X, Bell, ChevronRight,
  Shield, Activity
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
            <button className="relative w-9 h-9 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors">
              <Bell size={16} className="text-gray-600" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full" />
            </button>
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
