// 앱 잠금: 폰의 Face ID · 지문(패스키, WebAuthn)으로 연다. 서버를 거치지 않고 이 폰 안에서만 확인한다.
// 기록 자체는 이미 암호화돼 있고, 잠금은 「풀린 폰을 남이 집어 들었을 때」 화면을 가리는 장치다.

const LOCK_KEY = "duri-lock";

type LockInfo = { credentialId: string };

const toBase64Url = (bytes: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const fromBase64Url = (text: string) => {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
};

export function readLock(): LockInfo | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCK_KEY) ?? "") as LockInfo;
    return typeof parsed?.credentialId === "string" ? parsed : null;
  } catch {
    return null;
  }
}

export function clearLock() {
  try {
    localStorage.removeItem(LOCK_KEY);
  } catch {}
}

export async function canUseBiometric() {
  try {
    return Boolean(window.PublicKeyCredential) && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

// 이 폰에 「둘이자산 잠금」 패스키를 하나 만든다. 만들 때 Face ID · 지문을 한 번 확인한다.
export async function enableLock(name: string) {
  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "둘이자산", id: location.hostname },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: `duri-${name}`, displayName: `둘이자산 · ${name}` },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!credential) throw new Error("잠금을 만들지 못했어요.");
  localStorage.setItem(LOCK_KEY, JSON.stringify({ credentialId: toBase64Url(credential.rawId) }));
}

// Face ID · 지문 확인. 성공하면 true.
export async function unlockWithBiometric() {
  const lock = readLock();
  if (!lock) return true;
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rpId: location.hostname,
      allowCredentials: [{ type: "public-key", id: fromBase64Url(lock.credentialId) }],
      userVerification: "required",
      timeout: 60_000,
    },
  });
  return Boolean(assertion);
}
