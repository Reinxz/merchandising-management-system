"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  LayoutDashboard, ShoppingCart, Package, Tag, Truck, Star,
  ClipboardList, FileText, Activity, Brain, Cloud, UserCog,
  ScrollText, Settings, Search, Bell, ChevronLeft, ChevronRight,
  ChevronDown, TrendingUp, TrendingDown, AlertTriangle, CheckCircle,
  XCircle, Download, Filter, Plus, MoreHorizontal, ArrowUpRight,
  ArrowDownRight, Zap, ShieldCheck, DollarSign, Boxes, Award,
  Target, Clock, Calendar, RefreshCw, Eye, Printer, Mail,
  PackageOpen, BarChart3, Users, Database, LogOut, Moon, Sun,
  Minus, ChevronsUpDown, Info, Layers, PieChart, LineChart, Menu,
} from "lucide-react";
import { InventoryWorkspace } from "./inventory-workspace";
import { ProcurementWorkspace } from "./procurement-workspace";
import LiveDashboard from "./live-dashboard";
import { SalesWorkspace } from "./sales-workspace";
import { listInventoryItems } from "@/lib/supabase/inventory";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart as RPieChart,
  Pie, Cell, Legend, ComposedChart, Line, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";

// ─── CONSTANTS ─────────────────────────────────────────────────────────────────
const V = "#5B21B6";      // primary violet
const VL = "#EDE9FE";     // violet light bg
const VD = "#4C1D95";     // violet dark
const SB = "#111827";     // sidebar charcoal
const BG = "#F8FAFC";     // main bg
const TX = "#0F172A";     // primary text
const TX2 = "#6B7280";    // secondary text
const BD = "#E5E7EB";     // border
const SUCCESS = "#22C55E";
const WARNING = "#F59E0B";
const ERROR = "#EF4444";
const INFO = "#3B82F6";

// ─── TYPES ─────────────────────────────────────────────────────────────────────
type NavKey =
  | "dashboard" | "sales" | "inventory" | "merchandise"
  | "suppliers" | "evaluation" | "purchase-orders"
  | "reports" | "kpi" | "bi" | "cloud" | "users" | "audit" | "settings";

// ─── DATA ──────────────────────────────────────────────────────────────────────
const salesTrendData: any[] = [];
const categoryData: any[] = [];
const pieColors = [V, "#7C3AED", "#A78BFA", "#C4B5FD", "#DDD6FE"];
const supplierMetrics: any[] = [];
const topProducts: any[] = [];
const purchaseOrders: any[] = [];
const inventoryItems: any[] = [];
const auditLogs: any[] = [];
const biInsights: any[] = [];
const kpis: any[] = [];
const users: any[] = [];

// ─── SIDEBAR NAV GROUPS ─────────────────────────────────────────────────────────
const navGroups = [
  {
    label: "Main",
    items: [
      { key: "dashboard" as NavKey, icon: LayoutDashboard, label: "Dashboard" },
      { key: "sales" as NavKey, icon: ShoppingCart, label: "Sales Management" },
      { key: "inventory" as NavKey, icon: Package, label: "Inventory" },
      { key: "merchandise" as NavKey, icon: Tag, label: "Merchandise" },
    ],
  },
  {
    label: "Procurement",
    items: [
      { key: "suppliers" as NavKey, icon: Truck, label: "Supplier Management" },
      { key: "evaluation" as NavKey, icon: Star, label: "Supplier Evaluation" },
      { key: "purchase-orders" as NavKey, icon: ClipboardList, label: "Purchase Orders" },
    ],
  },
  {
    label: "Analytics & BI",
    items: [
      { key: "reports" as NavKey, icon: FileText, label: "Reports" },
      { key: "kpi" as NavKey, icon: Activity, label: "KPI Monitoring" },
      { key: "bi" as NavKey, icon: Brain, label: "Business Intelligence" },
    ],
  },
  {
    label: "System",
    items: [
      { key: "cloud" as NavKey, icon: Cloud, label: "Cloud Sync" },
      { key: "users" as NavKey, icon: UserCog, label: "User Management" },
      { key: "audit" as NavKey, icon: ScrollText, label: "Audit Logs" },
      { key: "settings" as NavKey, icon: Settings, label: "Settings" },
    ],
  },
];

// ─── HELPERS ───────────────────────────────────────────────────────────────────
function cx(...c: (string | false | undefined | null)[]) { return c.filter(Boolean).join(" "); }

