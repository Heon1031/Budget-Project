// 폰 안에서만 쓰는 암호화. 열쇠는 서버로 가지 않는다.
// 처음 시작한 폰이 무작위 비밀값(32바이트)을 만들고, 상대 폰은 QR로 그 값을 받는다.
// 비밀값 → (HKDF) → 앞 32바이트: 기록을 잠그는 AES 열쇠, 뒤 32바이트: 서버에 「우리 집이에요」를 보이는 확인값.

const DB_NAME = "duri-vault";
const STORE = "keys";
const SLOT = "current";
const PAIRING_PREFIX = "D1.";

export type Vault = {
  householdId: string;
  // QR · 복구 코드로 상대 폰에 넘기려고 이 폰에만 둔다(서버로 가지 않음).
  secret: string;
  auth: string;
  key: CryptoKey;
  me: 0 | 1;
};

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const fromBase64Url = (text: string) => {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
};

const toHex = (bytes: Uint8Array) => [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");

export async function vaultFromSecret(secret: string, householdId: string, me: 0 | 1): Promise<Vault> {
  const material = await crypto.subtle.importKey("raw", fromBase64Url(secret), "HKDF", false, ["deriveBits"]);
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: new TextEncoder().encode(`duri-budget:${householdId}`), info: new TextEncoder().encode("vault-v2") },
      material,
      512,
    ),
  );
  // extractable: false — 폰 안의 다른 코드도 열쇠 값을 꺼내 볼 수 없다.
  const key = await crypto.subtle.importKey("raw", bits.slice(0, 32), "AES-GCM", false, ["encrypt", "decrypt"]);
  const auth = toHex(bits.slice(32));
  bits.fill(0);
  return { householdId, secret, auth, key, me };
}

export function newVault(me: 0 | 1) {
  const householdId = toBase64Url(crypto.getRandomValues(new Uint8Array(16)));
  const secret = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  return vaultFromSecret(secret, householdId, me);
}

// QR · 복구 코드: 「D1.」 + (집 번호 16바이트 + 비밀값 32바이트 + 보여 준 사람 1바이트). 받는 폰은 반대쪽 사람이 된다.
export function encodePairing(vault: Vault) {
  const bytes = new Uint8Array(49);
  bytes.set(fromBase64Url(vault.householdId), 0);
  bytes.set(fromBase64Url(vault.secret), 16);
  bytes[48] = vault.me;
  return PAIRING_PREFIX + toBase64Url(bytes);
}

export function decodePairing(text: string) {
  const code = text.trim();
  if (!code.startsWith(PAIRING_PREFIX)) return null;
  try {
    const bytes = fromBase64Url(code.slice(PAIRING_PREFIX.length));
    if (bytes.length !== 49 || bytes[48] > 1) return null;
    return {
      householdId: toBase64Url(bytes.slice(0, 16)),
      secret: toBase64Url(bytes.slice(16, 48)),
      shownBy: bytes[48] as 0 | 1,
    };
  } catch {
    return null;
  }
}

export async function encryptJson(key: CryptoKey, value: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(value))),
  );
  const packed = new Uint8Array(iv.length + cipher.length);
  packed.set(iv);
  packed.set(cipher, iv.length);
  return toBase64Url(packed);
}

export async function decryptJson<T>(key: CryptoKey, blob: string): Promise<T> {
  const packed = fromBase64Url(blob);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: packed.slice(0, 12) }, key, packed.slice(12));
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

// CryptoKey는 꺼낼 수 없는 상태 그대로 IndexedDB에 저장된다. 다음에 앱을 열 때 다시 연결하지 않아도 되게 하기 위해서다.
export async function saveVault(vault: Vault) {
  await withStore("readwrite", (store) => store.put(vault, SLOT));
}

export async function loadVault(): Promise<Vault | null> {
  try {
    const stored = await withStore<Vault | undefined>("readonly", (store) => store.get(SLOT));
    // 비밀번호 방식(비밀값 없음)으로 저장된 연결은 쓰지 않는다. QR로 다시 연결한다.
    return stored && typeof stored.secret === "string" ? stored : null;
  } catch {
    return null;
  }
}

export async function clearVault() {
  await withStore("readwrite", (store) => store.delete(SLOT));
}
