import { useCallback, useEffect, useState } from "react";

/** Independent reads: retain successful sections and ignore obsolete responses. */
export function useAsyncSection<T>(read: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    read().then(value => { if (active) setData(value); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [read, revision]);
  const retry = useCallback(() => setRevision(value => value + 1), []);
  return { data, setData, error, loading, retry };
}
