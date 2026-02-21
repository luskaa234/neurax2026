import { useEffect, useRef, useState } from "react";

export function useAutosave<T>(
  value: T,
  onSave: (value: T) => Promise<void> | void,
  debounceMs = 2000,
) {
  const timeoutRef = useRef<number | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setIsDirty(true);

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(async () => {
      try {
        setIsSaving(true);
        await onSave(value);
        setIsDirty(false);
      } finally {
        setIsSaving(false);
      }
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [value, debounceMs, onSave]);

  return { isDirty, isSaving };
}
