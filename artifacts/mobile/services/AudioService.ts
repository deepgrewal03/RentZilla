/**
 * AudioService — centralised sound manager for RentZilla.
 * Uses expo-av under the hood.  All public methods are fire-and-forget and
 * NEVER throw — any failure is logged silently so the app keeps running.
 */
import { Audio } from "expo-av";
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
let _notifEnabled     = true;

let _audioModeSet = false;
let _ringtoneObj: Audio.Sound | null = null;
let _startupPlayed = false;

// Pre-loaded cache: key → Sound object
const _cache: Partial<Record<SoundKey, Audio.Sound>> = {};

// ── Setup ───────────────────────────────────────────────────────────────────

async function ensureAudioMode() {
  if (_audioModeSet) return;
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS:        false,
      staysActiveInBackground:   false,
      playsInSilentModeIOS:      false,  // respect iOS silent switch
      shouldDuckAndroid:         true,
      playThroughEarpieceAndroid: false,
    });
    _audioModeSet = true;
  } catch (e) {
    console.warn("[AudioService] setAudioMode failed:", e);
  }
}

// ── Preload ─────────────────────────────────────────────────────────────────

/** Eagerly load the most-used sounds so first play has no latency. */
export async function preloadCriticalSounds() {
  const critical: SoundKey[] = [
    "startup", "bookingSuccess", "notification", "walletCredit",
  ];
  await ensureAudioMode();
  await Promise.all(
    critical.map(async (key) => {
      try {
        if (_cache[key]) return;
        const { sound } = await Audio.Sound.createAsync(SOUND_FILES[key], {
          shouldPlay: false,
          volume: 1,
        });
        _cache[key] = sound;
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
): Promise<Audio.Sound | null> {
  try {
    await ensureAudioMode();
    let sound = _cache[key];
    if (sound) {
      await sound.setPositionAsync(0);
      await sound.setVolumeAsync(volume);
      await sound.setIsLoopingAsync(loop);
      await sound.playAsync();
      return sound;
    }
    const { sound: newSound } = await Audio.Sound.createAsync(
      SOUND_FILES[key],
      { shouldPlay: true, volume, isLooping: loop }
    );
    newSound.setOnPlaybackStatusUpdate((status) => {
      if (!loop && status.isLoaded && status.didJustFinish) {
        newSound.unloadAsync().catch(() => {});
        if (_cache[key] !== newSound) return;
        delete _cache[key];
      }
    });
    _cache[key] = newSound;
    return newSound;
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
  notif:     boolean;
}) {
  _masterEnabled    = settings.master;
  _vibrationEnabled = settings.vibration;
  _startupEnabled   = settings.startup;
  _bookingEnabled   = settings.booking;
  _walletEnabled    = settings.wallet;
  _ringtoneEnabled  = settings.ringtone;
  _notifEnabled     = settings.notif;
}

export function setMasterEnabled(v: boolean)    { _masterEnabled    = v; }
export function setVibrationEnabled(v: boolean) { _vibrationEnabled = v; }
export function setStartupEnabled(v: boolean)   { _startupEnabled   = v; }
export function setBookingEnabled(v: boolean)   { _bookingEnabled   = v; }
export function setWalletEnabled(v: boolean)    { _walletEnabled    = v; }
export function setRingtoneEnabled(v: boolean)  { _ringtoneEnabled  = v; }
export function setNotifEnabled(v: boolean)     { _notifEnabled     = v; }

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
  if (!_masterEnabled || !_notifEnabled) return;
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
  if (!_masterEnabled || !_notifEnabled) return;
  await _play("notification");
}

/** Start the incoming-booking ringtone (loops until stopRingtone called). */
export async function startRingtone() {
  if (!_masterEnabled || !_ringtoneEnabled) return;
  await stopRingtone();
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS:        false,
      staysActiveInBackground:   true,
      playsInSilentModeIOS:      true,   // ringtone overrides silent switch
      shouldDuckAndroid:         false,
      playThroughEarpieceAndroid: false,
    });
    _audioModeSet = false; // force reset next time
    const { sound } = await Audio.Sound.createAsync(
      SOUND_FILES["ringtone"],
      { shouldPlay: true, isLooping: true, volume: 1 }
    );
    _ringtoneObj = sound;
  } catch (e) {
    console.warn("[AudioService] startRingtone failed:", e);
  }
}

/** Stop and clean up the incoming-booking ringtone. */
export async function stopRingtone() {
  if (!_ringtoneObj) return;
  try {
    await _ringtoneObj.stopAsync();
    await _ringtoneObj.unloadAsync();
  } catch { }
  _ringtoneObj = null;
  _audioModeSet = false;
}

/** Play any sound by key — useful for "Test Sound" button. */
export async function playTest(key: SoundKey) {
  await _play(key, { volume: 1 });
}

/** Unload every cached sound (call on logout / app background). */
export async function unloadAll() {
  await stopRingtone();
  await Promise.all(
    Object.entries(_cache).map(async ([, s]) => {
      try { await (s as Audio.Sound).unloadAsync(); } catch { }
    })
  );
  for (const k in _cache) delete _cache[k as SoundKey];
}
