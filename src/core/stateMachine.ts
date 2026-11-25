import type {
  Hotspot,
  HotspotStatus,
  MetaConfig,
  ScriptStatus,
} from "@/types";
import { calculateTotalScore } from "./scoring";

const HOTSPOT_TRANSITIONS: Record<HotspotStatus, readonly HotspotStatus[]> = {
  collected: ["verified", "pending", "blocked"],
  verified: ["recommended", "expired"],
  pending: [],
  blocked: [],
  recommended: ["selected", "dismissed", "expired"],
  selected: [],
  dismissed: [],
  expired: [],
};

const SCRIPT_TRANSITIONS: Record<ScriptStatus, readonly ScriptStatus[]> = {
  idle: ["generating"],
  generating: ["checking"],
  checking: ["revising", "pending_final"],
  revising: ["checking"],
  pending_final: ["approved", "returned"],
  returned: ["revising"],
  approved: [],
};

export function deriveInitialHotspotStatus(
  hotspot: Hotspot,
  meta: MetaConfig,
  options: { applyInitialSelected?: boolean } = {}
): HotspotStatus {
  const { applyInitialSelected = true } = options;

  if (hotspot.verification.status === "pending") {
    return "pending";
  }
  if (hotspot.verification.status === "blocked") {
    return "blocked";
  }

  // verification.status === "verified"
  if (hotspot.lifecycle === "declining") {
    return "expired";
  }

  const totalScore = calculateTotalScore(hotspot.fit.dims, meta.scoring.weights);
  if (totalScore >= meta.scoring.threshold) {
    if (applyInitialSelected && meta.initialSelected.includes(hotspot.id)) {
      return "selected";
    }
    return "recommended";
  }

  return "verified";
}

export function canTransitionHotspot(
  from: HotspotStatus,
  to: HotspotStatus
): boolean {
  return HOTSPOT_TRANSITIONS[from].includes(to);
}

export function transitionHotspot(
  from: HotspotStatus,
  to: HotspotStatus
): HotspotStatus {
  if (!canTransitionHotspot(from, to)) {
    throw new Error(`非法的热点状态流转: ${from} -> ${to}`);
  }
  return to;
}

export function canTransitionScript(
  from: ScriptStatus,
  to: ScriptStatus
): boolean {
  return SCRIPT_TRANSITIONS[from].includes(to);
}

export function transitionScript(
  from: ScriptStatus,
  to: ScriptStatus
): ScriptStatus {
  if (!canTransitionScript(from, to)) {
    throw new Error(`非法的脚本状态流转: ${from} -> ${to}`);
  }
  return to;
}

export function getSelectDisabledReason(
  hotspot: Hotspot,
  status: HotspotStatus
): string | null {
  if (status === "recommended") {
    return null;
  }
  if (status === "selected") {
    return "该热点已确认选题";
  }
  if (status === "pending") {
    return hotspot.verification.sources <= 1
      ? "仅单一来源，需核实后才能选题"
      : "尚未完成交叉核验，需核实后才能选题";
  }
  if (status === "blocked") {
    return `已被系统拦截：${hotspot.risk.note || hotspot.verification.conclusion}`;
  }
  if (status === "expired") {
    return "热点已进入衰退期并超过时效窗口，不可选题";
  }
  if (status === "dismissed") {
    return "该热点已被放弃";
  }
  return "当前状态不可选题（适配分未达推荐阈值）";
}
