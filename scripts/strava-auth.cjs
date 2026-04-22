#!/usr/bin/env node
/**
 * One-time Strava OAuth flow to generate a refresh token for this site.
 *
 * Usage:
 *   1. Populate `.env` with STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET (copy
 *      them from your StravaAI .env).
 *   2. Run `npm run strava:auth`.
 *   3. A browser window opens. Authorize.
 *   4. The script prints STRAVA_REFRESH_TOKEN and STRAVA_ATHLETE_ID, and
 *      appends them to `.env`.
 *   5. Add the same four STRAVA_* values to Vercel's env vars.
 */

const http = require("http");
const url = require("url");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

// --- Tiny .env loader (no dependency) ---
const envPath = path.resolve(__dirname, "..", ".env");
function loadEnv() {
  if (!fs.existsSync(envPath)) return {};
  const out = {};
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
  return out;
}
const envVars = loadEnv();

const CLIENT_ID = envVars.STRAVA_CLIENT_ID || process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = envVars.STRAVA_CLIENT_SECRET || process.env.STRAVA_CLIENT_SECRET;
const PORT = 8642;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("\n✗ Missing STRAVA_CLIENT_ID and/or STRAVA_CLIENT_SECRET.\n");
  console.error(
    "  Copy them from StravaAI's .env file into ramon-site/.env, then re-run:"
  );
  console.error("    STRAVA_CLIENT_ID=12345");
  console.error("    STRAVA_CLIENT_SECRET=abc123...\n");
  process.exit(1);
}

const authUrl =
  `https://www.strava.com/oauth/authorize?` +
  `client_id=${CLIENT_ID}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&approval_prompt=force` +
  `&scope=read,activity:read_all,profile:read_all`;

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("  Strava OAuth setup for ramon-site");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
console.log("  Opening browser. If it doesn't open, paste this URL:\n");
console.log("  " + authUrl + "\n");

// Best-effort browser launcher
const openCmd =
  process.platform === "darwin" ? "open"
  : process.platform === "win32" ? "start"
  : "xdg-open";
exec(`${openCmd} "${authUrl}"`);

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  if (parsed.pathname !== "/callback") {
    res.writeHead(404); res.end("Not found"); return;
  }
  const code = parsed.query.code;
  const error = parsed.query.error;
  if (error) {
    res.writeHead(400, { "Content-Type": "text/html" });
    res.end(`<h1>Authorization denied</h1><p>${error}</p>`);
    console.error("\n✗ Authorization denied:", error);
    server.close(); process.exit(1);
  }
  if (!code) {
    res.writeHead(400); res.end("No code"); return;
  }

  try {
    const tokenRes = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
      }),
    });
    const data = await tokenRes.json();

    if (!tokenRes.ok) {
      throw new Error(JSON.stringify(data));
    }

    const refreshToken = data.refresh_token;
    const athleteId = data.athlete && data.athlete.id;
    const athleteName = data.athlete
      ? `${data.athlete.firstname} ${data.athlete.lastname}`.trim()
      : "unknown";

    // Write browser response
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`
      <!doctype html><html><head><meta charset="utf-8"><title>Done</title>
      <style>body{font-family:ui-monospace,monospace;background:#f0ebe0;color:#141210;
      padding:4rem;line-height:1.5}h1{font-family:Georgia,serif;font-size:2rem}
      code{background:#e3dcc8;padding:0.15em 0.4em}</style></head><body>
      <h1>✓ Strava connected</h1>
      <p>Authorized as <strong>${athleteName}</strong> (athlete id <code>${athleteId}</code>).</p>
      <p>You can close this tab and return to the terminal.</p>
      </body></html>
    `);

    // Update .env
    const toAppend = {
      STRAVA_REFRESH_TOKEN: refreshToken,
      STRAVA_ATHLETE_ID: String(athleteId),
    };
    updateEnvFile(envPath, toAppend);

    console.log("\n✓ Success! Authorized as " + athleteName);
    console.log("\n  Appended to .env:");
    for (const [k, v] of Object.entries(toAppend)) {
      const masked = v.length > 10 ? v.slice(0, 4) + "…" + v.slice(-4) : v;
      console.log(`    ${k}=${masked}`);
    }
    console.log("\n  Next: add these four vars to Vercel");
    console.log("  (Project → Settings → Environment Variables):\n");
    console.log(`    STRAVA_CLIENT_ID=${CLIENT_ID}`);
    console.log(`    STRAVA_CLIENT_SECRET=${CLIENT_SECRET.slice(0, 4)}…`);
    console.log(`    STRAVA_REFRESH_TOKEN=${refreshToken.slice(0, 4)}…`);
    console.log(`    STRAVA_ATHLETE_ID=${athleteId}\n`);

    setTimeout(() => { server.close(); process.exit(0); }, 500);
  } catch (err) {
    res.writeHead(500); res.end("Token exchange failed. Check terminal.");
    console.error("\n✗ Token exchange failed:", err.message || err);
    server.close(); process.exit(1);
  }
});

server.listen(PORT, () => {
  console.log(`  Listening on http://localhost:${PORT} for Strava callback…\n`);
});

/** Update or append key=value lines in a .env file. */
function updateEnvFile(filePath, kv) {
  let contents = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  for (const [key, value] of Object.entries(kv)) {
    const line = `${key}=${value}`;
    const re = new RegExp(`^\\s*${key}\\s*=.*$`, "m");
    if (re.test(contents)) {
      contents = contents.replace(re, line);
    } else {
      if (contents.length && !contents.endsWith("\n")) contents += "\n";
      contents += line + "\n";
    }
  }
  fs.writeFileSync(filePath, contents);
}
