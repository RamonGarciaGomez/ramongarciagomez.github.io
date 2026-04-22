/**
 * Strava client for ramon-site.
 * Called at build time — all errors are swallowed so a Strava outage
 * never breaks the build. Distances displayed in miles.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Activity {
  id: number;
  name: string;
  sport_type: string;
  distance_mi: string;       // "7.6"
  moving_time_fmt: string;   // "1h 02m"
  pace_fmt: string;          // "8:08 /mi"  (blank for non-pace sports)
  elevation_ft: string;      // "465"
  start_date_local: string;
  date_fmt: string;          // "Apr 18"
  strava_url: string;
  catalog: string;           // "A-001"
  polyline: string | null;   // encoded summary polyline
  gear_name: string | null;  // e.g. "Cervélo Soloist"
  is_soloist: boolean;       // true when gear matches Cervélo Soloist
  is_ride: boolean;          // true for bike activities
}

export interface WeeklyStats {
  mi: string;
  count: number;
  duration_fmt: string;
}

export interface YearStats {
  run: { mi: string; count: number };
  ride: { mi: string; count: number };
  weights: { hours: string; count: number };
}

export type StravaSnapshot =
  | {
      status: "ok";
      syncedAt: string;
      thisWeek: WeeklyStats;
      ytd: YearStats;
      latest: Activity | null;
      recent: Activity[];
    }
  | { status: "error"; reason: string };

// ─── Token cache ──────────────────────────────────────────────────────────────

let _cachedToken: string | null = null;

async function getAccessToken(): Promise<string> {
  if (_cachedToken) return _cachedToken;

  const clientId = import.meta.env.STRAVA_CLIENT_ID;
  const clientSecret = import.meta.env.STRAVA_CLIENT_SECRET;
  const refreshToken = import.meta.env.STRAVA_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing STRAVA_* env vars");
  }

  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  _cachedToken = data.access_token as string;
  return _cachedToken!;
}

/** Fetch all activities since `afterUnix`, paginating until exhausted. */
async function fetchAllActivities(
  token: string,
  afterUnix: number
): Promise<unknown[]> {
  const out: unknown[] = [];
  const perPage = 200;
  for (let page = 1; page <= 10; page++) {
    const batch = (await stravaGet(
      `/athlete/activities?after=${afterUnix}&per_page=${perPage}&page=${page}`,
      token
    )) as unknown[];
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < perPage) break;
  }
  return out;
}

