import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

const CATEGORIES = [
  {
    name: "Trash",
    icon: "🗑️",
    description: "Non-recyclable waste that goes to landfill. Examples: broken ceramics, contaminated packaging.",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    text: "text-red-400",
  },
  {
    name: "Compost",
    icon: "🌱",
    description: "Organic & biodegradable materials. Examples: food scraps, coffee grounds, fruit peels.",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    text: "text-emerald-400",
  },
  {
    name: "Recycling",
    icon: "♻️",
    description: "Paper, cardboard, plastic bottles, glass & metal cans that can be recycled.",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    text: "text-blue-400",
  },
  {
    name: "No Waste",
    icon: "✅",
    description: "No waste item detected in view, or a clean surface with nothing to classify.",
    bg: "bg-slate-500/10",
    border: "border-slate-500/20",
    text: "text-slate-400",
  },
];

const STEPS = [
  {
    step: "01",
    icon: "📷",
    title: "Point Your Camera",
    description:
      "Open the classifier and point your device camera at any waste item around you.",
  },
  {
    step: "02",
    icon: "🧠",
    title: "AI Analyses",
    description:
      "Our MobileNetV2 model analyses the image in real-time, running entirely in your browser — no data leaves your device.",
  },
  {
    step: "03",
    icon: "♻️",
    title: "Sort Correctly",
    description:
      "Get an instant classification — Trash, Compost, Recycling, or No Waste — with a real-time confidence score.",
  },
];

const FEATURES = [
  {
    icon: "⚡",
    title: "Real-Time Inference",
    description:
      "Runs at 30+ fps directly in your browser using TensorFlow.js. No server, no uploads, no latency.",
  },
  {
    icon: "🔒",
    title: "100% Private",
    description:
      "All processing happens on your device. Your camera feed never leaves your browser.",
  },
  {
    icon: "📱",
    title: "Works Everywhere",
    description:
      "Optimised for both desktop and mobile. Works on Chrome, Safari, Firefox, and Edge.",
  },
  {
    icon: "🤖",
    title: "MobileNetV2 Model",
    description:
      "Powered by a fine-tuned MobileNetV2 architecture via Google Teachable Machine.",
  },
  {
    icon: "🎯",
    title: "4 Waste Categories",
    description:
      "Classifies waste into Trash, Compost, Recycling, and No Waste with confidence scores.",
  },
  {
    icon: "🛠️",
    title: "Training Studio",
    description:
      "Add your own images and retrain the model in-browser to improve accuracy for your use case.",
  },
];

