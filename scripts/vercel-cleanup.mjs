/**
 * Delete old Vercel deployments, without taking the shop offline.
 *
 * Deployment storage fills up because every push builds a new deployment and
 * nothing removes the old ones. On a small app the bundles are 20-50 MB each,
 * so a few hundred pushes is several gigabytes — and the fix is deleting
 * deployments, not upgrading a plan.
 *
 * The danger is obvious: one wrong delete and a live business is offline. So
 * the rules below are conservative by construction, they are tested in
 * tests/vercel-cleanup.test.ts, and this prints what it would do and changes
 * nothing unless you pass --yes.
 *
 * What is never deleted, regardless of age:
 *   - the deployment currently serving production, read from the project
 *     itself rather than guessed at
 *   - anything with a domain or alias pointing at it
 *   - the newest --keep-production builds, so instant rollback still works
 *   - anything this script cannot confidently classify
 *
 * Usage:
 *   export VERCEL_TOKEN=...                  # never paste this into a chat
 *   node scripts/vercel-cleanup.mjs --project pepper-pan
 *   node scripts/vercel-cleanup.mjs --project pepper-pan --yes
 *
 * Options:
 *   --project <name>        required
 *   --team <id>             for a team account
 *   --keep-production <n>   recent production builds to keep (default 3)
 *   --preview-age <days>    delete previews older than this (default 7)
 *   --yes                   actually delete; without it, nothing is touched
 */

const API = "https://api.vercel.com";

/* ---------------------------------------------------------------- rules -- */

export const KEEP = {
  LIVE: "serving production right now",
  ALIASED: "a domain points at it",
  ROLLBACK: "kept for rollback",
  RECENT: "too recent",
  UNKNOWN: "could not classify it, so leaving it alone",
};

/**
 * Decide what happens to each deployment.
 *
 * Written as a pure function over plain data precisely so it can be tested
 * without an account: the consequence of a mistake here is a business being
 * offline, which is not something to find out from production.
 *
 * Everything defaults to keep. A deployment is deleted only when a rule says
 * so explicitly — the opposite arrangement means any field the API renames
 * silently turns into a deletion.
 */
export function classify(deployments, opts) {
  const {
    liveId,
    keepProduction = 3,
    previewAgeDays = 7,
    now = Date.now(),
  } = opts;

  if (!liveId) throw new Error("refusing to classify without knowing which deployment is live");

  const cutoff = now - previewAgeDays * 86_400_000;
  const production = deployments
    .filter((d) => d.target === "production")
    .sort((a, b) => b.created - a.created);
  const keepForRollback = new Set(production.slice(0, keepProduction).map((d) => d.uid));

  return deployments.map((d) => {
    const keep = (why) => ({ ...d, action: "keep", why });
    const drop = (why) => ({ ...d, action: "delete", why });

    if (d.uid === liveId) return keep(KEEP.LIVE);
    // `aliasAssigned` is set on anything a domain resolves to, including
    // branch aliases someone may have shared. Treated as sacred either way.
    if (d.aliasAssigned || (d.alias?.length ?? 0) > 0) return keep(KEEP.ALIASED);

    const state = String(d.state ?? d.readyState ?? "").toUpperCase();

    // Builds that failed or were cancelled never served a request, so these
    // are the safest thing on the account to remove and usually the bulk of it.
    if (state === "ERROR" || state === "CANCELED" || state === "CANCELLED") {
      return drop("build never succeeded");
    }

    if (d.target === "production") {
      return keepForRollback.has(d.uid) ? keep(KEEP.ROLLBACK) : drop("superseded production build");
    }

    if (d.target === "preview" || d.target === null || d.target === undefined) {
      return d.created < cutoff ? drop(`preview older than ${previewAgeDays}d`) : keep(KEEP.RECENT);
    }

    return keep(KEEP.UNKNOWN);
  });
}

/* ------------------------------------------------------------------ api -- */

async function api(path, token, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status}\n${body.slice(0, 400)}`);
  }
  return res.json();
}

/** The authoritative answer to "what is live", asked of the project itself. */
async function liveDeploymentId(project, token, team) {
  const q = team ? `?teamId=${team}` : "";
  const p = await api(`/v9/projects/${encodeURIComponent(project)}${q}`, token);
  const live = p?.targets?.production?.id ?? p?.targets?.production?.uid;
  if (!live) {
    throw new Error(
      "Could not read the current production deployment from the project.\n" +
      "Refusing to continue: without it there is no way to be sure a delete\n" +
      "would not take the site down."
    );
  }
  return { live, projectId: p.id };
}

async function allDeployments(projectId, token, team) {
  const out = [];
  let until;
  for (let page = 0; page < 100; page++) {
    const q = new URLSearchParams({ projectId, limit: "100" });
    if (team) q.set("teamId", team);
    if (until) q.set("until", String(until));
    const data = await api(`/v6/deployments?${q}`, token);
    const batch = data.deployments ?? [];
    out.push(...batch);
    const next = data.pagination?.next;
    if (!next || batch.length === 0) break;
    until = next;
  }
  return out;
}

/* ------------------------------------------------------------------ cli -- */

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}
const has = (name) => process.argv.includes(`--${name}`);

async function main() {
  const token = process.env.VERCEL_TOKEN;
  const project = arg("project");
  if (!token || !project) {
    console.error("VERCEL_TOKEN must be set, and --project <name> given.");
    console.error("Make a token at Vercel -> Settings -> Tokens, and delete it when you are done.");
    process.exit(1);
  }
  const team = arg("team");
  const keepProduction = Number(arg("keep-production", 3));
  const previewAgeDays = Number(arg("preview-age", 7));
  const commit = has("yes");

  const { live, projectId } = await liveDeploymentId(project, token, team);
  const deployments = await allDeployments(projectId, token, team);
  const judged = classify(deployments, { liveId: live, keepProduction, previewAgeDays });

  const doomed = judged.filter((d) => d.action === "delete");
  const kept = judged.filter((d) => d.action === "keep");

  const reasons = {};
  for (const d of judged) reasons[`${d.action}: ${d.why}`] = (reasons[`${d.action}: ${d.why}`] ?? 0) + 1;

  console.log(`\nproject      ${project}`);
  console.log(`live now     ${live}  <- never touched`);
  console.log(`deployments  ${deployments.length}\n`);
  for (const [why, n] of Object.entries(reasons).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(5)}  ${why}`);
  }
  console.log(`\nwould delete ${doomed.length}, keep ${kept.length}`);

  if (!commit) {
    console.log("\nDRY RUN — nothing was changed. Re-run with --yes to delete.\n");
    return;
  }

  console.log("\nDeleting. This cannot be undone; the source is still in git.\n");
  let done = 0, failed = 0;
  for (const d of doomed) {
    try {
      const q = team ? `?teamId=${team}` : "";
      await api(`/v13/deployments/${d.uid}${q}`, token, { method: "DELETE" });
      done++;
      if (done % 25 === 0) console.log(`  ${done}/${doomed.length}`);
    } catch (err) {
      failed++;
      console.error(`  failed ${d.uid}: ${String(err).split("\n")[0]}`);
      // A run of failures means something changed underneath us — a revoked
      // token, a rate limit, a moved endpoint. Stop rather than hammer it.
      if (failed >= 5) { console.error("\nToo many failures. Stopping."); break; }
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  console.log(`\ndeleted ${done}, failed ${failed}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => { console.error("\n" + String(err) + "\n"); process.exit(1); });
}
