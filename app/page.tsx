"use client";

import { useEffect, useMemo, useState } from "react";
import { House, PieChart, Settings, Sparkles, Waves, type LucideIcon } from "lucide-react";
import { ConnectPanel } from "./secure/connect-panel";
import { LockScreen, LockSettings } from "./secure/lock-screen";
import { clearLock, readLock } from "./lib/secure/lock";
import { BucketBoard } from "./screens/bucket-board";
import { FlowBoard } from "./screens/flow-board";
import { HousingBoard } from "./screens/housing-board";
import { calculateHouse, daysUntil, defaultMoveDate } from "./lib/calc/housing";
import {
  STORAGE_KEY,
  calculateSalary,
  computeFlow,
  initialState,
  restoreState,
  newId,
  type AppState,
  type Person,
  type Wish,
} from "./lib/calc/plan";
import { forgetCache, useSharedRecords } from "./lib/secure/sync";
import { clearVault, loadVault, type Vault } from "./lib/secure/vault";
import { SettingsBoard } from "./screens/settings-board";
import { WishBoard } from "./screens/wish-board";
import { UnitContext, UnitFilter } from "./screens/fields";

type Tab = "flow" | "buckets" | "wish" | "house" | "settings";

const TABS: { id: Tab; icon: LucideIcon; label: string }[] = [
  { id: "flow", icon: Waves, label: "흐름" },
  { id: "buckets", icon: PieChart, label: "나누기" },
  { id: "wish", icon: Sparkles, label: "해볼까" },
  { id: "house", icon: House, label: "내 집" },
  { id: "settings", icon: Settings, label: "설정" },
];

// 매달 하는 「해볼까」를 시작하면: 그 사람 「자기관리」 바구니(없으면 첫 쓰기 바구니)에 항목으로 담는다. 둘이 하는 건 반씩.
function startMonthlyWish(state: AppState, wish: Wish): AppState {
  const owners: (0 | 1)[] = wish.owner === "both" ? [0, 1] : [wish.owner];
  const amount = wish.owner === "both" ? Math.round(wish.amount / 2) : wish.amount;
  const people = state.people.map((person, index) => {
    if (!owners.includes(index as 0 | 1)) return person;
    const target = person.buckets.find((bucket) => bucket.id === "b-self") ?? person.buckets.find((bucket) => bucket.kind !== "save");
    if (!target) return person;
    return {
      ...person,
      buckets: person.buckets.map((bucket) => (bucket.id === target.id ? { ...bucket, items: [...bucket.items, { id: newId("i"), name: wish.name, amount }] } : bucket)),
    };
  }) as [Person, Person];
  return { ...state, people, wishes: state.wishes.filter((item) => item.id !== wish.id) };
}

// 연봉이나 바구니 항목이 아직 처음 예시 그대로인지(첫 화면 안내용).
// 아직 예시값인 곳을 한 줄로 알려 준다: 항목이 예시면 나누기로, 연봉만 예시면 설정으로.
function exampleNote(state: AppState): { text: string; tab: "buckets" | "settings" } | null {
  const sampleItems = state.people.some((person) => person.buckets.some((bucket) => bucket.items.some((item) => item.example === true)));
  if (sampleItems) return { text: "옅은 숫자는 예시예요 · 칸을 눌러 우리 숫자를 넣어 주세요", tab: "buckets" };
  const sampleGross = state.people.filter((person, index) => person.annualGross === initialState.people[index].annualGross);
  if (sampleGross.length) return { text: `${sampleGross.map((person) => person.name).join(" · ")} 연봉이 아직 예시예요 · 설정에서 넣어 주세요`, tab: "settings" };
  return null;
}

