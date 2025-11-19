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
  const [toast, setToast] = useState<{ msg: string; id: number } | null>(null);

  // Support popover visibility
  const [showDonation, setShowDonation] = useState(false);

  // SDK READY HANDLER (same robust logic)
  useEffect(() => {
    let mounted = true;
    const MAX_ATTEMPTS = 12;
    const RETRY_DELAY_MS = 400;

    async function tryReady(sdkObj: any) {
      if (!sdkObj?.actions?.ready) return false;
      try {
        await sdkObj.actions.ready();
        return true;
      } catch {
        return false;
      }
    }

    async function init() {
      if (await tryReady(sdk)) return;

      let dynamic: any = null;
      try {
        const mod = await import("@farcaster/miniapp-sdk");
        dynamic = mod.sdk ?? mod.default ?? mod;
        if (dynamic && (await tryReady(dynamic))) return;
      } catch {}

      for (let i = 0; mounted && i < MAX_ATTEMPTS; i++) {
        const candidate = dynamic ?? (globalThis as any).sdk ?? sdk;
        if (candidate && (await tryReady(candidate))) return;
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }

    init();
    return () => {
      mounted = false;
    };
  }, []);

  function showToast(message: string, ms = 2500) {
    const id = Date.now();
    setToast({ msg: message, id });
    setTimeout(() => {
      setToast((t) => (t?.id === id ? null : t));
    }, ms);
  }

  function farcasterExternalLink(p: Profile) {
    return p.username ? `https://farcaster.xyz/${encodeURIComponent(p.username)}` : null;
  }

  async function searchFid() {
    setErrorMsg(null);
    setProfile(null);

    const fid = query.trim();
    if (!fid) return setErrorMsg("Please enter a numeric FID.");
    if (!/^\d+$/.test(fid)) return setErrorMsg("FID must be numeric.");

    setLoading(true);
    try {
      const res = await fetch(`/api/profiles?fid=${encodeURIComponent(fid)}`);
      const json = await res.json();

      if (!res.ok) {
        if (res.status === 404) setErrorMsg("FID not found.");
        else if (res.status === 402) setErrorMsg("This FID requires paid Neynar credits.");
        else setErrorMsg(json?.error ?? "Unknown error");
      } else {
        setProfile(json);
      }
    } catch (err: any) {
      setErrorMsg("Network error: " + err?.message);
    } finally {
      setLoading(false);
    }
  }

  function composeCastText(p: Profile) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const handle = p.username ? `@${p.username}` : `fid:${p.fid}`;
    const bio = p.bio ?? "";
    const trimmedBio = bio.length > 140 ? bio.slice(0, 137) + "…" : bio;
    const bioSection = trimmedBio ? `\n\n${trimmedBio}` : "";
    const link = p.username ? `\n\nhttps://farcaster.xyz/${p.username}` : "";
    const teaser = `\n\nJust found out fid ${p.fid} is ${handle}. Want to look up a specific fid? Try ${origin}`;
    return `${handle}\nFID: ${p.fid}${bioSection}${link}${teaser}\n\n(Shared via ${MINIAPP_NAME})`;
  }

  async function shareAsCast(p: Profile) {
    setSharing(true);
    const text = composeCastText(p);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const embeds = [{ type: "link", url: origin, title: MINIAPP_NAME }];

    try {
      if ((sdk as any)?.actions?.createCast)
        try {
          await (sdk as any).actions.createCast({ text, embeds });
          showToast("Cast created.");
          return;
        } catch {}

      if ((sdk as any)?.actions?.publish)
        try {
          await (sdk as any).actions.publish({ type: "cast", body: { text, embeds } });
          showToast("Cast published.");
          return;
        } catch {}

      await navigator.clipboard.writeText(text);
      showToast("Cast copied to clipboard.");
    } catch {
      showToast("Unable to share.");
    } finally {
      setSharing(false);
    }
  }

  async function copyDonationAddress() {
    try {
      await navigator.clipboard.writeText(DONATION_ADDRESS);
      showToast("Address copied");
    } catch {
      showToast("Copy failed");
    }
  }

  function goToProfile(p: Profile) {
    const url = farcasterExternalLink(p);
    if (!url) return showToast("This profile has no username.");
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !loading) searchFid();
  }

  return (
    <main className="min-h-screen bg-neutral-900 text-gray-100 p-4 sm:p-6 flex justify-center pb-28 sm:pb-0">
      <div className="w-full max-w-2xl">
        <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">{MINIAPP_NAME}</h1>

        {/* Search */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Enter FID (e.g. 2)"
            inputMode="numeric"
            className="flex-1 px-4 py-3 rounded-lg border border-neutral-700 bg-neutral-800 text-gray-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-600"
          />
          <button
            onClick={searchFid}
            disabled={loading}
            className="w-full sm:w-auto px-5 py-3 rounded-lg bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white font-medium disabled:opacity-60"
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 text-sm text-red-400 bg-neutral-800 p-3 rounded">{errorMsg}</div>
        )}

        {/* Profile */}
        {profile && (
          <article className="bg-white rounded-lg shadow p-4 sm:p-6 text-black">
            <div className="flex flex-col sm:flex-row gap-4">
              <img
                src={profile.avatarUrl ?? "/default-avatar.svg"}
                alt=""
                className="w-24 h-24 rounded-md object-cover bg-gray-100 mx-auto sm:mx-0"
              />

              <div className="flex-1">
                <div className="flex flex-col sm:flex-row sm:justify-between">
                  <div>
                    <div className="text-lg sm:text-xl font-semibold">
                      {profile.displayName ?? `fid:${profile.fid}`}
                    </div>
                    <div className="text-sm text-gray-700 mt-1">
                      @{profile.username ?? `fid:${profile.fid}`}
                    </div>
                  </div>

                  <div className="hidden sm:block text-sm text-gray-700">
                    <b>{profile.followerCount ?? "—"}</b> Followers
                  </div>
                </div>

                {profile.bio && (
                  <p className="mt-3 text-sm text-gray-800 leading-relaxed">{profile.bio}</p>
                )}

                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => goToProfile(profile)}
                    className="w-full sm:w-auto px-4 py-3 bg-fuchsia-600 text-white rounded-md shadow"
                  >
                    Go to profile
                  </button>

                  <button
                    onClick={() => shareAsCast(profile)}
                    disabled={sharing}
                    className="w-full sm:w-auto px-4 py-3 rounded-md border bg-neutral-100 text-neutral-900 disabled:opacity-60"
                  >
                    {sharing ? "Sharing…" : "Share as cast"}
                  </button>
                </div>

                <div className="mt-3 sm:hidden text-sm text-gray-700">
                  <b>{profile.followerCount ?? "—"}</b> Followers
                </div>
              </div>
            </div>
          </article>
        )}

        {!profile && !errorMsg && (
          <p className="mt-6 text-sm text-neutral-400">Enter a numeric FID and press Search.</p>
        )}
      </div>

      {/* -------------------------------- */}
      {/* Support Button + Expandable Panel */}
      {/* -------------------------------- */}
      <div className="fixed bottom-4 right-4 z-50">

        {/* Support button (when collapsed) */}
        {!showDonation && (
          <button
            onClick={() => setShowDonation(true)}
            className="px-4 py-2 bg-fuchsia-600 text-white rounded-full shadow hover:bg-fuchsia-700 text-sm"
          >
            Support
          </button>
        )}

        {/* Expanded support panel */}
        {showDonation && (
          <div className="bg-neutral-800 text-white rounded-lg shadow-xl p-3 w-64 animate-fadeIn">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Support this miniapp</span>
              <button
                onClick={() => setShowDonation(false)}
                className="text-neutral-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <code className="block bg-black/50 p-2 rounded text-xs break-all mb-2">
              {DONATION_ADDRESS}
            </code>

            <button
              onClick={copyDonationAddress}
              className="w-full bg-neutral-700 hover:bg-neutral-600 text-white text-sm py-2 rounded"
            >
              Copy address
            </button>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-50 bg-black/90 text-white px-4 py-2 rounded-md text-sm shadow">
          {toast.msg}
        </div>
      )}
    </main>
  );
}
