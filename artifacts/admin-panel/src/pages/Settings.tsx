import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { RefreshCw, Save, IndianRupee, Percent, ToggleLeft, ToggleRight, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PlatformSettings {
  baseFare: number; perKmRate: number; surgeMultiplier: number;
  commissionPercent: number; instantBookingEnabled: boolean;
  scheduledRidesEnabled: boolean; carsEnabled: boolean;
  equipmentEnabled: boolean; servicesEnabled: boolean;
}

function NumberField({ label, icon: Icon, value, onChange, unit, step = 1, min = 0 }: any) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center">
          <Icon size={18} className="text-orange-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">{label}</p>
          {unit && <p className="text-xs text-gray-400">{unit}</p>}
        </div>
      </div>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-lg font-bold text-gray-900 outline-none focus:border-orange-400 text-center"
      />
    </div>
  );
}

function ToggleField({ label, description, value, onChange }: any) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`flex-shrink-0 transition-colors ${value ? "text-green-500" : "text-gray-300"}`}
      >
        {value ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
      </button>
    </div>
  );
}

export default function Settings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [settings, setSettings] = useState<PlatformSettings | null>(null);

  const { data, isLoading } = useQuery<PlatformSettings>({
    queryKey: ["admin-settings"],
    queryFn: () => api.get("/admin/settings"),
  });

  useEffect(() => { if (data) setSettings(data); }, [data]);

  const saveMutation = useMutation({
    mutationFn: (s: PlatformSettings) => api.patch("/admin/settings", s),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-settings"] }); toast({ title: "Settings saved successfully" }); },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  function update(key: keyof PlatformSettings, value: any) {
    setSettings(prev => prev ? { ...prev, [key]: value } : prev);
  }

  if (isLoading || !settings) {
    return <div className="flex justify-center py-12"><RefreshCw size={24} className="animate-spin text-orange-500" /></div>;
  }

  return (
    <div className="space-y-6 animate-fadeIn max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Settings</h1>
          <p className="text-gray-500 text-sm mt-0.5">Configure pricing, commissions and features</p>
        </div>
        <button
          onClick={() => settings && saveMutation.mutate(settings)}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-70"
        >
          {saveMutation.isPending ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
          Save Changes
        </button>
      </div>

      {/* Pricing */}
      <div>
        <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
          <IndianRupee size={18} className="text-orange-500" /> Ride Pricing
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <NumberField label="Base Fare" icon={IndianRupee} value={settings.baseFare}
            onChange={(v: number) => update("baseFare", v)} unit="₹ per ride" />
          <NumberField label="Per KM Rate" icon={IndianRupee} value={settings.perKmRate}
            onChange={(v: number) => update("perKmRate", v)} unit="₹ per kilometer" step={0.5} />
          <NumberField label="Surge Multiplier" icon={Zap} value={settings.surgeMultiplier}
            onChange={(v: number) => update("surgeMultiplier", v)} unit="1.0 = no surge" step={0.1} min={1} />
          <NumberField label="Commission %" icon={Percent} value={settings.commissionPercent}
            onChange={(v: number) => update("commissionPercent", v)} unit="% of each booking" />
        </div>
      </div>

      {/* Booking features */}
      <div>
        <h2 className="text-base font-bold text-gray-900 mb-3">Booking Features</h2>
        <div className="space-y-3">
          <ToggleField label="Instant Booking" description="Allow customers to book without provider approval"
            value={settings.instantBookingEnabled} onChange={(v: boolean) => update("instantBookingEnabled", v)} />
          <ToggleField label="Scheduled Rides" description="Allow ride scheduling in advance"
            value={settings.scheduledRidesEnabled} onChange={(v: boolean) => update("scheduledRidesEnabled", v)} />
        </div>
      </div>

      {/* Categories */}
      <div>
        <h2 className="text-base font-bold text-gray-900 mb-3">Service Categories</h2>
        <div className="space-y-3">
          <ToggleField label="Cars" description="Enable car rental listings"
            value={settings.carsEnabled} onChange={(v: boolean) => update("carsEnabled", v)} />
          <ToggleField label="Equipment" description="Enable farm & heavy equipment listings"
            value={settings.equipmentEnabled} onChange={(v: boolean) => update("equipmentEnabled", v)} />
          <ToggleField label="Services" description="Enable home & professional services"
            value={settings.servicesEnabled} onChange={(v: boolean) => update("servicesEnabled", v)} />
        </div>
      </div>

      <div className="pt-2">
        <button
          onClick={() => settings && saveMutation.mutate(settings)}
          disabled={saveMutation.isPending}
          className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl text-sm font-bold transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
        >
          {saveMutation.isPending ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
          Save All Settings
        </button>
      </div>
    </div>
  );
}
