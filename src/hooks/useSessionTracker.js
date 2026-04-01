import { useRef, useState, useCallback } from "react";
import {
  addDoc,
  collection,
  doc,
  updateDoc,
  setDoc,
  increment,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

// How confident the model must be before we start the timer
const CONFIDENCE_THRESHOLD = 0.65;

// How long (ms) the item must stay in frame before we save a session
const DWELL_MS = 2500;

export function useSessionTracker() {
  // { className, startTime, saved }
  const trackingRef = useRef(null);
  const [lastSaved, setLastSaved] = useState(null);
  const [saveError, setSaveError] = useState(null);

  const saveSession = useCallback(async (className, confidence) => {
    if (!db) return;

    setSaveError(null);
    try {
      // 1. Write the session document
      await addDoc(collection(db, "sessions"), {
        className,
        confidence: parseFloat(confidence.toFixed(3)),
        timestamp: serverTimestamp(),
      });

      // 2. Atomically increment the stats counter
      const statsRef = doc(db, "stats", "summary");
      try {
        await updateDoc(statsRef, {
          total: increment(1),
          [className]: increment(1),
        });
      } catch {
        // stats/summary doesn't exist yet — create it
        await setDoc(statsRef, { total: 1, [className]: 1 });
      }

      setLastSaved({ className, confidence, at: Date.now() });
    } catch (err) {
      console.error("TrashSort: could not save session", err);
      setSaveError(err.code ?? err.message);
    }
  }, []);

  /**
   * Call this on every prediction frame.
   * Saves a session once the same class has been detected at high
   * confidence for DWELL_MS milliseconds without interruption.
   */
  const trackPrediction = useCallback(
    (topClass) => {
      if (!topClass) {
        trackingRef.current = null;
        return;
      }

      const { className, probability } = topClass;

      // Ignore "No Waste" and low-confidence frames
      if (className === "No Waste" || probability < CONFIDENCE_THRESHOLD) {
        trackingRef.current = null;
        return;
      }

      const now = Date.now();
      const t = trackingRef.current;

      if (!t || t.className !== className) {
        // New class appeared — start the dwell timer
        trackingRef.current = { className, startTime: now, saved: false };
        return;
      }

      if (!t.saved && now - t.startTime >= DWELL_MS) {
        // Item has been in frame long enough — save once
        t.saved = true;
        saveSession(className, probability);
      }
    },
    [saveSession]
  );

  /** Call when the camera stops to clear stale tracking state. */
  const resetTracking = useCallback(() => {
    trackingRef.current = null;
  }, []);

  return { trackPrediction, resetTracking, lastSaved, saveError };
}
