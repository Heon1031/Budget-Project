"use client";

import { useState } from "react";
import { Link2, TriangleAlert } from "lucide-react";
import { checkVault, registerHousehold, type SyncStatus } from "./lib/sync";
import { deriveVault, isHouseholdId, newHouseholdId, saveVault, type Vault } from "./lib/vault";

// 두 폰 연결. 둘 중 아무 폰에서 「처음 시작」으로 연결 코드를 만들고, 다른 폰이 그 코드와 같은 비밀번호로 연결한다(누가 주인인 구조가 아님).

const MIN_PASSPHRASE = 10;

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
  onConnected: (vault: Vault, isNew: boolean) => void;
  onDisconnect: () => void;
  onSync: () => void;
}) {
  const [mode, setMode] = useState<"new" | "join">("new");
  const [code, setCode] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [me, setMe] = useState<0 | 1>(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

  if (vault) {
    return (
      <section className="card connect-card">
        <h3 className="card-title"><Link2 size={18} /> 두 폰 연결됨 · {names[vault.me]}</h3>
        <div className="code-box">
          <span>연결 코드</span>
          <code>{vault.householdId}</code>
          <button onClick={() => {
            void navigator.clipboard?.writeText(vault.householdId).then(() => setCopied(true));
          }}>{copied ? "복사됨" : "복사"}</button>
        </div>
        <p className="muted small">코드와 비밀번호는 한 메시지에 같이 보내지 마세요.</p>
        <div className={`sync-line ${status}`}>
          {status === "syncing" && "맞추는 중…"}
          {status === "idle" && (pendingCount > 0 ? `보낼 기록 ${pendingCount}개 대기` : "최신 상태")}
          {status === "offline" && `연결 안 됨 · 폰에 저장해 두고 나중에 보내요${error ? ` (${error})` : ""}`}
          {status === "denied" && `서버가 거절했어요: ${error}`}
          <button onClick={onSync}>지금 맞추기</button>
        </div>
        <button className="danger" onClick={() => {
          if (confirm("이 폰에서 연결을 끊을까요? 서버의 기록은 그대로 있고, 코드와 비밀번호로 다시 들어올 수 있어요.")) onDisconnect();
        }}>이 폰에서 연결 끊기</button>
      </section>
    );
  }

  const submit = async () => {
    setMessage("");
    const trimmedCode = code.trim();
    if (mode === "join" && !isHouseholdId(trimmedCode)) return setMessage("연결 코드는 22글자예요. 다시 확인해 주세요.");
    if (passphrase.length < MIN_PASSPHRASE) return setMessage(`비밀번호는 ${MIN_PASSPHRASE}글자 이상으로 해 주세요.`);
    if (mode === "new" && passphrase !== confirmText) return setMessage("비밀번호 확인이 달라요.");
    setBusy(true);
    try {
      const householdId = mode === "new" ? newHouseholdId() : trimmedCode;
      const vault = await deriveVault(passphrase, householdId, me);
      if (mode === "new") await registerHousehold(vault);
      else await checkVault(vault);
      await saveVault(vault);
      setPassphrase("");
      setConfirmText("");
      onConnected(vault, mode === "new");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "연결하지 못했어요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card connect-card">
      <span className="lock-badge small"><Link2 size={22} /></span>
      <h2>둘이자산 연결</h2>
      <p className="badge warn"><TriangleAlert size={14} /> 비밀번호를 잊으면 기록을 되살릴 수 없어요</p>
      <div className="toggle-group wide">
        <button className={mode === "new" ? "active" : ""} onClick={() => setMode("new")}>처음 시작</button>
        <button className={mode === "join" ? "active" : ""} onClick={() => setMode("join")}>상대 폰과 연결</button>
      </div>
      <div className="toggle-group wide">
        <button className={me === 0 ? "active" : ""} onClick={() => setMe(0)}>나는 {names[0]}</button>
        <button className={me === 1 ? "active" : ""} onClick={() => setMe(1)}>나는 {names[1]}</button>
      </div>
      {mode === "join" && (
        <label className="field">
          <span>연결 코드</span>
          <input className="plain-input" value={code} autoComplete="off" autoCapitalize="off" spellCheck={false} onChange={(event) => setCode(event.target.value)} />
        </label>
      )}
      <label className="field">
        <span>비밀번호 <small>단어 서너 개 이어 쓰기</small></span>
        <input className="plain-input" type="password" autoComplete={mode === "new" ? "new-password" : "current-password"} value={passphrase} onChange={(event) => setPassphrase(event.target.value)} />
      </label>
      {mode === "new" && (
        <label className="field">
          <span>비밀번호 확인</span>
          <input className="plain-input" type="password" autoComplete="new-password" value={confirmText} onChange={(event) => setConfirmText(event.target.value)} />
        </label>
      )}
      {message && <p className="verdict no">{message}</p>}
      <button className="primary" disabled={busy} onClick={() => void submit()}>{busy ? "열쇠 만드는 중…" : mode === "new" ? "우리 집 만들기" : "연결하기"}</button>
    </section>
  );
}
