import { toast } from "sonner";
import hotspotsData from "@data/hotspots.json";
import presetsData from "@data/presets.json";
import type {
  Hotspot,
  Platform,
  Review,
  ReviewIssue,
  RuleResult,
  Script,
} from "@/types";

const hotspots = hotspotsData as Hotspot[];

let hasNotifiedFallback = false;

export function resetFallbackNotice() {
  hasNotifiedFallback = false;
}

function notifyFallbackOnce() {
  if (hasNotifiedFallback) return;
  hasNotifiedFallback = true;
  if (typeof window !== "undefined") {
    toast.info("模型暂不可用，已使用预置结果演示");
  }
}

function findHotspot(hotspotId: string): Hotspot | undefined {
  return hotspots.find((h) => h.id === hotspotId);
}

function mapEvidenceId(refId: string, hotspot: Hotspot): string {
  if (hotspot.id === "h10" || hotspot.evidence.length === 0) {
    return refId;
  }
  const match = refId.match(/-e(\d+)$/);
  if (match) {
    const idx = Math.max(0, parseInt(match[1], 10) - 1);
    return hotspot.evidence[idx]?.id ?? hotspot.evidence[0].id;
  }
  return hotspot.evidence[0].id;
}

/**
 * 将 presets.h10 的预置脚本适配到指定热点与平台：
 * - 替换 hotspotId 与 platform，版本来源固定为 "preset"
 * - 非 h10 热点时，按顺序映射 evidenceRefs 与各镜头 evidenceRef（单证据热点全部映射到第 1 条），避免 R6 误报
 */
export function adaptPresetScriptForHotspot(
  presetScript: Script,
  hotspot: Hotspot,
  platform: Platform,
  versionOverride?: number
): Script {
  const version = versionOverride ?? presetScript.version;
  const mappedRefs = Array.from(
    new Set(presetScript.evidenceRefs.map((id) => mapEvidenceId(id, hotspot)))
  );
  const mappedShots = presetScript.shots.map((shot) => {
    if (!shot.evidenceRef) return { ...shot };
    return {
      ...shot,
      evidenceRef: mapEvidenceId(shot.evidenceRef, hotspot),
    };
  });

  return {
    ...presetScript,
    id: `s-${hotspot.id}-v${version}-preset`,
    hotspotId: hotspot.id,
    platform,
    version,
    source: "preset",
    shots: mappedShots,
    evidenceRefs: mappedRefs,
  };
}

export interface HealthResponse {
  ok: boolean;
  provider: string | null;
  model: string | null;
}

export async function fetchHealth(): Promise<HealthResponse> {
  try {
    const res = await fetch("/api/health");
    if (!res.ok) {
      return { ok: false, provider: null, model: null };
    }
    const data = (await res.json()) as Partial<HealthResponse>;
    return {
      ok: Boolean(data.ok),
      provider: data.provider ?? null,
      model: data.model ?? null,
    };
  } catch {
    return { ok: false, provider: null, model: null };
  }
}

export async function generateScriptApi(params: {
  hotspotId: string;
  platform: Platform;
  direction?: string;
}): Promise<{ script: Script; source: "llm" | "preset"; usedFallback: boolean }> {
  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        script?: Script;
        source?: "llm";
        fallback?: boolean;
      };
      if (!data.fallback && data.script) {
        return { script: data.script, source: "llm", usedFallback: false };
      }
    }
  } catch {
    // 网络或解析异常，走预置回退
  }

  notifyFallbackOnce();
  const hotspot = findHotspot(params.hotspotId) ?? findHotspot("h10")!;
  const presetV1 = presetsData.h10.v1 as Script;
  const adapted = adaptPresetScriptForHotspot(
    presetV1,
    hotspot,
    params.platform,
    1
  );
  return { script: adapted, source: "preset", usedFallback: true };
}

export async function reviewScriptApi(params: {
  hotspotId: string;
  script: Script;
  ruleResults?: RuleResult[];
}): Promise<{ review: Review; source: "llm" | "preset"; usedFallback: boolean }> {
  try {
    const res = await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        review?: Review;
        source?: "llm";
        fallback?: boolean;
      };
      if (!data.fallback && data.review) {
        return { review: data.review, source: "llm", usedFallback: false };
      }
    }
  } catch {
    // 走预置回退
  }

  notifyFallbackOnce();
  const review = (
    params.script.version <= 1
      ? presetsData.h10.v1Review
      : presetsData.h10.v2Review
  ) as Review;
  return { review, source: "preset", usedFallback: true };
}

export async function reviseScriptApi(params: {
  hotspotId: string;
  script: Script;
  issues: ReviewIssue[];
  ruleFailures: RuleResult[];
  humanNote?: string;
}): Promise<{
  script: Script;
  changes: string[];
  source: "llm" | "preset";
  usedFallback: boolean;
}> {
  try {
    const res = await fetch("/api/revise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        script?: Script;
        changes?: string[];
        source?: "llm";
        fallback?: boolean;
      };
      if (!data.fallback && data.script) {
        return {
          script: data.script,
          changes: data.changes ?? [],
          source: "llm",
          usedFallback: false,
        };
      }
    }
  } catch {
    // 走预置回退
  }

  notifyFallbackOnce();
  const hotspot = findHotspot(params.hotspotId) ?? findHotspot("h10")!;
  const presetV2 = presetsData.h10.v2 as Script;
  const nextVersion = params.script.version + 1;
  const adapted = adaptPresetScriptForHotspot(
    presetV2,
    hotspot,
    params.script.platform,
    nextVersion
  );

  const baseChanges = presetsData.h10.v2Changes as string[];
  const changes = params.humanNote?.trim()
    ? [`已按人工退回意见「${params.humanNote.trim()}」调整脚本`, ...baseChanges]
    : baseChanges;

  return {
    script: adapted,
    changes,
    source: "preset",
    usedFallback: true,
  };
}
