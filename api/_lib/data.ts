import fs from "fs";
import path from "path";

export type Platform = "douyin" | "bilibili" | "xiaohongshu";

export interface GameCard {
  id: string;
  type: string;
  name: string;
  summary: string;
  source: string;
  effectiveVersion: string;
  confidentiality: "public" | "internal" | "unreleased";
  keywords: string[];
  forbiddenClaims: string[];
}

export interface GameConfig {
  name: string;
  genre: string;
  tagline: string;
  currentVersion: string;
  currentEvent: string;
  ageRating: string;
  audience: string;
  tone: string;
  cards: GameCard[];
}

export interface PlatformRule {
  name: string;
  durationSec: { min: number; max: number };
  titleMaxChars: number;
  coverMaxChars: number;
  aspect: string;
  requiredNotices: string[];
  style: string;
}

export interface Evidence {
  id: string;
  platform: string;
  rank: number | null;
  heat: number | null;
  capturedAt: string;
  url: string;
  snapshotHash: string;
  excerpt: string;
}

export interface Hotspot {
  id: string;
  title: string;
  summary: string;
  category: string;
  platforms: string[];
  firstSeenAt: string;
  lifecycle: string;
  windowEnd: string;
  evidence: Evidence[];
  verification: {
    status: string;
    sources: number;
    conclusion: string;
  };
  risk: {
    level: string;
    note: string;
  };
  fit: {
    recommendation: string;
    angles: string[];
    suggestedPlatform: Platform;
  };
}

export interface Shot {
  start: number;
  end: number;
  visual: string;
  line: string;
  subtitle: string;
  evidenceRef?: string;
}

export interface Script {
  id: string;
  hotspotId: string;
  platform: Platform;
  version: number;
  source: "llm" | "revision" | "human_return" | "preset";
  title: string;
  coverText: string;
  hook: string;
  shots: Shot[];
  endCard: string;
  bgm: string;
  evidenceRefs: string[];
  createdAt: string;
}

export interface ReviewIssue {
  category: "设定一致性" | "角色人设" | "平台适配" | "事实引用" | "表达";
  severity: "high" | "medium" | "low";
  location: string;
  detail: string;
  suggestion: string;
}

export interface Review {
  scores: {
    consistency: number;
    persona: number;
    hook: number;
    platformFit: number;
  };
  issues: ReviewIssue[];
  summary: string;
  passed: boolean;
}

interface DataCache {
  meta?: { demoNow: string; gameVersion: string; maxRevisionRounds: number };
  game?: GameConfig;
  platforms?: Record<Platform, PlatformRule>;
  lexicon?: { adLawWords: string[]; sensitiveWords: string[] };
  hotspots?: Hotspot[];
  presets?: {
    h10: {
      v2: Script;
      v2Review: Review;
    };
  };
}

const cache: DataCache = {};

function readJsonFile<T>(filename: string): T {
  const filePath = path.join(process.cwd(), "data", filename);
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

export function getMeta() {
  if (!cache.meta) {
    cache.meta = readJsonFile("meta.json");
  }
  return cache.meta;
}

export function getGame(): GameConfig {
  if (!cache.game) {
    cache.game = readJsonFile<GameConfig>("game.json");
  }
  return cache.game;
}

/**
 * 严格过滤：只允许保密等级为 public / internal 的设定卡进入模型上下文，
 * unreleased（未公开）设定卡绝不进入 prompt。
 */
export function getAllowedGameCards(): GameCard[] {
  return getGame().cards.filter(
    (card) =>
      card.confidentiality === "public" || card.confidentiality === "internal"
  );
}

export function getPlatforms(): Record<Platform, PlatformRule> {
  if (!cache.platforms) {
    cache.platforms = readJsonFile<Record<Platform, PlatformRule>>(
      "platforms.json"
    );
  }
  return cache.platforms;
}

export function getLexicon() {
  if (!cache.lexicon) {
    cache.lexicon = readJsonFile<{
      adLawWords: string[];
      sensitiveWords: string[];
    }>("lexicon.json");
  }
  return cache.lexicon;
}

export function getHotspots(): Hotspot[] {
  if (!cache.hotspots) {
    cache.hotspots = readJsonFile<Hotspot[]>("hotspots.json");
  }
  return cache.hotspots;
}

export function getHotspotById(id: string): Hotspot | undefined {
  return getHotspots().find((h) => h.id === id);
}

export function getPresets() {
  if (!cache.presets) {
    cache.presets = readJsonFile("presets.json");
  }
  return cache.presets!;
}

const VALID_CATEGORIES = new Set<ReviewIssue["category"]>([
  "设定一致性",
  "角色人设",
  "平台适配",
  "事实引用",
  "表达",
]);

const VALID_SEVERITIES = new Set<ReviewIssue["severity"]>([
  "high",
  "medium",
  "low",
]);

function clampScore(value: unknown, fallback = 3): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(5, Math.max(1, Math.round(num)));
}

