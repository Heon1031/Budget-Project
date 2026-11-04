"use client";

import { useState } from "react";
import {
  Bus,
  HeartPulse,
  PiggyBank,
  Plane,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  Dumbbell,
  GraduationCap,
  House,
  Landmark,
  Package,
  Palette,
  Shield,
  ShoppingCart,
  Smartphone,
  Tv,
  type LucideIcon,
} from "lucide-react";
import type { BucketIcon, FixedCategory } from "../lib/calc/plan";
import { won } from "./fields";

// 그래프 부품. 색은 globals.css의 --chart-* 토큰(색약 검증 통과)만 쓴다.

export const CATEGORY_ICONS: Record<FixedCategory, LucideIcon> = {
  주거: House,
  생활: ShoppingCart,
  통신: Smartphone,
  보험: Shield,
  교통: Bus,
  대출: Landmark,
  "학원·배움": GraduationCap,
  "운동·건강": Dumbbell,
  취미: Palette,
  구독: Tv,
  기타: Package,
};

export const BUCKET_ICON_MAP: Record<BucketIcon, LucideIcon> = {
  piggy: PiggyBank,
  cart: ShoppingCart,
  heart: HeartPulse,
  wallet: Wallet,
  plane: Plane,
  shield: ShieldCheck,
  users: Users,
  home: House,
  sparkles: Sparkles,
};

// 바구니 색: 순서(자리)에 따라 고정. dataviz 기준 팔레트 8색(색약 검증 통과, 밝은 · 어두운 각각).
export const bucketColor = (index: number) => `var(--bucket-${(index % 8) + 1})`;

export type Segment = { label: string; value: number; color: string };

// 도넛: 조각 사이 2px 틈, 가운데에 큰 숫자. 조각을 누르면 아래 설명이 그 조각으로 바뀐다.
export function Donut({ segments, size = 132, center, caption }: { segments: Segment[]; size?: number; center: string; caption: string }) {
  const [active, setActive] = useState<number | null>(null);
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const length = 2 * Math.PI * radius;
  const gap = total > 0 ? 2 : 0;
  const parts = segments.map((segment) => (total > 0 ? (Math.max(0, segment.value) / total) * length : 0));
  const starts = parts.map((_, index) => parts.slice(0, index).reduce((sum, part) => sum + part, 0));
  const shown = active === null ? null : segments[active];
  return (
    <figure className="donut" style={{ width: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={segments.map((s) => `${s.label} ${won(s.value)}`).join(", ")}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        {segments.map((segment, index) => {
          const dash = Math.max(0, parts[index] - gap);
          return (
            <circle
              key={segment.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${length - dash}`}
              strokeDashoffset={-starts[index]}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              opacity={active === null || active === index ? 1 : 0.35}
              onPointerEnter={() => setActive(index)}
              onPointerLeave={() => setActive(null)}
              onClick={() => setActive(active === index ? null : index)}
            >
              <title>{`${segment.label} ${won(segment.value)}`}</title>
            </circle>
          );
        })}
      </svg>
      <div className="donut-center">
        <strong>{shown ? `${Math.round(total > 0 ? (shown.value / total) * 100 : 0)}%` : center}</strong>
        <small>{shown ? shown.label : caption}</small>
      </div>
    </figure>
  );
}

export function Legend({ segments, total }: { segments: Segment[]; total: number }) {
  return (
    <ul className="legend">
      {segments.map((segment) => (
        <li key={segment.label}>
          <i style={{ background: segment.color }} />
          <span>{segment.label}</span>
          <b>{total > 0 ? Math.round((Math.max(0, segment.value) / total) * 100) : 0}%</b>
        </li>
      ))}
    </ul>
  );
}

// 12달 쌓이는 막대: 한 가지 색(크기), 마지막 막대만 숫자를 단다. 막대를 누르면 그 달 금액.
export function GrowthBars({ monthly, months = 12 }: { monthly: number; months?: number }) {
  const [active, setActive] = useState<number | null>(null);
  const width = 300;
  const height = 72;
  const barWidth = width / months - 4;
  return (
    <figure className="growth">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`매달 ${won(monthly)}씩 ${months}달 쌓이는 모습`}>
        {Array.from({ length: months }, (_, index) => {
          const value = monthly * (index + 1);
          const barHeight = Math.max(2, ((index + 1) / months) * (height - 4));
          return (
            <rect
              key={index}
              x={index * (width / months) + 2}
              y={height - barHeight}
              width={barWidth}
              height={barHeight}
              rx={3}
              className={active === index || (active === null && index === months - 1) ? "on" : ""}
              onPointerEnter={() => setActive(index)}
              onPointerLeave={() => setActive(null)}
              onClick={() => setActive(index)}
            >
              <title>{`${index + 1}달 뒤 ${won(value)}`}</title>
            </rect>
          );
        })}
      </svg>
      <figcaption>{active === null ? "12달 뒤" : `${active + 1}달 뒤 ${won(monthly * (active + 1))}`}</figcaption>
    </figure>
  );
}

// 진행 고리: 0~100%.
export function Ring({ ratio, size = 64, children }: { ratio: number; size?: number; children?: React.ReactNode }) {
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const length = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, ratio));
  return (
    <div className="progress-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--brand)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${clamped * length} ${length}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span>{children}</span>
    </div>
  );
}

// 가로 막대 하나: 값/최대값.
export function Bar({ value, max, tone = "brand" }: { value: number; max: number; tone?: "brand" | "bad" | "muted" }) {
  return (
    <i className={`hbar ${tone}`} aria-hidden="true">
      <span style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%` }} />
    </i>
  );
}