async function stravaGet(path: string, token: string): Promise<unknown> {
  const res = await fetch(`https://www.strava.com/api/v3${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Strava GET ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

const METERS_PER_MILE = 1609.344;

function fmtMi(meters: number): string {
  return (meters / METERS_PER_MILE).toFixed(1);
}

function fmtDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

function fmtPace(meters: number, seconds: number, sportType: string): string {
  const paceSports = ["Run", "TrailRun", "Walk", "Hike", "VirtualRun"];
  if (!paceSports.includes(sportType) || meters === 0) return "";
  const secPerMile = seconds / (meters / METERS_PER_MILE);
  const pm = Math.floor(secPerMile / 60);
  const ps = Math.round(secPerMile % 60);
  return `${pm}:${String(ps).padStart(2, "0")} /mi`;
}

function fmtDate(isoLocal: string): string {
  const d = new Date(isoLocal);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtElevationFt(meters: number): string {
  return String(Math.round(meters * 3.28084));
}

// ─── Week boundaries (Mon–Sun in America/Los_Angeles) ─────────────────────────

function weekBoundsUnix(): { start: number; end: number } {
  const now = new Date();
  const laStr = now.toLocaleDateString("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [mm, dd, yyyy] = laStr.split("/").map(Number);
  const dow = new Date(yyyy!, mm! - 1, dd!).getDay();
  const daysFromMon = (dow + 6) % 7;

  const monMidnightLA = new Date(Date.UTC(yyyy!, mm! - 1, dd! - daysFromMon));
  const offsetMs = getOffsetMs("America/Los_Angeles", monMidnightLA);
  const weekStart = Math.floor((monMidnightLA.getTime() - offsetMs) / 1000);
  const weekEnd = weekStart + 7 * 24 * 3600 - 1;

  return { start: weekStart, end: weekEnd };
}

function getOffsetMs(tz: string, date: Date): number {
  const utcStr = date.toLocaleString("en-US", { timeZone: "UTC" });
  const tzStr = date.toLocaleString("en-US", { timeZone: tz });
  return new Date(tzStr).getTime() - new Date(utcStr).getTime();
}

// ─── Normalize raw Strava activity ────────────────────────────────────────────

const RIDE_SPORTS = new Set([
  "Ride",
  "VirtualRide",
  "EBikeRide",
  "MountainBikeRide",
  "GravelRide",
  "Handcycle",
  "Velomobile",
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalize(raw: any, catalogIndex: number, gearMap: Map<string, string>): Activity {
  const sport = raw.sport_type ?? raw.type ?? "Workout";
  const gearName = raw.gear_id ? gearMap.get(raw.gear_id) ?? null : null;
  const soloist = gearName ? /soloist/i.test(gearName) : false;

  return {
    id: raw.id,
    name: raw.name,
    sport_type: sport,
    distance_mi: fmtMi(raw.distance ?? 0),
    moving_time_fmt: fmtDuration(raw.moving_time ?? 0),
    pace_fmt: fmtPace(raw.distance ?? 0, raw.moving_time ?? 0, sport),
    elevation_ft: fmtElevationFt(raw.total_elevation_gain ?? 0),
    start_date_local: raw.start_date_local ?? raw.start_date ?? "",
    date_fmt: fmtDate(raw.start_date_local ?? raw.start_date ?? ""),
    strava_url: `https://www.strava.com/activities/${raw.id}`,
    catalog: `A-${String(catalogIndex + 1).padStart(3, "0")}`,
    polyline: raw.map?.summary_polyline ?? null,
    gear_name: gearName,
    is_soloist: soloist,
    is_ride: RIDE_SPORTS.has(sport),
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function getStravaData(): Promise<StravaSnapshot> {
  try {
    const token = await getAccessToken();
    const athleteId = import.meta.env.STRAVA_ATHLETE_ID;

    const sixtyDaysAgo = Math.floor(Date.now() / 1000) - 60 * 24 * 3600;
    // Unix timestamp for Jan 1 of current year, UTC
    const yearStart = Math.floor(
      Date.UTC(new Date().getUTCFullYear(), 0, 1) / 1000
    );

    const [rawActivities, rawStats, rawAthlete, ytdActivities] = await Promise.all([
      stravaGet(
        `/athlete/activities?after=${sixtyDaysAgo}&per_page=60`,
        token
      ) as Promise<unknown[]>,
      athleteId
        ? (stravaGet(`/athletes/${athleteId}/stats`, token) as Promise<unknown>)
        : Promise.resolve(null),
      stravaGet("/athlete", token) as Promise<unknown>,
      fetchAllActivities(token, yearStart),
    ]);

    // Build gear_id → name map from athlete's bikes + shoes
    const gearMap = new Map<string, string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const athlete = rawAthlete as any;
    if (Array.isArray(athlete?.bikes)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const b of athlete.bikes) {
        if (b?.id && b?.name) gearMap.set(b.id, b.name);
      }
    }
    if (Array.isArray(athlete?.shoes)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const s of athlete.shoes) {
        if (s?.id && s?.name) gearMap.set(s.id, s.name);
      }
    }

    const sorted = [...(rawActivities as unknown[])].sort(
      (a, b) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        new Date((b as any).start_date).getTime() -
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        new Date((a as any).start_date).getTime()
    );

    const activities = sorted.map((a, i) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      normalize(a as any, i, gearMap)
    );

    // ── This week ──────────────────────────────────────────────────────────
    const { start: weekStart, end: weekEnd } = weekBoundsUnix();
    const weekActivities = sorted.filter((a) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const t = Math.floor(new Date((a as any).start_date).getTime() / 1000);
      return t >= weekStart && t <= weekEnd;
    });
    const weekTotalM = weekActivities.reduce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s, a) => s + ((a as any).distance ?? 0),
      0
    );
    const weekTotalS = weekActivities.reduce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s, a) => s + ((a as any).moving_time ?? 0),
      0
    );
    const thisWeek: WeeklyStats = {
      mi: fmtMi(weekTotalM),
      count: weekActivities.length,
      duration_fmt: fmtDuration(weekTotalS),
    };

    // ── YTD: running + cycling from stats endpoint, weight training
    //         computed from activity list ──────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = rawStats as any;
    const weightActivities = ytdActivities.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (a) => (a as any).sport_type === "WeightTraining"
    );
    const weightSeconds = weightActivities.reduce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sum, a) => sum + ((a as any).moving_time ?? (a as any).elapsed_time ?? 0),
      0
    );

    const ytd: YearStats = {
      run: s
        ? {
            mi: fmtMi(s.ytd_run_totals?.distance ?? 0),
            count: s.ytd_run_totals?.count ?? 0,
          }
        : { mi: "0.0", count: 0 },
      ride: s
        ? {
            mi: fmtMi(s.ytd_ride_totals?.distance ?? 0),
            count: s.ytd_ride_totals?.count ?? 0,
          }
        : { mi: "0.0", count: 0 },
      weights: {
        hours: (weightSeconds / 3600).toFixed(1),
        count: weightActivities.length,
      },
    };

    const latest = activities[0] ?? null;
    const recent = activities.slice(0, 10);

    return {
      status: "ok",
      syncedAt: new Date().toISOString(),
      thisWeek,
      ytd,
      latest,
      recent,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn("[strava] data fetch failed:", reason);
    return { status: "error", reason };
  }
}
