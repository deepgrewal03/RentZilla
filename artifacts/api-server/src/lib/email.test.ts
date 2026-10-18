import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import { transformSync } from "esbuild";
import { randomUUID } from "node:crypto";

const compile = (file: string) => transformSync(readFileSync(new URL(file, import.meta.url), "utf8"), { loader: "ts", format: "cjs" }).code;
const senderCode = compile("./gmailSender.ts");
const emailCode = compile("./email.ts");

function setup(mode = "ok") {
  const requests: any[] = [];
  const logs: unknown[] = [];
  const gmailModule = { exports: {} as any };
  runInNewContext(senderCode, {
    module: gmailModule, exports: gmailModule.exports, Buffer, Date,
    require: (name: string) => {
      if (name === "node:crypto") return { randomUUID };
      if (name === "@replit/connectors-sdk") return { ReplitConnectors: class {
        async listConnections() {
          if (mode === "missing") return [];
          if (mode === "multiple") return [{ status: "healthy" }, { status: "healthy" }];
          return [{ status: mode === "unhealthy" ? "error" : "healthy" }];
        }
        async proxy(...args: any[]) {
          requests.push(args);
          if (mode === "network") throw new Error("private provider diagnostic");
          return { ok: mode !== "denied", status: mode === "denied" ? 403 : 200,
            json: async () => mode === "empty" ? {} : { id: "test-message-id" } };
        }
      } };
      throw new Error(`Unexpected import ${name}`);
    },
  });
  const emailModule = { exports: {} as any };
  runInNewContext(emailCode, {
    module: emailModule, exports: emailModule.exports,
    process: { env: {} },
    require: (name: string) => {
      if (name === "./gmailSender") return gmailModule.exports;
      if (name === "nodemailer") return { createTransport: () => { throw new Error("Password reset must not use SMTP"); } };
      if (name === "./logger") return { logger: {
        error: (...args: unknown[]) => logs.push(args),
        info: (...args: unknown[]) => logs.push(args),
      } };
      throw new Error(`Unexpected import ${name}`);
    },
  });
  return { api: emailModule.exports, gmail: gmailModule.exports, requests, logs };
}

test("connected Gmail sends encoded OTP email without SMTP credentials", async () => {
  const { api, requests, logs } = setup();
  await api.sendOtpEmail("test@example.invalid", "123456");
  assert.equal(requests.length, 1);
  assert.equal(requests[0][0], "google-mail");
  assert.equal(requests[0][1], "/gmail/v1/users/me/messages/send");
  const mime = Buffer.from(requests[0][2].body.raw, "base64url").toString();
  assert.ok(mime.startsWith("To: test@example.invalid\r\n"));
  assert.ok(!mime.includes("\r\nFrom:"));
  assert.ok(Buffer.from(mime.split("\r\n\r\n")[1], "base64").toString().includes("123456"));
  assert.ok(!JSON.stringify(logs).includes("123456"));
});

test("missing, unhealthy and ambiguous Gmail connections fail before sending", async () => {
  for (const mode of ["missing", "unhealthy", "multiple"]) {
    const { api, requests } = setup(mode);
    await assert.rejects(api.preparePasswordResetEmail(), /temporarily unavailable/);
    assert.equal(requests.length, 0);
  }
});

test("failed or uncertain Gmail sends fail safely without automatic retries", async () => {
  for (const mode of ["denied", "network", "empty"]) {
    const { api, requests, logs } = setup(mode);
    await assert.rejects(api.sendOtpEmail("test@example.invalid", "123456"), /temporarily unavailable/);
    assert.equal(requests.length, 1);
    assert.ok(!JSON.stringify(logs).includes("123456"));
    assert.ok(!JSON.stringify(logs).includes("private provider diagnostic"));
  }
});

test("Gmail sender rejects header injection and multiple recipients", async () => {
  const { gmail, requests } = setup();
  const send = await gmail.prepareGmailSender();
  for (const recipient of ["a@example.invalid\r\nBcc: b@example.invalid", "a@example.invalid,b@example.invalid"]) {
    await assert.rejects(send(recipient, "Test", "Test"));
  }
  assert.equal(requests.length, 0);
});
