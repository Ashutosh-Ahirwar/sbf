// src/app/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";

type Profile = {
  fid: string;
  displayName?: string | null;
  username?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  followerCount?: number | null;
  raw?: any;
};

const DONATION_ADDRESS = "0xa6DEe9FdE9E1203ad02228f00bF10235d9Ca3752";
const MINIAPP_NAME = "Search by FID";

export default function Home() {
  const [query, setQuery] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  // Toast state
  const [toast, setToast] = useState<{ msg: string; id: number } | null>(null);

  useEffect(() => {
    // best-effort: if sdk is available, try to mark it ready
    try {
      (sdk as any)?.actions?.ready?.().catch(() => {});
    } catch {
      // ignore if sdk import behaves differently at runtime
    }
  }, []);

  function showToast(message: string, ms = 2500) {
    const id = Date.now();
    setToast({ msg: message, id });
    setTimeout(() => {
      setToast((t) => (t?.id === id ? null : t));
    }, ms);
  }

  function farcasterExternalLink(p: Profile) {
    if (p.username && p.username.trim().length > 0) {
      return `https://farcaster.xyz/${encodeURIComponent(p.username)}`;
    }
    return null;
  }

  async function searchFid() {
    setErrorMsg(null);
    setProfile(null);

    const fid = query.trim();
    if (!fid) {
      setErrorMsg("Please enter a numeric FID.");
      return;
    }
    if (!/^\d+$/.test(fid)) {
      setErrorMsg("FID must be numeric.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/profiles?fid=${encodeURIComponent(fid)}`);
      const json = await res.json();

      if (!res.ok) {
        if (res.status === 404) setErrorMsg("FID not found.");
        else if (res.status === 402) setErrorMsg("This FID requires paid Neynar credits.");
        else setErrorMsg(json?.error ?? "Unknown error");
        setProfile(null);
      } else {
        setProfile(json);
        setErrorMsg(null);
      }
    } catch (err: any) {
      setErrorMsg("Network error: " + (err?.message ?? String(err)));
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }

  // Compose cast text (with teaser + miniapp link)
  function composeCastText(p: Profile) {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://your-miniapp.example";
    const handle = p.username ? `@${p.username}` : `fid:${p.fid}`;
    const shortBio = p.bio ? (p.bio.length > 140 ? p.bio.slice(0, 137) + "…" : p.bio) : "";
    const profileLink = p.username ? `\n\nhttps://farcaster.xyz/${encodeURIComponent(p.username)}` : "";
    const teaser = `\n\nJust found out fid ${p.fid} is ${handle}. Want to look up a specific fid? Try ${MINIAPP_NAME}: ${origin}`;
    const bioSection = shortBio ? `\n\n${shortBio}` : "";
    return `${handle}\nFID: ${p.fid}${bioSection}${profileLink}${teaser}\n\n(Shared via ${MINIAPP_NAME})`;
  }

  // Share as cast — uses SDK if available, else clipboard fallback
  async function shareAsCast(p: Profile) {
    setSharing(true);
    const text = composeCastText(p);
    const origin = typeof window !== "undefined" ? window.location.origin : "https://your-miniapp.example";
    const embeds = [{ type: "link", url: origin, title: MINIAPP_NAME, description: "Look up Farcaster users by FID" }];

    try {
      if ((sdk as any)?.actions?.createCast) {
        try {
          await (sdk as any).actions.createCast({ text, embeds });
          showToast("Cast created.");
          setSharing(false);
          return;
        } catch {}
      }

      if ((sdk as any)?.actions?.publish) {
        try {
          await (sdk as any).actions.publish({ type: "cast", body: { text, embeds } });
          showToast("Cast published.");
          setSharing(false);
          return;
        } catch {}
      }

      await navigator.clipboard.writeText(text);
      showToast("Cast copied to clipboard. Paste into Farcaster.");
    } catch (err) {
      console.error(err);
      try {
        await navigator.clipboard.writeText(text);
        showToast("Could not publish. Cast copied to clipboard.");
      } catch {
        showToast("Unable to share or copy.");
      }
    } finally {
      setSharing(false);
    }
  }

  function goToProfile(p: Profile) {
    const url = farcasterExternalLink(p);
    if (!url) {
      showToast("This profile has no username to open externally.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  // Copy donation address helper (single implementation)
  async function copyDonationAddress() {
    try {
      await navigator.clipboard.writeText(DONATION_ADDRESS);
      showToast("Donation address copied");
    } catch {
      showToast("Copy failed");
    }
  }

  // handle Enter key
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!loading) searchFid();
    }
  }

  return (
    <main className="min-h-screen bg-neutral-900 text-gray-100 p-4 sm:p-6 flex justify-center">
      <div className="w-full max-w-2xl">
        <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-gray-200">{MINIAPP_NAME}</h1>

        {/* Search row */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Enter FID (e.g. 2)"
            className="flex-1 px-4 py-3 rounded-lg border border-neutral-700 bg-neutral-800 text-gray-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-600"
            inputMode="numeric"
            aria-label="Enter FID"
          />
          <button
            type="button"
            onClick={searchFid}
            disabled={loading}
            className="w-full sm:w-auto px-5 py-3 rounded-lg bg-gradient-to-r from-fuchsia-600 to-violet-600 hover:opacity-95 text-white font-medium disabled:opacity-60"
            aria-disabled={loading}
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </div>

        {/* Error */}
        {errorMsg && (
          <div className="mb-4 text-sm text-red-400 bg-neutral-800 p-3 rounded" role="alert">
            {errorMsg}
          </div>
        )}

        {/* Profile card */}
        {profile && (
          <article className="bg-white rounded-lg shadow p-4 sm:p-6 text-black" aria-live="polite">
            <div className="flex flex-col sm:flex-row gap-4">
              <img
                src={profile.avatarUrl ?? "/default-avatar.svg"}
                alt={profile.displayName ?? `fid:${profile.fid}`}
                className="w-24 h-24 rounded-md bg-gray-100 object-cover mx-auto sm:mx-0"
                onError={(e) => ((e.currentTarget as HTMLImageElement).src = "/default-avatar.svg")}
              />

              <div className="flex-1">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                  <div>
                    <div className="text-lg sm:text-xl font-semibold">{profile.displayName ?? `fid:${profile.fid}`}</div>
                    <div className="text-sm text-gray-700 mt-1">@{profile.username ?? `fid:${profile.fid}`}</div>
                  </div>

                  <div className="hidden sm:block text-sm text-gray-700">
                    <b className="text-gray-900">{profile.followerCount ?? "—"}</b> Followers
                  </div>
                </div>

                {profile.bio && <p className="mt-3 text-gray-800 text-sm leading-relaxed">{profile.bio}</p>}

                {/* Buttons stack on mobile */}
                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => goToProfile(profile)}
                    className="w-full sm:w-auto px-4 py-3 bg-fuchsia-600 text-white rounded-md shadow"
                  >
                    Go to profile
                  </button>

                  <button
                    type="button"
                    onClick={() => shareAsCast(profile)}
                    disabled={sharing}
                    className="w-full sm:w-auto px-4 py-3 border rounded-md bg-neutral-100 text-neutral-900 disabled:opacity-60"
                  >
                    {sharing ? "Sharing…" : "Share as cast"}
                  </button>
                </div>

                {/* follower count visible on mobile below */}
                <div className="mt-3 sm:hidden text-sm text-gray-700">
                  <b className="text-gray-900">{profile.followerCount ?? "—"}</b> Followers
                </div>
              </div>
            </div>
          </article>
        )}

        {!profile && !errorMsg && (
          <p className="mt-6 text-sm text-neutral-400">Enter a numeric FID and press Search.</p>
        )}
      </div>

      {/* Donation pill */}
      <div className="fixed z-50 left-1/2 transform -translate-x-1/2 bottom-4 sm:right-6 sm:left:auto sm:transform-none sm:translate-x-0">
        <div className="flex items-center gap-2 bg-neutral-800 rounded-full px-3 py-2 shadow backdrop-blur">
          <span className="text-xs text-neutral-300 hidden sm:block">Support this miniapp 💜</span>

          <code className="bg-black/60 text-xs px-2 py-1 rounded text-white font-mono max-w-[220px] truncate">
            {DONATION_ADDRESS}
          </code>

          <button
            type="button"
            onClick={copyDonationAddress}
            className="text-xs bg-neutral-700 hover:bg-neutral-600 text-white px-2 py-1 rounded"
          >
            Copy
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed left-1/2 transform -translate-x-1/2 bottom-24 z-50 bg-black/90 text-white px-4 py-2 rounded-md text-sm shadow"
          role="status"
          aria-live="polite"
        >
          {toast.msg}
        </div>
      )}
    </main>
  );
}
