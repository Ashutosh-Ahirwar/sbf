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
const DONATION_STORAGE_KEY = "sbf:donation:expanded";

export default function Home() {
  const [query, setQuery] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const [toast, setToast] = useState<{ msg: string; id: number } | null>(null);

  // donation pill expanded state (persisted)
  const [donationExpanded, setDonationExpanded] = useState<boolean>(() => {
    try {
      const v = typeof window !== "undefined" ? localStorage.getItem(DONATION_STORAGE_KEY) : null;
      return v === "1";
    } catch {
      return false;
    }
  });

  // SDK ready logic (unchanged)
  useEffect(() => {
    let mounted = true;
    const MAX_ATTEMPTS = 12;
    const RETRY_DELAY_MS = 400;

    async function tryCallReady(sdkObj: any) {
      if (!sdkObj?.actions?.ready) return false;
      try {
        await sdkObj.actions.ready();
        console.info("Farcaster SDK: actions.ready() succeeded");
        return true;
      } catch {
        return false;
      }
    }

    async function initReady() {
      try {
        if ((sdk as any)?.actions) {
          const ok = await tryCallReady(sdk);
          if (ok) return;
        }
      } catch {}

      let importedSdk: any = null;
      try {
        const mod = await import("@farcaster/miniapp-sdk");
        importedSdk = mod.sdk ?? mod.default ?? mod;
        if (importedSdk) {
          const ok = await tryCallReady(importedSdk);
          if (ok) return;
        }
      } catch {}

      for (let attempt = 1; mounted && attempt <= MAX_ATTEMPTS; attempt++) {
        const candidate = importedSdk ?? (globalThis as any).sdk ?? sdk;
        if (candidate) {
          const ok = await tryCallReady(candidate);
          if (ok) return;
        }
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }

      console.warn("Farcaster SDK ready() not called — expected outside client.");
    }

    initReady();
    return () => {
      mounted = false;
    };
  }, []);

  // persist donationExpanded
  useEffect(() => {
    try {
      localStorage.setItem(DONATION_STORAGE_KEY, donationExpanded ? "1" : "0");
    } catch {}
  }, [donationExpanded]);

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
      setErrorMsg(`Network error: ${err?.message ?? String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  function composeCastText(p: Profile) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const handle = p.username ? `@${p.username}` : `fid:${p.fid}`;
    const shortBio = p.bio ? (p.bio.length > 140 ? p.bio.slice(0, 137) + "…" : p.bio) : "";
    const profileLink = p.username ? `\n\nhttps://farcaster.xyz/${encodeURIComponent(p.username)}` : "";
    const teaser = `\n\nJust found out fid ${p.fid} is ${handle}. Want to look up a specific fid? Try ${MINIAPP_NAME}: ${origin}`;
    const bioSection = shortBio ? `\n\n${shortBio}` : "";
    return `${handle}\nFID: ${p.fid}${bioSection}${profileLink}${teaser}\n\n(Shared via ${MINIAPP_NAME})`;
  }

  async function shareAsCast(p: Profile) {
    setSharing(true);
    const text = composeCastText(p);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const embeds = [{ type: "link", url: origin, title: MINIAPP_NAME }];

    try {
      if ((sdk as any)?.actions?.createCast) {
        try {
          await (sdk as any).actions.createCast({ text, embeds });
          showToast("Cast created.");
          return;
        } catch {}
      }

      if ((sdk as any)?.actions?.publish) {
        try {
          await (sdk as any).actions.publish({ type: "cast", body: { text, embeds } });
          showToast("Cast published.");
          return;
        } catch {}
      }

      await navigator.clipboard.writeText(text);
      showToast("Cast copied to clipboard.");
    } catch {
      showToast("Unable to share or copy.");
    } finally {
      setSharing(false);
    }
  }

  function goToProfile(p: Profile) {
    const url = farcasterExternalLink(p);
    if (!url) return showToast("This profile has no username to open externally.");
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function copyDonationAddress() {
    try {
      await navigator.clipboard.writeText(DONATION_ADDRESS);
      showToast("Donation address copied");
    } catch {
      showToast("Copy failed");
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !loading) searchFid();
  }

  // Toggle expand/collapse
  function toggleDonation() {
    setDonationExpanded((v) => !v);
  }

  return (
    <main className="min-h-screen bg-neutral-900 text-gray-100 p-4 sm:p-6 flex justify-center pb-28 sm:pb-0">
      <div className="w-full max-w-2xl">
        <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">{MINIAPP_NAME}</h1>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Enter FID (e.g. 2)"
            className="flex-1 px-4 py-3 rounded-lg border border-neutral-700 bg-neutral-800 text-gray-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-600"
            inputMode="numeric"
          />
          <button
            onClick={searchFid}
            disabled={loading}
            className="w-full sm:w-auto px-5 py-3 rounded-lg bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white disabled:opacity-60"
            type="button"
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </div>

        {errorMsg && <div className="mb-4 text-sm text-red-400 bg-neutral-800 p-3 rounded">{errorMsg}</div>}

        {profile && (
          <article className="bg-white rounded-lg shadow p-4 sm:p-6 text-black">
            <div className="flex flex-col sm:flex-row gap-4">
              <img
                src={profile.avatarUrl ?? "/default-avatar.svg"}
                alt={profile.displayName ?? ""}
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

                {profile.bio && <p className="mt-3 text-sm text-gray-800 leading-relaxed">{profile.bio}</p>}

                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => goToProfile(profile)}
                    className="w-full sm:w-auto px-4 py-3 bg-fuchsia-600 text-white rounded-md shadow"
                    type="button"
                  >
                    Go to profile
                  </button>

                  <button
                    onClick={() => shareAsCast(profile)}
                    disabled={sharing}
                    className="w-full sm:w-auto px-4 py-3 border rounded-md bg-neutral-100 text-neutral-900 disabled:opacity-60"
                    type="button"
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

        {!profile && !errorMsg && <p className="mt-6 text-sm text-neutral-400">Enter a numeric FID and press Search.</p>}
      </div>

      {/* Expandable Donation pill */}
      <div
        className="fixed z-50 left-1/2 -translate-x-1/2 bottom-4 sm:right-6 sm:left-auto sm:translate-x-0"
        aria-hidden={false}
      >
        <div
          className={`overflow-hidden rounded-full shadow backdrop-blur transition-all duration-300 ${
            donationExpanded ? "rounded-xl" : "rounded-full"
          }`}
          style={{ width: donationExpanded ? 360 : "auto" }}
        >
          <div
            className={`flex items-center gap-2 bg-neutral-800 px-3 py-2 transition-all duration-300 ${
              donationExpanded ? "rounded-t-xl" : "rounded-full"
            }`}
          >
            <div className="flex-1 min-w-0">
              {!donationExpanded ? (
                <div className="flex items-center gap-2">
                  <code className="bg-black/60 text-xs px-2 py-1 rounded text-white font-mono max-w-[220px] truncate">
                    {DONATION_ADDRESS}
                  </code>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium text-white">Support this miniapp</div>
                    <button
                      type="button"
                      onClick={() => {
                        setDonationExpanded(false);
                      }}
                      aria-label="Collapse donation"
                      className="text-xs text-neutral-300 hover:text-white px-2 py-1 rounded"
                    >
                      Close
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <code className="bg-black/60 text-xs px-3 py-2 rounded text-white font-mono break-all">
                      {DONATION_ADDRESS}
                    </code>

                    {/* Simple visual QR placeholder - replace with real QR generation if desired */}
                    <div className="w-20 h-20 bg-white/5 rounded grid place-items-center text-[10px] text-white/80">
                      QR
                    </div>
                  </div>

                  <p className="text-xs text-neutral-300 mt-1">
                    Copy the address to donate or scan the QR code with your wallet.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={copyDonationAddress}
                className="text-xs bg-neutral-700 hover:bg-neutral-600 text-white px-2 py-1 rounded"
                aria-label="Copy donation address"
              >
                Copy
              </button>

              <button
                type="button"
                onClick={toggleDonation}
                aria-expanded={donationExpanded}
                aria-controls="donation-expanded"
                className="p-1 rounded hover:bg-white/5"
                title={donationExpanded ? "Collapse" : "Expand"}
              >
                {/* chevron icon (simple) */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-4 w-4 text-white transition-transform duration-200 ${
                    donationExpanded ? "rotate-180" : "rotate-0"
                  }`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Expanded content panel */}
          <div
            id="donation-expanded"
            className={`bg-neutral-800 px-3 pb-3 transition-all duration-300 ${
              donationExpanded ? "max-h-[260px] opacity-100 pt-3" : "max-h-0 opacity-0 pt-0"
            }`}
            aria-hidden={!donationExpanded}
          >
            {/* content already included above in the expanded section for visual consistency */}
            {/* This section is kept minimal; you can duplicate or move content here if you prefer */}
          </div>
        </div>
      </div>

      {toast && (
        <div
          className="fixed left-1/2 -translate-x-1/2 bottom-24 z-50 bg-black/90 text-white px-4 py-2 rounded-md text-sm shadow"
          role="status"
          aria-live="polite"
        >
          {toast.msg}
        </div>
      )}
    </main>
  );
}
