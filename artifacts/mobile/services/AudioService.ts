/**
 * AudioService — centralised sound manager for RentZilla.
 * Uses expo-audio under the hood. All public methods are fire-and-forget and
 * NEVER throw — any failure is logged silently so the app keeps running.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { Platform } from "react-native";

// ── Sound file map ──────────────────────────────────────────────────────────

export type SoundKey =
  | "startup"
  | "bookingSuccess"
  | "providerAlert"
  | "walletCredit"
  | "payoutSuccess"
  | "ringtone"
  | "paymentFail"
  | "notification";

const SOUND_FILES: Record<SoundKey, any> = {
  startup:        require("../assets/sounds/startup.wav"),
  bookingSuccess: require("../assets/sounds/booking-success.wav"),
  providerAlert:  require("../assets/sounds/provider-alert.wav"),
  walletCredit:   require("../assets/sounds/wallet-credit.wav"),
  payoutSuccess:  require("../assets/sounds/payout-success.wav"),
  ringtone:       require("../assets/sounds/ringtone.wav"),
  paymentFail:    require("../assets/sounds/payment-fail.wav"),
  notification:   require("../assets/sounds/notification.wav"),
};

// ── Internal state ──────────────────────────────────────────────────────────

let _masterEnabled    = true;
let _vibrationEnabled = true;
let _startupEnabled   = true;
let _bookingEnabled   = true;
let _walletEnabled    = true;
let _ringtoneEnabled  = true;

let _audioModeSet = false;
let _ringtoneObj: AudioPlayer | null = null;
let _ringtoneGeneration = 0;
let _cacheGeneration = 0;
let _startupPlayed = false;

// Keep at most one player per cue until unloadAll; expo-audio players do not
// rewind automatically after finishing, so cached players must seek before replay.
const _cache: Partial<Record<SoundKey, AudioPlayer>> = {};

// ── Setup ───────────────────────────────────────────────────────────────────

async function ensureAudioMode() {
  if (_audioModeSet) return;
  try {
    await setAudioModeAsync({
      allowsRecording: false,
      shouldPlayInBackground: false,
      playsInSilentMode: false, // respect iOS silent switch
      interruptionMode: Platform.OS === "ios" ? "mixWithOthers" : "duckOthers",
      shouldRouteThroughEarpiece: false,
    });
    _audioModeSet = true;
  } catch (e) {
    console.warn("[AudioService] setAudioMode failed:", e);
  }
}

// ── Preload ─────────────────────────────────────────────────────────────────

/** Eagerly load the most-used sounds so first play has no latency. */
export async function preloadCriticalSounds() {
  const generation = _cacheGeneration;
  const critical: SoundKey[] = [
    "startup", "bookingSuccess", "notification", "walletCredit",
  ];
  await ensureAudioMode();
  if (generation !== _cacheGeneration) return;
  await Promise.all(
    critical.map(async (key) => {
      try {
        if (_cache[key]) return;
        _cache[key] = createAudioPlayer(SOUND_FILES[key]);
      } catch (e) {
        console.warn(`[AudioService] preload ${key} failed:`, e);
      }
    })
  );
}

// ── Core play helper ────────────────────────────────────────────────────────

