
import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import * as tmImage from "@teachablemachine/image";
import { useSessionTracker } from "./hooks/useSessionTracker";

// Normalise labels from metadata.json to match LABEL_CONFIG keys
const normalizeLabel = (name) => {
  const map = { recycling: "Recycling", "no waste": "No Waste" };
  return map[name] || name;
};

const MODEL_URL = "/model/";
const LABELS = ["Trash", "Compost", "Recycling", "No Waste"];
const LABEL_CONFIG = {
  Trash: {
    color: "from-red-500 to-rose-600",
    icon: "🗑️",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    text: "text-red-400",
    glow: "rgba(239,68,68,0.55)",
    badgeBg: "rgba(239,68,68,0.13)",
    bracketColor: "#f87171",
    description: "Landfill waste",
  },
  Compost: {
    color: "from-emerald-500 to-green-600",
    icon: "🌱",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    text: "text-emerald-400",
    glow: "rgba(16,185,129,0.55)",
    badgeBg: "rgba(16,185,129,0.13)",
    bracketColor: "#34d399",
    description: "Organic / biodegradable",
  },
  Recycling: {
    color: "from-blue-500 to-cyan-600",
    icon: "♻️",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    text: "text-blue-400",
    glow: "rgba(59,130,246,0.55)",
    badgeBg: "rgba(59,130,246,0.13)",
    bracketColor: "#60a5fa",
    description: "Recyclable materials",
  },
  "No Waste": {
    color: "from-slate-400 to-slate-500",
    icon: "✅",
    bg: "bg-slate-500/10",
    border: "border-slate-500/30",
    text: "text-slate-400",
    glow: "rgba(148,163,184,0.3)",
    badgeBg: "rgba(148,163,184,0.10)",
    bracketColor: "#94a3b8",
    description: "No waste detected",
  },
};

