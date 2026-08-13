import { useEffect, useState } from "react";

/**
 * Debounces a fast-changing value (e.g. a search input) so dependent effects
 * - like a fetch to a paginated/searchable API route - only fire once the
 * user pauses typing, instead of on every keystroke. This is what makes
 * "debounced search" in the Customers/Domains pages a real perf win rather
 * than just a nicety: it directly reduces the number of DB round-trips.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
