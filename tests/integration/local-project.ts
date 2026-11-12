import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

export type LocalTestProject = {
  apiUrl: string;
  anonKey: string;
  dbContainer: string;
};

/** Resolve only the checkout's local stack or an explicitly selected scratch KC3-37 stack. */
export function getLocalTestProject(): LocalTestProject {
  try {
    const scratchWorkdir = process.env.KC3_TEST_SUPABASE_WORKDIR;
    const workdir = scratchWorkdir ?? process.cwd();
    const config = readFileSync(
      path.resolve(workdir, "supabase/config.toml"),
      "utf8",
    );
    const projectId = config.match(/^project_id = "([A-Za-z0-9_]+)"$/m)?.[1];
    const apiPort = config
      .split(/^\[api\]$/m)[1]
      ?.split(/^\[/m)[0]
      ?.match(/^port = (\d+)$/m)?.[1];
    if (
      !projectId ||
      (scratchWorkdir
        ? !/^KC3_37_[A-Za-z0-9_]+$/.test(projectId) ||
          !path.resolve(workdir).startsWith("/private/tmp/")
        : projectId !== "KC3")
    ) {
      throw new Error("Unexpected local project");
    }
    const status = JSON.parse(
      execFileSync(
        path.resolve("node_modules/.bin/supabase"),
        ["status", "--workdir", workdir, "-o", "json"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 15000 },
      ),
    ) as { API_URL?: string; ANON_KEY?: string };
    const url = new URL(status.API_URL ?? "");
    if (
      !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
      !["http:", "https:"].includes(url.protocol) ||
      url.port !== apiPort ||
      !status.ANON_KEY
    ) {
      throw new Error("Unexpected local endpoint");
    }
    return {
      apiUrl: status.API_URL!,
      anonKey: status.ANON_KEY,
      dbContainer: `supabase_db_${projectId}`,
    };
  } catch {
    // CLI output can contain privileged credentials; never include it in errors.
    throw new Error(
      "Start the selected disposable local Supabase project before integration tests.",
    );
  }
}
