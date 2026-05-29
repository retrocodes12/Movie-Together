"use client";

import { useEffect, useState } from "react";
import { Bell, Database, Link2, Radio, Users } from "lucide-react";

const API_GROUPS = [
  { icon: Users, label: "Rooms", text: "create, join, invite, public/private rooms, host migration" },
  { icon: Radio, label: "Sync", text: "server-authoritative playback, discussion mode, reactions, votes" },
  { icon: Bell, label: "Social", text: "friends, notifications, reviews, ratings, watch history" },
  { icon: Database, label: "Voice", text: "room voice state, speaking indicators, WebRTC signaling payloads" },
];

export default function Page() {
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  return (
    <main className="min-h-screen bg-[#0a0d12] text-[#f4f7fb]">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center gap-8 px-6 py-12">
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#60d394]">Nuvio Watch Together</p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">
            Social watch-party backend for the Nuvio app.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-[#a6b0bd]">
            Nuvio owns discovery, metadata, addon integration, stream selection, playback, subtitles, and browsing.
            This service only adds rooms, real-time coordination, voice state, social features, reviews, and history.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {API_GROUPS.map(({ icon: Icon, label, text }) => (
            <div key={label} className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-3 flex items-center gap-3">
                <Icon size={20} className="text-[#60d394]" />
                <h2 className="text-lg font-semibold">{label}</h2>
              </div>
              <p className="text-sm leading-6 text-[#a6b0bd]">{text}</p>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-[#60d394]/30 bg-[#60d394]/10 p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#b8ffd7]">
            <Link2 size={16} />
            Nuvio frontend configuration
          </div>
          <code className="block overflow-x-auto rounded-md bg-black/35 p-3 text-sm text-[#d5ffe7]">
            WATCH_TOGETHER_API_BASE_URL: "{origin}"
          </code>
        </div>
      </section>
    </main>
  );
}