export default function Landing() {
  const [liveStats, setLiveStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (!db) {
      setStatsLoading(false);
      return;
    }
    getDoc(doc(db, "stats", "summary"))
      .then((snap) => {
        if (snap.exists()) setLiveStats(snap.data());
      })
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, []);

  // Find the most-detected non-total category
  const topCategory = liveStats
    ? Object.entries(liveStats)
        .filter(([k]) => k !== "total")
        .sort(([, a], [, b]) => b - a)[0]?.[0] ?? null
    : null;

  return (
    <div className="min-h-screen bg-[#050c18] text-white overflow-x-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="animate-orb-1 absolute -top-32 -left-24 w-[900px] h-[900px] bg-cyan-500/[0.07] rounded-full blur-[150px]" />
        <div className="animate-orb-2 absolute -bottom-40 -right-24 w-[900px] h-[900px] bg-violet-500/[0.07] rounded-full blur-[150px]" />
        <div className="animate-orb-3 absolute top-1/2 left-1/2 w-[600px] h-[600px] bg-emerald-500/[0.04] rounded-full blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.022]"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      {/* Navbar */}
      <nav className="relative z-10 glass border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-cyan-400 rounded-xl opacity-50 blur-md animate-glow-breathe" />
              <div className="relative w-10 h-10 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-lg">♻️</span>
              </div>
            </div>
            <div>
              <p className="text-base font-bold tracking-tight">
                TrashSort <span className="text-cyan-400">AI</span>
              </p>
              <p className="text-[10px] text-slate-500 tracking-widest uppercase">
                Smart Waste Classification
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/train"
              className="text-xs text-slate-400 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-white/[0.06]"
            >
              Training Studio
            </Link>
            <Link
              to="/classify"
              className="group relative overflow-hidden text-xs font-semibold px-4 py-2 rounded-lg transition-all"
              style={{
                background: "linear-gradient(135deg, #059669, #0891b2)",
                boxShadow: "0 0 20px rgba(5,150,105,0.4)",
              }}
            >
              <span
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.15), transparent 55%)",
                }}
              />
              <span className="relative">Launch App →</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-6xl mx-auto px-5 pt-20 pb-20 text-center animate-slide-up">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Powered by MobileNetV2 · Runs 100% in-browser
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 leading-[1.05]">
          Sort Waste
          <br />
          <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
            Smarter with AI
          </span>
        </h1>

        <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Point your camera at any waste item and get an instant AI-powered
          classification. Trash, Compost, Recycling, or No Waste — in real
          time, right in your browser.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/classify"
            className="group relative overflow-hidden px-8 py-4 rounded-xl text-base font-semibold transition-all"
            style={{
              background: "linear-gradient(135deg, #059669, #0891b2)",
              boxShadow:
                "0 0 40px rgba(5,150,105,0.5), 0 0 80px rgba(8,145,178,0.2)",
            }}
          >
            <span
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.15), transparent 55%)",
              }}
            />
            <span className="relative flex items-center gap-2">
              ▶ Start Sorting
            </span>
          </Link>
          <Link
            to="/train"
            className="px-8 py-4 rounded-xl text-base font-semibold border border-white/[0.12] text-slate-300 hover:text-white hover:border-white/20 hover:bg-white/[0.05] transition-all"
          >
            🛠️ Training Studio
          </Link>
        </div>

        {/* Stats row — live from Firestore */}
        <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Total sessions */}
          <div className="glass rounded-xl p-4">
            <div className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
              {statsLoading ? (
                <span className="inline-block w-10 h-6 bg-white/[0.06] rounded animate-pulse" />
              ) : (
                liveStats?.total?.toLocaleString() ?? "0"
              )}
            </div>
            <div className="text-xs text-slate-500 mt-1">Sessions Logged</div>
          </div>

          {/* Top category */}
          <div className="glass rounded-xl p-4">
            <div className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
              {statsLoading ? (
                <span className="inline-block w-16 h-6 bg-white/[0.06] rounded animate-pulse" />
              ) : topCategory ? (
                topCategory
              ) : (
                "—"
              )}
            </div>
            <div className="text-xs text-slate-500 mt-1">Top Category</div>
          </div>

          {/* Recycling count */}
          <div className="glass rounded-xl p-4">
            <div className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
              {statsLoading ? (
                <span className="inline-block w-10 h-6 bg-white/[0.06] rounded animate-pulse" />
              ) : (
                liveStats?.Recycling?.toLocaleString() ?? "0"
              )}
            </div>
            <div className="text-xs text-slate-500 mt-1">♻️ Recycling Saves</div>
          </div>

          {/* Compost count */}
          <div className="glass rounded-xl p-4">
            <div className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
              {statsLoading ? (
                <span className="inline-block w-10 h-6 bg-white/[0.06] rounded animate-pulse" />
              ) : (
                liveStats?.Compost?.toLocaleString() ?? "0"
              )}
            </div>
            <div className="text-xs text-slate-500 mt-1">🌱 Compost Sessions</div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="relative z-10 max-w-6xl mx-auto px-5 py-16 border-t border-white/[0.04]">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-3">How It Works</h2>
          <p className="text-slate-400">Three simple steps to smarter waste sorting</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-6">
          {STEPS.map((s) => (
            <div key={s.step} className="glass rounded-2xl p-7 text-center">
              <div className="text-[10px] font-mono text-slate-600 mb-3 tracking-widest">
                STEP {s.step}
              </div>
              <div className="text-5xl mb-5">{s.icon}</div>
              <h3 className="font-bold text-base mb-2">{s.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">
                {s.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Waste Categories */}
      <section className="relative z-10 max-w-6xl mx-auto px-5 py-16 border-t border-white/[0.04]">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-3">Waste Categories</h2>
          <p className="text-slate-400">
            TrashSort AI classifies waste into four clear categories
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {CATEGORIES.map((cat) => (
            <div
              key={cat.name}
              className={`glass rounded-2xl p-6 border ${cat.border} ${cat.bg} transition-all hover:scale-[1.02] duration-300`}
            >
              <div className="text-5xl mb-4">{cat.icon}</div>
              <h3 className={`font-bold text-base mb-2 ${cat.text}`}>
                {cat.name}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {cat.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 max-w-6xl mx-auto px-5 py-16 border-t border-white/[0.04]">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-3">Features</h2>
          <p className="text-slate-400">Built for speed, privacy, and accuracy</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="glass rounded-2xl p-6 border border-transparent hover:border-white/[0.08] transition-all"
            >
              <div className="text-4xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-sm mb-2">{f.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA banner */}
      <section className="relative z-10 max-w-6xl mx-auto px-5 py-16 border-t border-white/[0.04]">
        <div
          className="glass rounded-3xl p-14 text-center"
          style={{
            background:
              "linear-gradient(135deg, rgba(5,150,105,0.08), rgba(8,145,178,0.06))",
            border: "1px solid rgba(5,150,105,0.2)",
          }}
        >
          <h2 className="text-3xl font-bold mb-4">Ready to Sort Smarter?</h2>
          <p className="text-slate-400 mb-8 max-w-md mx-auto">
            Launch the classifier now and start identifying waste with AI in
            seconds.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/classify"
              className="group relative overflow-hidden inline-flex px-10 py-4 rounded-xl text-base font-semibold transition-all"
              style={{
                background: "linear-gradient(135deg, #059669, #0891b2)",
                boxShadow: "0 0 40px rgba(5,150,105,0.5)",
              }}
            >
              <span
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.15), transparent 55%)",
                }}
              />
              <span className="relative">▶ Launch TrashSort AI</span>
            </Link>
            <Link
              to="/train"
              className="inline-flex px-10 py-4 rounded-xl text-base font-semibold border border-white/[0.12] text-slate-300 hover:text-white hover:bg-white/[0.05] transition-all"
            >
              🛠️ Open Training Studio
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.04] py-8">
        <div className="max-w-6xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-600">
            TrashSort AI · Real-time waste classification powered by
            MobileNetV2 &amp; TensorFlow.js
          </p>
          <div className="flex items-center gap-5">
            <Link
              to="/classify"
              className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
            >
              Classifier
            </Link>
            <Link
              to="/train"
              className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
            >
              Training Studio
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
