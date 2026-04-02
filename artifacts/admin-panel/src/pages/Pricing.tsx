import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  BadgePercent, ChevronDown, Save, RefreshCw,
  IndianRupee, Truck, Wrench, Clock, Fuel, UserCog,
  Package, Zap, AlertCircle, TrendingUp, Wallet, HandCoins,
  Layers, Tag, CheckCircle2,
} from "lucide-react";

// ── Static subcategory lists ──────────────────────────────────────────────────
const SUBCATEGORIES: Record<string, string[]> = {
  services: [
    "Plumbing", "Electrician", "Beauty", "Carpenter", "Painter", "AC Repair",
  ],
  professions: [
    "Doctor (Home Visit)", "Lawyer", "Accountant", "Tutor",
    "Photographer", "Event Manager", "Nutritionist", "Yoga Trainer",
  ],
  equipment: [
    "Tractor", "Harvester", "Rotavator", "Sprayer", "Plough", "Cultivator",
    "JCB", "Excavator", "Bulldozer", "Poclain", "Rock Breaker", "Wheel Loader",
    "Chhota Hathi", "Loader", "Backhoe", "Roller", "Crane", "Dump Truck",
  ],
};

const CATEGORY_LABELS: Record<string, string> = {
  services: "Services",
  professions: "Professions",
  equipment: "Equipment",
};

type PricingMode = "subcategory" | "service_type";

// ── Default zero rule ─────────────────────────────────────────────────────────
function defaultRule(category: string, subcategory: string, service_type?: string) {
  return {
    category, subcategory, service_type: service_type ?? "",
    base_fee: 0, hourly_rate: 0, daily_rate: 0, km_rate: 0,
    operator_fee: 0, fuel_fee: 0, material_fee: 0, urgency_fee: 0,
    delivery_fee: 0, platform_fee: 0, commission_percent: 10,
    security_deposit: 0,
  };
}

// ── Numeric input field ───────────────────────────────────────────────────────
function Field({ label, icon: Icon, value, onChange, unit = "₹", step = 1 }: {
  label: string; icon: any; value: number;
  onChange: (v: number) => void; unit?: string; step?: number;
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center">
          <Icon size={14} className="text-orange-600" />
        </div>
        <p className="text-xs font-semibold text-gray-700">{label}</p>
        {unit && <span className="ml-auto text-xs text-gray-400">{unit}</span>}
      </div>
      <input
        type="number"
        min={0}
        step={step}
        value={value}
        onChange={e => onChange(Math.max(0, Number(e.target.value)))}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-base font-bold text-gray-900 outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-100 text-center bg-white"
      />
    </div>
  );
}

// ── Dropdown ──────────────────────────────────────────────────────────────────
function Dropdown({ label, value, options, onChange, placeholder }: {
  label: string; value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full appearance-none bg-white border-2 border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-800 outline-none focus:border-orange-400 cursor-pointer pr-10"
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      </div>
    </div>
  );
}