async function _play(
  key: SoundKey,
  { volume = 1, loop = false }: { volume?: number; loop?: boolean } = {}
): Promise<AudioPlayer | null> {
  const generation = _cacheGeneration;
  try {
    await ensureAudioMode();
    if (generation !== _cacheGeneration) return null;
    let sound = _cache[key];
    if (sound) {
      await sound.seekTo(0);
      if (generation !== _cacheGeneration) return null;
    } else {
      sound = createAudioPlayer(SOUND_FILES[key]);
      _cache[key] = sound;
    }
    sound.volume = volume;
    sound.loop = loop;
    sound.play();
    return sound;
  } catch (e) {
    console.warn(`[AudioService] play ${key} failed:`, e);
    return null;
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Apply persisted settings (call from SoundContext on mount). */
export function applySettings(settings: {
  master:    boolean;
  vibration: boolean;
  startup:   boolean;
  booking:   boolean;
  wallet:    boolean;
  ringtone:  boolean;
}) {
  _masterEnabled    = settings.master;
  _vibrationEnabled = settings.vibration;
  _startupEnabled   = settings.startup;
  _bookingEnabled   = settings.booking;
  _walletEnabled    = settings.wallet;
  _ringtoneEnabled  = settings.ringtone;
}

export function setMasterEnabled(v: boolean)    { _masterEnabled    = v; }
export function setVibrationEnabled(v: boolean) { _vibrationEnabled = v; }
export function setStartupEnabled(v: boolean)   { _startupEnabled   = v; }
export function setBookingEnabled(v: boolean)   { _bookingEnabled   = v; }
export function setWalletEnabled(v: boolean)    { _walletEnabled    = v; }
export function setRingtoneEnabled(v: boolean)  { _ringtoneEnabled  = v; }

/** Play startup chime — only fires once per app session. */
export async function playStartup() {
  if (!_masterEnabled || !_startupEnabled || _startupPlayed) return;
  _startupPlayed = true;
  await _play("startup", { volume: 0.7 });
}

/** Reset so startup plays again (e.g. after logout). */
export function resetStartupPlayed() { _startupPlayed = false; }

export async function playBookingSuccess() {
  if (!_masterEnabled || !_bookingEnabled) return;
  await _play("bookingSuccess");
}

export async function playBookingFail() {
  if (!_masterEnabled || !_bookingEnabled) return;
  await _play("paymentFail");
}

export async function playProviderAlert() {
  if (!_masterEnabled) return;
  await _play("providerAlert");
}

export async function playWalletCredit() {
  if (!_masterEnabled || !_walletEnabled) return;
  await _play("walletCredit");
}

export async function playPayoutSuccess() {
  if (!_masterEnabled || !_walletEnabled) return;
  await _play("payoutSuccess");
}

export async function playPaymentFail() {
  if (!_masterEnabled || !_walletEnabled) return;
  await _play("paymentFail");
}

export async function playNotification() {
  if (!_masterEnabled) return;
  await _play("notification");
}

/** Start the incoming-booking ringtone (loops until stopRingtone called). */
export async function startRingtone() {
  if (!_masterEnabled || !_ringtoneEnabled) return;
  const stopping = stopRingtone();
  const generation = _ringtoneGeneration;
  await stopping;
  try {
    if (generation !== _ringtoneGeneration) return;
    await setAudioModeAsync({
      allowsRecording: false,
      shouldPlayInBackground: true,
      playsInSilentMode: true, // ringtone overrides silent switch
      interruptionMode: Platform.OS === "ios" ? "mixWithOthers" : "doNotMix",
      shouldRouteThroughEarpiece: false,
    });
    _audioModeSet = false; // force reset next time
    if (generation !== _ringtoneGeneration) return;
    const sound = createAudioPlayer(SOUND_FILES.ringtone);
    _ringtoneObj = sound;
    sound.loop = true;
    sound.volume = 1;
    sound.play();
  } catch (e) {
    console.warn("[AudioService] startRingtone failed:", e);
  }
}

/** Stop and clean up the incoming-booking ringtone. */
export async function stopRingtone() {
  _ringtoneGeneration++;
  const sound = _ringtoneObj;
  _ringtoneObj = null;
  _audioModeSet = false;
  if (!sound) return;
  try {
    sound.remove();
  } catch (e) {
    console.warn("[AudioService] stopRingtone failed:", e);
  }
}

/** Play any sound by key — useful for "Test Sound" button. */
export async function playTest(key: SoundKey) {
  await _play(key, { volume: 1 });
}

/** Unload every cached sound (call on logout / app background). */
export async function unloadAll() {
  _cacheGeneration++;
  await stopRingtone();
  for (const key of Object.keys(_cache) as SoundKey[]) {
    const sound = _cache[key];
    delete _cache[key];
    try { sound?.remove(); } catch (e) {
      console.warn(`[AudioService] unload ${key} failed:`, e);
    }
  }
}
