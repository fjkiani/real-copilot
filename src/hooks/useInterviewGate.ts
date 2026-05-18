/**
 * useInterviewGate.ts — Debounce gate for interview utterance submission.
 *
 * NEW hook (not a port of useDebounceGate). Enforces:
 *   1. isStreaming guard — blocks submission while any agent is streaming.
 *   2. Debounce — collapses rapid successive calls into one (default 400ms).
 *   3. Minimum length — ignores utterances shorter than minLength chars.
 *
 * Usage:
 *   const { submit, isPending } = useInterviewGate({
 *     onSubmit: submitUtterance,
 *     isStreaming,
 *   });
 *
 *   // Call submit(text) from the transcript listener.
 *   // isPending is true during the debounce window.
 */

import { useRef, useState, useCallback, useEffect } from 'react';

export interface UseInterviewGateOptions {
  /** Called with the debounced utterance when the gate opens. */
  onSubmit: (utterance: string) => void;
  /** Block submission while this is true (agent is streaming). */
  isStreaming: boolean;
  /** Debounce delay in ms. Default: 400. */
  debounceMs?: number;
  /** Minimum utterance length to pass the gate. Default: 3. */
  minLength?: number;
}

export interface UseInterviewGateResult {
  /** Call this with each new transcript fragment. */
  submit: (utterance: string) => void;
  /** True during the debounce window (utterance received but not yet dispatched). */
  isPending: boolean;
}

export function useInterviewGate({
  onSubmit,
  isStreaming,
  debounceMs = 400,
  minLength = 3,
}: UseInterviewGateOptions): UseInterviewGateResult {
  const [isPending, setIsPending] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<string>('');

  // Keep a stable ref to onSubmit so the debounce closure doesn't go stale.
  const onSubmitRef = useRef(onSubmit);
  useEffect(() => { onSubmitRef.current = onSubmit; }, [onSubmit]);

  // Keep a stable ref to isStreaming for the timer callback.
  const isStreamingRef = useRef(isStreaming);
  useEffect(() => { isStreamingRef.current = isStreaming; }, [isStreaming]);

  const submit = useCallback((utterance: string) => {
    // Hard gate: never submit while streaming
    if (isStreamingRef.current) return;

    // Minimum length gate
    if (!utterance || utterance.trim().length < minLength) return;

    pendingRef.current = utterance;
    setIsPending(true);

    // Reset debounce timer
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      setIsPending(false);
      // Re-check streaming gate at fire time (stream may have started during debounce)
      if (isStreamingRef.current) return;
      const text = pendingRef.current.trim();
      if (text.length >= minLength) {
        onSubmitRef.current(text);
      }
    }, debounceMs);
  }, [debounceMs, minLength]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { submit, isPending };
}
