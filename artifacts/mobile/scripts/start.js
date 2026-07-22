#!/usr/bin/env node
/**
 * Expo startup wrapper for Replit.
 * Patches @expo/cli to skip the interactive "Log in / Proceed anonymously" prompt
 * that blocks Expo Go connections in non-TTY workflow environments.
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PATCH_MARKER = 'AUTO_ANON_PATCHED';
const actionsPath = path.join(
  __dirname,
  '../node_modules/@expo/cli/build/src/api/user/actions.js'
);

function patchExpoCliActions() {
  try {
    let content = fs.readFileSync(actionsPath, 'utf8');
    if (content.includes(PATCH_MARKER)) {
      console.log('[expo-start] Expo CLI already patched, skipping.');
      return;
    }

    const original = `async function tryGetUserAsync() {
    const user = await (0, _user.getUserAsync)().catch(()=>null);
    if (user) {
        return user;
    }
    const choices = [
        {
            title: 'Log in',
            value: true
        },
        {
            title: 'Proceed anonymously',
            value: false
        }
    ];
    const value = await (0, _prompts.selectAsync)((0, _chalk().default)\`\\n\\nIt is recommended to log in with your Expo account before proceeding. \\n{dim \${(0, _link.learnMore)('https://expo.fyi/unverified-app-expo-go')}}\\n\`, choices, {
        nonInteractiveHelp: \`Use the EXPO_TOKEN environment variable to authenticate in CI (\${(0, _link.learnMore)('https://docs.expo.dev/accounts/programmatic-access/')})\`
    });
    if (value) {
        await showLoginPromptAsync({
            printNewLine: true
        });
        return await (0, _user.getUserAsync)() ?? null;
    }
    return null;
}`;

    const patched = `async function tryGetUserAsync() {
    /* ${PATCH_MARKER}: skip interactive login prompt, always proceed anonymously */
    const user = await (0, _user.getUserAsync)().catch(()=>null);
    if (user) {
        return user;
    }
    return null;
}`;

    if (content.includes('async function tryGetUserAsync()')) {
      const updated = content.replace(original, patched);
      if (updated !== content) {
        fs.writeFileSync(actionsPath, updated, 'utf8');
        console.log('[expo-start] Patched Expo CLI — login prompt suppressed, will proceed anonymously automatically.');
      } else {
        // Fallback: simpler replacement in case whitespace differs
        const simplePatched = content.replace(
          /const choices = \[\s*\{\s*title: 'Log in',[\s\S]*?return null;\n\}/,
          `/* ${PATCH_MARKER} */\n    return null;\n}`
        );
        if (simplePatched !== content) {
          fs.writeFileSync(actionsPath, simplePatched, 'utf8');
          console.log('[expo-start] Patched Expo CLI (fallback) — login prompt suppressed.');
        } else {
          console.warn('[expo-start] Could not apply patch — prompt may still appear.');
        }
      }
    } else {
      console.warn('[expo-start] tryGetUserAsync not found in expected location.');
    }
  } catch (e) {
    console.warn('[expo-start] Patch failed (non-fatal):', e.message);
  }
}

patchExpoCliActions();

const port = process.env.PORT || '19000';
const args = ['exec', 'expo', 'start', '--clear', '--localhost', '--port', port];

console.log('[expo-start] Launching Metro bundler...');

const child = spawn('pnpm', args, {
  env: process.env,
  stdio: 'inherit',
});

child.on('exit', (code) => process.exit(code ?? 0));
process.on('SIGTERM', () => child.kill('SIGTERM'));
process.on('SIGINT', () => child.kill('SIGINT'));
