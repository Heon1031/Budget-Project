"use client";

import { useEffect, useMemo, useState } from "react";
import { ConnectPanel } from "./connect-panel";
import { FixedBoard } from "./fixed-board";
import { FlowBoard } from "./flow-board";
import { HousingBoard } from "./housing-board";
import { calculateHouse, daysUntil, defaultMoveDate } from "./lib/housing";
import {
  STORAGE_KEY,
  calculateSalary,
  computeFlow,
  initialState,
  restoreState,
  type AppState,
  type Person,
} from "./lib/plan";
import { forgetCache, useSharedRecords } from "./lib/sync";
import { clearVault, loadVault, type Vault } from "./lib/vault";
import { SettingsBoard } from "./settings-board";
import { WishBoard } from "./wish-board";

type Tab = "flow" | "fixed" | "wish" | "house" | "settings";

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: "flow", icon: "◎", label: "흐름" },
  { id: "fixed", icon: "≡", label: "고정지출" },
  { id: "wish", icon: "✦", label: "해볼까" },
  { id: "house", icon: "⌂", label: "내 집" },
  { id: "settings", icon: "⚙", label: "설정" },
];

export default function Home() {
  const [state, setState] = useState<AppState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [vault, setVault] = useState<Vault | null>(null);
  const [tab, setTab] = useState<Tab>("flow");
  const shared = useSharedRecords(vault);
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
  const canSendPlan = Boolean(vault) && sharedLoaded && (sharedPulled || remotePlan !== undefined);
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

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top"><span className="brand-mark">둘</span><span>둘이자산</span></a>
        <span className="save-dot">{vault ? "● 둘이 함께 · 암호화" : "● 이 폰에만 저장"}</span>
      </header>

      <div className="layout" id="top">
        {tab === "flow" && (
          <FlowBoard
            flow={flow}
            names={names}
            targets={[state.people[0], state.people[1]]}
            house={{ daysLeft: daysUntil(moveDate), have: houseCalc.willHave, need: houseCalc.needCash }}
            onOpen={setTab}
          />
        )}
        {tab === "fixed" && <FixedBoard items={state.fixedCosts} names={names} onChange={(fixedCosts) => update({ fixedCosts })} />}
        {tab === "wish" && (
          <WishBoard
            wishes={state.wishes}
            flow={flow}
            names={names}
            onChange={(wishes) => update({ wishes })}
            onMoveToFixed={(fixed, wishId) =>
              setState((current) => ({
                ...current,
                fixedCosts: [...current.fixedCosts, fixed],
                wishes: current.wishes.filter((wish) => wish.id !== wishId),
              }))
            }
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
            <ConnectPanel
              vault={vault}
              names={names}
              status={shared.status}
              error={shared.error}
              pendingCount={shared.pendingCount}
              onConnected={(connected) => setVault(connected)}
              onDisconnect={() => void disconnect()}
              onSync={() => void shared.syncNow()}
            />
            <button className="text-button" onClick={() => {
              if (confirm(vault ? "모든 계획을 예시값으로 바꿀까요? 상대 폰도 함께 바뀌어요." : "모든 계획을 예시값으로 바꿀까요?")) setState(initialState);
            }}>예시값으로 초기화</button>
          </SettingsBoard>
        )}
      </div>

      <footer>
        <span>둘이자산 · 먼저 떼고, 남은 돈은 마음 편히</span>
        <p>계산은 참고용 추정이에요. 실제 자산은 은행 · 자산관리 앱에서 확인하세요.</p>
      </footer>

      <nav className="tabbar" aria-label="화면 바꾸기">
        {TABS.map((item) => (
          <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}>
            <span>{item.icon}</span>{item.label}
          </button>
        ))}
      </nav>
    </main>
  );
}
