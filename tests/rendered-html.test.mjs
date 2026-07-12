import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("uses Google sign-in without ChatGPT authentication", async () => {
  const [page, gate, auth] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/google-auth-gate.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/supabase-auth.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /GoogleAuthGate/);
  assert.match(gate, /Continue with Google/);
  assert.match(gate, /provider=google/);
  assert.match(auth, /sudjndxwsfefenfytucf\.supabase\.co/);
  assert.doesNotMatch(page, /ChatGPT|signin-with-chatgpt/);
});

test("protects API data with the verified Supabase user", async () => {
  const api = await readFile(
    new URL("../app/api/data/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(api, /\/auth\/v1\/user/);
  assert.match(api, /authorization/);
  assert.match(api, /WHERE owner_email = \?/);
  assert.match(api, /Unauthorized[\s\S]*401/);
});
