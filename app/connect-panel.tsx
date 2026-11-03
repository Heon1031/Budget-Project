"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardPaste, Copy, Link2, QrCode, ScanLine, ShieldCheck, TriangleAlert } from "lucide-react";
import { QrImage, QrScanner } from "./qr";
import { checkVault, registerHousehold, type SyncStatus } from "./lib/sync";
import { decodePairing, encodePairing, newVault, saveVault, vaultFromSecret, type Vault } from "./lib/vault";

// 두 폰 연결. 둘 중 아무 폰에서 「새로 시작하기」를 누르면 바로 QR이 뜨고, 다른 폰이 그 QR을 찍으면 끝.
// 누가 주인인 구조가 아니다. 연결된 폰은 둘 다 언제든 QR을 보여 줄 수 있다.

const QR_SECONDS = 120;

export function ConnectPanel({
  vault,
  names,
  status,
  error,
  pendingCount,
  onConnected,
  onDisconnect,
  onSync,
}: {
  vault: Vault | null;
  names: [string, string];
  status: SyncStatus;
  error: string;
  pendingCount: number;
  onConnected: (vault: Vault) => void;
  onDisconnect: () => void;
  onSync: () => void;
}) {
  if (vault) {
    return <ConnectedCard vault={vault} names={names} status={status} error={error} pendingCount={pendingCount} onDisconnect={onDisconnect} onSync={onSync} />;
  }
  return <StartCard names={names} onConnected={onConnected} />;
}

function StartCard({ names, onConnected }: { names: [string, string]; onConnected: (vault: Vault) => void }) {
  const [me, setMe] = useState<0 | 1>(0);
  const [scanning, setScanning] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  // 처음 시작한 폰: 바로 QR을 보여 주고, 상대 폰이 찍은 뒤(또는 나중에) 앱으로 들어간다.
  const [created, setCreated] = useState<Vault | null>(null);

  const start = async () => {
    setBusy(true);
    setMessage("");
    try {
      const vault = await newVault(me);
      await registerHousehold(vault);
      await saveVault(vault);
      setCreated(vault);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "시작하지 못했어요.");
    } finally {
      setBusy(false);
    }
  };

  // QR · 붙여넣은 코드로 연결. 받는 폰은 QR을 보여 준 사람의 반대쪽이 된다(붙여넣기는 고른 쪽).
  const join = useCallback(
    async (text: string, chosen?: 0 | 1) => {
      setScanning(false);
      setMessage("");
      const pairing = decodePairing(text);
      if (!pairing) return setMessage("둘이자산 연결 QR이 아니에요.");
      setBusy(true);
      try {
        const vault = await vaultFromSecret(pairing.secret, pairing.householdId, chosen ?? (pairing.shownBy === 0 ? 1 : 0));
        await checkVault(vault);
        await saveVault(vault);
        onConnected(vault);
      } catch (caught) {
        setMessage(caught instanceof Error ? caught.message : "연결하지 못했어요.");
      } finally {
        setBusy(false);
      }
    },
    [onConnected],
  );

  const onScan = useCallback((text: string) => void join(text), [join]);

  if (created) {
    return (
      <section className="card connect-card">
        <span className="lock-badge small"><QrCode size={22} /></span>
        <h2>상대 폰으로 찍어 주세요</h2>
        <p className="muted small">상대 폰에서 이 주소를 열고 「상대 폰 QR 찍기」를 누르면 연결돼요.</p>
        <div className="qr-box">
          <QrImage text={encodePairing(created)} />
          <p className="badge warn"><TriangleAlert size={14} /> 옆에서 직접 찍기만 · 사진으로 보내지 마세요</p>
        </div>
        <button className="primary" onClick={() => onConnected(created)}>다 찍었어요 · 시작하기</button>
        <button className="text-button" onClick={() => onConnected(created)}>나중에 연결할게요(설정에서 다시 볼 수 있어요)</button>
      </section>
    );
  }

  return (
    <section className="card connect-card">
      <span className="lock-badge small"><Link2 size={22} /></span>
      <h2>둘이자산 연결</h2>

      <div className="start-grid">
        <div className="start-option">
          <b>처음 쓰는 거라면</b>
          <div className="toggle-group wide">
            <button className={me === 0 ? "active" : ""} onClick={() => setMe(0)}>나는 {names[0]}</button>
            <button className={me === 1 ? "active" : ""} onClick={() => setMe(1)}>나는 {names[1]}</button>
          </div>
          <button className="primary" disabled={busy} onClick={() => void start()}>{busy ? "준비 중…" : "새로 시작하기"}</button>
        </div>
        <div className="start-option">
          <b>상대가 이미 시작했다면</b>
          <button className="primary ghost-primary" disabled={busy} onClick={() => setScanning(true)}><ScanLine size={18} /> 상대 폰 QR 찍기</button>
          <button className="text-button" onClick={() => setPasting(!pasting)}><ClipboardPaste size={14} /> 코드 붙여넣기</button>
        </div>
      </div>

      {pasting && (
        <div className="paste-box">
          <input className="plain-input" value={code} autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder="D1.으로 시작하는 코드" onChange={(event) => setCode(event.target.value)} />
          <div className="toggle-group wide">
            <button className={me === 0 ? "active" : ""} onClick={() => setMe(0)}>나는 {names[0]}</button>
            <button className={me === 1 ? "active" : ""} onClick={() => setMe(1)}>나는 {names[1]}</button>
          </div>
          <button className="primary" disabled={busy || !code.trim()} onClick={() => void join(code, me)}>연결하기</button>
        </div>
      )}

      {message && <p className="badge bad"><TriangleAlert size={14} /> {message}</p>}
      {scanning && <QrScanner onCode={onScan} onClose={() => setScanning(false)} />}
    </section>
  );
}

