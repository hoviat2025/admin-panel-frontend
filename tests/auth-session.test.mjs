import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { AUTH_TOKEN_KEY, SESSION_CHANGED_EVENT, authenticatedFetch, endSession, tokenExpiresAt, tokenHasExpired } from "../src/lib/authSession.ts";

let storage;
let events;
beforeEach(() => {
  storage = new Map([[AUTH_TOKEN_KEY, "current-token"]]);
  globalThis.localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: (key) => storage.delete(key),
  };
  globalThis.window = new EventTarget();
  events = 0;
  window.addEventListener(SESSION_CHANGED_EVENT, () => events++);
});
const authorization = { Authorization: "Bearer current-token" };

test("a rejected session clears the stored token and notifies the UI even with a non-JSON response", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("Unauthorized", { status: 401 }));
  const response = await authenticatedFetch("https://api.test/admin/users", { headers: authorization });
  assert.equal(response.status, 401);
  assert.equal(storage.has(AUTH_TOKEN_KEY), false);
  assert.equal(events, 1);
});

test("concurrent rejected requests notify once", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 401 }));
  await Promise.all([1, 2, 3].map(() => authenticatedFetch("https://api.test/admin/users", { headers: authorization })));
  assert.equal(events, 1);
});

test("an old request's delayed 401 cannot remove a newer login", async (t) => {
  let resolve;
  t.mock.method(globalThis, "fetch", () => new Promise((done) => { resolve = done; }));
  const request = authenticatedFetch("https://api.test/admin/users", { headers: authorization });
  storage.set(AUTH_TOKEN_KEY, "new-login");
  resolve(new Response(null, { status: 401 }));
  await request;
  assert.equal(storage.get(AUTH_TOKEN_KEY), "new-login");
  assert.equal(events, 0);
});

test("permission and server errors preserve the session", async (t) => {
  for (const status of [403, 404, 422, 429, 500, 503]) {
    const mock = t.mock.method(globalThis, "fetch", async () => new Response(null, { status }));
    await authenticatedFetch("https://api.test/admin/users", { headers: authorization });
    mock.mock.restore();
  }
  assert.equal(storage.get(AUTH_TOKEN_KEY), "current-token");
  assert.equal(events, 0);
});

test("network failure does not clear the session", async (t) => {
  t.mock.method(globalThis, "fetch", async () => { throw new TypeError("offline"); });
  await assert.rejects(authenticatedFetch("https://api.test/admin/users", { headers: authorization }));
  assert.equal(storage.get(AUTH_TOKEN_KEY), "current-token");
  assert.equal(events, 0);
});

test("multipart uploads retain their body and headers and also handle rejection", async (t) => {
  const body = new FormData();
  body.append("file", new Blob(["image"]), "image.png");
  const init = { method: "POST", headers: new Headers(authorization), body };
  t.mock.method(globalThis, "fetch", async (input, options) => {
    assert.equal(options, init);
    assert.equal(options.body, body);
    assert.equal(options.headers.has("Content-Type"), false);
    return new Response(null, { status: 401 });
  });
  await authenticatedFetch("https://api.test/admin/cover-image", init);
  assert.equal(events, 1);
});

test("Request objects use their own authorization headers", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 401 }));
  await authenticatedFetch(new Request("https://api.test/admin/users", { headers: authorization }));
  assert.equal(events, 1);
});

test("a request without session credentials cannot clear a stored session", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 401 }));
  await authenticatedFetch("https://api.test/public");
  assert.equal(storage.get(AUTH_TOKEN_KEY), "current-token");
  assert.equal(events, 0);
});

test("explicit logout clears the session", () => {
  endSession();
  assert.equal(storage.has(AUTH_TOKEN_KEY), false);
  assert.equal(events, 1);
});

test("JWT expiry follows its exact boundary; malformed claims do not invent an expiry", () => {
  const token = (payload) => "header." + Buffer.from(JSON.stringify(payload)).toString("base64url") + ".signature";
  assert.equal(tokenExpiresAt(token({ exp: 2000 })), 2000000);
  assert.equal(tokenHasExpired(token({ exp: 2000 }), 1999999), false);
  assert.equal(tokenHasExpired(token({ exp: 2000 }), 2000000), true);
  for (const invalid of ["invalid", "a.invalid.c", token({}), token({ exp: "2000" }), token({ exp: null })]) {
    assert.equal(tokenExpiresAt(invalid), null);
  }
});
