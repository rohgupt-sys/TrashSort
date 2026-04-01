import { useEffect, useRef, useState, useCallback } from "react";
import * as tmImage from "@teachablemachine/image";
import * as tf from "@tensorflow/tfjs";
import { Link } from "react-router-dom";

// These must match the labels in public/model/metadata.json exactly
const LABELS = ["Trash", "Compost", "recycling", "no waste"];

const LABEL_META = [
  {
    name: "Trash",
    displayName: "Trash",
    icon: "🗑️",
    gradient: "from-red-500 to-rose-600",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    text: "text-red-400",
  },
  {
    name: "Compost",
    displayName: "Compost",
    icon: "🌱",
    gradient: "from-emerald-500 to-green-600",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    text: "text-emerald-400",
  },
  {
    name: "recycling",
    displayName: "Recycling",
    icon: "♻️",
    gradient: "from-blue-500 to-cyan-600",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    text: "text-blue-400",
  },
  {
    name: "no waste",
    displayName: "No Waste",
    icon: "✅",
    gradient: "from-slate-400 to-slate-500",
    bg: "bg-slate-500/10",
    border: "border-slate-500/30",
    text: "text-slate-400",
  },
];

const RECYCLING_CLASS_INDEX = 2;

// Pre-loaded paper tray images for the Recycling class
const PRELOADED_RECYCLING = [
  "/img_data/paper_tray_1.jpeg",
  "/img_data/paper_tray_2.jpeg",
  "/img_data/paper_tray_3.jpeg",
  "/img_data/paper_tray_4.webp",
  "/img_data/paper_tray_5.jpeg",
  "/img_data/paper_tray_6.webp",
];