function ConnectedCard({
  vault,
  names,
  status,
  error,
  pendingCount,
  onDisconnect,
  onSync,
}: {
  vault: Vault;
  names: [string, string];
  status: SyncStatus;
  error: string;
  pendingCount: number;
  onDisconnect: () => void;
  onSync: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [copied, setCopied] = useState(false);
  const pairing = encodePairing(vault);

  // QR은 2분만 보여 주고 숨긴다(옆에 있는 상대 폰만 찍게).
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  return (
    <section className="card connect-card">
      <h3 className="card-title"><Link2 size={18} /> 두 폰 연결 · 이 폰은 {names[vault.me]}</h3>

      {secondsLeft > 0 ? (
        <div className="qr-box">
          <QrImage text={pairing} />
          <p className="badge warn"><TriangleAlert size={14} /> 옆에서 직접 찍기만 · 사진으로 보내지 마세요</p>
          <small>{secondsLeft}초 뒤에 숨겨요</small>
          <button className="text-button" onClick={() => setSecondsLeft(0)}>숨기기</button>
        </div>
      ) : (
        <button className="add-button" onClick={() => setSecondsLeft(QR_SECONDS)}><QrCode size={16} /> 상대 폰 연결 QR 보여 주기</button>
      )}

      <div className={`sync-line ${status}`}>
        {status === "syncing" && "맞추는 중…"}
        {status === "idle" && (pendingCount > 0 ? `보낼 기록 ${pendingCount}개 대기` : "최신 상태")}
        {status === "offline" && `연결 안 됨 · 나중에 보내요${error ? ` (${error})` : ""}`}
        {status === "denied" && `서버가 거절했어요: ${error}`}
        <button onClick={onSync}>지금 맞추기</button>
      </div>

      <details className="explain">
        <summary><ShieldCheck size={14} /> 복구 코드</summary>
        <p>두 폰을 함께 잃어버렸을 때 쓰는 코드예요. 비밀번호 관리 앱 같은 안전한 곳에만 저장하세요. 이 코드가 있으면 누구나 기록을 열 수 있어요.</p>
        <button className="add-button" onClick={() => void navigator.clipboard?.writeText(pairing).then(() => setCopied(true))}>
          <Copy size={16} /> {copied ? "복사했어요" : "복구 코드 복사"}
        </button>
      </details>

      <button className="danger" onClick={() => {
        if (confirm("이 폰에서 연결을 끊을까요? 상대 폰의 QR이나 복구 코드로 다시 연결할 수 있어요.")) onDisconnect();
      }}>이 폰에서 연결 끊기</button>
    </section>
  );
}
