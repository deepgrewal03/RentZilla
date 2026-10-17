/**
 * SoundContext — persists user sound/notification preferences to AsyncStorage
 * and keeps AudioService in sync.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext, useContext, useEffect, useState, useCallback,
} from "react";
import * as Haptics from "expo-haptics";

import * as AudioService from "@/services/AudioService";

// ── Types ────────────────────────────────────────────────────────────────────

export interface SoundSettings {
  master:    boolean;
  vibration: boolean;
  startup:   boolean;
  booking:   boolean;
  wallet:    boolean;
  ringtone:  boolean;
  notif:     boolean;
}

interface SoundContextValue {
  settings: SoundSettings;
  settingsReady: boolean;
  toggle:   (key: keyof SoundSettings) => Promise<void>;
  testSound: (key: AudioService.SoundKey) => Promise<void>;
  vibrate:  () => void;
}

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: SoundSettings = {
  master:    true,
  vibration: true,
  startup:   true,
  booking:   true,
  wallet:    true,
  ringtone:  true,
  notif:     true,
};

const STORAGE_KEY = "@rentzilla:sound_settings";

// ── Context ───────────────────────────────────────────────────────────────────

const SoundCtx = createContext<SoundContextValue>({
  settings:  DEFAULT_SETTINGS,
  settingsReady: false,
  toggle:    async () => {},
  testSound: async () => {},
  vibrate:   () => {},
});

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SoundSettings>(DEFAULT_SETTINGS);
  const [settingsReady, setSettingsReady] = useState(false);

  // Load persisted settings on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) return;
        if (raw) {
          const saved: SoundSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
          setSettings(saved);
          AudioService.applySettings(saved);
        } else {
          AudioService.applySettings(DEFAULT_SETTINGS);
        }
      } catch {
        if (cancelled) return;
        AudioService.applySettings(DEFAULT_SETTINGS);
      }
      // Publish readiness only after the service has received saved settings.
      setSettingsReady(true);
      // Pre-load critical sounds after settings are applied
      AudioService.preloadCriticalSounds().catch(() => {});
    })();
    return () => { cancelled = true; };
  }, []);

  const toggle = useCallback(async (key: keyof SoundSettings) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      AudioService.applySettings(next);
      return next;
    });
  }, []);

  const testSound = useCallback(async (key: AudioService.SoundKey) => {
    await AudioService.playTest(key);
  }, []);

  const vibrate = useCallback(() => {
    if (!settings.vibration) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, [settings.vibration]);

  return (
    <SoundCtx.Provider value={{ settings, settingsReady, toggle, testSound, vibrate }}>
      {children}
    </SoundCtx.Provider>
  );
}

export function useSound() {
  return useContext(SoundCtx);
}

/** Wait for both the splash and preference hydration; the service enforces once/session. */
export function StartupSound({ splashDone }: { splashDone: boolean }) {
  const { settingsReady } = useSound();
  useEffect(() => {
    if (splashDone && settingsReady) {
      AudioService.playStartup().catch(() => {});
    }
  }, [splashDone, settingsReady]);
  return null;
}
