import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";

const source = fs.readFileSync("artifacts/mobile/services/AudioService.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function harness(platform = "android") {
  const players = [];
  const modes = [];
  const warnings = [];
  const exports = {};
  const audio = {
    async setAudioModeAsync(mode) { modes.push(mode); },
    createAudioPlayer(file) {
      const player = {
        file, volume: 1, loop: false, plays: 0, removed: false, seeks: [],
        play() { assert.equal(this.removed, false); this.plays++; },
        async seekTo(position) { this.seeks.push(position); },
        remove() { this.removed = true; },
      };
      players.push(player);
      return player;
    },
  };
  vm.runInNewContext(compiled, {
    exports,
    console: { warn: (...args) => warnings.push(args) },
    require(name) {
      if (name === "expo-audio") return audio;
      if (name === "react-native") return { Platform: { OS: platform } };
      if (name.endsWith(".wav")) return name;
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  return { service: exports, audio, players, modes, warnings };
}

const defaults = {
  master: true, vibration: true, startup: true, booking: true,
  wallet: true, ringtone: true, notif: true,
};
const cues = [
  ["playStartup", "startup", "startup.wav", 0.7],
  ["playBookingSuccess", "booking", "booking-success.wav", 1],
  ["playBookingFail", "booking", "payment-fail.wav", 1],
  ["playProviderAlert", "notif", "provider-alert.wav", 1],
  ["playWalletCredit", "wallet", "wallet-credit.wav", 1],
  ["playPayoutSuccess", "wallet", "payout-success.wav", 1],
  ["playPaymentFail", "wallet", "payment-fail.wav", 1],
  ["playNotification", "notif", "notification.wav", 1],
];

test("all cues retain their files, volumes, master and category settings", async () => {
  for (const [method, setting, file, volume] of cues) {
    const { service, players } = harness();
    service.applySettings({ ...defaults, master: false });
    await service[method]();
    service.applySettings({ ...defaults, [setting]: false });
    await service[method]();
    assert.equal(players.length, 0, method);
    service.applySettings(defaults);
    await service[method]();
    assert.ok(players[0].file.endsWith(file), method);
    assert.equal(players[0].volume, volume);
    assert.equal(players[0].plays, 1);
    assert.equal(players[0].loop, false);
  }
});

test("preloaded sounds rewind on replay, startup runs once and can reset", async () => {
  const { service, players } = harness();
  await service.preloadCriticalSounds();
  await service.preloadCriticalSounds();
  assert.equal(players.length, 4);
  assert.ok(players.every(p => p.plays === 0));
  await service.playStartup();
  await service.playStartup();
  assert.equal(players[0].plays, 1);
  service.resetStartupPlayed();
  await service.playStartup();
  assert.equal(players[0].plays, 2);
  assert.deepEqual(players[0].seeks, [0, 0]);
  await service.playBookingSuccess();
  await service.playBookingSuccess();
  assert.equal(players[1].plays, 2);
  assert.deepEqual(players[1].seeks, [0, 0]);
});

test("test sound bypasses settings, and cleanup releases every cached player", async () => {
  const { service, players } = harness();
  service.applySettings({ ...defaults, master: false });
  await service.playTest("ringtone");
  assert.equal(players[0].loop, false);
  await service.preloadCriticalSounds();
  await service.unloadAll();
  assert.ok(players.every(p => p.removed));
  await service.playTest("notification");
  assert.equal(players.at(-1).removed, false);
});

test("ringtone loops, replaces previous player, and stop cancels pending starts", async () => {
  const { service, players } = harness();
  await service.startRingtone();
  assert.equal(players[0].loop, true);
  await service.startRingtone();
  assert.equal(players[0].removed, true);
  await service.stopRingtone();
  assert.ok(players.every(p => p.removed));
  const pending = service.startRingtone();
  await service.stopRingtone();
  await pending;
  assert.equal(players.length, 2);
  service.setRingtoneEnabled(false);
  await service.startRingtone();
  assert.equal(players.length, 2);
});

test("normal and ringtone modes preserve platform behavior without recording", async () => {
  for (const platform of ["ios", "android"]) {
    const { service, modes } = harness(platform);
    await service.playNotification();
    assert.equal(modes[0].playsInSilentMode, false);
    assert.equal(modes[0].shouldPlayInBackground, false);
    assert.equal(modes[0].interruptionMode, platform === "ios" ? "mixWithOthers" : "duckOthers");
    await service.startRingtone();
    assert.equal(modes[1].playsInSilentMode, true);
    assert.equal(modes[1].shouldPlayInBackground, true);
    assert.equal(modes[1].interruptionMode, platform === "ios" ? "mixWithOthers" : "doNotMix");
    await service.stopRingtone();
    await service.playNotification();
    assert.equal(modes[2].playsInSilentMode, false);
    assert.ok(modes.every(m => !m.allowsRecording && !m.shouldRouteThroughEarpiece));
  }
});

test("unload cancels pending playback and failures are contained and logged", async () => {
  const { service, players, audio, warnings } = harness();
  const pending = service.playNotification();
  await service.unloadAll();
  await pending;
  assert.equal(players.length, 0);
  audio.createAudioPlayer = () => { throw new Error("device unavailable"); };
  await service.playNotification();
  assert.equal(warnings.length, 1);
});

// Execute the actual provider and startup effect with controlled storage and
// a minimal hook runner, without loading native modules or wall-clock timers.
function startupHarness() {
  const { service, players } = harness();
  let resolveStorage, rejectStorage;
  const storage = new Promise((resolve, reject) => {
    resolveStorage = resolve;
    rejectStorage = reject;
  });
  const states = [];
  let stateIndex = 0;
  let effects = [];
  let context;
  const react = {
    createContext(value) { context = value; return { Provider: "Provider" }; },
    useContext() { return context; },
    useState(initial) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = initial;
      return [states[index], value => {
        states[index] = typeof value === "function" ? value(states[index]) : value;
      }];
    },
    useEffect(fn) { effects.push(fn); },
    useCallback(fn) { return fn; },
    createElement(_type, props) { context = props.value; return null; },
  };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(
    fs.readFileSync("artifacts/mobile/context/SoundContext.tsx", "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true } },
  ).outputText, {
    exports,
    require(name) {
      if (name === "react") return react;
      if (name === "@react-native-async-storage/async-storage") {
        return { getItem: () => storage };
      }
      if (name === "expo-haptics") return {};
      if (name === "@/services/AudioService") return service;
      throw new Error(`Unexpected dependency: ${name}`);
    },
  });
  function renderProvider() {
    stateIndex = 0;
    exports.SoundProvider({ children: null });
  }
  renderProvider();
  const cleanup = effects.shift()();
  function renderStartup(splashDone) {
    // Refresh the context value, but don't re-run the mount-only provider effect.
    renderProvider();
    effects = [];
    exports.StartupSound({ splashDone });
    effects.shift()();
  }
  return {
    players, resolveStorage, rejectStorage, renderStartup, cleanup,
    ready: () => states[1],
  };
}

const flush = () => new Promise(resolve => setImmediate(resolve));

for (const [label, saved, expected] of [
  ["muted", '{"master":false}', 0],
  ["startup disabled", '{"startup":false}', 0],
  ["enabled", '{"startup":true}', 1],
  ["missing preferences", null, 1],
  ["malformed preferences", "{invalid", 1],
  ["storage failure", undefined, 1],
]) {
  test(`delayed cold-launch storage: ${label}`, async () => {
    const h = startupHarness();
    h.renderStartup(true); // splash completes before storage
    await flush();
    assert.equal(h.ready(), false);
    assert.equal(h.players.length, 0, "no sound before hydration");
    if (saved === undefined) h.rejectStorage(new Error("storage unavailable"));
    else h.resolveStorage(saved);
    await flush();
    h.renderStartup(true);
    await flush();
    h.renderStartup(true); // repeated effects must not duplicate the cue
    await flush();
    assert.equal(h.ready(), true);
    assert.equal(h.players.reduce((sum, p) => sum + p.plays, 0), expected);
    h.cleanup();
  });
}

test("hydration before splash still waits for splash completion", async () => {
  const h = startupHarness();
  h.resolveStorage(null);
  await flush();
  h.renderStartup(false);
  await flush();
  assert.ok(h.players.every(p => p.plays === 0));
  h.renderStartup(true);
  await flush();
  assert.equal(h.players.reduce((sum, p) => sum + p.plays, 0), 1);
  h.cleanup();
});

test("unmounted provider ignores late storage completion", async () => {
  const h = startupHarness();
  h.cleanup();
  h.resolveStorage(null);
  await flush();
  assert.equal(h.ready(), false);
  assert.equal(h.players.length, 0);
});