// ── Live Preview Card ─────────────────────────────────────────────────────────
function PreviewCard({ rule, category }: { rule: any; category: string }) {
  const isEquipment = category === "equipment";

  const customerPrice = useMemo(() => {
    if (isEquipment) {
      return (
        Number(rule.daily_rate) * 1 +
        Number(rule.delivery_fee) +
        Number(rule.fuel_fee) +
        Number(rule.operator_fee) +
        Number(rule.platform_fee)
      );
    }
    return (
      Number(rule.base_fee) +
      Number(rule.hourly_rate) * 1 +
      Number(rule.material_fee) +
      Number(rule.km_rate) * 5 +
      Number(rule.urgency_fee) +
      Number(rule.platform_fee)
    );
  }, [rule, isEquipment]);

  const commission = Math.round(customerPrice * Number(rule.commission_percent) / 100);
  const providerGets = Math.round(customerPrice - commission);
  const hint = isEquipment ? "1 day · 0 km" : "1 hr · 5 km";

  return (
    <div className="bg-gradient-to-br from-[#FF7A18] to-[#FF9F43] rounded-2xl p-5 text-white shadow-lg">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={18} />
        <span className="font-bold text-sm">Live Price Preview</span>
        <span className="ml-auto text-xs bg-white/20 px-2 py-0.5 rounded-full">{hint}</span>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between bg-white/15 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <IndianRupee size={15} />
            <span className="text-sm font-medium">Customer Price</span>
          </div>
          <span className="text-xl font-black">₹{Math.round(customerPrice).toLocaleString("en-IN")}</span>
        </div>

        <div className="flex items-center justify-between bg-white/15 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <Wallet size={15} />
            <span className="text-sm font-medium">Provider Gets</span>
          </div>
          <span className="text-xl font-black">₹{providerGets.toLocaleString("en-IN")}</span>
        </div>

        <div className="flex items-center justify-between bg-white/15 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <HandCoins size={15} />
            <span className="text-sm font-medium">App Commission ({rule.commission_percent}%)</span>
          </div>
          <span className="text-xl font-black">₹{commission.toLocaleString("en-IN")}</span>
        </div>

        {isEquipment && Number(rule.security_deposit) > 0 && (
          <div className="flex items-center justify-between bg-white/10 rounded-xl px-4 py-2.5">
            <span className="text-xs font-medium opacity-80">Security Deposit</span>
            <span className="text-sm font-bold">₹{Number(rule.security_deposit).toLocaleString("en-IN")}</span>
          </div>
        )}
      </div>

      {customerPrice === 0 && (
        <div className="flex items-center gap-1.5 mt-3 bg-white/10 rounded-xl px-3 py-2">
          <AlertCircle size={13} />
          <span className="text-xs">Set pricing values above to see the preview</span>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Pricing() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [category, setCategory] = useState("services");
  const [subcategory, setSubcategory] = useState(SUBCATEGORIES["services"][0]);
  const [mode, setMode] = useState<PricingMode>("subcategory");
  const [serviceType, setServiceType] = useState("");
  const [form, setForm] = useState<any>(defaultRule("services", SUBCATEGORIES["services"][0]));
  const [dirty, setDirty] = useState(false);

  // ── Data queries ──────────────────────────────────────────────────────────
  const { data: allRules = [], isLoading } = useQuery<any[]>({
    queryKey: ["pricing-rules"],
    queryFn: () => api.get("/pricing/admin/rules"),
  });

  const { data: serviceTypesData } = useQuery<{ serviceTypes: string[] }>({
    queryKey: ["pricing-service-types", subcategory],
    queryFn: () => api.get(`/pricing/admin/service-types?subcategory=${encodeURIComponent(subcategory)}`),
    enabled: !!subcategory,
  });
  const serviceTypes = serviceTypesData?.serviceTypes ?? [];

  const { data: stRules = [] } = useQuery<any[]>({
    queryKey: ["pricing-service-type-rules", category, subcategory],
    queryFn: () => api.get(`/pricing/admin/service-type-rules?category=${category}&subcategory=${encodeURIComponent(subcategory)}`),
    enabled: !!category && !!subcategory,
  });

  // ── Category / subcategory change ─────────────────────────────────────────
  function handleCategoryChange(cat: string) {
    setCategory(cat);
    const firstSub = SUBCATEGORIES[cat][0];
    setSubcategory(firstSub);
    setServiceType("");
    setMode("subcategory");
    loadSubcategoryRule(cat, firstSub, allRules);
  }

  function handleSubcategoryChange(sub: string) {
    setSubcategory(sub);
    setServiceType("");
    setMode("subcategory");
    loadSubcategoryRule(category, sub, allRules);
  }

  function loadSubcategoryRule(cat: string, sub: string, rules: any[]) {
    const existing = rules.find((r: any) => r.category === cat && r.subcategory === sub);
    setForm(existing ? { ...existing } : defaultRule(cat, sub));
    setDirty(false);
  }

  function handleServiceTypeChange(st: string) {
    setServiceType(st);
    if (!st) return;
    const existing = stRules.find((r: any) => r.service_type === st);
    setForm(existing ? { ...existing } : defaultRule(category, subcategory, st));
    setDirty(false);
  }

  function handleModeChange(m: PricingMode) {
    setMode(m);
    setDirty(false);
    if (m === "subcategory") {
      setServiceType("");
      loadSubcategoryRule(category, subcategory, allRules);
    } else {
      // Pre-select first service type
      const firstSt = serviceTypes[0] ?? "";
      setServiceType(firstSt);
      if (firstSt) {
        const existing = stRules.find((r: any) => r.service_type === firstSt);
        setForm(existing ? { ...existing } : defaultRule(category, subcategory, firstSt));
      }
    }
  }

  // Sync form when allRules / stRules load
  useEffect(() => {
    if (mode === "subcategory") {
      loadSubcategoryRule(category, subcategory, allRules);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRules]);

  useEffect(() => {
    if (mode === "service_type" && serviceType) {
      const existing = stRules.find((r: any) => r.service_type === serviceType);
      setForm(existing ? { ...existing } : defaultRule(category, subcategory, serviceType));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stRules]);

  function setField(key: string, value: number) {
    setForm((f: any) => ({ ...f, [key]: value }));
    setDirty(true);
  }

  // ── Save mutations ────────────────────────────────────────────────────────
  const saveSubcategoryMutation = useMutation({
    mutationFn: (data: any) => api.post("/pricing/admin/rules", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pricing-rules"] });
      toast({ title: "Saved!", description: `Subcategory pricing for ${subcategory} updated.` });
      setDirty(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const saveServiceTypeMutation = useMutation({
    mutationFn: (data: any) => api.post("/pricing/admin/service-type-rules", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pricing-service-type-rules", category, subcategory] });
      toast({ title: "Saved!", description: `Pricing for "${serviceType}" updated.` });
      setDirty(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function handleSave() {
    if (mode === "subcategory") {
      saveSubcategoryMutation.mutate(form);
    } else {
      saveServiceTypeMutation.mutate({ ...form, service_type: serviceType });
    }
  }

  const isSaving = saveSubcategoryMutation.isPending || saveServiceTypeMutation.isPending;
  const isEquipment = category === "equipment";
  const subcategoryOptions = SUBCATEGORIES[category].map(s => ({ value: s, label: s }));
  const categoryOptions = Object.entries(CATEGORY_LABELS).map(([k, v]) => ({ value: k, label: v }));
  const serviceTypeOptions = serviceTypes.map(s => ({ value: s, label: s }));

  const configuredCount = (cat: string) => allRules.filter((r: any) => r.category === cat).length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center shadow-md">
            <BadgePercent size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900">Pricing & Commission</h1>
            <p className="text-sm text-gray-500 mt-0.5">Set subcategory pricing and per-service-type overrides</p>
          </div>
        </div>
        {isLoading && <RefreshCw size={18} className="text-orange-400 animate-spin" />}
      </div>

      {/* Category stat cards */}
      <div className="grid grid-cols-3 gap-4">
        {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
          const count = configuredCount(cat);
          const total = SUBCATEGORIES[cat].length;
          const pct = Math.round((count / total) * 100);
          const icons: Record<string, any> = { services: Wrench, professions: UserCog, equipment: Package };
          const Icon = icons[cat];
          return (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              className={`bg-white rounded-2xl p-4 shadow-sm border-2 transition-all text-left ${
                category === cat ? "border-orange-400 shadow-orange-100" : "border-gray-100 hover:border-orange-200"
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  category === cat ? "bg-orange-100" : "bg-gray-100"
                }`}>
                  <Icon size={18} className={category === cat ? "text-orange-600" : "text-gray-500"} />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{label}</p>
                  <p className="text-xs text-gray-400">{count}/{total} configured</p>
                </div>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div
                  className="bg-gradient-to-r from-orange-400 to-amber-400 h-1.5 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: selectors + form */}
        <div className="lg:col-span-2 space-y-5">

          {/* Category + Subcategory selectors */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Dropdown label="Category" value={category} options={categoryOptions} onChange={handleCategoryChange} />
              <Dropdown label="Subcategory" value={subcategory} options={subcategoryOptions} onChange={handleSubcategoryChange} />
            </div>

            {/* Mode switcher */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Pricing Level</p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleModeChange("subcategory")}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                    mode === "subcategory"
                      ? "bg-orange-50 border-orange-400 text-orange-700"
                      : "bg-gray-50 border-gray-200 text-gray-500 hover:border-orange-200"
                  }`}
                >
                  <Layers size={15} />
                  Subcategory Pricing
                </button>
                <button
                  onClick={() => handleModeChange("service_type")}
                  disabled={serviceTypes.length === 0}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                    mode === "service_type"
                      ? "bg-orange-50 border-orange-400 text-orange-700"
                      : "bg-gray-50 border-gray-200 text-gray-500 hover:border-orange-200"
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  <Tag size={15} />
                  Per Service Type
                  {stRules.length > 0 && (
                    <span className="bg-green-100 text-green-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
                      {stRules.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Service type dropdown — only when in service_type mode */}
            {mode === "service_type" && (
              <div>
                <Dropdown
                  label="Service Type"
                  value={serviceType}
                  options={serviceTypeOptions}
                  onChange={handleServiceTypeChange}
                  placeholder="— Select a service type —"
                />
                {serviceType && (
                  <p className="mt-2 text-xs text-gray-500">
                    Setting price for <span className="font-semibold text-orange-600">{serviceType}</span> under <span className="font-semibold">{subcategory}</span>.
                    If not set, the subcategory price applies.
                  </p>
                )}
              </div>
            )}

            {/* Formula explanation */}
            <div className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-orange-700 mb-1">
                {isEquipment ? "Equipment Pricing Formula" : "Services / Professions Formula"}
              </p>
              <p className="text-xs text-orange-600 font-mono">
                {isEquipment
                  ? "Price = Daily Rate × Days + Delivery + Fuel + Operator + Platform Fee"
                  : "Price = Base Fee + Hourly Rate × Hours + Material + (Per Km × Distance) + Urgency + Platform Fee"
                }
              </p>
            </div>
          </div>

          {/* Pricing fields — only when a service type is chosen in service_type mode */}
          {(mode === "subcategory" || (mode === "service_type" && serviceType)) && (
            <>
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-2">
                  <IndianRupee size={16} className="text-orange-500" />
                  {mode === "service_type" ? `Pricing — ${serviceType}` : (isEquipment ? "Equipment Pricing" : "Service Pricing")}
                </h3>
                {mode === "service_type" && (
                  <p className="text-xs text-gray-400 mb-4">Override pricing for this specific service type only</p>
                )}
                {mode === "subcategory" && <div className="mb-4" />}
                <div className="grid grid-cols-2 gap-3">
                  {isEquipment ? (
                    <>
                      <Field label="Hourly Rate" icon={Clock} value={Number(form.hourly_rate)} onChange={v => setField("hourly_rate", v)} />
                      <Field label="Daily Rate" icon={IndianRupee} value={Number(form.daily_rate)} onChange={v => setField("daily_rate", v)} />
                      <Field label="Delivery Charge" icon={Truck} value={Number(form.delivery_fee)} onChange={v => setField("delivery_fee", v)} />
                      <Field label="Fuel Charge" icon={Fuel} value={Number(form.fuel_fee)} onChange={v => setField("fuel_fee", v)} />
                      <Field label="Operator Fee" icon={UserCog} value={Number(form.operator_fee)} onChange={v => setField("operator_fee", v)} />
                      <Field label="Security Deposit" icon={Package} value={Number(form.security_deposit)} onChange={v => setField("security_deposit", v)} />
                    </>
                  ) : (
                    <>
                      <Field label="Base Visit Fee" icon={IndianRupee} value={Number(form.base_fee)} onChange={v => setField("base_fee", v)} />
                      <Field label="Hourly Rate" icon={Clock} value={Number(form.hourly_rate)} onChange={v => setField("hourly_rate", v)} />
                      <Field label="Material Fee" icon={Package} value={Number(form.material_fee)} onChange={v => setField("material_fee", v)} />
                      <Field label="Per Km Rate" icon={Truck} value={Number(form.km_rate)} onChange={v => setField("km_rate", v)} unit="₹/km" />
                      <Field label="Urgency Fee" icon={Zap} value={Number(form.urgency_fee)} onChange={v => setField("urgency_fee", v)} />
                      <Field label="Platform Fee" icon={Wrench} value={Number(form.platform_fee)} onChange={v => setField("platform_fee", v)} />
                    </>
                  )}
                </div>
              </div>

              {/* Commission */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <BadgePercent size={16} className="text-orange-500" />
                  Platform Commission
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Commission %"
                    icon={BadgePercent}
                    value={Number(form.commission_percent)}
                    onChange={v => setField("commission_percent", Math.min(100, v))}
                    unit="%"
                    step={0.5}
                  />
                  <Field
                    label="Platform Fee"
                    icon={Wrench}
                    value={Number(form.platform_fee)}
                    onChange={v => setField("platform_fee", v)}
                  />
                </div>
              </div>

              {/* Save button */}
              <button
                onClick={handleSave}
                disabled={isSaving}
                className={`w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl font-bold text-sm transition-all shadow-lg ${
                  dirty
                    ? "bg-gradient-to-r from-orange-500 to-amber-400 text-white shadow-orange-200 hover:shadow-orange-300 hover:from-orange-600 hover:to-amber-500 active:scale-[0.98]"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                }`}
              >
                {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                {isSaving ? "Saving..." : dirty
                  ? (mode === "service_type" ? `Save "${serviceType}" Pricing` : "Save Pricing Rule")
                  : "No Changes"
                }
              </button>
            </>
          )}

          {/* Prompt when no service type selected */}
          {mode === "service_type" && !serviceType && (
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-dashed border-orange-200 flex flex-col items-center gap-3 text-center">
              <Tag size={32} className="text-orange-300" />
              <p className="text-sm font-semibold text-gray-600">Select a service type above</p>
              <p className="text-xs text-gray-400">
                Pick a specific service type to configure its individual pricing. If not set, the subcategory price is used.
              </p>
            </div>
          )}
        </div>

        {/* Right: preview + configured rules */}
        <div className="space-y-5">
          {/* Live preview */}
          {(mode === "subcategory" || (mode === "service_type" && serviceType)) && (
            <PreviewCard rule={form} category={category} />
          )}

          {/* Configured subcategory rules */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                Subcategory Rules — {CATEGORY_LABELS[category]}
              </p>
            </div>
            <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
              {allRules
                .filter((r: any) => r.category === category)
                .map((r: any) => {
                  const isSelected = r.subcategory === subcategory && mode === "subcategory";
                  return (
                    <button
                      key={r.subcategory}
                      onClick={() => handleSubcategoryChange(r.subcategory)}
                      className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                        isSelected ? "bg-orange-50" : "hover:bg-gray-50"
                      }`}
                    >
                      <div>
                        <p className={`text-sm font-semibold ${isSelected ? "text-orange-600" : "text-gray-800"}`}>
                          {r.subcategory}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{Number(r.commission_percent)}% commission</p>
                      </div>
                      <CheckCircle2 size={15} className={isSelected ? "text-orange-400" : "text-green-400"} />
                    </button>
                  );
                })
              }
              {allRules.filter((r: any) => r.category === category).length === 0 && (
                <div className="flex flex-col items-center justify-center py-6 text-gray-400">
                  <BadgePercent size={24} className="mb-1.5 text-gray-200" />
                  <p className="text-xs font-medium">No rules set yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Service type rules for current subcategory */}
          {stRules.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-orange-50">
                <p className="text-xs font-bold text-orange-700 uppercase tracking-wide">
                  Service Type Overrides — {subcategory}
                </p>
              </div>
              <div className="divide-y divide-gray-50 max-h-56 overflow-y-auto">
                {stRules.map((r: any) => {
                  const isSelected = r.service_type === serviceType && mode === "service_type";
                  const price = Number(r.base_fee) + Number(r.hourly_rate) + Number(r.platform_fee);
                  return (
                    <button
                      key={r.service_type}
                      onClick={() => { setMode("service_type"); handleServiceTypeChange(r.service_type); }}
                      className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                        isSelected ? "bg-orange-50" : "hover:bg-gray-50"
                      }`}
                    >
                      <div>
                        <p className={`text-sm font-semibold ${isSelected ? "text-orange-600" : "text-gray-800"}`}>
                          {r.service_type}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          ₹{price > 0 ? price.toLocaleString("en-IN") : "0"} · {Number(r.commission_percent)}%
                        </p>
                      </div>
                      <Tag size={13} className={isSelected ? "text-orange-400" : "text-gray-300"} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pending setup */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">Pending Setup</p>
            </div>
            <div className="divide-y divide-gray-50 max-h-48 overflow-y-auto">
              {SUBCATEGORIES[category]
                .filter(sub => !allRules.some((r: any) => r.category === category && r.subcategory === sub))
                .map(sub => (
                  <button
                    key={sub}
                    onClick={() => handleSubcategoryChange(sub)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-gray-50 transition-colors ${
                      subcategory === sub ? "bg-orange-50" : ""
                    }`}
                  >
                    <span className="text-sm text-gray-500">{sub}</span>
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                      Not set
                    </span>
                  </button>
                ))
              }
              {SUBCATEGORIES[category].every(sub =>
                allRules.some((r: any) => r.category === category && r.subcategory === sub)
              ) && (
                <div className="flex items-center justify-center gap-2 py-6 text-green-500">
                  <CheckCircle2 size={15} />
                  <p className="text-xs font-semibold">All subcategories configured!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
