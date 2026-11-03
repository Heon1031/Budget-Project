"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Lock, ScanFace } from "lucide-react";
import { canUseBiometric, clearLock, enableLock, readLock, unlockWithBiometric } from "./lib/lock";

// 잠금 화면: Face ID · 지문으로 연다. 생체 인식이 안 되면 폰이 알아서 폰 잠금 비밀번호(PIN)를 묻는다.

export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const tried = useRef(false);

  const tryBiometric = useCallback(async () => {
    setBusy(true);
    setMessage("");
    try {
      if (await unlockWithBiometric()) onUnlock();
    } catch {
      setMessage("확인하지 못했어요. 다시 눌러 주세요.");
    } finally {
      setBusy(false);
    }
  }, [onUnlock]);

  // 앱을 열자마자 한 번 띄운다(아이폰은 버튼을 눌러야 뜰 때가 있어 실패하면 버튼으로).
  useEffect(() => {
    if (tried.current) return;
    tried.current = true;
    unlockWithBiometric().then((ok) => ok && onUnlock()).catch(() => {});
  }, [onUnlock]);

  return (
    <div className="lock-screen">
      <span className="lock-badge"><Lock size={28} /></span>
      <h2>둘이자산</h2>
      <button className="primary" disabled={busy} onClick={() => void tryBiometric()}><ScanFace size={20} /> Face ID · 지문으로 열기</button>
      <small className="muted small">안 되면 폰 잠금 비밀번호로 열려요</small>
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
        <p className="badge warn">이 기기에서는 Face ID · 지문을 쓸 수 없어요</p>
      ) : (
        <div className="toggle-group wide">
          <button className={enabled ? "active" : ""} onClick={() => void (enabled ? undefined : turnOn())}><ScanFace size={15} /> 켜기</button>
          <button className={!enabled ? "active" : ""} onClick={() => { clearLock(); setEnabled(false); }}>끄기</button>
        </div>
      )}
      {enabled && <button className="add-button" onClick={onLockNow}><Lock size={16} /> 지금 잠그기</button>}
      {message && <p className="badge bad">{message}</p>}
    </section>
  );
}
