const assert = require("node:assert/strict");
const { Buffer } = require("node:buffer");
const { execFileSync } = require("node:child_process");
const { mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const test = require("node:test");
const {
  protectedPath,
  secretFindings,
  isFormattedCode,
  isLintedCode,
} = require("../scripts/check-agent-safeguards.cjs");

test("protects credential filenames while allowing the public example", () => {
  assert.equal(protectedPath(".env.local"), true);
  assert.equal(protectedPath("nested/signing_keys.json"), true);
  assert.equal(protectedPath("keys/private.pem"), true);
  assert.equal(protectedPath(".env.example"), false);
});

test("finds high-confidence secrets without echoing their values", () => {
  const token = "sb_secret_" + "a".repeat(25);
  const findings = secretFindings("src/config.ts", `const key = "${token}";`);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].includes(token), false);
  assert.equal(
    secretFindings("docs/example.md", "sb_secret_example").length,
    0,
  );
});

test("finds service-role JWTs but leaves anonymous JWTs alone", () => {
  const jwt = (role) =>
    `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.signature`;
  assert.equal(secretFindings("a.ts", jwt("service_role")).length, 1);
  assert.equal(secretFindings("a.ts", jwt("anon")).length, 0);
});

test("only sends the existing code and config scope to format and lint", () => {
  assert.equal(isFormattedCode("scripts/example.ts"), true);
  assert.equal(isFormattedCode("package.json"), true);
  assert.equal(isFormattedCode("docs/README.md"), false);
  assert.equal(isLintedCode("src/App.tsx"), true);
  assert.equal(isLintedCode("package.json"), false);
});

test("staged checks read the index, not later worktree edits", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "kc3-agent-guard-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, { cwd: dir });
  const run = () =>
    execFileSync(
      process.execPath,
      [require.resolve("../scripts/check-agent-safeguards.cjs"), "--staged"],
      {
        cwd: dir,
        stdio: "pipe",
      },
    );
  git("init", "-q");
  const file = join(dir, "notes.txt");
  writeFileSync(file, `sb_secret_${"a".repeat(25)}\n`);
  git("add", "notes.txt");
  writeFileSync(file, "safe worktree text\n");
  assert.throws(run);
  git("add", "notes.txt");
  writeFileSync(file, `sb_secret_${"a".repeat(25)}\n`);
  assert.doesNotThrow(run);
});
