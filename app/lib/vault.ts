// 폰 안에서만 쓰는 암호화. 비밀번호와 열쇠는 서버로 가지 않는다.
// 비밀번호 → (PBKDF2) → 앞 32바이트: 기록을 잠그는 AES 열쇠, 뒤 32바이트: 서버에 「우리 가구예요」를 보이는 확인값.

const PBKDF2_ROUNDS = 600_000;
const DB_NAME = "duri-vault";
const STORE = "keys";
const SLOT = "current";

export type Vault = {
  householdId: string;
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

export function newHouseholdId() {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(16)));
}

export function isHouseholdId(text: string) {
  return /^[A-Za-z0-9_-]{22}$/.test(text);
}

export async function deriveVault(passphrase: string, householdId: string, me: 0 | 1): Promise<Vault> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase.normalize("NFC")),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(`duri-budget:${householdId}`), iterations: PBKDF2_ROUNDS },
      material,
      512,
    ),
  );
  // extractable: false — 폰 안의 다른 코드도 열쇠 값을 꺼내 볼 수 없다.
  const key = await crypto.subtle.importKey("raw", bits.slice(0, 32), "AES-GCM", false, ["encrypt", "decrypt"]);
  const auth = toHex(bits.slice(32));
  bits.fill(0);
  return { householdId, auth, key, me };
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

// CryptoKey는 꺼낼 수 없는 상태 그대로 IndexedDB에 저장된다. 다음에 앱을 열 때 비밀번호를 다시 묻지 않기 위해서다.
export async function saveVault(vault: Vault) {
  await withStore("readwrite", (store) => store.put(vault, SLOT));
}

export async function loadVault(): Promise<Vault | null> {
  try {
    return (await withStore<Vault | undefined>("readonly", (store) => store.get(SLOT))) ?? null;
  } catch {
    return null;
  }
}

export async function clearVault() {
  await withStore("readwrite", (store) => store.delete(SLOT));
}
