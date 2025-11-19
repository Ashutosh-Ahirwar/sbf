// src/app/api/profiles/route.ts
import { NextResponse } from "next/server";

const NEYNAR_BASE = "https://api.neynar.com/v2";
const BULK_PATH = "/farcaster/user/bulk"; // using bulk even for single fid (2 credits/fid)
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX_PER_WINDOW = 300; // adjust as needed

type CacheEntry = { value: any; expiresAt: number };
const cache = new Map<string, CacheEntry>();

type RateEntry = { count: number; windowStart: number };
const rateMap = new Map<string, RateEntry>();

let creditsUsed = 0; // in-memory credit counter (persist in prod if needed)

function getFromCache(fid: string) {
  const e = cache.get(fid);
  if (!e) return null;
  if (Date.now() > e.expiresAt) {
    cache.delete(fid);
    return null;
  }
  return e.value;
}
function setCache(fid: string, value: any) {
  cache.set(fid, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

function normalizeUser(u: any) {
  return {
    fid: String(u.fid ?? u.id ?? ""),
    displayName: u.displayName ?? u.display_name ?? u.name ?? null,
    username: u.username ?? u.handle ?? null,
    avatarUrl:
      u.pfp_url ??
      u.avatar_url ??
      u.profile?.pfp_url ??
      u.raw?.profile?.pfp_url ??
      null,
    bio: u.bio ?? u.profile?.bio?.text ?? u.raw?.profile?.bio?.text ?? null,
    followerCount:
      u.follower_count ?? u.followersCount ?? u.raw?.profile?.follower_count ?? null,
    raw: u,
  };
}

function getClientIp(req: Request) {
  try {
    const fwd = req.headers.get("x-forwarded-for");
    if (fwd) return fwd.split(",")[0].trim();
    return req.headers.get("x-real-ip") ?? req.headers.get("host") ?? "local";
  } catch {
    return "unknown";
  }
}
function isRateLimited(ip: string) {
  const now = Date.now();
  const e = rateMap.get(ip);
  if (!e) {
    rateMap.set(ip, { count: 1, windowStart: now });
    return false;
  }
  if (now - e.windowStart > RATE_LIMIT_WINDOW_MS) {
    e.count = 1;
    e.windowStart = now;
    rateMap.set(ip, e);
    return false;
  }
  e.count += 1;
  rateMap.set(ip, e);
  return e.count > RATE_LIMIT_MAX_PER_WINDOW;
}

export async function GET(req: Request) {
  try {
    const key = process.env.NEYNAR_API_KEY;
    if (!key) {
      return NextResponse.json({ error: "NEYNAR_API_KEY not set" }, { status: 500 });
    }

    const url = new URL(req.url);
    const fid = (url.searchParams.get("fid") ?? "").trim();

    // enforce single numeric fid only
    if (!fid) {
      return NextResponse.json({ error: "Missing query param: fid" }, { status: 400 });
    }
    if (fid.includes(",") || !/^\d+$/.test(fid)) {
      return NextResponse.json(
        { error: "This endpoint accepts a single numeric fid (digits only)" },
        { status: 400 }
      );
    }

    // rate limit per IP
    const ip = getClientIp(req);
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Rate limit exceeded", details: `max ${RATE_LIMIT_MAX_PER_WINDOW} lookups per hour` },
        { status: 429 }
      );
    }

    // cache hit?
    const cached = getFromCache(fid);
    if (cached) {
      return NextResponse.json(normalizeUser(cached), { status: 200, headers: { "X-Cache": "HIT" } });
    }

    // call bulk endpoint for single fid (Neynar charges per-fid)
    const neynarUrl = `${NEYNAR_BASE}${BULK_PATH}?fids=${encodeURIComponent(fid)}`;
    const resp = await fetch(neynarUrl, { headers: { "x-api-key": key, Accept: "application/json" } });
    const text = await resp.text().catch(() => "<no body>");

    // Payment required -> return helpful fallback JSON
    if (resp.status === 402) {
      const fallback = `https://farcaster.xyz/${encodeURIComponent(fid)}`; // fallback uses fid if username not known
      return NextResponse.json(
        {
          error: "Payment required by Neynar for this endpoint",
          message: "This data endpoint requires Neynar credits for access. You can view the profile directly on Farcaster as a fallback.",
          fallback: { farcaster: fallback },
          neynarDetails: (() => { try { return JSON.parse(text); } catch { return text; } })(),
        },
        { status: 402 }
      );
    }

    if (resp.status === 401 || resp.status === 403) {
      return NextResponse.json({ error: "Neynar auth failed", details: text }, { status: resp.status });
    }
    if (!resp.ok) {
      return NextResponse.json({ error: `Neynar returned ${resp.status}`, details: text }, { status: 502 });
    }

    let json: any;
    try { json = JSON.parse(text); } catch (e) {
      return NextResponse.json({ error: "Invalid JSON from Neynar", details: text }, { status: 502 });
    }

    const users: any[] = Array.isArray(json) ? json : json.users ?? json.data ?? [];
    if (!users || users.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const user = users[0];
    const foundFid = String(user.fid ?? user.id ?? "");
    setCache(foundFid, user);

    // credit accounting: 2 credits per fid for bulk endpoint
    creditsUsed += 2;
    console.log(`creditsUsed += 2 (total ${creditsUsed}) for fid ${foundFid}`);

    return NextResponse.json(normalizeUser(user), { status: 200, headers: { "X-Cache": "MISS" } });
  } catch (err: any) {
    console.error("profiles route error:", err);
    return NextResponse.json({ error: "Internal server error", details: String(err) }, { status: 500 });
  }
}
