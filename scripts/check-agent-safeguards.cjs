#!/usr/bin/env node
// Fast staged-file guard; CI uses --tracked to catch commits made without hooks.
const { execFileSync } = require("node:child_process");
const { Buffer } = require("node:buffer");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const protectedName =
  /^(?:\.env(?:\..+)?|credentials\.json|signing_keys\.json|id_(?:rsa|ed25519))$/i;
const protectedExtension =
  /\.(?:key|pem|p12|pfx|jks|keystore|mobileprovision)$/i;
const tokenPatterns = [
  /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/g,
  /\b(?:gh[pousr]_[A-Za-z0-9_]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/g,
  /\bsb_secret_[A-Za-z0-9_-]{20,}\b/g,
  /\bAIza[0-9A-Za-z_-]{35}\b/g,
  /\bsk_live_[A-Za-z0-9]{20,}\b/g,
];

function protectedPath(file) {
  const name = path.basename(file);
  return (
    name !== ".env.example" &&
    (protectedName.test(name) || protectedExtension.test(name))
  );
}

function secretFindings(file, content) {
  if (protectedPath(file)) return [`${file}: protected credential filename`];
  if (content.includes("\0")) return [];
  const findings = [];
  for (const pattern of tokenPatterns) {
    pattern.lastIndex = 0;
    for (const match of content.matchAll(pattern)) {
      const line = content.slice(0, match.index).split("\n").length;
      findings.push(
        `${file}:${line}: potential secret (${pattern.source.slice(0, 24)}...)`,
      );
    }
  }
  // Decode JWT claims without printing the token. Public anonymous JWTs are allowed.
  for (const match of content.matchAll(
    /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
  )) {
    try {
      const claims = JSON.parse(
        Buffer.from(match[0].split(".")[1], "base64url").toString(),
      );
      if (claims.role === "service_role") {
        const line = content.slice(0, match.index).split("\n").length;
        findings.push(`${file}:${line}: potential service-role JWT`);
      }
    } catch {
      // Invalid JWT-like text is not a credential finding.
    }
  }
  return findings;
}

function git(args) {
  return execFileSync("git", args, {
    encoding: "buffer",
    maxBuffer: 32 * 1024 * 1024,
  });
}

function fileNames(mode) {
  const args =
    mode === "--staged"
      ? ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"]
      : ["ls-files", "-z"];
  return git(args).toString().split("\0").filter(Boolean);
}

function isFormattedCode(file) {
  return (
    /^(?:src|scripts|tests)\/.*\.(?:ts|tsx|js|cjs)$/.test(file) ||
    /^(?:index\.ts|eslint\.config\.js|app\.json|tsconfig\.json|package\.json)$/.test(
      file,
    )
  );
}

function isLintedCode(file) {
  return (
    /^(?:src|scripts|tests)\/.*\.(?:ts|tsx|js|cjs)$/.test(file) ||
    /^(?:index\.ts|eslint\.config\.js)$/.test(file)
  );
}

async function main(mode) {
  if (!["--staged", "--tracked"].includes(mode)) {
    throw new Error(
      "Usage: node scripts/check-agent-safeguards.cjs --staged|--tracked",
    );
  }
  const files = fileNames(mode);
  const findings = [];
  let prettier;
  let eslint;
  if (mode === "--staged" && files.some(isFormattedCode)) {
    prettier = require("prettier");
    const { ESLint } = require("eslint");
    eslint = new ESLint();
  }
  for (const file of files) {
    const blob =
      mode === "--staged" ? git(["show", `:${file}`]) : readFileSync(file);
    const content = blob.toString("utf8");
    const secretIssues = secretFindings(file, content);
    findings.push(...secretIssues);
    // Do not pass a credential to tools whose diagnostics can include source text.
    if (secretIssues.length) continue;
    if (!prettier || content.includes("\0") || !isFormattedCode(file)) continue;
    try {
      const options = {
        ...(await prettier.resolveConfig(file)),
        filepath: file,
      };
      if (!(await prettier.check(content, options)))
        findings.push(`${file}: staged content needs Prettier formatting`);
      if (isLintedCode(file)) {
        const results = await eslint.lintText(content, { filePath: file });
        for (const result of results) {
          for (const message of result.messages) {
            findings.push(
              `${file}:${message.line}:${message.column}: ESLint ${message.ruleId ?? "parse error"}`,
            );
          }
        }
      }
    } catch {
      findings.push(`${file}: staged formatting or lint check failed`);
    }
  }
  if (findings.length) {
    for (const finding of findings) process.stderr.write(`${finding}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(
      `Agent safeguard check passed (${files.length} ${mode.slice(2)} files).\n`,
    );
  }
}

if (require.main === module)
  main(process.argv[2]).catch(() => {
    process.stderr.write(
      "Agent safeguard check failed; inspect staged files and tool configuration.\n",
    );
    process.exitCode = 1;
  });

module.exports = {
  protectedPath,
  secretFindings,
  isFormattedCode,
  isLintedCode,
};
