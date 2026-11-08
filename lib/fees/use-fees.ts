"use client";

import { useEffect, useState } from "react";
import { BACKEND, call } from "@/lib/sync/remote";
import { DEFAULT_SERVICE_FEES, type ServiceFees } from "./config";

let cache: Promise<ServiceFees> | null = null;

/** Current service prices (from the server when connected, otherwise the defaults). */
export function useServiceFees() {
  const [fees, setFees] = useState<ServiceFees | null>(BACKEND ? null : DEFAULT_SERVICE_FEES);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!BACKEND) return;
    cache ??= call<{ fees: ServiceFees }>("GET", "/api/service-fees").then((r) => r.fees);
    let live = true;
    cache.then((f) => live && setFees(f)).catch(() => { cache = null; });
    return () => { live = false; };
  }, [tick]);
  return { fees, reload: () => { cache = null; setTick((t) => t + 1); } };
}