export function normalizeScript(
  raw: unknown,
  defaults: {
    hotspotId: string;
    platform: Platform;
    version: number;
    source: Script["source"];
    fallbackEvidenceIds: string[];
  }
): Script {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const rawShots = Array.isArray(obj.shots) ? obj.shots : [];
  let cursor = 0;
  const shots: Shot[] = rawShots
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .map((item) => {
      const startNum = Number(item.start);
      const endNum = Number(item.end);
      const start = Number.isFinite(startNum) && startNum >= 0 ? startNum : cursor;
      const end =
        Number.isFinite(endNum) && endNum > start ? endNum : start + 8;
      cursor = end;

      const shot: Shot = {
        start,
        end,
        visual: typeof item.visual === "string" ? item.visual : "",
        line: typeof item.line === "string" ? item.line : "",
        subtitle: typeof item.subtitle === "string" ? item.subtitle : "",
      };
      if (typeof item.evidenceRef === "string" && item.evidenceRef.trim()) {
        shot.evidenceRef = item.evidenceRef.trim();
      }
      return shot;
    });

  const validRefs = Array.isArray(obj.evidenceRefs)
    ? obj.evidenceRefs
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
        .map((x) => x.trim())
    : [];

  const evidenceRefs =
    validRefs.length > 0 ? Array.from(new Set(validRefs)) : defaults.fallbackEvidenceIds;

  return {
    id:
      typeof obj.id === "string" && obj.id.trim()
        ? obj.id.trim()
        : `s-${defaults.hotspotId}-v${defaults.version}-${Date.now()}`,
    hotspotId: defaults.hotspotId,
    platform: defaults.platform,
    version: defaults.version,
    source: defaults.source,
    title: typeof obj.title === "string" ? obj.title.trim() : "未命名脚本",
    coverText: typeof obj.coverText === "string" ? obj.coverText.trim() : "",
    hook: typeof obj.hook === "string" ? obj.hook.trim() : "",
    shots,
    endCard: typeof obj.endCard === "string" ? obj.endCard.trim() : "",
    bgm: typeof obj.bgm === "string" ? obj.bgm.trim() : "轻快温暖背景音乐",
    evidenceRefs,
    createdAt: new Date().toISOString(),
  };
}

export function normalizeReview(raw: unknown): Review {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const rawScores =
    obj.scores && typeof obj.scores === "object"
      ? (obj.scores as Record<string, unknown>)
      : {};

  const rawIssues = Array.isArray(obj.issues) ? obj.issues : [];
  const issues: ReviewIssue[] = rawIssues
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .map((item) => {
      const cat =
        typeof item.category === "string" &&
        VALID_CATEGORIES.has(item.category as ReviewIssue["category"])
          ? (item.category as ReviewIssue["category"])
          : "表达";
      const sev =
        typeof item.severity === "string" &&
        VALID_SEVERITIES.has(item.severity as ReviewIssue["severity"])
          ? (item.severity as ReviewIssue["severity"])
          : "medium";
      return {
        category: cat,
        severity: sev,
        location: typeof item.location === "string" ? item.location : "整体",
        detail: typeof item.detail === "string" ? item.detail : "",
        suggestion: typeof item.suggestion === "string" ? item.suggestion : "",
      };
    });

  const hasHighIssue = issues.some((i) => i.severity === "high");
  const passed =
    typeof obj.passed === "boolean" ? obj.passed : !hasHighIssue;

  return {
    scores: {
      consistency: clampScore(rawScores.consistency, 4),
      persona: clampScore(rawScores.persona, 4),
      hook: clampScore(rawScores.hook, 4),
      platformFit: clampScore(rawScores.platformFit, 4),
    },
    issues,
    summary:
      typeof obj.summary === "string" && obj.summary.trim()
        ? obj.summary.trim()
        : passed
          ? "整体符合游戏设定与平台表达要求。"
          : "存在需要修订的问题，请按清单调整。",
    passed,
  };
}