export default function Train() {
  const [teachable, setTeachable] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState(null);

  // examples[classIndex] = array of data-URLs for preview
  const [examples, setExamples] = useState([[], [], [], []]);
  const [preloadStatus, setPreloadStatus] = useState({ done: 0, total: PRELOADED_RECYCLING.length });
  const [isPreloading, setIsPreloading] = useState(false);

  const [isTraining, setIsTraining] = useState(false);
  const [trainEpoch, setTrainEpoch] = useState(0);
  const [trainLoss, setTrainLoss] = useState(null);
  const [trainAcc, setTrainAcc] = useState(null);
  const [isTrained, setIsTrained] = useState(false);

  const [epochs, setEpochs] = useState(50);
  const [learningRate, setLearningRate] = useState(0.001);

  // null | classIndex — which class is currently capturing from webcam
  const [activeCapture, setActiveCapture] = useState(null);

  const webcamRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRefs = useRef([]);

  // ── Initialise TeachableMobileNet ─────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const model = await tmImage.createTeachable(
          { tfjsVersion: tf.version.tfjs },
          { version: 2, alpha: 0.35 }
        );
        model.setLabels(LABELS);
        setTeachable(model);
        setIsInitializing(false);
      } catch (err) {
        setInitError("Failed to initialise training model: " + err.message);
        setIsInitializing(false);
      }
    }
    init();
  }, []);

  // ── Pre-load recycling images once model is ready ─────────
  useEffect(() => {
    if (!teachable || isInitializing) return;

    setIsPreloading(true);
    let loaded = 0;

    PRELOADED_RECYCLING.forEach((src) => {
      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = async () => {
        try {
          await teachable.addExample(RECYCLING_CLASS_INDEX, img);
          loaded++;
          setPreloadStatus({ done: loaded, total: PRELOADED_RECYCLING.length });
          setExamples((prev) => {
            const next = prev.map((arr) => [...arr]);
            next[RECYCLING_CLASS_INDEX] = [...next[RECYCLING_CLASS_INDEX], src];
            return next;
          });
        } catch (e) {
          console.warn("Could not add example:", src, e);
          loaded++;
          setPreloadStatus({ done: loaded, total: PRELOADED_RECYCLING.length });
        }
        if (loaded === PRELOADED_RECYCLING.length) setIsPreloading(false);
      };

      img.onerror = () => {
        loaded++;
        setPreloadStatus({ done: loaded, total: PRELOADED_RECYCLING.length });
        if (loaded === PRELOADED_RECYCLING.length) setIsPreloading(false);
      };

      img.src = src;
    });
  }, [teachable, isInitializing]);

  // ── Webcam helpers ────────────────────────────────────────
  const startCapture = useCallback(async (classIndex) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 224, height: 224 },
      });
      streamRef.current = stream;
      setActiveCapture(classIndex);
      // Attach stream to video element after state update (next tick)
      setTimeout(() => {
        if (webcamRef.current) {
          webcamRef.current.srcObject = stream;
          webcamRef.current.play();
        }
      }, 0);
    } catch {
      alert("Camera access denied. Please allow camera permissions.");
    }
  }, []);

  const stopCapture = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setActiveCapture(null);
  }, []);

  const captureFrame = useCallback(async () => {
    if (activeCapture === null || !webcamRef.current || !teachable) return;

    const canvas = document.createElement("canvas");
    canvas.width = 224;
    canvas.height = 224;
    canvas.getContext("2d").drawImage(webcamRef.current, 0, 0, 224, 224);

    await teachable.addExample(activeCapture, canvas);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.7);

    setExamples((prev) => {
      const next = prev.map((arr) => [...arr]);
      next[activeCapture] = [...next[activeCapture], dataUrl];
      return next;
    });
  }, [activeCapture, teachable]);

  // ── File upload ───────────────────────────────────────────
  const handleFileUpload = useCallback(
    async (classIndex, files) => {
      if (!teachable) return;
      for (const file of Array.from(files)) {
        await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = async (e) => {
            const img = new Image();
            img.onload = async () => {
              await teachable.addExample(classIndex, img);
              setExamples((prev) => {
                const next = prev.map((arr) => [...arr]);
                next[classIndex] = [...next[classIndex], e.target.result];
                return next;
              });
              resolve();
            };
            img.src = e.target.result;
          };
          reader.readAsDataURL(file);
        });
      }
    },
    [teachable]
  );

  // ── Train ─────────────────────────────────────────────────
  const handleTrain = useCallback(async () => {
    if (!teachable) return;
    setIsTraining(true);
    setTrainEpoch(0);
    setIsTrained(false);
    try {
      await teachable.train(
        { denseUnits: 100, epochs, learningRate, batchSize: 16 },
        {
          onEpochEnd: (epoch, logs) => {
            setTrainEpoch(epoch + 1);
            setTrainLoss(logs.loss?.toFixed(4) ?? null);
            setTrainAcc(logs.acc ? (logs.acc * 100).toFixed(1) : null);
          },
        }
      );
      setIsTrained(true);
    } catch (err) {
      alert("Training failed: " + err.message);
    } finally {
      setIsTraining(false);
    }
  }, [teachable, epochs, learningRate]);

  // ── Download model + metadata ─────────────────────────────
  const handleDownload = useCallback(async () => {
    if (!teachable || !isTrained) return;

    // Downloads trash-sort-model.json and trash-sort-model.weights.bin
    await teachable.save("downloads://trash-sort-model");

    // Also download metadata.json
    const metadata = {
      tfjsVersion: tf.version.tfjs,
      tmVersion: "2.4.10",
      packageVersion: "0.8.5",
      packageName: "@teachablemachine/image",
      timeStamp: new Date().toISOString(),
      userMetadata: {},
      modelName: "trash-sort-model",
      labels: LABELS,
      imageSize: 224,
    };
    const blob = new Blob([JSON.stringify(metadata)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "metadata.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [teachable, isTrained]);

  const totalExamples = examples.reduce((sum, arr) => sum + arr.length, 0);
  const canTrain =
    !isInitializing &&
    !isTraining &&
    examples.every((arr) => arr.length >= 2);

  return (
    <div className="min-h-screen bg-[#050c18] text-white overflow-x-hidden">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="animate-orb-1 absolute -top-32 -left-24 w-[700px] h-[700px] bg-cyan-500/[0.07] rounded-full blur-[130px]" />
        <div className="animate-orb-2 absolute -bottom-40 -right-24 w-[800px] h-[800px] bg-violet-500/[0.07] rounded-full blur-[140px]" />
        <div
          className="absolute inset-0 opacity-[0.022]"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 glass border-b border-white/[0.06]">
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
                Model Training Studio
              </p>
            </div>
          </div>
          <nav className="flex items-center gap-2">
            <Link
              to="/"
              className="text-xs text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/[0.06]"
            >
              ← Home
            </Link>
            <Link
              to="/classify"
              className="text-xs text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/[0.06]"
            >
              Classifier
            </Link>
          </nav>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Page title */}
        <div className="mb-6 animate-slide-up">
          <h2 className="text-2xl font-bold mb-1">Model Training Studio</h2>
          <p className="text-slate-400 text-sm">
            Add training examples for each waste category, then train and
            download your improved model. The Recycling class is pre-loaded
            with paper tray images.
          </p>
        </div>

        {/* Init error */}
        {initError && (
          <div className="mb-6 p-4 bg-red-500/[0.08] border border-red-500/20 rounded-2xl text-red-300 text-sm animate-slide-up">
            ⚠️ {initError}
          </div>
        )}

        {/* Status bar */}
        <div className="glass rounded-2xl p-4 mb-6 flex flex-wrap items-center gap-4 animate-slide-up">
          {isInitializing ? (
            <span className="text-xs text-slate-400 flex items-center gap-2">
              <svg
                className="animate-spin h-3.5 w-3.5 text-cyan-400"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Initialising MobileNet base…
            </span>
          ) : (
            <span className="text-xs text-emerald-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              Model ready
            </span>
          )}

          {isPreloading && (
            <span className="text-xs text-blue-400 flex items-center gap-2">
              <svg
                className="animate-spin h-3.5 w-3.5"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Pre-loading recycling images ({preloadStatus.done}/
              {preloadStatus.total})…
            </span>
          )}

          <div className="ml-auto text-xs text-slate-500">
            Total examples:{" "}
            <span className="text-white font-mono font-semibold">
              {totalExamples}
            </span>
          </div>
        </div>

        {/* Class panels */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          {LABEL_META.map((meta, classIndex) => (
            <ClassPanel
              key={meta.name}
              meta={meta}
              classIndex={classIndex}
              examples={examples[classIndex]}
              isRecycling={classIndex === RECYCLING_CLASS_INDEX}
              onStartCapture={() => startCapture(classIndex)}
              onFileUpload={(files) => handleFileUpload(classIndex, files)}
              fileInputRef={(el) => (fileInputRefs.current[classIndex] = el)}
            />
          ))}
        </div>

        {/* Webcam capture modal */}
        {activeCapture !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="glass rounded-2xl p-6 w-full max-w-xs mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm">
                  Capture for:{" "}
                  {LABEL_META[activeCapture].icon}{" "}
                  {LABEL_META[activeCapture].displayName}
                </h3>
                <button
                  onClick={stopCapture}
                  className="text-slate-400 hover:text-white text-xl leading-none cursor-pointer"
                >
                  ×
                </button>
              </div>

              <div className="relative rounded-xl overflow-hidden aspect-square bg-black mb-4">
                <video
                  ref={webcamRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
              </div>

              <div className="flex gap-3 mb-3">
                <button
                  onClick={captureFrame}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all hover:opacity-90"
                  style={{
                    background: "linear-gradient(135deg, #059669, #0891b2)",
                    boxShadow: "0 0 20px rgba(5,150,105,0.3)",
                  }}
                >
                  📸 Capture
                </button>
                <button
                  onClick={stopCapture}
                  className="px-4 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white bg-white/[0.04] border border-white/[0.08] cursor-pointer"
                >
                  Done
                </button>
              </div>
              <p className="text-xs text-slate-500 text-center">
                {examples[activeCapture].length} captured for this class
              </p>
            </div>
          </div>
        )}

        {/* Training config */}
        <div className="glass rounded-2xl p-6 mb-4 animate-slide-up">
          <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-5">
            Training Parameters
          </h3>

          <div className="grid sm:grid-cols-2 gap-5 mb-6">
            <div>
              <label className="text-xs text-slate-500 block mb-2">
                Epochs:{" "}
                <span className="text-white font-mono">{epochs}</span>
              </label>
              <input
                type="range"
                min="10"
                max="200"
                step="5"
                value={epochs}
                onChange={(e) => setEpochs(Number(e.target.value))}
                className="w-full accent-cyan-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-2">
                Learning Rate
              </label>
              <select
                value={learningRate}
                onChange={(e) => setLearningRate(Number(e.target.value))}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/40"
              >
                <option value={0.0001}>0.0001 — slow, precise</option>
                <option value={0.001}>0.001 — balanced (recommended)</option>
                <option value={0.003}>0.003 — fast</option>
              </select>
            </div>
          </div>

          {/* Validation message */}
          {!canTrain && !isTraining && (
            <div className="mb-4 p-3 rounded-xl bg-amber-500/[0.08] border border-amber-500/20 text-amber-400 text-xs">
              ⚠️ Each class needs at least 2 examples before training.
              Current counts:{" "}
              {examples
                .map(
                  (arr, i) =>
                    `${LABEL_META[i].icon} ${arr.length}`
                )
                .join(" · ")}
            </div>
          )}

          {/* Training progress */}
          {isTraining && (
            <div className="mb-5">
              <div className="flex justify-between text-xs mb-2">
                <span className="text-slate-400">
                  Epoch {trainEpoch} / {epochs}
                </span>
                <span className="font-mono text-slate-500">
                  {trainLoss && `loss: ${trainLoss}`}
                  {trainAcc && ` · acc: ${trainAcc}%`}
                </span>
              </div>
              <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-300"
                  style={{
                    width: `${epochs > 0 ? (trainEpoch / epochs) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Success message */}
          {isTrained && !isTraining && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-start gap-2">
              <span className="text-lg shrink-0">✅</span>
              <div>
                Training complete! Download the model below, then replace
                the files in{" "}
                <code className="font-mono text-xs bg-white/[0.08] px-1.5 py-0.5 rounded">
                  public/model/
                </code>{" "}
                and restart the dev server.
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleTrain}
              disabled={!canTrain}
              className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              style={
                canTrain
                  ? {
                      background:
                        "linear-gradient(135deg, #059669, #0891b2)",
                      boxShadow: "0 0 32px rgba(5,150,105,0.35)",
                    }
                  : { background: "rgba(255,255,255,0.04)" }
              }
            >
              {isTraining ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Training…
                </span>
              ) : (
                "🧠 Train Model"
              )}
            </button>

            {isTrained && (
              <button
                onClick={handleDownload}
                className="flex-1 py-3 rounded-xl text-sm font-semibold cursor-pointer transition-all hover:opacity-90"
                style={{
                  background:
                    "linear-gradient(135deg, #7c3aed, #4f46e5)",
                  boxShadow: "0 0 24px rgba(124,58,237,0.35)",
                }}
              >
                ⬇️ Download Model
              </button>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="glass rounded-2xl p-5 text-xs text-slate-500 leading-relaxed animate-slide-up">
          <p className="font-semibold text-slate-400 mb-3">
            How to deploy the downloaded model:
          </p>
          <ol className="list-decimal list-inside space-y-2">
            <li>
              Click <strong className="text-slate-300">Download Model</strong>{" "}
              — you will receive{" "}
              <code className="text-slate-300 bg-white/[0.06] px-1 rounded">
                trash-sort-model.json
              </code>
              ,{" "}
              <code className="text-slate-300 bg-white/[0.06] px-1 rounded">
                trash-sort-model.weights.bin
              </code>
              , and{" "}
              <code className="text-slate-300 bg-white/[0.06] px-1 rounded">
                metadata.json
              </code>
              .
            </li>
            <li>
              Rename{" "}
              <code className="text-slate-300 bg-white/[0.06] px-1 rounded">
                trash-sort-model.json
              </code>{" "}
              →{" "}
              <code className="text-slate-300 bg-white/[0.06] px-1 rounded">
                model.json
              </code>{" "}
              and{" "}
              <code className="text-slate-300 bg-white/[0.06] px-1 rounded">
                trash-sort-model.weights.bin
              </code>{" "}
              →{" "}
              <code className="text-slate-300 bg-white/[0.06] px-1 rounded">
                weights.bin
              </code>
              .
            </li>
            <li>
              Replace all three files in{" "}
              <code className="text-slate-300 bg-white/[0.06] px-1 rounded">
                public/model/
              </code>
              .
            </li>
            <li>Restart the dev server — the classifier will use the new model.</li>
          </ol>
        </div>
      </main>
    </div>
  );
}

// ── Class panel sub-component ────────────────────────────────
function ClassPanel({
  meta,
  classIndex,
  examples,
  isRecycling,
  onStartCapture,
  onFileUpload,
  fileInputRef,
}) {
  return (
    <div className="glass rounded-2xl overflow-hidden border border-white/[0.06]">
      {/* Panel header */}
      <div className="px-5 py-4 border-b border-white/[0.05]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{meta.icon}</span>
            <div>
              <p className="font-semibold text-sm">{meta.displayName}</p>
              <p className={`text-xs ${meta.text}`}>
                {examples.length} example{examples.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          {isRecycling && examples.length > 0 && (
            <span className="text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-full">
              ♻️ Pre-loaded
            </span>
          )}
          {examples.length < 2 && (
            <span className="text-[10px] text-amber-400/70 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
              Need {2 - examples.length} more
            </span>
          )}
        </div>
      </div>

      <div className="p-5">
        {/* Thumbnail grid */}
        {examples.length > 0 ? (
          <div className="grid grid-cols-6 gap-1 mb-4">
            {examples.slice(-12).map((src, i) => (
              <div
                key={i}
                className="aspect-square rounded-md overflow-hidden bg-white/[0.04]"
              >
                <img
                  src={src}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            ))}
            {examples.length > 12 && (
              <div className="aspect-square rounded-md bg-white/[0.04] flex items-center justify-center text-[10px] text-slate-500 col-span-1">
                +{examples.length - 12}
              </div>
            )}
          </div>
        ) : (
          <div className="py-5 text-center text-slate-700 text-xs mb-4">
            No examples yet — add some below
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={onStartCapture}
            className="flex-1 py-2 rounded-lg text-xs font-medium bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-slate-300 transition-all cursor-pointer"
          >
            📷 Camera
          </button>
          <button
            onClick={() => fileInputRef?.click?.()}
            className="flex-1 py-2 rounded-lg text-xs font-medium bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-slate-300 transition-all cursor-pointer"
          >
            📁 Upload
          </button>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            ref={fileInputRef}
            onChange={(e) => {
              onFileUpload(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </div>
    </div>
  );
}