function useCountUp(target: number, duration = 1200) {
  const [v, setV] = useState(0);
  const ref = useRef<number | null>(null);
  useEffect(() => {
    ref.current = null;
    const start = performance.now();
    const frame = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setV(Math.round(ease * target));
      if (p < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, [target, duration]);
  return v;
}

function Counter({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const v = useCountUp(value);
  return <>{prefix}{v.toLocaleString()}{suffix}</>;
}

const TT_STYLE = {
  background: "#111827",
  border: "none",
  borderRadius: 10,
  color: "#F9FAFB",
  fontSize: 12,
  fontFamily: "Inter, sans-serif",
  padding: "10px 14px",
  boxShadow: "0 10px 25px rgba(0,0,0,0.25)",
};

const statusCfg: Record<string, { bg: string; text: string; dot: string }> = {
  Healthy:     { bg: "#F0FDF4", text: "#15803D", dot: SUCCESS },
  Low:         { bg: "#FFFBEB", text: "#92400E", dot: WARNING },
  Critical:    { bg: "#FEF2F2", text: "#991B1B", dot: ERROR },
  Active:      { bg: "#F0FDF4", text: "#15803D", dot: SUCCESS },
  Suspended:   { bg: "#FEF2F2", text: "#991B1B", dot: ERROR },
  Excellent:   { bg: "#EDE9FE", text: "#5B21B6", dot: V },
  Good:        { bg: "#EFF6FF", text: "#1D4ED8", dot: INFO },
  Review:      { bg: "#FFFBEB", text: "#92400E", dot: WARNING },
  Confirmed:   { bg: "#EFF6FF", text: "#1D4ED8", dot: INFO },
  "In Transit":{ bg: "#F0FDF4", text: "#15803D", dot: SUCCESS },
  Pending:     { bg: "#FFFBEB", text: "#92400E", dot: WARNING },
  Draft:       { bg: "#F9FAFB", text: "#6B7280", dot: "#D1D5DB" },
  Success:     { bg: "#F0FDF4", text: "#15803D", dot: SUCCESS },
  Failed:      { bg: "#FEF2F2", text: "#991B1B", dot: ERROR },
};

function StatusBadge({ label }: { label: string }) {
  const cfg = statusCfg[label] ?? { bg: "#F3F4F6", text: "#6B7280", dot: "#9CA3AF" };
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border"
      style={{ background: cfg.bg, color: cfg.text, borderColor: cfg.bg }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
      {label}
    </span>
  );
}

function StarRow({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={11}
          className={i <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-gray-200 fill-gray-200"} />
      ))}
      <span className="ml-1 text-xs font-semibold text-slate-500">{rating}</span>
    </span>
  );
}

// ─── SHARED UI ─────────��─��─────────────────────────────────────────────────────
function Card({ children, className = "", p = true }: { children: React.ReactNode; className?: string; p?: boolean }) {
  return (
    <div className={cx("bg-white rounded-2xl border", p && "p-6", className)}
      style={{ borderColor: BD, boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)" }}>
      {children}
    </div>
  );
}

function PrimaryBtn({ children, icon: Icon, onClick, size = "md" }: {
  children?: React.ReactNode; icon?: React.ElementType; onClick?: () => void; size?: "sm" | "md";
}) {
  return (
    <button onClick={onClick}
      className={cx("inline-flex items-center gap-2 font-semibold rounded-xl transition-all duration-150 hover:opacity-90 active:scale-95",
        size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"
      )}
      style={{ background: V, color: "#fff" }}>
      {Icon && <Icon size={size === "sm" ? 12 : 14} />}
      {children}
    </button>
  );
}

function SecondaryBtn({ children, icon: Icon, onClick, size = "md" }: {
  children?: React.ReactNode; icon?: React.ElementType; onClick?: () => void; size?: "sm" | "md";
}) {
  return (
    <button onClick={onClick}
      className={cx("inline-flex items-center gap-2 font-semibold rounded-xl border bg-white transition-all duration-150 hover:bg-violet-50 active:scale-95",
        size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"
      )}
      style={{ color: V, borderColor: V }}>
      {Icon && <Icon size={size === "sm" ? 12 : 14} />}
      {children}
    </button>
  );
}

function GhostBtn({ children, icon: Icon, onClick }: { children?: React.ReactNode; icon?: React.ElementType; onClick?: () => void }) {
  return (
    <button onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl transition-colors hover:bg-gray-100 text-gray-600">
      {Icon && <Icon size={12} />}
      {children}
    </button>
  );
}

function SectionHead({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <h3 className="text-base font-bold" style={{ color: TX }}>{title}</h3>
        {subtitle && <p className="text-xs mt-0.5" style={{ color: TX2 }}>{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2 shrink-0">{children}</div>}
    </div>
  );
}

function SearchBar({ placeholder = "Search…", className = "" }: { placeholder?: string; className?: string }) {
  return (
    <div className={cx("flex items-center gap-2 border bg-white rounded-xl px-3 py-2", className)} style={{ borderColor: BD }}>
      <Search size={14} style={{ color: TX2 }} />
      <input placeholder={placeholder}
        className="bg-transparent text-sm focus:outline-none flex-1"
        style={{ color: TX }} />
    </div>
  );
}

function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-xl font-bold" style={{ color: TX }}>{title}</h2>
        {subtitle && <p className="text-sm mt-0.5" style={{ color: TX2 }}>{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function TableBase({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr style={{ background: "#F9FAFB", borderBottom: `1px solid ${BD}` }}>
          {headers.map((h) => (
            <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: TX2 }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

function TableRow({ children, last = false }: { children: React.ReactNode; last?: boolean }) {
  return (
    <tr className="transition-colors hover:bg-violet-50/30 cursor-pointer"
      style={{ borderBottom: last ? "none" : `1px solid ${BD}` }}>
      {children}
    </tr>
  );
}

function Td({ children, mono = false }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <td className={cx("px-5 py-3.5 text-sm", mono && "font-mono text-xs")} style={{ color: TX }}>
      {children}
    </td>
  );
}

function TdSub({ children }: { children: React.ReactNode }) {
  return <td className="px-5 py-3.5 text-xs" style={{ color: TX2 }}>{children}</td>;
}

function Pagination({ total, current = 1 }: { total: number; current?: number }) {
  return (
    <div className="px-5 py-3.5 flex items-center justify-between border-t" style={{ borderColor: BD }}>
      <span className="text-xs" style={{ color: TX2 }}>Showing {Math.min(5, total)} of {total} records</span>
      <div className="flex items-center gap-1">
        {[1, 2, 3, "...", Math.ceil(total / 5)].map((p, i) => (
          <button key={i}
            className={cx("w-7 h-7 rounded-lg text-xs font-medium transition-colors",
              p === current ? "text-white" : "hover:bg-gray-100"
            )}
            style={p === current ? { background: V, color: "#fff" } : { color: TX2 }}>
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── KPI STAT CARD ─────────────────────────────────────────────────────────────
function KpiCard({ label, value, change, up, icon: Icon, iconBg, iconColor, prefix = "", suffix = "" }: {
  label: string; value: number; change: string; up: boolean;
  icon: React.ElementType; iconBg: string; iconColor: string;
  prefix?: string; suffix?: string;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: iconBg }}>
          <Icon size={18} style={{ color: iconColor }} />
        </div>
        <span className={cx("flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full",
          up ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
        )}>
          {up ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
          {change}
        </span>
      </div>
      <div className="text-2xl font-bold mb-0.5" style={{ color: TX }}>
        <Counter value={value} prefix={prefix} suffix={suffix} />
      </div>
      <div className="text-xs font-medium" style={{ color: TX2 }}>{label}</div>
    </Card>
  );
}

// ─── PAGES ─────────────────────────────────────────────────────────────────────

function DashboardPage({ userName, liveCounts }: { userName?: string; liveCounts?: { inventory: number; suppliers: number; purchaseOrders: number } }) {
  const kpiCards = [
    { label: "Inventory Records", value: liveCounts?.inventory ?? 0, change: "Live", up: true, icon: Boxes, iconBg: VL, iconColor: V },
    { label: "Active Suppliers", value: liveCounts?.suppliers ?? 0, change: "Live", up: true, icon: Truck, iconBg: "#FFFBEB", iconColor: WARNING },
    { label: "Purchase Orders", value: liveCounts?.purchaseOrders ?? 0, change: "Live", up: true, icon: ClipboardList, iconBg: "#FFFBEB", iconColor: WARNING },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-2xl px-8 py-6 flex items-center justify-between relative overflow-hidden"
        style={{ background: V }}>
        <div className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
        <div className="relative">
          <p className="text-violet-200 text-sm font-medium mb-1">Welcome back{userName ? `, ${userName}` : ""}</p>
          <h1 className="text-white text-xl font-bold mb-1">Merchandising Management System</h1>
          <h2 className="text-violet-100 text-sm font-semibold mb-1">Supply Chain &amp; Inventory Management</h2>
          <p className="text-violet-200 text-sm max-w-2xl leading-relaxed">
            Monitor inventory, suppliers, purchase orders, sales, and stock levels across all product categories.
          </p>
          {liveCounts && <p className="relative text-violet-200 text-[11px] mt-2">Live records: {liveCounts.inventory} inventory · {liveCounts.suppliers} suppliers · {liveCounts.purchaseOrders} purchase orders</p>}
        </div>
        <div className="relative hidden lg:flex items-center gap-6">
          {[
            { label: "Cloud Status", val: "Synced", icon: Cloud, ok: true },
            { label: "Last Backup", val: "07:00 UTC", icon: Clock, ok: true },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <div className="flex items-center gap-1.5 text-violet-200 text-xs mb-1 justify-center">
                <item.icon size={11} />
                {item.label}
              </div>
              <div className="flex items-center gap-1.5 text-white text-sm font-semibold justify-center">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: item.ok ? SUCCESS : ERROR }} />
                {item.val}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpiCards.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2" p={false}>
          <div className="p-6 pb-0">
            <SectionHead title="Monthly Sales Trend" subtitle="Revenue, Sales & Profit — Jan to Dec 2026">
              <GhostBtn icon={Filter}>Filter</GhostBtn>
              <SecondaryBtn icon={Download} size="sm">Export</SecondaryBtn>
            </SectionHead>
          </div>
          <div className="px-6 pb-6">
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={salesTrendData}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={V} stopOpacity={0.12} />
                    <stop offset="100%" stopColor={V} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={BD} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: TX2, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: TX2, fontFamily: "Inter" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}K`} />
                <Tooltip contentStyle={TT_STYLE} formatter={(v: unknown) => [`₱${v}K`, ""]} />
                <Area type="monotone" dataKey="revenue" stroke={V} strokeWidth={2.5} fill="url(#revGrad)" dot={false} name="Revenue" />
                <Line type="monotone" dataKey="sales" stroke={INFO} strokeWidth={1.5} dot={false} name="Sales" strokeDasharray="4 3" />
                <Line type="monotone" dataKey="profit" stroke={SUCCESS} strokeWidth={1.5} dot={false} name="Profit" />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-5 mt-2">
              {[{ c: V, l: "Revenue" }, { c: INFO, l: "Sales", d: true }, { c: SUCCESS, l: "Profit" }].map((i) => (
                <div key={i.l} className="flex items-center gap-1.5 text-xs" style={{ color: TX2 }}>
                  <div className="h-0.5 w-5 rounded" style={{ background: i.d ? "transparent" : i.c, borderTop: i.d ? `2px dashed ${i.c}` : undefined }} />
                  {i.l}
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card p={false}>
          <div className="p-6 pb-2">
            <SectionHead title="Revenue Mix" subtitle="By product category" />
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <RPieChart>
              <Pie data={categoryData} cx="50%" cy="50%" innerRadius={55} outerRadius={82}
                paddingAngle={3} dataKey="value" stroke="none">
                {categoryData.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
              </Pie>
              <Tooltip contentStyle={TT_STYLE} formatter={(v: unknown) => [`${v}%`, ""]} />
            </RPieChart>
          </ResponsiveContainer>
          <div className="px-6 pb-6 space-y-2 mt-1">
            {categoryData.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: pieColors[i % pieColors.length] }} />
                  <span style={{ color: TX2 }}>{d.name}</span>
                </div>
                <span className="font-bold" style={{ color: TX }}>{d.value}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2" p={false}>
          <div className="p-6 pb-0">
            <SectionHead title="Product Category Performance" subtitle="Sales volume by category">
              <GhostBtn icon={Filter}>Filter</GhostBtn>
            </SectionHead>
          </div>
          <div className="px-6 pb-6">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={categoryData} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke={BD} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: TX2, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: TX2, fontFamily: "Inter" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={TT_STYLE} formatter={(v: unknown) => [`${v}%`, "Share"]} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}
                  fill={V}
                  activeBar={{ fill: VD }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Low Stock Alerts */}
        <Card p={false}>
          <div className="p-6 pb-3">
            <SectionHead title="Low Stock Alerts">
              <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: "#FEF2F2", color: ERROR }}>
                {inventoryItems.filter(i => i.status !== "Healthy").length} items
              </span>
            </SectionHead>
          </div>
          <div className="px-6 pb-6 space-y-3">
            {inventoryItems.filter(i => i.status !== "Healthy").map((item) => {
              const pct = (item.stock / item.min) * 100;
              const barColor = item.status === "Critical" ? ERROR : WARNING;
              return (
                <div key={item.sku} className="rounded-xl p-3 border" style={{ borderColor: BD }}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-xs font-semibold" style={{ color: TX }}>{item.name}</div>
                      <div className="text-[10px] font-mono mt-0.5" style={{ color: TX2 }}>{item.sku}</div>
                    </div>
                    <StatusBadge label={item.status} />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full" style={{ background: BD }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: barColor }} />
                    </div>
                    <span className="text-[10px] font-mono" style={{ color: TX2 }}>{item.stock}/{item.min}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Top Products Table */}
      <Card p={false}>
        <div className="p-6 border-b" style={{ borderColor: BD }}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold" style={{ color: TX }}>Top Selling Products</h3>
              <p className="text-xs mt-0.5" style={{ color: TX2 }}>Best performing SKUs — July 2026</p>
            </div>
            <div className="flex gap-2">
              <SearchBar placeholder="Search products…" className="w-48" />
              <GhostBtn icon={Filter}>Filter</GhostBtn>
              <SecondaryBtn icon={Download} size="sm">Export</SecondaryBtn>
            </div>
          </div>
        </div>
        <TableBase headers={["#", "Product", "SKU", "Category", "Units Sold", "Revenue", "Margin", "Stock", "Trend"]}>
          {topProducts.map((p, i) => (
            <TableRow key={p.sku} last={i === topProducts.length - 1}>
              <Td>
                <span className="w-6 h-6 rounded-lg inline-flex items-center justify-center text-xs font-bold"
                  style={{ background: i === 0 ? "#FFFBEB" : i === 1 ? "#F1F5F9" : "#F9FAFB", color: i === 0 ? "#92400E" : TX2 }}>
                  {p.rank}
                </span>
              </Td>
              <td className="px-5 py-3.5">
                <span className="text-sm font-semibold" style={{ color: TX }}>{p.name}</span>
              </td>
              <Td mono>{p.sku}</Td>
              <TdSub>{p.category}</TdSub>
              <td className="px-5 py-3.5 text-sm font-semibold" style={{ color: TX }}>{p.units.toLocaleString()}</td>
              <td className="px-5 py-3.5 text-sm font-bold" style={{ color: V }}>{p.revenue}</td>
              <TdSub>{p.margin}</TdSub>
              <Td mono>{p.stock}</Td>
              <td className="px-5 py-3.5">
                {p.trend === "up"
                  ? <TrendingUp size={14} style={{ color: SUCCESS }} />
                  : p.trend === "down"
                  ? <TrendingDown size={14} style={{ color: ERROR }} />
                  : <Minus size={14} style={{ color: TX2 }} />}
              </td>
            </TableRow>
          ))}
        </TableBase>
        <Pagination total={topProducts.length} />
      </Card>
    </div>
  );
}

function InventoryPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Inventory Management" subtitle="Real-time stock levels, valuation, and reorder management">
        <GhostBtn icon={Filter}>Filter</GhostBtn>
        <SecondaryBtn icon={Download}>Export</SecondaryBtn>
        <PrimaryBtn icon={Plus}>Add Item</PrimaryBtn>
      </PageHeader>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total SKUs", value: inventoryItems.length, icon: Boxes, iconBg: VL, iconColor: V },
        ].map((s) => (
          <Card key={s.label}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: s.iconBg }}>
                <s.icon size={18} style={{ color: s.iconColor }} />
              </div>
              <div>
                <div className="text-xl font-bold" style={{ color: TX }}>
                  {s.label === "Total Value" ? <Counter value={s.value} prefix="₱" suffix="K" /> : <Counter value={s.value} />}
                </div>
                <div className="text-xs" style={{ color: TX2 }}>{s.label}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card p={false}>
        <div className="p-5 border-b flex items-center gap-3" style={{ borderColor: BD }}>
          <SearchBar placeholder="Search inventory…" className="flex-1 max-w-xs" />
          <select className="border rounded-xl px-3 py-2 text-xs focus:outline-none" style={{ borderColor: BD, color: TX2 }}>
            <option>All Categories</option>
            <option>Dry Products</option>
            <option>Frozen Products</option>
            <option>Cosmetic Products</option>
          </select>
          <select className="border rounded-xl px-3 py-2 text-xs focus:outline-none" style={{ borderColor: BD, color: TX2 }}>
            <option>All Statuses</option>
            <option>Healthy</option>
            <option>Low</option>
            <option>Critical</option>
          </select>
          <div className="ml-auto flex gap-2">
            <SecondaryBtn icon={Printer} size="sm">PDF</SecondaryBtn>
            <SecondaryBtn icon={Download} size="sm">Excel</SecondaryBtn>
          </div>
        </div>
        <TableBase headers={["SKU", "Product Name", "Category", "Stock", "Min. Level", "Max. Level", "Value", "Status", ""]}>
          {inventoryItems.map((item, i) => {
            const pct = (item.stock / item.max) * 100;
            return (
              <TableRow key={item.sku} last={i === inventoryItems.length - 1}>
                <Td mono>{item.sku}</Td>
                <td className="px-5 py-3.5">
                  <span className="text-sm font-semibold" style={{ color: TX }}>{item.name}</span>
                </td>
                <TdSub>{item.category}</TdSub>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 rounded-full" style={{ background: BD }}>
                      <div className="h-full rounded-full" style={{
                        width: `${pct}%`,
                        background: item.status === "Critical" ? ERROR : item.status === "Low" ? WARNING : SUCCESS,
                      }} />
                    </div>
                    <span className="text-xs font-semibold" style={{ color: TX }}>{item.stock}</span>
                  </div>
                </td>
                <Td mono>{item.min}</Td>
                <Td mono>{item.max}</Td>
                <td className="px-5 py-3.5 text-sm font-semibold" style={{ color: V }}>{item.value}</td>
                <Td><StatusBadge label={item.status} /></Td>
                <td className="px-5 py-3.5">
                  <button className="text-gray-400 hover:text-gray-600 transition-colors"><MoreHorizontal size={14} /></button>
                </td>
              </TableRow>
            );
          })}
        </TableBase>
        <Pagination total={inventoryItems.length} />
      </Card>
    </div>
  );
}

function SuppliersPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Supplier Management" subtitle="47 active supplier relationships across all categories">
        <SecondaryBtn icon={Download}>Export</SecondaryBtn>
        <PrimaryBtn icon={Plus}>Add Supplier</PrimaryBtn>
      </PageHeader>

      <div className="grid grid-cols-3 gap-4">
        <Card className="col-span-2" p={false}>
          <div className="p-6 pb-0">
            <SectionHead title="Performance Radar" subtitle="Multi-dimensional comparison — top 3 suppliers" />
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={[
              { metric: "Quality", A: 94, B: 78, C: 87 },
              { metric: "Delivery", A: 91, B: 84, C: 97 },
              { metric: "Cost Eff.", A: 87, B: 92, C: 74 },
              { metric: "Reliability", A: 96, B: 80, C: 89 },
              { metric: "Support", A: 92, B: 75, C: 84 },
            ]}>
              <PolarGrid stroke={BD} />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: TX2, fontFamily: "Inter" }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9, fill: TX2 }} />
<Radar name="Supplier A" dataKey="A" stroke={V} fill={V} fillOpacity={0.15} strokeWidth={2} />
                <Radar name="Supplier B" dataKey="B" stroke={INFO} fill={INFO} fillOpacity={0.1} strokeWidth={1.5} />
              <Radar name="FastLogix" dataKey="C" stroke={SUCCESS} fill={SUCCESS} fillOpacity={0.1} strokeWidth={1.5} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontFamily: "Inter", fontSize: 11, color: TX2 }} />
              <Tooltip contentStyle={TT_STYLE} />
            </RadarChart>
          </ResponsiveContainer>
        </Card>

        <Card p={false}>
          <div className="p-6 pb-3">
            <SectionHead title="Overall Scores" subtitle="Composite performance index" />
          </div>
          <div className="px-6 pb-6 space-y-4">
            {supplierMetrics.map((s) => {
              const score = Math.round((s.quality + s.delivery + s.reliability) / 3);
              return (
                <div key={s.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold" style={{ color: TX }}>{s.name}</span>
                    <span className="text-xs font-bold" style={{ color: score >= 88 ? V : score >= 78 ? WARNING : ERROR }}>{score}</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: BD }}>
                    <div className="h-full rounded-full" style={{
                      width: `${score}%`,
                      background: score >= 88 ? V : score >= 78 ? WARNING : ERROR,
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card p={false}>
        <div className="p-5 border-b flex items-center gap-3" style={{ borderColor: BD }}>
          <SearchBar placeholder="Search suppliers…" className="flex-1 max-w-xs" />
          <div className="ml-auto flex gap-2">
            <SecondaryBtn icon={Printer} size="sm">PDF</SecondaryBtn>
            <SecondaryBtn icon={Download} size="sm">Excel</SecondaryBtn>
          </div>
        </div>
        <TableBase headers={["Supplier", "ID", "Category", "Orders", "Rating", "On-Time", "Defect Rate", "Annual Spend", "Status", ""]}>
          {supplierMetrics.map((s, i) => (
            <TableRow key={s.name} last={i === supplierMetrics.length - 1}>
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold"
                    style={{ background: V }}>{s.name.charAt(0)}</div>
                  <span className="text-sm font-semibold" style={{ color: TX }}>{s.name}</span>
                </div>
              </td>
              <Td mono>{`SUP-00${i + 1}`}</Td>
              <TdSub>Mixed</TdSub>
              <Td>{[148, 92, 214, 67, 183][i]}</Td>
              <Td><StarRow rating={s.rating} /></Td>
              <td className="px-5 py-3.5 text-sm font-bold" style={{ color: s.delivery >= 90 ? SUCCESS : WARNING }}>{s.delivery}%</td>
              <td className="px-5 py-3.5 text-sm font-semibold" style={{ color: s.reliability >= 85 ? SUCCESS : ERROR }}>
                {[2.1, 4.8, 3.2, 0.9, 2.7][i]}%
              </td>
              <td className="px-5 py-3.5 text-sm font-bold" style={{ color: V }}>{s.spend}</td>
              <Td><StatusBadge label={s.status} /></Td>
              <td className="px-5 py-3.5">
                <button className="text-gray-400 hover:text-gray-600 transition-colors"><MoreHorizontal size={14} /></button>
              </td>
            </TableRow>
          ))}
        </TableBase>
        <Pagination total={47} />
      </Card>
    </div>
  );
}

function EvaluationPage() {
  const [selected, setSelected] = useState(0);
  const s = supplierMetrics[selected];
  const overall = Math.round((s.quality + s.delivery + s.cost + s.reliability) / 4);
  const overallRating = +(overall / 20).toFixed(1);

  return (
    <div className="space-y-6">
      <PageHeader title="Supplier Evaluation" subtitle="Comprehensive performance scoring and history tracking">
        <SecondaryBtn icon={Calendar}>View History</SecondaryBtn>
        <PrimaryBtn icon={FileText}>Generate Report</PrimaryBtn>
      </PageHeader>

      {/* Selector */}
      <div className="flex gap-2 flex-wrap">
        {supplierMetrics.map((s, i) => (
          <button key={s.name} onClick={() => setSelected(i)}
            className="px-4 py-2 rounded-xl text-sm font-semibold border transition-all"
            style={{
              background: selected === i ? V : "#fff",
              color: selected === i ? "#fff" : TX,
              borderColor: selected === i ? V : BD,
              boxShadow: selected === i ? `0 4px 12px ${V}30` : undefined,
            }}>
            {s.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Score ring */}
        <Card className="text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="relative w-32 h-32">
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <circle cx="60" cy="60" r="50" fill="none" stroke={BD} strokeWidth="10" />
                <circle cx="60" cy="60" r="50" fill="none" stroke={V} strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${(overall / 100) * 314} 314`}
                  className="transition-all duration-700" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold" style={{ color: V }}>{overall}</span>
                <span className="text-xs" style={{ color: TX2 }}>/ 100</span>
              </div>
            </div>
          </div>
          <h3 className="text-sm font-bold mb-1" style={{ color: TX }}>{s.name}</h3>
          <div className="flex justify-center mb-3"><StarRow rating={overallRating} /></div>
          <StatusBadge label={s.status} />

          <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-3 text-left" style={{ borderColor: BD }}>
            {[
              { label: "On-Time Rate", val: `${s.delivery}%` },
              { label: "Defect Rate", val: `${[2.1,4.8,3.2,0.9,2.7][selected]}%` },
              { label: "Avg Lead Time", val: "4.2 days" },
              { label: "Annual Spend", val: s.spend },
            ].map((m) => (
              <div key={m.label} className="rounded-xl p-2.5" style={{ background: BG }}>
                <div className="text-[10px]" style={{ color: TX2 }}>{m.label}</div>
                <div className="text-sm font-bold mt-0.5" style={{ color: TX }}>{m.val}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Metric breakdown */}
        <Card className="col-span-2">
          <SectionHead title="Performance Breakdown" subtitle="Detailed scoring across evaluation criteria" />
          <div className="grid grid-cols-2 gap-5">
            {[
              { label: "Product Quality", value: s.quality, icon: Award, color: V },
              { label: "Delivery Performance", value: s.delivery, icon: Truck, color: INFO },
              { label: "Cost Efficiency", value: s.cost, icon: DollarSign, color: SUCCESS },
              { label: "Reliability Score", value: s.reliability, icon: ShieldCheck, color: WARNING },
            ].map((m) => (
              <div key={m.label}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <m.icon size={14} style={{ color: m.color }} />
                    <span className="text-sm font-medium" style={{ color: TX }}>{m.label}</span>
                  </div>
                  <span className="text-sm font-bold" style={{ color: m.color }}>{m.value}%</span>
                </div>
                <div className="h-2.5 rounded-full" style={{ background: BD }}>
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${m.value}%`, background: m.color }} />
                </div>
              </div>
            ))}
          </div>

          {/* History mini chart */}
          <div className="mt-6 pt-5 border-t" style={{ borderColor: BD }}>
            <div className="text-xs font-semibold mb-3" style={{ color: TX2 }}>Performance History (6 months)</div>
            <ResponsiveContainer width="100%" height={100}>
              <AreaChart data={[
                { m: "Feb", v: 80 }, { m: "Mar", v: 83 }, { m: "Apr", v: 85 },
                { m: "May", v: 82 }, { m: "Jun", v: 87 }, { m: "Jul", v: overall },
              ]}>
                <defs>
                  <linearGradient id="evalGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={V} stopOpacity={0.15} />
                    <stop offset="100%" stopColor={V} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="m" tick={{ fontSize: 10, fill: TX2 }} axisLine={false} tickLine={false} />
                <YAxis domain={[60, 100]} hide />
                <Tooltip contentStyle={TT_STYLE} />
                <Area type="monotone" dataKey="v" stroke={V} strokeWidth={2} fill="url(#evalGrad)" dot={false} name="Score" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

function PurchaseOrdersPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Purchase Orders" subtitle="23 open orders · ₱186,600 total outstanding value">
        <GhostBtn icon={Filter}>Filter</GhostBtn>
        <SecondaryBtn icon={Download}>Export</SecondaryBtn>
        <PrimaryBtn icon={Plus}>New Order</PrimaryBtn>
      </PageHeader>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Open Orders", value: 23, icon: ClipboardList, iconBg: VL, iconColor: V },
          { label: "In Transit", value: 8, icon: Truck, iconBg: "#EFF6FF", iconColor: INFO },
          { label: "Confirmed", value: 11, icon: CheckCircle, iconBg: "#F0FDF4", iconColor: SUCCESS },
          { label: "Overdue", value: 2, icon: AlertTriangle, iconBg: "#FEF2F2", iconColor: ERROR },
        ].map((s) => (
          <Card key={s.label}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: s.iconBg }}>
                <s.icon size={18} style={{ color: s.iconColor }} />
              </div>
              <div>
                <div className="text-xl font-bold" style={{ color: TX }}><Counter value={s.value} /></div>
                <div className="text-xs" style={{ color: TX2 }}>{s.label}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card p={false}>
        <div className="p-5 border-b flex items-center gap-3" style={{ borderColor: BD }}>
          <SearchBar placeholder="Search orders by ID, supplier…" className="flex-1 max-w-xs" />
          <select className="border rounded-xl px-3 py-2 text-xs focus:outline-none" style={{ borderColor: BD, color: TX2 }}>
            <option>All Statuses</option>
            <option>Confirmed</option>
            <option>In Transit</option>
            <option>Pending</option>
            <option>Draft</option>
          </select>
          <div className="ml-auto flex gap-2">
            <SecondaryBtn icon={Printer} size="sm">PDF</SecondaryBtn>
            <SecondaryBtn icon={Download} size="sm">Excel</SecondaryBtn>
          </div>
        </div>
        <TableBase headers={["Order ID", "Supplier", "Order Date", "Expected Delivery", "Amount", "Items", "Status", ""]}>
          {purchaseOrders.map((po, i) => (
            <TableRow key={po.id} last={i === purchaseOrders.length - 1}>
              <Td mono>{po.id}</Td>
              <td className="px-5 py-3.5 text-sm font-semibold" style={{ color: TX }}>{po.supplier}</td>
              <TdSub>{po.date}</TdSub>
              <TdSub>{po.expected}</TdSub>
              <td className="px-5 py-3.5 text-sm font-bold" style={{ color: V }}>{po.amount}</td>
              <TdSub>{po.items} items</TdSub>
              <Td><StatusBadge label={po.status} /></Td>
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-1">
                  <GhostBtn icon={Eye}>View</GhostBtn>
                  <button className="text-gray-400 hover:text-gray-600 transition-colors"><MoreHorizontal size={14} /></button>
                </div>
              </td>
            </TableRow>
          ))}
        </TableBase>
        <Pagination total={23} />
      </Card>
    </div>
  );
}

function ReportsPage() {
  const reportTypes = [
    { icon: ShoppingCart, label: "Sales Report", desc: "Monthly & quarterly sales analysis with trends", color: V, bg: VL },
    { icon: Truck, label: "Supplier Report", desc: "Vendor performance, ratings & evaluation", color: INFO, bg: "#EFF6FF" },
    { icon: Boxes, label: "Inventory Report", desc: "Stock levels, turnover & valuation summary", color: WARNING, bg: "#FFFBEB" },
    { icon: Activity, label: "KPI Report", desc: "Key performance indicator summary dashboard", color: SUCCESS, bg: "#F0FDF4" },
    { icon: Brain, label: "BI Report", desc: "AI-driven forecasts & business intelligence", color: "#8B5CF6", bg: "#F5F3FF" },
    { icon: DollarSign, label: "Profit & Loss", desc: "P&L statement with category breakdowns", color: ERROR, bg: "#FEF2F2" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Reports & Exports" subtitle="Generate, schedule, and export automated business reports">
        <SecondaryBtn icon={Clock}>Schedule Report</SecondaryBtn>
        <PrimaryBtn icon={Cloud}>Cloud Backup</PrimaryBtn>
      </PageHeader>

      <div className="grid grid-cols-3 gap-4">
        {reportTypes.map((r) => (
          <Card key={r.label} className="hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 cursor-pointer">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: r.bg }}>
              <r.icon size={20} style={{ color: r.color }} />
            </div>
            <div className="text-sm font-bold mb-1" style={{ color: TX }}>{r.label}</div>
            <div className="text-xs mb-4 leading-relaxed" style={{ color: TX2 }}>{r.desc}</div>
            <div className="flex gap-2 flex-wrap">
              <PrimaryBtn icon={Printer} size="sm">Generate</PrimaryBtn>
              <SecondaryBtn icon={FileText} size="sm">PDF</SecondaryBtn>
              <SecondaryBtn icon={Download} size="sm">Excel</SecondaryBtn>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <SectionHead title="Scheduled Reports" subtitle="Automated report delivery via email and cloud">
          <PrimaryBtn icon={Plus} size="sm">Add Schedule</PrimaryBtn>
        </SectionHead>
        <div className="space-y-3">
          {[
            { name: "Weekly Sales Summary", freq: "Every Monday · 08:00 UTC", to: "team@company.com", fmt: "PDF + Excel", next: "Jul 14, 2026" },
            { name: "Monthly KPI Dashboard", freq: "1st of month · 07:00 UTC", to: "management@company.com", fmt: "PDF", next: "Aug 1, 2026" },
            { name: "Supplier Performance", freq: "Every Friday · 17:00 UTC", to: "procurement@company.com", fmt: "Excel", next: "Jul 11, 2026" },
            { name: "Low Stock Alert", freq: "Daily · 09:00 UTC", to: "warehouse@company.com", fmt: "Email", next: "Jul 10, 2026" },
          ].map((s) => (
            <div key={s.name} className="flex items-center gap-4 rounded-xl p-4 border" style={{ borderColor: BD }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: VL }}>
                <Calendar size={15} style={{ color: V }} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold" style={{ color: TX }}>{s.name}</div>
                <div className="text-xs mt-0.5" style={{ color: TX2 }}>{s.freq} · To: {s.to}</div>
              </div>
              <StatusBadge label={s.fmt === "Email" ? "Active" : "Active"} />
              <div className="text-xs font-medium" style={{ color: TX2 }}>Next: {s.next}</div>
              <SecondaryBtn icon={Mail} size="sm">Test Send</SecondaryBtn>
              <button className="text-gray-400 hover:text-gray-600 transition-colors"><MoreHorizontal size={14} /></button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function KpiPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="KPI Monitoring" subtitle="Real-time key performance indicator tracking against targets">
        <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full"
          style={{ background: "#F0FDF4", color: SUCCESS }}>
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: SUCCESS }} />
          Live · Refresh every 60s
        </div>
        <SecondaryBtn icon={Download}>Export</SecondaryBtn>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4">
        {kpis.map((k) => {
          const pct = Math.min((k.value / k.target) * 100, 100);
          return (
            <Card key={k.name}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold" style={{ color: TX }}>{k.name}</span>
                <span className="text-xs font-bold px-2 py-1 rounded-full"
                  style={{ background: pct >= 95 ? "#F0FDF4" : pct >= 85 ? VL : "#FFFBEB", color: pct >= 95 ? SUCCESS : pct >= 85 ? V : WARNING }}>
                  {pct.toFixed(0)}% of target
                </span>
              </div>
              <div className="flex items-end gap-3 mb-3">
                <span className="text-3xl font-bold" style={{ color: k.color }}>{k.value}{k.unit}</span>
                <span className="text-sm mb-0.5" style={{ color: TX2 }}>/ {k.target}{k.unit} target</span>
              </div>
              <div className="h-2.5 rounded-full" style={{ background: BD }}>
                <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%`, background: k.color }} />
              </div>
            </Card>
          );
        })}
      </div>

      <Card p={false}>
        <div className="p-6 pb-0">
          <SectionHead title="Profit Analysis" subtitle="Net profit vs sales — last 6 months" />
        </div>
        <div className="px-6 pb-6">
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={salesTrendData.slice(-6)}>
              <CartesianGrid strokeDasharray="3 3" stroke={BD} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: TX2, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: TX2, fontFamily: "Inter" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}K`} />
              <Tooltip contentStyle={TT_STYLE} formatter={(v: unknown) => [`₱${v}K`, ""]} />
              <Bar dataKey="profit" fill={V} radius={[6, 6, 0, 0]} name="Net Profit" barSize={36} />
              <Line type="monotone" dataKey="sales" stroke={SUCCESS} strokeWidth={2} dot={false} name="Sales" strokeDasharray="5 3" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

function BiPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Business Intelligence" subtitle="AI-powered insights, demand forecasting, and strategic recommendations">
        <div className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full border"
          style={{ background: VL, color: V, borderColor: "#C4B5FD" }}>
          <Brain size={12} />
          AI Engine Active
        </div>
        <SecondaryBtn icon={RefreshCw}>Refresh Insights</SecondaryBtn>
      </PageHeader>

      {/* Forecast chart */}
      <Card p={false}>
        <div className="p-6 pb-0">
          <SectionHead title="Revenue Forecasting" subtitle="12-month forward projection with 87% confidence interval">
            <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: VL, color: V }}>87% Confidence</span>
          </SectionHead>
        </div>
        <div className="px-6 pb-6">
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={[
              ...salesTrendData.slice(6).map((d) => ({ month: d.month, actual: d.revenue, forecast: undefined as number | undefined })),
              { month: "Jan '27", actual: undefined, forecast: 598 },
              { month: "Feb '27", actual: undefined, forecast: 631 },
              { month: "Mar '27", actual: undefined, forecast: 618 },
              { month: "Apr '27", actual: undefined, forecast: 672 },
              { month: "May '27", actual: undefined, forecast: 714 },
              { month: "Jun '27", actual: undefined, forecast: 698 },
            ]}>
              <defs>
                <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={V} stopOpacity={0.15} /><stop offset="100%" stopColor={V} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fctGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SUCCESS} stopOpacity={0.15} /><stop offset="100%" stopColor={SUCCESS} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={BD} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: TX2, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: TX2 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}K`} />
              <Tooltip contentStyle={TT_STYLE} formatter={(v: unknown) => v ? [`₱${v}K`, ""] : [""]} />
              <Area type="monotone" dataKey="actual" stroke={V} strokeWidth={2.5} fill="url(#actGrad)" dot={false} name="Actual" connectNulls />
              <Area type="monotone" dataKey="forecast" stroke={SUCCESS} strokeWidth={2} strokeDasharray="6 3" fill="url(#fctGrad)" dot={false} name="Forecast" connectNulls />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-5 mt-2">
            {[{ c: V, l: "Actual Revenue" }, { c: SUCCESS, l: "AI Forecast", d: true }].map((i) => (
              <div key={i.l} className="flex items-center gap-1.5 text-xs" style={{ color: TX2 }}>
                <div className="h-0.5 w-5 rounded" style={{ background: i.d ? "transparent" : i.c, borderTop: i.d ? `2px dashed ${i.c}` : undefined }} />
                {i.l}
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* AI Insight Cards */}
      <div className="grid grid-cols-3 gap-4">
        {biInsights.map((ins) => (
          <Card key={ins.title} className="hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: ins.bg }}>
                <ins.icon size={16} style={{ color: ins.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-bold" style={{ color: TX }}>{ins.title}</span>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: ins.bg, color: ins.color }}>{ins.tag}</span>
              </div>
            </div>
            <p className="text-xs leading-relaxed mb-4" style={{ color: TX2 }}>{ins.desc}</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-20 rounded-full" style={{ background: BD }}>
                  <div className="h-full rounded-full" style={{ width: `${ins.confidence}%`, background: ins.color }} />
                </div>
                <span className="text-[10px]" style={{ color: TX2 }}>{ins.confidence}% confidence</span>
              </div>
              <GhostBtn icon={ArrowUpRight}>View</GhostBtn>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function CloudPage() {
  const [syncing, setSyncing] = useState(false);
  return (
    <div className="space-y-6">
      <PageHeader title="Cloud Synchronization" subtitle="Real-time cloud backup, sync status, and storage management">
        <SecondaryBtn icon={RefreshCw} onClick={() => { setSyncing(true); setTimeout(() => setSyncing(false), 2500); }}>
          {syncing ? "Syncing…" : "Sync Now"}
        </SecondaryBtn>
        <PrimaryBtn icon={Cloud}>Configure</PrimaryBtn>
      </PageHeader>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Storage Used", value: "142 / 500 GB", pct: 28, color: V, icon: Database },
          { label: "Last Backup", value: "07:00 UTC · Jul 9", pct: 100, color: SUCCESS, icon: CheckCircle },
          { label: "Sync Status", value: "Online", pct: 100, color: SUCCESS, icon: Cloud },
          { label: "Backup Retention", value: "365 days", pct: 100, color: INFO, icon: Clock },
        ].map((item) => (
          <Card key={item.label}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: VL }}>
                <item.icon size={15} style={{ color: item.color }} />
              </div>
              <span className="text-xs font-medium" style={{ color: TX2 }}>{item.label}</span>
            </div>
            <div className="text-base font-bold mb-2" style={{ color: TX }}>{item.value}</div>
            <div className="h-1.5 rounded-full" style={{ background: BD }}>
              <div className="h-full rounded-full" style={{ width: `${item.pct}%`, background: item.color }} />
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <SectionHead title="Backup History" subtitle="Automated cloud backup operations log" />
        <div className="space-y-2">
          {[
            { time: "Jul 9, 2026 · 07:00 UTC", type: "Full Backup", size: "4.2 GB", dur: "3m 18s", ok: true },
            { time: "Jul 8, 2026 · 19:00 UTC", type: "Incremental", size: "0.8 GB", dur: "42s", ok: true },
            { time: "Jul 8, 2026 · 07:00 UTC", type: "Full Backup", size: "4.1 GB", dur: "3m 04s", ok: true },
            { time: "Jul 7, 2026 · 19:00 UTC", type: "Incremental", size: "1.1 GB", dur: "58s", ok: true },
            { time: "Jul 7, 2026 · 07:00 UTC", type: "Full Backup", size: "4.0 GB", dur: "3m 22s", ok: true },
          ].map((b, i) => (
            <div key={i} className="flex items-center gap-4 rounded-xl p-4 border" style={{ borderColor: BD }}>
              <CheckCircle size={16} style={{ color: SUCCESS }} className="shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-semibold" style={{ color: TX }}>{b.time}</div>
                <div className="text-xs mt-0.5" style={{ color: TX2 }}>{b.type} · {b.size} · Duration: {b.dur}</div>
              </div>
              <StatusBadge label="Success" />
              <SecondaryBtn icon={Download} size="sm">Restore</SecondaryBtn>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function UsersPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="User Management" subtitle="5 registered users · Role-based access control">
        <SecondaryBtn icon={Download}>Export</SecondaryBtn>
        <PrimaryBtn icon={Plus}>Invite User</PrimaryBtn>
      </PageHeader>

      <Card p={false}>
        <div className="p-5 border-b flex items-center gap-3" style={{ borderColor: BD }}>
          <SearchBar placeholder="Search users by name or email…" className="flex-1 max-w-xs" />
          <select className="border rounded-xl px-3 py-2 text-xs focus:outline-none" style={{ borderColor: BD, color: TX2 }}>
            <option>All Roles</option>
            <option>Administrator</option>
            <option>Manager</option>
            <option>Staff</option>
          </select>
          <select className="border rounded-xl px-3 py-2 text-xs focus:outline-none" style={{ borderColor: BD, color: TX2 }}>
            <option>All Statuses</option>
            <option>Active</option>
            <option>Suspended</option>
          </select>
        </div>
        <TableBase headers={["User", "Email", "Role", "Department", "Status", "Last Login", ""]}>
          {users.map((u, i) => (
            <TableRow key={u.email} last={i === users.length - 1}>
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold"
                    style={{ background: V }}>{u.name.split(" ").map((n: string) => n[0]).join("")}</div>
                  <span className="text-sm font-semibold" style={{ color: TX }}>{u.name}</span>
                </div>
              </td>
              <TdSub>{u.email}</TdSub>
              <td className="px-5 py-3.5">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: VL, color: V }}>{u.role}</span>
              </td>
              <TdSub>{u.dept}</TdSub>
              <Td><StatusBadge label={u.status} /></Td>
              <TdSub>{u.lastLogin}</TdSub>
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-1">
                  <GhostBtn icon={Eye}>View</GhostBtn>
                  <button className="text-gray-400 hover:text-gray-600 transition-colors"><MoreHorizontal size={14} /></button>
                </div>
              </td>
            </TableRow>
          ))}
        </TableBase>
        <Pagination total={5} />
      </Card>
    </div>
  );
}

function AuditPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Audit Logs" subtitle="System activity trail and compliance records">
        <SecondaryBtn icon={Filter}>Filter</SecondaryBtn>
        <SecondaryBtn icon={Calendar}>Date Range</SecondaryBtn>
        <PrimaryBtn icon={Download}>Export Logs</PrimaryBtn>
      </PageHeader>

      <Card p={false}>
        <div className="p-5 border-b flex items-center gap-3" style={{ borderColor: BD }}>
          <SearchBar placeholder="Search by user, action, or module…" className="flex-1 max-w-md" />
          <select className="border rounded-xl px-3 py-2 text-xs focus:outline-none" style={{ borderColor: BD, color: TX2 }}>
            <option>All Results</option>
            <option>Success</option>
            <option>Failed</option>
          </select>
          <select className="border rounded-xl px-3 py-2 text-xs focus:outline-none" style={{ borderColor: BD, color: TX2 }}>
            <option>All Modules</option>
            <option>Reports</option>
            <option>Inventory</option>
            <option>Cloud Sync</option>
          </select>
        </div>
        <TableBase headers={["Log ID", "User", "Role", "Action", "Module", "Timestamp", "IP Address", "Result"]}>
          {auditLogs.map((log, i) => (
            <TableRow key={log.id} last={i === auditLogs.length - 1}>
              <Td mono>{log.id}</Td>
              <td className="px-5 py-3.5">
                <span className="text-sm font-semibold" style={{ color: TX }}>{log.user}</span>
              </td>
              <td className="px-5 py-3.5">
                <span className="text-xs font-medium px-2 py-1 rounded-lg" style={{ background: "#F3F4F6", color: TX2 }}>{log.role}</span>
              </td>
              <TdSub>{log.action}</TdSub>
              <td className="px-5 py-3.5">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: VL, color: V }}>{log.module}</span>
              </td>
              <Td mono>{log.timestamp}</Td>
              <Td mono>{log.ip}</Td>
              <td className="px-5 py-3.5">
                {log.result === "Success"
                  ? <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: SUCCESS }}><CheckCircle size={12} />Success</span>
                  : <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: ERROR }}><XCircle size={12} />Failed</span>}
              </td>
            </TableRow>
          ))}
        </TableBase>
        <Pagination total={1284} />
      </Card>
    </div>
  );
}

function PlaceholderPage({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-80 gap-4">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: VL }}>
        <Layers size={28} style={{ color: V }} />
      </div>
      <div className="text-center">
        <h2 className="text-lg font-bold" style={{ color: TX }}>{title}</h2>
        <p className="text-sm mt-1" style={{ color: TX2 }}>{subtitle}</p>
      </div>
    </div>
  );
}

// ─── MAIN APP ──────────────────────────────────────────────────────────────────
export default function DashboardApp({ userId, userName, userEmail, userRole, onSignOut, liveCounts }: { userId: string; userName?: string; userEmail?: string; userRole?: string; onSignOut?: () => void; liveCounts?: { inventory: number; suppliers: number; purchaseOrders: number } }) {
  const [active, setActive] = useState<NavKey>("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState<Array<{ icon: typeof AlertTriangle; color: string; bg: string; title: string; time: string; unread: boolean }>>([]);

  useEffect(() => {
    let activeRequest = true;
    const refreshAlerts = () => listInventoryItems(userId).then(({ data, error }) => {
      if (!activeRequest || error) return;
      const alerts = (data || []).filter((item) => item.status === "low_stock" || item.status === "out_of_stock" || (Number(item.quantity) > 0 && Number(item.quantity) <= Number(item.reorder_level))).slice(0, 5);
      setNotifications(alerts.map((item) => ({
        icon: AlertTriangle,
        color: item.status === "out_of_stock" || Number(item.quantity) <= 0 ? ERROR : WARNING,
        bg: item.status === "out_of_stock" || Number(item.quantity) <= 0 ? "#FEF2F2" : "#FFFBEB",
        title: `${item.name}: ${Number(item.quantity) <= 0 ? "out of stock" : `${item.quantity} left (reorder at ${item.reorder_level})`}`,
        time: "Needs attention",
        unread: true,
      })));
    });
    void refreshAlerts();
    window.addEventListener("inventory-changed", refreshAlerts);
    return () => { activeRequest = false; window.removeEventListener("inventory-changed", refreshAlerts); };
  }, [userId]);

  const pages: Record<NavKey, React.ReactNode> = {
    dashboard: <LiveDashboard ownerId={userId} userName={userName} />,
    sales: <SalesWorkspace ownerId={userId} />,
    inventory: <InventoryWorkspace ownerId={userId} />,
    merchandise: <PlaceholderPage title="Merchandise" subtitle="Product catalog, pricing, and merchandise planning" />,
    suppliers: <ProcurementWorkspace ownerId={userId} mode="suppliers" />,
    evaluation: <PlaceholderPage title="Supplier Evaluation" subtitle="Supplier evaluation data will appear here when records are available." />,
    "purchase-orders": <ProcurementWorkspace ownerId={userId} mode="orders" />,
    reports: <PlaceholderPage title="Reports" subtitle="Reports will appear here when Supabase reporting data is available." />,
    kpi: <PlaceholderPage title="KPI Monitoring" subtitle="KPIs will appear here when Supabase metrics are available." />,
    bi: <PlaceholderPage title="Business Intelligence" subtitle="Insights will appear here when Supabase analytics data is available." />,
    cloud: <PlaceholderPage title="Cloud Sync" subtitle="Cloud synchronization status will appear here." />,
    users: <PlaceholderPage title="User Management" subtitle="User records will appear here when user-management data is available." />,
    audit: <PlaceholderPage title="Audit Logs" subtitle="Audit events will appear here when audit data is available." />,
    settings: <PlaceholderPage title="Settings" subtitle="System configuration, preferences, and integrations" />,
  };

  const currentLabel = navGroups.flatMap(g => g.items).find(i => i.key === active)?.label ?? "Dashboard";
  const restrictedKeys: NavKey[] = userRole === "admin" ? [] : userRole === "manager" ? ["users"] : ["users", "audit", "reports", "kpi", "bi", "cloud", "settings", "evaluation"];
  const visibleNavGroups = navGroups.map((group) => ({ ...group, items: group.items.filter((item) => !restrictedKeys.includes(item.key)) })).filter((group) => group.items.length > 0);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: BG, fontFamily: "'Inter', sans-serif" }}>

      {/* ── SIDEBAR ── */}
      {mobileNavOpen && <button aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} className="fixed inset-0 z-40 bg-black/30 md:hidden" />}
      <aside className={`fixed md:relative inset-y-0 left-0 z-50 flex flex-col h-full shrink-0 transition-all duration-300 ${mobileNavOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
        style={{
          width: collapsed ? 68 : 240,
          background: SB,
          boxShadow: "1px 0 0 #1F2937",
        }}>

        {/* Logo */}
        <div className="flex items-center gap-3 px-4 pt-5 pb-5" style={{ borderBottom: "1px solid #1F2937" }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 overflow-hidden bg-white"
            style={{ boxShadow: `0 4px 12px ${V}50` }}>
            <Image src="/images/tri-m-logo.png" alt="TRI-M Global Logistics & Trading Inc." width={34} height={34} className="object-contain" />
          </div>
          {!collapsed && (
            <div>
              <div className="text-sm font-bold text-white leading-tight">TRI-M SCIMS</div>
              <div className="text-[10px] text-gray-500 leading-tight mt-0.5">Supply Chain & Inventory</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-2.5 space-y-5" style={{ scrollbarWidth: "none" }}>
          {visibleNavGroups.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <div className="text-[10px] font-bold uppercase tracking-widest px-2 mb-1.5" style={{ color: "#4B5563" }}>
                  {group.label}
                </div>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const { key, icon: Icon, label } = item;
                  const badge = "badge" in item ? item.badge : undefined;
                  const isActive = active === key;
                  return (
                    <button key={key} onClick={() => setActive(key)}
                      className="relative w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-sm transition-all duration-150 text-left group"
                      style={{
                        background: isActive ? `${V}20` : "transparent",
                        color: isActive ? "#fff" : "#9CA3AF",
                      }}
                      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "#1F2937"; }}
                      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full"
                          style={{ background: V }} />
                      )}
                      <Icon size={16} style={{ color: isActive ? "#fff" : "#6B7280", flexShrink: 0 }} />
                      {!collapsed && (
                        <>
                          <span className="flex-1 text-[13px] font-medium"
                            style={{ color: isActive ? "#fff" : "#9CA3AF" }}>{label}</span>
                          {'badge' in group.items.find((item) => item.key === key)! && badge && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{ background: isActive ? `${V}40` : "#374151", color: isActive ? "#fff" : "#D1D5DB" }}>
                              {String(badge)}
                            </span>
                          )}
                        </>
                      )}
                      {collapsed && (
                        <div className="pointer-events-none absolute left-full ml-3 z-50 px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ background: "#111827", color: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,0.3)", border: "1px solid #374151" }}>
                          {label}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Collapse toggle */}
        <div className="p-2.5" style={{ borderTop: "1px solid #1F2937" }}>
          <button onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-colors"
            style={{ color: "#6B7280" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#1F2937"; e.currentTarget.style.color = "#D1D5DB"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#6B7280"; }}>
            {collapsed ? <ChevronRight size={15} /> : <><ChevronLeft size={15} /><span>Collapse</span></>}
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top Nav */}
        <header className="h-16 shrink-0 flex items-center gap-4 px-6 bg-white"
          style={{ borderBottom: `1px solid ${BD}`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>

          <button aria-label="Open navigation" onClick={() => setMobileNavOpen(true)} className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center hover:bg-gray-100" style={{ color: TX2 }}><Menu size={18} /></button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm min-w-0">
            <span style={{ color: TX2 }}>TRI-M SCIMS</span>
            <ChevronRight size={14} style={{ color: BD }} />
            <span className="font-semibold" style={{ color: TX }}>{currentLabel}</span>
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 rounded-xl border px-3 py-2 ml-4 flex-1 max-w-sm"
            style={{ background: BG, borderColor: BD }}>
            <Search size={14} style={{ color: TX2 }} />
            <input placeholder="Search anything… (⌘K)"
              className="bg-transparent text-sm focus:outline-none flex-1" style={{ color: TX }} />
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Live indicator */}
            <div className="hidden md:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{ background: "#F0FDF4", color: SUCCESS, border: `1px solid #BBF7D0` }}>
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: SUCCESS }} />
              Live
            </div>

            {/* Notifications */}
            <div className="relative">
              <button onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); }}
                className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-gray-100"
                style={{ color: TX2 }}>
                <Bell size={16} />
                {notifications.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full border-2 border-white" style={{ background: ERROR }} />}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl border shadow-2xl z-50 overflow-hidden"
                  style={{ borderColor: BD }}>
                  <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${BD}` }}>
                    <span className="text-sm font-bold" style={{ color: TX }}>Notifications</span>
                    <button className="text-xs font-semibold" style={{ color: V }}>Mark all read</button>
                  </div>
                  {notifications.map((n, i) => (
                    <div key={i} className="flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer"
                      style={{ borderBottom: i < notifications.length - 1 ? `1px solid ${BD}` : "none" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = BG; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; }}>
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ background: n.bg }}>
                        <n.icon size={14} style={{ color: n.color }} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start gap-1">
                          <span className="text-xs font-semibold flex-1" style={{ color: TX }}>{n.title}</span>
                          {n.unread && <div className="w-2 h-2 rounded-full mt-0.5 shrink-0" style={{ background: V }} />}
                        </div>
                        <div className="text-[10px] mt-0.5" style={{ color: TX2 }}>{n.time}</div>
                      </div>
                    </div>
                  ))}
                  {notifications.length === 0 && <div className="px-4 py-6 text-center text-xs" style={{ color: TX2 }}>No low-stock alerts. Inventory looks healthy.</div>}
                </div>
              )}
            </div>

            {/* Profile */}
            <div className="relative">
              <button onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); }}
                className="flex items-center gap-2.5 pl-3 ml-1 transition-all rounded-xl hover:bg-gray-50 pr-2 py-1.5"
                style={{ borderLeft: `1px solid ${BD}` }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold"
                  style={{ background: V, boxShadow: `0 2px 8px ${V}40` }}>
                  {(userName || "TM").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-xs font-bold" style={{ color: TX }}>{userName || "TRI-M User"}</div>
                  <div className="text-[10px]" style={{ color: TX2 }}>{userRole || "Staff"}</div>
                </div>
                <ChevronDown size={12} style={{ color: TX2 }} />
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-12 w-52 bg-white rounded-2xl border shadow-2xl z-50 overflow-hidden"
                  style={{ borderColor: BD }}>
                  <div className="px-4 py-3" style={{ borderBottom: `1px solid ${BD}` }}>
                    <div className="text-sm font-bold" style={{ color: TX }}>{userName || "TRI-M User"}</div>
                    <div className="text-xs" style={{ color: TX2 }}>{userEmail || "user@tri-m.com"}</div>
                  </div>
                  {[
                    { icon: UserCog, label: "Profile Settings" },
                    { icon: Settings, label: "Preferences" },
                    { icon: ShieldCheck, label: "Security" },
                  ].map((item) => (
                    <button key={item.label}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors text-left"
                      style={{ color: TX }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = BG; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; }}>
                      <item.icon size={14} style={{ color: TX2 }} />
                      {item.label}
                    </button>
                  ))}
                  <div style={{ borderTop: `1px solid ${BD}` }}>
                    <button onClick={onSignOut}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors text-left"
                      style={{ color: ERROR }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "#FEF2F2"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; }}>
                      <LogOut size={14} />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6" style={{ scrollbarWidth: "none" }}
          onClick={() => { setNotifOpen(false); setProfileOpen(false); }}>
          {pages[active]}
        </main>
      </div>
    </div>
  );
}
