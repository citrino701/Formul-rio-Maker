import { useEffect, useRef, useState, useCallback } from "react";

export type AutoSaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

export interface UseAutoSaveOptions<T> {
  data: T;
  onSave: (data: T) => Promise<void> | void;
  debounceMs?: number;
  enabled?: boolean;
}

export interface UseAutoSaveReturn {
  status: AutoSaveStatus;
  lastSavedAt: Date | null;
  isSaving: boolean;
  isPending: boolean;
  saveNow: () => Promise<void>;
  cancel: () => void;
  resetLastSaved: (newData: any) => void;
}

/**
 * useAutoSave
 * Monitors changes to data and triggers onSave after debounceMs (default 2000ms) of inactivity.
 */
export function useAutoSave<T extends { id?: string }>({
  data,
  onSave,
  debounceMs = 2000,
  enabled = true
}: UseAutoSaveOptions<T>): UseAutoSaveReturn {
  const [status, setStatus] = useState<AutoSaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedJsonRef = useRef<string>(JSON.stringify(data));
  const currentIdRef = useRef<string | undefined>(data?.id);
  const isInitialMount = useRef(true);
  const dataRef = useRef(data);
  const onSaveRef = useRef(onSave);

  dataRef.current = data;
  onSaveRef.current = onSave;

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetLastSaved = useCallback((newData: any) => {
    cancel();
    lastSavedJsonRef.current = JSON.stringify(newData);
    currentIdRef.current = newData?.id;
    setStatus("idle");
  }, [cancel]);

  const performSave = useCallback(async (dataToSave: T) => {
    setStatus("saving");
    try {
      await onSaveRef.current(dataToSave);
      lastSavedJsonRef.current = JSON.stringify(dataToSave);
      setLastSavedAt(new Date());
      setStatus("saved");
    } catch (err) {
      console.error("Erro no auto-save:", err);
      setStatus("error");
    }
  }, []);

  const saveNow = useCallback(async () => {
    cancel();
    const currentData = dataRef.current;
    await performSave(currentData);
  }, [cancel, performSave]);

  useEffect(() => {
    // Initial mount check
    if (isInitialMount.current) {
      isInitialMount.current = false;
      lastSavedJsonRef.current = JSON.stringify(data);
      currentIdRef.current = data?.id;
      return;
    }

    // If switching to a different form/entity ID, reset tracking without firing auto-save
    if (data?.id && currentIdRef.current && data.id !== currentIdRef.current) {
      cancel();
      currentIdRef.current = data.id;
      lastSavedJsonRef.current = JSON.stringify(data);
      setStatus("idle");
      return;
    }

    if (!enabled) {
      cancel();
      return;
    }

    const currentJson = JSON.stringify(data);

    // If contents haven't changed since last save, do nothing
    if (currentJson === lastSavedJsonRef.current) {
      return;
    }

    // Cancel existing pending debounce timer
    cancel();

    // Mark as pending auto-save
    setStatus("pending");

    // Start 2-second debounce timer of inactivity
    timerRef.current = setTimeout(() => {
      performSave(dataRef.current);
    }, debounceMs);

    return () => {
      cancel();
    };
  }, [data, debounceMs, enabled, cancel, performSave]);

  return {
    status,
    lastSavedAt,
    isSaving: status === "saving",
    isPending: status === "pending",
    saveNow,
    cancel,
    resetLastSaved
  };
}
