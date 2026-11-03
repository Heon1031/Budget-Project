"use client";

import { useEffect, useRef, useState } from "react";
import { KeyRound, Lock, ScanFace } from "lucide-react";
import { canUseBiometric, clearLock, enableLock, readLock, unlockWithBiometric } from "./lib/lock";
import { deriveVault, type Vault } from "./lib/vault";

// 잠금 화면: Face ID · 지문으로 열고, 안 되면 연결 비밀번호로 연다.

export function LockScreen({ vault, onUnlock }: { vault: Vault; onUnlock: () => void }) {
  const [mode, setMode] = useState<"bio" | "pass">(readLock() ? "bio" : "pass");
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const tried = useRef(false);

  const tryBiometric = async () => {
    setBusy(true);
    setMessage("");
    try {
      if (await unlockWithBiometric()) onUnlock();
    } catch {
      setMessage("확인하지 못했어요. 다시 누르거나 비밀번호로 열어 주세요.");
    } finally {
      setBusy(false);
    }
  };

  // 앱을 열자마자 한 번 Face ID를 띄운다(아이폰은 누르는 동작이 있어야 뜰 수 있어 실패하면 버튼으로).
  useEffect(() => {
    if (mode !== "bio" || tried.current) return;
    tried.current = true;
    unlockWithBiometric().then((ok) => ok && onUnlock()).catch(() => {});
  }, [mode, onUnlock]);

  const tryPassphrase = async () => {
    setBusy(true);
    setMessage("");
    try {
      const check = await deriveVault(passphrase, vault.householdId, vault.me);
      if (check.auth === vault.auth) onUnlock();
      else setMessage("비밀번호가 달라요.");
    } finally {
      setBusy(false);
      setPassphrase("");
    }
  };

  return (
    <div className="lock-screen">
      <span className="lock-badge"><Lock size={28} /></span>
      <h2>둘이자산</h2>
      {mode === "bio" ? (
        <>
          <button className="primary" disabled={busy} onClick={() => void tryBiometric()}><ScanFace size={20} /> Face ID · 지문으로 열기</button>
          <button className="text-button" onClick={() => setMode("pass")}><KeyRound size={14} /> 비밀번호로 열기</button>
        </>
      ) : (
        <>
          <input
            className="plain-input"
            type="password"
            autoComplete="current-password"
            placeholder="연결 비밀번호"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && passphrase && void tryPassphrase()}
          />
          <button className="primary" disabled={busy || !passphrase} onClick={() => void tryPassphrase()}><KeyRound size={18} /> {busy ? "확인 중…" : "열기"}</button>
          {readLock() && <button className="text-button" onClick={() => setMode("bio")}><ScanFace size={14} /> Face ID · 지문으로</button>}
        </>
      )}
      {message && <p className="badge bad">{message}</p>}
    </div>
  );
}

// 설정의 잠금 카드: 이 폰에서 Face ID · 지문 잠금 켜기 / 끄기, 지금 잠그기.
export function LockSettings({ name, onLockNow }: { name: string; onLockNow: () => void }) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void canUseBiometric().then((ok) => {
      setAvailable(ok);
      setEnabled(Boolean(readLock()));
    });
  }, []);

  const turnOn = async () => {
    setMessage("");
    try {
      await enableLock(name);
      setEnabled(true);
    } catch {
      setMessage("켜지 못했어요. 폰의 Face ID · 지문 설정을 확인해 주세요.");
    }
  };

  return (
    <section className="card">
      <h3 className="card-title"><Lock size={18} /> 앱 잠금</h3>
      {available === false ? (
        <p className="badge warn">이 기기에서는 Face ID · 지문을 쓸 수 없어요 · 비밀번호로 잠겨요</p>
      ) : (
        <div className="toggle-group wide">
          <button className={enabled ? "active" : ""} onClick={() => void (enabled ? undefined : turnOn())}><ScanFace size={15} /> 켜기</button>
          <button className={!enabled ? "active" : ""} onClick={() => { clearLock(); setEnabled(false); }}>끄기</button>
        </div>
      )}
      <button className="add-button" onClick={onLockNow}><Lock size={16} /> 지금 잠그기</button>
      {message && <p className="badge bad">{message}</p>}
    </section>
  );
}
