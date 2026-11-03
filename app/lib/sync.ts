"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { decryptJson, encryptJson, type Vault } from "./vault";

// 기록 동기화. 폰에는 암호화된 글자만 저장하고, 화면에 보여 줄 때만 푼다.
// 1) 못 보낸 기록을 먼저 보내고 2) 서버에서 바뀐 것만(seq 이후) 받아 온다. 같은 기록은 나중에 쓴 쪽이 이긴다.

type Row = { blob: string | null; deleted: boolean; seq: number };
type Pending = { blob: string | null; deleted: boolean };
type Cache = { cursor: number; rows: Record<string, Row>; pending: Record<string, Pending> };

export type SyncStatus = "idle" | "syncing" | "offline" | "denied";

const POLL_MS = 30_000;
const cacheKey = (householdId: string) => `duri-sync-${householdId}`;

function readCache(householdId: string): Cache {
  try {
    const parsed = JSON.parse(localStorage.getItem(cacheKey(householdId)) ?? "") as Cache;
    if (parsed && typeof parsed.cursor === "number" && parsed.rows && parsed.pending) return parsed;
  } catch {}
  return { cursor: 0, rows: {}, pending: {} };
}

function writeCache(householdId: string, cache: Cache) {
  try {
    localStorage.setItem(cacheKey(householdId), JSON.stringify(cache));
  } catch {}
}

export function forgetCache(householdId: string) {
  try {
    localStorage.removeItem(cacheKey(householdId));
  } catch {}
}

function authHeaders(vault: Vault) {
  return { "x-household": vault.householdId, "x-auth": vault.auth, "content-type": "application/json" };
}

async function readError(response: Response) {
  try {
    return ((await response.json()) as { error?: string }).error ?? `서버 응답 ${response.status}`;
  } catch {
    return `서버 응답 ${response.status}`;
  }
}

export async function registerHousehold(vault: Vault) {
  const response = await fetch("/api/household", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ householdId: vault.householdId, auth: vault.auth }),
  });
  if (!response.ok) throw new Error(await readError(response));
}

// 연결 코드와 비밀번호가 맞는지 서버에 한 번 물어본다.
export async function checkVault(vault: Vault) {
  const response = await fetch("/api/sync?since=0", { headers: authHeaders(vault), cache: "no-store" });
  if (!response.ok) throw new Error(await readError(response));
}

export function useSharedRecords(vault: Vault | null) {
  const [records, setRecords] = useState<Map<string, unknown>>(new Map());
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [pulled, setPulled] = useState(false);
  const cacheRef = useRef<Cache | null>(null);
  const runningRef = useRef<Promise<void> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyRows = useCallback(
    async (ids: string[]) => {
      const cache = cacheRef.current;
      if (!vault || !cache) return;
      const decoded = await Promise.all(
        ids.map(async (id) => {
          const source = cache.pending[id] ?? cache.rows[id];
          if (!source || source.deleted || !source.blob) return [id, undefined] as const;
          try {
            return [id, await decryptJson(vault.key, source.blob)] as const;
          } catch {
            return [id, undefined] as const;
          }
        }),
      );
      setRecords((current) => {
        const next = new Map(current);
        for (const [id, value] of decoded) {
          if (value === undefined) next.delete(id);
          else next.set(id, value);
        }
        return next;
      });
    },
    [vault],
  );

  const syncNow = useCallback(async () => {
    if (!vault) return;
    if (runningRef.current) return runningRef.current;
    const run = (async () => {
      const cache = cacheRef.current;
      if (!cache) return;
      setStatus("syncing");
      try {
        const pendingIds = Object.keys(cache.pending);
        if (pendingIds.length > 0) {
          const sending = pendingIds.map((id) => ({ id, ...cache.pending[id] }));
          const response = await fetch("/api/sync", {
            method: "POST",
            headers: authHeaders(vault),
            body: JSON.stringify({ records: sending }),
          });
          if (!response.ok) throw Object.assign(new Error(await readError(response)), { status: response.status });
          // 보내는 사이에 다시 고친 기록은 그대로 남겨 두고 다음에 보낸다.
          for (const item of sending) {
            if (cache.pending[item.id]?.blob === item.blob && cache.pending[item.id]?.deleted === item.deleted) {
              delete cache.pending[item.id];
            }
          }
        }

        const changed: string[] = [];
        for (;;) {
          const response = await fetch(`/api/sync?since=${cache.cursor}`, { headers: authHeaders(vault), cache: "no-store" });
          if (!response.ok) throw Object.assign(new Error(await readError(response)), { status: response.status });
          const { records: rows } = (await response.json()) as {
            records: { id: string; blob: string | null; deleted: number; seq: number }[];
          };
          for (const row of rows) {
            cache.rows[row.id] = { blob: row.blob, deleted: row.deleted === 1, seq: row.seq };
            cache.cursor = Math.max(cache.cursor, row.seq);
            changed.push(row.id);
          }
          if (rows.length < 1000) break;
        }
        writeCache(vault.householdId, cache);
        setPendingCount(Object.keys(cache.pending).length);
        await applyRows(changed);
        setStatus("idle");
        setError("");
        setPulled(true);
      } catch (caught) {
        writeCache(vault.householdId, cache);
        const statusCode = (caught as { status?: number }).status;
        setStatus(statusCode === 401 || statusCode === 429 ? "denied" : "offline");
        setError(caught instanceof Error ? caught.message : "연결하지 못했어요.");
      }
    })();
    runningRef.current = run;
    try {
      await run;
    } finally {
      runningRef.current = null;
    }
  }, [applyRows, vault]);

  const scheduleSync = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void syncNow(), 600);
  }, [syncNow]);

  const write = useCallback(
    async (id: string, value: unknown | null) => {
      const cache = cacheRef.current;
      if (!vault || !cache) return;
      cache.pending[id] = value === null
        ? { blob: null, deleted: true }
        : { blob: await encryptJson(vault.key, value), deleted: false };
      writeCache(vault.householdId, cache);
      setPendingCount(Object.keys(cache.pending).length);
      await applyRows([id]);
      scheduleSync();
    },
    [applyRows, scheduleSync, vault],
  );

  useEffect(() => {
    if (!vault) {
      cacheRef.current = null;
      return;
    }
    let cancelled = false;
    const cache = readCache(vault.householdId);
    cacheRef.current = cache;
    void (async () => {
      await applyRows([...new Set([...Object.keys(cache.rows), ...Object.keys(cache.pending)])]);
      if (cancelled) return;
      setPendingCount(Object.keys(cache.pending).length);
      setLoaded(true);
      void syncNow();
    })();

    const onVisible = () => {
      if (document.visibilityState === "visible") void syncNow();
    };
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void syncNow();
    }, POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
      setRecords(new Map());
      setLoaded(false);
      setPulled(false);
    };
  }, [applyRows, syncNow, vault]);

  return { records, status, error, loaded, pulled, pendingCount, write, syncNow };
}
