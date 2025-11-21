"use client";

import React, { useEffect, useState, useCallback } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { Search, Share, ExternalLink, Copy, Info, Heart, Bookmark } from "lucide-react";

// --- Types ---
type Profile = {
  fid: string;
  displayName?: string | null;
  username?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  followerCount?: number | null;
};

const DONATION_ADDRESS = "0xa6DEe9FdE9E1203ad02228f00bF10235d9Ca3752";
const MINIAPP_NAME = "Search by FID";

export default function Home() {
  // State
  const [query, setQuery] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; id: number } | null>(null);
  const [showDonation, setShowDonation] = useState(false);
  
  // Track if the app is already added to the user's client
  const [isAdded, setIsAdded] = useState(false);

  // --- Haptic Helper (Fixed) ---
  const triggerHaptic = useCallback((type: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning' = 'light') => {
    // Map the unified type to the specific SDK haptic methods
    switch (type) {
      case 'light':
      case 'medium':
      case 'heavy':
        sdk.haptics.impactOccurred(type);
        break;
      case 'success':
      case 'warning':
      case 'error':
        sdk.haptics.notificationOccurred(type);
        break;
    }
  }, []);

  // --- SDK Initialization & Context Check ---
  useEffect(() => {
    const initSdk = async () => {
      if (sdk && sdk.actions && sdk.actions.ready) {
        await sdk.actions.ready();
      }
      
      // Check if the user has already added the app
      try {
        const context = await sdk.context;
        if (context?.client?.added) {
          setIsAdded(true);
        }
      } catch (err) {
        console.error("Failed to load context", err);
      }
    };
    initSdk();
  }, []);

  // --- Actions ---
  const showToast = (message: string) => {
    setToast({ msg: message, id: Date.now() });
    setTimeout(() => setToast(null), 2500);
  };

  const addToFarcaster = async () => {
    try {
      triggerHaptic('medium');
      await sdk.actions.addMiniApp();
      setIsAdded(true);
      showToast("Added to your apps!");
    } catch (e) {
      console.error(e);
      // Note: This usually fails in dev/ngrok. It works on production domains.
      showToast("Failed to add (Dev/Network Error)");
    }
  };

  const searchFid = async () => {
    triggerHaptic('light');
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
        triggerHaptic('error');
        setErrorMsg(json?.error ?? "Unknown error");
      } else {
        triggerHaptic('success');
        setProfile(json);
      }
    } catch (err) {
      triggerHaptic('error');
      setErrorMsg("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const shareAsCast = async () => {
    if (!profile) return;
    triggerHaptic('medium');
    
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const handle = profile.username ? `@${profile.username}` : `fid:${profile.fid}`;
    const text = `Check out ${handle} (FID: ${profile.fid})\n\nFound via ${MINIAPP_NAME}`;
    
    // FIX: Explicitly define type as [string] (Tuple of length 1) to satisfy SDK
    const embeds = [origin] as [string];

    try {
      if (sdk && sdk.actions && sdk.actions.composeCast) {
        await sdk.actions.composeCast({ text, embeds });
      } else {
        // Fallback
        await navigator.clipboard.writeText(`${text} ${origin}`);
        showToast("Copied to clipboard");
      }
    } catch (e) {
      showToast("Could not open cast composer");
    }
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-gray-100 flex justify-center p-4">
      <div className="w-full max-w-md flex flex-col gap-6 mt-8">
        
        {/* Header */}
        <header className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 bg-gradient-to-tr from-fuchsia-600 to-violet-600 rounded-lg flex items-center justify-center">
            <Search size={18} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-100 to-gray-400">
            {MINIAPP_NAME}
          </h1>
        </header>

        {/* Search Bar */}
        <div className="relative group">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && searchFid()}
            placeholder="Enter FID (e.g. 3)"
            inputMode="numeric"
            autoComplete="off"
            className="w-full pl-4 pr-14 py-4 rounded-xl bg-neutral-900 border border-neutral-800 text-lg focus:outline-none focus:ring-2 focus:ring-fuchsia-600/50 focus:border-fuchsia-600 transition-all placeholder:text-neutral-600"
          />
          <button
            onClick={searchFid}
            disabled={loading}
            className="absolute right-2 top-2 bottom-2 aspect-square bg-neutral-800 hover:bg-neutral-700 text-fuchsia-500 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <Search size={20} />
            )}
          </button>
        </div>
        
        {/* Add App Button - Only visible if not added */}
        {!isAdded && (
            <button 
                onClick={addToFarcaster}
                className="flex items-center justify-center gap-2 w-full py-3 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-400 text-sm font-medium hover:bg-neutral-800 hover:text-white hover:border-neutral-700 transition-all active:scale-95"
            >
                <Bookmark size={16} className="text-fuchsia-500" />
                Add {MINIAPP_NAME} to your apps
            </button>
        )}

        {/* Error State */}
        {errorMsg && (
          <div className="p-4 bg-red-900/20 border border-red-900/50 rounded-xl text-red-200 text-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
            <Info size={18} className="shrink-0" />
            {errorMsg}
          </div>
        )}

        {/* Profile Card or Skeleton */}
        {loading ? (
          <ProfileSkeleton />
        ) : profile ? (
          <div className="bg-neutral-900 rounded-2xl p-5 border border-neutral-800 shadow-xl animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              <img
                src={profile.avatarUrl ?? `https://avatar.vercel.sh/${profile.fid}`}
                alt={profile.username ?? "User"}
                className="w-20 h-20 rounded-full object-cover border-2 border-neutral-800 bg-neutral-800"
              />
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold truncate">{profile.displayName}</h2>
                <p className="text-fuchsia-400 text-sm truncate">@{profile.username ?? `fid:${profile.fid}`}</p>
                <div className="flex items-center gap-4 mt-3 text-sm text-neutral-400">
                  <span className="flex items-center gap-1.5">
                    <span className="text-gray-200 font-medium">{profile.followerCount?.toLocaleString() ?? 0}</span> followers
                  </span>
                </div>
              </div>
            </div>

            {profile.bio && (
              <p className="mt-4 text-neutral-300 text-sm leading-relaxed line-clamp-4">
                {profile.bio}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                onClick={shareAsCast}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-white font-medium transition-all active:scale-95"
              >
                <Share size={18} />
                Share
              </button>
              <a
                href={`https://warpcast.com/${profile.username ?? ""}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => triggerHaptic('light')}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white text-black font-medium hover:bg-gray-100 transition-all active:scale-95"
              >
                Profile
                <ExternalLink size={18} />
              </a>
            </div>
          </div>
        ) : (
          // Empty State
          !errorMsg && (
            <div className="text-center py-12 text-neutral-500">
              <div className="w-16 h-16 bg-neutral-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search size={24} className="opacity-20" />
              </div>
              <p>Search for any Farcaster ID</p>
            </div>
          )
        )}

        {/* Support / Donation (Minimalist) */}
        <div className="fixed bottom-6 right-6 z-50">
            {!showDonation ? (
                <button 
                    onClick={() => { setShowDonation(true); triggerHaptic('light'); }}
                    className="w-10 h-10 bg-neutral-800 hover:bg-neutral-700 text-fuchsia-500 rounded-full shadow-lg flex items-center justify-center border border-neutral-700 transition-all"
                >
                    <Heart size={18} />
                </button>
            ) : (
                <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-2xl shadow-2xl w-72 animate-in slide-in-from-bottom-4">
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-sm font-medium text-gray-200">Support Development</span>
                        <button onClick={() => setShowDonation(false)} className="text-neutral-500 hover:text-white">✕</button>
                    </div>
                    <div className="bg-black/50 p-3 rounded-lg flex items-center justify-between gap-2 border border-neutral-800">
                        <code className="text-xs text-neutral-400 truncate flex-1">{DONATION_ADDRESS}</code>
                        <button 
                            onClick={async () => {
                                await navigator.clipboard.writeText(DONATION_ADDRESS);
                                showToast("Address Copied");
                                triggerHaptic('success');
                            }}
                            className="text-fuchsia-500 hover:text-fuchsia-400"
                        >
                            <Copy size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>

        {/* Toast Notification */}
        {toast && (
            <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-white text-black px-6 py-3 rounded-full shadow-2xl font-medium text-sm z-50 animate-in slide-in-from-top-4 fade-in">
                {toast.msg}
            </div>
        )}
      </div>
    </main>
  );
}

// --- Sub-components ---

function ProfileSkeleton() {
  return (
    <div className="bg-neutral-900 rounded-2xl p-5 border border-neutral-800 shadow-xl">
      <div className="flex items-start gap-4 animate-pulse">
        <div className="w-20 h-20 rounded-full bg-neutral-800" />
        <div className="flex-1 space-y-3 py-1">
          <div className="h-5 bg-neutral-800 rounded w-3/4" />
          <div className="h-4 bg-neutral-800 rounded w-1/3" />
        </div>
      </div>
      <div className="mt-6 space-y-2 animate-pulse">
        <div className="h-4 bg-neutral-800 rounded w-full" />
        <div className="h-4 bg-neutral-800 rounded w-5/6" />
      </div>
      <div className="grid grid-cols-2 gap-3 mt-6">
        <div className="h-12 bg-neutral-800 rounded-xl" />
        <div className="h-12 bg-neutral-800 rounded-xl" />
      </div>
    </div>
  );
}