function App() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const modelRef = useRef(null);
  const animFrameRef = useRef(null);

  const [predictions, setPredictions] = useState([]);
  const [topClass, setTopClass] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  const { trackPrediction, resetTracking, lastSaved, saveError } = useSessionTracker();
  const [toast, setToast] = useState(null); // { id, type, className, confidence } | null

  // Show success toast when a session is saved
  useEffect(() => {
    if (!lastSaved) return;
    setToast({ id: lastSaved.at, type: "success", className: lastSaved.className, confidence: lastSaved.confidence });
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [lastSaved]);

  // Show error toast when a save fails
  useEffect(() => {
    if (!saveError) return;
    setToast({ id: Date.now(), type: "error", message: saveError });
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [saveError]);

  const startWebcam = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: 640, height: 480 },
      });
      if (webcamRef.current) {
        webcamRef.current.srcObject = stream;
        await webcamRef.current.play();
      }
    } catch {
      setError("Camera access denied. Please allow camera permissions.");
    }
  }, []);

  const stopWebcam = useCallback(() => {
    if (webcamRef.current?.srcObject) {
      webcamRef.current.srcObject.getTracks().forEach((t) => t.stop());
      webcamRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadModel() {
      try {
        const model = await tmImage.load(
          MODEL_URL + "model.json",
          MODEL_URL + "metadata.json"
        );
        if (!cancelled) {
          modelRef.current = model;
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) setError("Failed to load the classification model.");
      }
    }

    loadModel();
    return () => { cancelled = true; };
  }, []);

  const predict = useCallback(async () => {
    const video = webcamRef.current;
    const model = modelRef.current;
    if (!video || !model || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(predict);
      return;
    }

    const results = await model.predict(video);
    const mapped = results.map((r) => ({
      className: normalizeLabel(r.className),
      probability: r.probability,
    }));
    mapped.sort((a, b) => b.probability - a.probability);
    setPredictions(mapped);
    setTopClass(mapped[0]);
    trackPrediction(mapped[0]);

    animFrameRef.current = requestAnimationFrame(predict);
  }, [trackPrediction]);

  const handleStart = useCallback(async () => {
    await startWebcam();
    setIsRunning(true);
    animFrameRef.current = requestAnimationFrame(predict);
  }, [startWebcam, predict]);

  const handleStop = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    stopWebcam();
    resetTracking();
    setIsRunning(false);
    setPredictions([]);
    setTopClass(null);
  }, [stopWebcam, resetTracking]);

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      stopWebcam();
    };
  }, [stopWebcam]);

  const topConfig = topClass ? LABEL_CONFIG[topClass.className] ?? LABEL_CONFIG["No Waste"] : null;

  const videoBoxShadow =
    isRunning && topClass && topClass.probability > 0.4
      ? `0 0 0 1px ${topConfig.bracketColor}55, 0 0 50px ${topConfig.glow}, 0 0 100px ${topConfig.badgeBg}`
      : "0 0 0 1px rgba(255,255,255,0.07)";

  const BRACKETS = [
    "top-4 left-4 border-t-2 border-l-2",
    "top-4 right-4 border-t-2 border-r-2",
    "bottom-4 left-4 border-b-2 border-l-2",
    "bottom-4 right-4 border-b-2 border-r-2",
  ];

  return (
    <div className="min-h-screen bg-[#050c18] text-white overflow-x-hidden">

      {/* ── Animated background ─────────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="animate-orb-1 absolute -top-32 -left-24 w-[700px] h-[700px] bg-cyan-500/[0.07] rounded-full blur-[130px]" />
        <div className="animate-orb-2 absolute -bottom-40 -right-24 w-[800px] h-[800px] bg-violet-500/[0.07] rounded-full blur-[140px]" />
        <div className="animate-orb-3 absolute top-1/2 left-1/2 w-[500px] h-[500px] bg-emerald-500/[0.05] rounded-full blur-[110px]" />
        {/* Dot-grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.022]"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      {/* ── Header ──────────────────────────────────── */}
      <header className="relative z-10 glass border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-5 py-3.5 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3.5">
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-cyan-400 rounded-xl opacity-50 blur-md animate-glow-breathe" />
              <div className="relative w-10 h-10 bg-gradient-to-br from-emerald-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-lg">♻️</span>
              </div>
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">
                TrashSort{" "}
                <span className="text-cyan-400">AI</span>
              </h1>
              <p className="text-[10px] text-slate-500 tracking-widest uppercase">
                Real-time waste classification
              </p>
            </div>
          </div>

          {/* Nav links + status pill */}
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-white/[0.06] hidden sm:block"
            >
              Home
            </Link>
            <Link
              to="/train"
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-white/[0.06] hidden sm:block"
            >
              Train
            </Link>
            {isLoading && !isRunning && (
              <div className="shimmer flex items-center gap-2 text-xs text-slate-500 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.06]">
                <svg className="animate-spin h-3.5 w-3.5 text-cyan-500" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading model
              </div>
            )}
            {isRunning && (
              <div className="flex items-center gap-2 text-xs text-emerald-400 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 animate-fade-in">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Live&nbsp;inference
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────── */}
      <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {error && (
          <div className="mb-6 p-4 bg-red-500/[0.08] border border-red-500/20 rounded-2xl text-red-300 text-sm flex items-center gap-3 animate-slide-up">
            <span className="text-xl">⚠️</span>
            {error}
          </div>
        )}

        {saveError && (
          <div className="mb-6 p-4 bg-orange-500/[0.08] border border-orange-500/20 rounded-2xl text-orange-300 text-sm flex items-center gap-3 animate-slide-up">
            <span className="text-xl">🔥</span>
            <span>
              <strong>Firestore save failed:</strong> {saveError}.{" "}
              {saveError === "permission-denied"
                ? "Open Firebase Console → Firestore → Rules and allow reads/writes."
                : "Check your Firebase config in .env."}
            </span>
          </div>
        )}

        <div className="grid lg:grid-cols-5 gap-5">

          {/* ─── Video column ─────────────────────── */}
          <div className="lg:col-span-3 space-y-4 animate-slide-up">

            {/* Video frame */}
            <div
              className="relative rounded-2xl overflow-hidden bg-[#080f1e] aspect-[4/3] transition-shadow duration-700"
              style={{ boxShadow: videoBoxShadow }}
            >
              <video ref={webcamRef} className="w-full h-full object-cover" playsInline muted />
              <canvas ref={canvasRef} className="hidden" />

              {/* Corner targeting brackets */}
              {BRACKETS.map((cls, i) => (
                <div
                  key={i}
                  className={`absolute ${cls} w-5 h-5 transition-colors duration-700`}
                  style={{
                    borderColor: isRunning && topConfig
                      ? topConfig.bracketColor
                      : "rgba(6,182,212,0.35)",
                  }}
                />
              ))}

              {/* Scan line */}
              {isRunning && (
                <div
                  className="animate-scan-line inset-x-5 h-px pointer-events-none z-10"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${topConfig?.bracketColor ?? "#06b6d4"}cc, transparent)`,
                    boxShadow: `0 0 8px ${topConfig?.bracketColor ?? "#06b6d4"}80`,
                  }}
                />
              )}

              {/* Idle overlay */}
              {!isRunning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#080f1e]/95 gap-5">
                  <div className="relative">
                    <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-3xl animate-glow-breathe" />
                    <div className="relative w-20 h-20 bg-white/[0.04] border border-white/[0.08] rounded-full flex items-center justify-center">
                      <span className="text-4xl">📷</span>
                    </div>
                  </div>
                  <p className="text-slate-400 text-sm text-center max-w-[220px] leading-relaxed">
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4 text-cyan-400 shrink-0" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Initialising AI model…
                      </span>
                    ) : (
                      "Press Start to begin real‑time waste detection"
                    )}
                  </p>
                </div>
              )}

              {/* Centred prediction badge */}
              {isRunning && topClass && topClass.probability > 0.45 && (
                <div
                  key={topClass.className}
                  className="absolute top-4 animate-badge-pop flex items-center gap-2.5 px-4 py-2.5 rounded-2xl backdrop-blur-xl border"
                  style={{
                    left: "50%",
                    background: topConfig.badgeBg,
                    borderColor: `${topConfig.bracketColor}45`,
                    boxShadow: `0 4px 24px ${topConfig.glow.replace("0.55", "0.3")}`,
                  }}
                >
                  <span className="text-2xl">{topConfig.icon}</span>
                  <div>
                    <p className="text-[10px] text-white/50 uppercase tracking-wider leading-none mb-0.5">
                      Detected
                    </p>
                    <p className="text-sm font-bold leading-none">{topClass.className}</p>
                  </div>
                  <span className={`text-xl font-extrabold ml-1 ${topConfig.text}`}>
                    {(topClass.probability * 100).toFixed(0)}%
                  </span>
                </div>
              )}

              {/* In-frame "uploading" indicator — shows while toast is visible */}
              {isRunning && toast?.type === "success" && (
                <div
                  key={toast.id}
                  className="absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-xl border text-xs font-medium text-emerald-300 animate-fade-in"
                  style={{ background: "rgba(16,185,129,0.15)", borderColor: "rgba(16,185,129,0.3)" }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  ✓ Logged to Firestore
                </div>
              )}

              {/* Bottom HUD strip */}
              {isRunning && (
                <div className="absolute bottom-0 inset-x-0 px-4 py-0 bg-gradient-to-t from-black/60 to-transparent flex items-center justify-between">
                  <span className="text-[10px] font-mono text-white/25 tracking-widest">
                    224 × 224 · MobileNetV2
                  </span>
                  <span className="text-[10px] font-mono text-white/25 tracking-widest">
                    TF.js 1.7.4
                  </span>
                </div>
              )}
            </div>

            {/* Control button */}
            <div>
              {!isRunning ? (
                <button
                  onClick={handleStart}
                  disabled={isLoading}
                  className="group relative w-full overflow-hidden py-3.5 px-6 rounded-xl font-semibold text-sm transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  style={{
                    background: isLoading
                      ? "rgba(255,255,255,0.05)"
                      : "linear-gradient(135deg,#059669 0%,#0891b2 100%)",
                    boxShadow: isLoading ? "none" : "0 0 32px rgba(5,150,105,0.45), 0 0 64px rgba(8,145,178,0.2)",
                  }}
                >
                  {!isLoading && (
                    <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.18),transparent 55%)" }}
                    />
                  )}
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2 text-slate-500">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Loading Model…
                    </span>
                  ) : (
                    <span className="relative flex items-center justify-center gap-2">
                      <span>▶</span> Start Camera
                    </span>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleStop}
                  className="group relative w-full overflow-hidden py-3.5 px-6 rounded-xl font-semibold text-sm cursor-pointer transition-all duration-300"
                  style={{
                    background: "linear-gradient(135deg,#dc2626 0%,#e11d48 100%)",
                    boxShadow: "0 0 32px rgba(220,38,38,0.45)",
                  }}
                >
                  <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.18),transparent 55%)" }}
                  />
                  <span className="relative flex items-center justify-center gap-2">
                    <span>⏹</span> Stop Camera
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* ─── Results column ───────────────────── */}
          <div className="lg:col-span-2 space-y-4 animate-slide-up" style={{ animationDelay: "80ms" }}>

            {/* Classification results */}
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">
                  Classification
                </h2>
                {isRunning && predictions.length > 0 && (
                  <span className="text-[10px] font-mono text-cyan-500/60 tracking-wider">REAL‑TIME</span>
                )}
              </div>

              {predictions.length === 0 ? (
                <div className="py-10 flex flex-col items-center gap-3 text-slate-700">
                  <div className="w-12 h-12 border border-white/[0.06] rounded-full flex items-center justify-center text-2xl">
                    📊
                  </div>
                  <p className="text-sm text-slate-600 text-center">
                    {isRunning ? "Warming up…" : "Start the camera to see results"}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {predictions.map((pred, i) => {
                    const cfg = LABEL_CONFIG[pred.className] ?? LABEL_CONFIG["No Waste"];
                    const pct = (pred.probability * 100).toFixed(1);
                    const isTop = pred.className === topClass?.className;
                    return (
                      <div
                        key={pred.className}
                        className={`relative p-3.5 rounded-xl border transition-all duration-500 ${
                          isTop ? `${cfg.bg} ${cfg.border}` : "bg-white/[0.02] border-white/[0.05]"
                        }`}
                        style={{
                          animationDelay: `${i * 60}ms`,
                          ...(isTop ? { boxShadow: `0 0 20px ${cfg.badgeBg}` } : {}),
                        }}
                      >
                        <div className="flex items-center justify-between mb-2.5">
                          <span className="flex items-center gap-2 text-sm font-medium">
                            <span className={isTop ? "text-base" : "text-base opacity-50"}>
                              {cfg.icon}
                            </span>
                            <span className={isTop ? "text-white" : "text-slate-500"}>
                              {pred.className}
                            </span>
                          </span>
                          <span className={`font-mono text-sm font-semibold ${isTop ? cfg.text : "text-slate-700"}`}>
                            {pct}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${cfg.color} transition-all duration-500`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Category guide */}
            <div className="glass rounded-2xl p-5">
              <h2 className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-4">
                Categories
              </h2>
              <div className="space-y-2">
                {LABELS.map((label) => {
                  const cfg = LABEL_CONFIG[label];
                  const isActive = topClass?.className === label && isRunning && (topClass?.probability ?? 0) > 0.45;
                  return (
                    <div
                      key={label}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all duration-500 ${
                        isActive ? `${cfg.bg} ${cfg.border}` : "border-transparent"
                      }`}
                      style={isActive ? { boxShadow: `0 0 16px ${cfg.badgeBg}` } : {}}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all duration-300 ${
                        isActive ? cfg.bg : "bg-white/[0.04]"
                      }`}>
                        {cfg.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium transition-colors duration-300 ${isActive ? "text-white" : "text-slate-400"}`}>
                          {label}
                        </p>
                        <p className="text-xs text-slate-600 truncate">{cfg.description}</p>
                      </div>
                      {isActive && (
                        <span className={`text-sm font-bold ${cfg.text} shrink-0 animate-fade-in`}>
                          {(topClass.probability * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Model info */}
            <div className="glass rounded-2xl p-4">
              <p className="text-center text-[10px] font-mono text-slate-700 leading-relaxed tracking-wide">
                MobileNetV2 · 4 Classes · 224 × 224 px                
              </p>
            </div>

          </div>
        </div>
      </main>

      {/* ── Toast notification ──────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-toast-in w-72">
          {toast.type === "success" ? (
            <div
              className="rounded-2xl overflow-hidden border border-emerald-500/25 backdrop-blur-2xl"
              style={{ background: "rgba(4,30,18,0.92)", boxShadow: "0 0 48px rgba(16,185,129,0.2), 0 8px 32px rgba(0,0,0,0.5)" }}
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  {/* Category icon */}
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0 ${LABEL_CONFIG[toast.className]?.bg ?? "bg-white/[0.06]"}`}
                  >
                    {LABEL_CONFIG[toast.className]?.icon ?? "📦"}
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
                        Session Saved
                      </span>
                      <span className="text-[10px] text-slate-600">· Firestore</span>
                    </div>
                    <p className="text-sm font-bold text-white leading-tight">
                      {toast.className}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {(toast.confidence * 100).toFixed(0)}% confidence ·{" "}
                      {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </p>
                  </div>

                  {/* Dismiss */}
                  <button
                    onClick={() => setToast(null)}
                    className="text-slate-600 hover:text-slate-300 text-lg leading-none shrink-0 transition-colors cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Drain progress bar */}
              <div className="h-0.5 bg-white/[0.05]">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 animate-toast-drain"
                  style={{ "--drain-duration": "4s" }}
                />
              </div>
            </div>
          ) : (
            <div
              className="rounded-2xl overflow-hidden border border-red-500/25 backdrop-blur-2xl"
              style={{ background: "rgba(30,4,4,0.92)", boxShadow: "0 0 48px rgba(239,68,68,0.2), 0 8px 32px rgba(0,0,0,0.5)" }}
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-red-500/15 flex items-center justify-center text-2xl shrink-0">
                    🔥
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wider mb-0.5">
                      Save Failed
                    </p>
                    <p className="text-sm font-bold text-white leading-tight">
                      {toast.message === "permission-denied"
                        ? "Firestore permission denied"
                        : "Could not reach Firestore"}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {toast.message === "permission-denied"
                        ? "Update security rules in Firebase Console"
                        : toast.message}
                    </p>
                  </div>
                  <button
                    onClick={() => setToast(null)}
                    className="text-slate-600 hover:text-slate-300 text-lg leading-none shrink-0 transition-colors cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="h-0.5 bg-white/[0.05]">
                <div
                  className="h-full bg-gradient-to-r from-red-500 to-rose-500 animate-toast-drain"
                  style={{ "--drain-duration": "5s" }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
