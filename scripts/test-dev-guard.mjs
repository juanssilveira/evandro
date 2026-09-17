import assert from "node:assert";
import { extractHostname, isLocalDevPanelAllowedWithHeaders } from "../src/lib/dev/guard.ts";

console.log("🔒 Running Dev Panel Security Guard Verification Suite...\n");

function createHeaders(hostValue) {
  const headers = new Headers();
  if (hostValue) {
    headers.set("host", hostValue);
  }
  return headers;
}

const originalEnv = { ...process.env };

function resetEnv() {
  process.env = { ...originalEnv };
  process.env.NODE_ENV = "development";
  process.env.APP_ENV = "development";
  process.env.DEV_PANEL_ENABLED = "true";
  delete process.env.VERCEL;
  delete process.env.VERCEL_ENV;
  delete process.env.NEXT_PUBLIC_VERCEL_ENV;
}

let passed = 0;
let failed = 0;

function test(description, fn) {
  try {
    resetEnv();
    fn();
    console.log(`  ✓ ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${description}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// 1. Host extraction tests
test("extractHostname handles localhost:3000", () => {
  assert.strictEqual(extractHostname("localhost:3000"), "localhost");
});

test("extractHostname handles 127.0.0.1:3000", () => {
  assert.strictEqual(extractHostname("127.0.0.1:3000"), "127.0.0.1");
});

test("extractHostname handles [::1]:3000", () => {
  assert.strictEqual(extractHostname("[::1]:3000"), "[::1]");
});

test("extractHostname handles ::1", () => {
  assert.strictEqual(extractHostname("::1"), "::1");
});

test("extractHostname handles LAN IP 192.168.1.100:3000", () => {
  assert.strictEqual(extractHostname("192.168.1.100:3000"), "192.168.1.100");
});

// 2. Allowed Loopback Cases
test("ALLOWS access via localhost", () => {
  const allowed = isLocalDevPanelAllowedWithHeaders(createHeaders("localhost:3000"));
  assert.strictEqual(allowed, true);
});

test("ALLOWS access via 127.0.0.1", () => {
  const allowed = isLocalDevPanelAllowedWithHeaders(createHeaders("127.0.0.1:3000"));
  assert.strictEqual(allowed, true);
});

test("ALLOWS access via [::1]", () => {
  const allowed = isLocalDevPanelAllowedWithHeaders(createHeaders("[::1]:3000"));
  assert.strictEqual(allowed, true);
});

test("ALLOWS access via ::1", () => {
  const allowed = isLocalDevPanelAllowedWithHeaders(createHeaders("::1"));
  assert.strictEqual(allowed, true);
});

// 3. Blocked Non-Loopback Hosts (LAN IP, public domain, etc.)
test("BLOCKS access via LAN IP 192.168.1.50", () => {
  const allowed = isLocalDevPanelAllowedWithHeaders(createHeaders("192.168.1.50:3000"));
  assert.strictEqual(allowed, false);
});

test("BLOCKS access via LAN IP 10.0.0.12", () => {
  const allowed = isLocalDevPanelAllowedWithHeaders(createHeaders("10.0.0.12:3000"));
  assert.strictEqual(allowed, false);
});

test("BLOCKS access via public domain app.evandro.watch", () => {
  const allowed = isLocalDevPanelAllowedWithHeaders(createHeaders("app.evandro.watch"));
  assert.strictEqual(allowed, false);
});

test("BLOCKS access via custom public domain or spoofed host", () => {
  const allowed = isLocalDevPanelAllowedWithHeaders(createHeaders("attacker.com"));
  assert.strictEqual(allowed, false);
});

test("BLOCKS access when host header is missing", () => {
  const allowed = isLocalDevPanelAllowedWithHeaders(new Headers());
  assert.strictEqual(allowed, false);
});

test("BLOCKS access when headers object is null", () => {
  const allowed = isLocalDevPanelAllowedWithHeaders(null);
  assert.strictEqual(allowed, false);
});

// 4. Blocked Environments
test("BLOCKS access when APP_ENV is production", () => {
  process.env.APP_ENV = "production";
  const allowed = isLocalDevPanelAllowedWithHeaders(createHeaders("localhost:3000"));
  assert.strictEqual(allowed, false);
});

test("BLOCKS access when APP_ENV is missing", () => {
  delete process.env.APP_ENV;
  const allowed = isLocalDevPanelAllowedWithHeaders(createHeaders("localhost:3000"));
  assert.strictEqual(allowed, false);
});

test("BLOCKS access when NODE_ENV is production", () => {
  process.env.NODE_ENV = "production";
  const allowed = isLocalDevPanelAllowedWithHeaders(createHeaders("localhost:3000"));
  assert.strictEqual(allowed, false);
});

test("BLOCKS access when DEV_PANEL_ENABLED is false", () => {
  process.env.DEV_PANEL_ENABLED = "false";
  const allowed = isLocalDevPanelAllowedWithHeaders(createHeaders("localhost:3000"));
  assert.strictEqual(allowed, false);
});

test("BLOCKS access when DEV_PANEL_ENABLED is missing", () => {
  delete process.env.DEV_PANEL_ENABLED;
  const allowed = isLocalDevPanelAllowedWithHeaders(createHeaders("localhost:3000"));
  assert.strictEqual(allowed, false);
});

test("BLOCKS access when running on VERCEL (process.env.VERCEL = 1)", () => {
  process.env.VERCEL = "1";
  const allowed = isLocalDevPanelAllowedWithHeaders(createHeaders("localhost:3000"));
  assert.strictEqual(allowed, false);
});

test("BLOCKS access when running on VERCEL (process.env.VERCEL_ENV = preview)", () => {
  process.env.VERCEL_ENV = "preview";
  const allowed = isLocalDevPanelAllowedWithHeaders(createHeaders("localhost:3000"));
  assert.strictEqual(allowed, false);
});

test("BLOCKS access when running on VERCEL (process.env.NEXT_PUBLIC_VERCEL_ENV = production)", () => {
  process.env.NEXT_PUBLIC_VERCEL_ENV = "production";
  const allowed = isLocalDevPanelAllowedWithHeaders(createHeaders("localhost:3000"));
  assert.strictEqual(allowed, false);
});

console.log(`\nResults: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log("🛡️ All security assertions passed perfectly.\n");
}