export default function Home() {
  const [state, setState] = useState<AppState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [vault, setVault] = useState<Vault | null>(null);
  const [tab, setTab] = useState<Tab>("flow");
  // 금액 단위(원 · 만원 · 억원): 이 폰에서만 기억하는 보기 설정. 기본은 만원.
  // 첫 화면(흐름)에는 금액 칸이 없어서 서버 렌더와 어긋나지 않는다.
  const [unit, setUnitState] = useState(() => {
    if (typeof window === "undefined") return 1;
    try {
      const raw = window.localStorage.getItem("duri-unit");
      const saved = raw === null ? 1 : Number(raw);
      return saved >= 0 && saved <= 2 && Number.isInteger(saved) ? saved : 1;
    } catch {
      return 1;
    }
  });
  const setUnit = (next: number) => {
    setUnitState(next);
    try {
      window.localStorage.setItem("duri-unit", String(next));
    } catch {
      // 저장이 막힌 브라우저면 이번에만 바꾼다.
    }
  };
  // 잠금이 켜진 폰은 Face ID · 지문(안 되면 폰 PIN)으로 열기 전까지 기록을 풀지 않는다.
  const [unlocked, setUnlocked] = useState(false);
  const activeVault = vault && unlocked ? vault : null;
  const shared = useSharedRecords(activeVault);
  const { write: writeShared, loaded: sharedLoaded, pulled: sharedPulled } = shared;
  // 서버와 마지막으로 맞춘 계획(JSON). 같은 내용을 다시 보내거나, 보낸 걸 다시 덮어쓰지 않으려고 둔다.
  const [syncedPlanJson, setSyncedPlanJson] = useState("");
  const [seenRemotePlan, setSeenRemotePlan] = useState<unknown>(undefined);

  useEffect(() => {
    void loadVault().then((stored) => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          setState(restoreState(JSON.parse(saved)));
        } catch {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
      if (stored) setVault(stored);
      setUnlocked(!readLock());
      setHydrated(true);
    });
  }, []);

  // 연결 전에는 이 폰에만 저장한다. 연결 뒤에는 암호화된 기록만 남기고 평문 저장본은 지운다.
  useEffect(() => {
    if (!hydrated) return;
    if (vault) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated, vault]);

  const remotePlan = shared.records.get("plan");
  if (remotePlan !== seenRemotePlan) {
    setSeenRemotePlan(remotePlan);
    const json = remotePlan ? JSON.stringify(remotePlan) : "";
    if (remotePlan && json !== syncedPlanJson) {
      setSyncedPlanJson(json);
      setState(restoreState(remotePlan));
    }
  }

  // 처음 연결한 폰은 서버 계획을 먼저 받아 본 뒤에야 내 계획을 보낸다(상대 계획을 덮어쓰지 않게).
  // 잠긴 채로 3분 넘게 다른 앱에 있다 돌아오면 다시 잠근다.
  useEffect(() => {
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 3 * 60_000 && readLock()) setUnlocked(false);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const canSendPlan = Boolean(activeVault) && sharedLoaded && (sharedPulled || remotePlan !== undefined);
  useEffect(() => {
    if (!canSendPlan) return;
    const json = JSON.stringify(state);
    if (json === syncedPlanJson) return;
    const timer = setTimeout(() => {
      setSyncedPlanJson(json);
      void writeShared("plan", state);
    }, 800);
    return () => clearTimeout(timer);
  }, [canSendPlan, state, syncedPlanJson, writeShared]);

  const disconnect = async () => {
    if (vault) forgetCache(vault.householdId);
    await clearVault();
    clearLock();
    setVault(null);
    setSyncedPlanJson("");
    setState(initialState);
    setTab("flow");
  };

  const salary = useMemo(
    () => state.people.map(calculateSalary) as [ReturnType<typeof calculateSalary>, ReturnType<typeof calculateSalary>],
    [state.people],
  );
  const flow = useMemo(() => computeFlow(state, [salary[0].net, salary[1].net]), [state, salary]);
  const names: [string, string] = [state.people[0].name || "A", state.people[1].name || "B"];
  const annualIncome = state.people[0].annualGross + state.people[1].annualGross;
  const moveDate = state.house.moveDate || defaultMoveDate();
  const houseCalc = calculateHouse(state.house, annualIncome, state.plan.currentAssets, moveDate);

  const update = (patch: Partial<AppState>) => setState((current) => ({ ...current, ...patch }));
  const updatePerson = (index: 0 | 1, patch: Partial<Person>) =>
    setState((current) => {
      const people = [...current.people] as [Person, Person];
      people[index] = { ...people[index], ...patch };
      return { ...current, people };
    });

  // 연결 안 된 폰은 연결 화면만, 잠긴 폰은 잠금 화면만 보인다.
  if (hydrated && !vault) {
    return (
      <main className="gate">
        <ConnectPanel
          vault={null}
          names={names}
          status={shared.status}
          error={shared.error}
          pendingCount={shared.pendingCount}
          onConnected={(connected) => {
            setVault(connected);
            setUnlocked(true);
          }}
          onDisconnect={() => {}}
          onSync={() => {}}
        />
      </main>
    );
  }
  if (hydrated && vault && !unlocked) {
    return (
      <main className="gate">
        <LockScreen onUnlock={() => setUnlocked(true)} />
      </main>
    );
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top"><span className="brand-mark">둘</span><span>둘이자산</span></a>
        <span className="save-dot">{vault ? "● 둘이 함께 · 암호화" : "● 이 폰에만 저장"}</span>
      </header>

      <UnitContext.Provider value={unit}>
      <div className="layout" id="top">
        {tab !== "flow" && <UnitFilter unit={unit} onChange={setUnit} />}
        {tab === "flow" && (
          <FlowBoard
            flow={flow}
            names={names}
            example={exampleNote(state)}
            house={{ daysLeft: daysUntil(moveDate), have: houseCalc.willHave, need: houseCalc.needCash }}
            onOpen={setTab}
          />
        )}
        {tab === "buckets" && <BucketBoard people={state.people} flow={flow} names={names} me={vault?.me ?? 0} onPerson={updatePerson} common={state.common} onCommon={(common) => update({ common })} />}
        {tab === "wish" && (
          <WishBoard
            wishes={state.wishes}
            flow={flow}
            names={names}
            onChange={(wishes) => update({ wishes })}
            onStartMonthly={(wish) => setState((current) => startMonthlyWish(current, wish))}
          />
        )}
        {tab === "house" && (
          <HousingBoard
            house={state.house}
            moveDate={moveDate}
            onChange={(patch) => setState((current) => ({ ...current, house: { ...current.house, ...patch } }))}
            annualIncome={annualIncome}
            currentAssets={state.plan.currentAssets}
            monthlyNet={flow.totalNet}
            unassigned={flow.people[0].free + flow.people[1].free}
          />
        )}
        {tab === "settings" && (
          <SettingsBoard state={state} salary={salary} onPerson={updatePerson} onState={update}>
            {vault && <LockSettings name={names[vault.me]} onLockNow={() => setUnlocked(false)} />}
            <ConnectPanel
              vault={vault}
              names={names}
              status={shared.status}
              error={shared.error}
              pendingCount={shared.pendingCount}
              onConnected={(connected) => {
                setVault(connected);
                setUnlocked(true);
              }}
              onDisconnect={() => void disconnect()}
              onSync={() => void shared.syncNow()}
            />
            <button className="text-button" onClick={() => {
              if (confirm(vault ? "모든 계획을 예시값으로 바꿀까요? 상대 폰도 함께 바뀌어요." : "모든 계획을 예시값으로 바꿀까요?")) setState(initialState);
            }}>예시값으로 초기화</button>
          </SettingsBoard>
        )}
      </div>
      </UnitContext.Provider>

      <footer>
        <span>둘이자산 · 먼저 떼고, 남은 돈은 마음 편히</span>
        <p>참고용 추정이에요</p>
      </footer>

      <nav className="tabbar" aria-label="화면 바꾸기">
        {TABS.map((item) => (
          <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}>
            <item.icon size={22} strokeWidth={tab === item.id ? 2.4 : 1.8} />{item.label}
          </button>
        ))}
      </nav>
    </main>
  );
}
