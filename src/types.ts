export type Platform = "douyin" | "bilibili" | "xiaohongshu";

export type SourcePlatform =
  | "weibo"
  | "douyin"
  | "bilibili"
  | "xiaohongshu"
  | "news"
  | "official";

export type LifecycleStage = "emerging" | "rising" | "peak" | "declining";

export type VerificationStatus = "verified" | "pending" | "blocked";

export type RiskLevel = "low" | "medium" | "high";

export type HotspotStatus =
  | "collected"
  | "verified"
  | "pending"
  | "blocked"
  | "recommended"
  | "selected"
  | "dismissed"
  | "expired";

export type ScriptStatus =
  | "idle"
  | "generating"
  | "checking"
  | "revising"
  | "pending_final"
  | "approved"
  | "returned";

export type Confidentiality = "public" | "internal" | "unreleased";

export type ScoreDimension =
  | "relevance"
  | "heat"
  | "timeliness"
  | "risk"
  | "tone";

export interface MetaConfig {
  demoNow: string;
  gameVersion: string;
  maxRevisionRounds: number;
  initialSelected: string[];
  scoring: {
    threshold: number;
    weights: Record<ScoreDimension, number>;
    labels: Record<ScoreDimension, string>;
  };
  lifecycleLabels: Record<LifecycleStage, string>;
  platformLabels: Record<SourcePlatform, string>;
}

export interface GameCard {
  id: string;
  type: string;
  name: string;
  summary: string;
  source: string;
  effectiveVersion: string;
  confidentiality: Confidentiality;
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
  durationSec: {
    min: number;
    max: number;
  };
  titleMaxChars: number;
  coverMaxChars: number;
  aspect: string;
  requiredNotices: string[];
  style: string;
}

export type PlatformsConfig = Record<Platform, PlatformRule>;

export interface LexiconConfig {
  adLawWords: string[];
  sensitiveWords: string[];
}

export interface HeatPoint {
  t: string;
  v: number;
}

export interface Evidence {
  id: string;
  platform: SourcePlatform;
  rank: number | null;
  heat: number | null;
  capturedAt: string;
  url: string;
  snapshotHash: string;
  excerpt: string;
}

export interface HotspotVerification {
  status: VerificationStatus;
  sources: number;
  conclusion: string;
}

export interface HotspotRisk {
  level: RiskLevel;
  note: string;
}

export interface HotspotFit {
  dims: Record<ScoreDimension, number>;
  reasons: Record<ScoreDimension, string>;
  recommendation: string;
  angles: string[];
  suggestedPlatform: Platform;
}

export interface Hotspot {
  id: string;
  title: string;
  summary: string;
  category: string;
  platforms: SourcePlatform[];
  firstSeenAt: string;
  lifecycle: LifecycleStage;
  windowEnd: string;
  heatCurve: HeatPoint[];
  evidence: Evidence[];
  verification: HotspotVerification;
  risk: HotspotRisk;
  fit: HotspotFit;
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
  sourceLabel?: string;
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

export interface RuleResult {
  id: "R1" | "R2" | "R3" | "R4" | "R5" | "R6" | "R7";
  name: string;
  passed: boolean;
  hits: string[];
  message: string;
}

export interface RevisionRecord {
  round: number;
  version: number;
  source: Script["source"];
  changes: string[];
  humanNote?: string;
  createdAt: string;
}

export interface TopicSession {
  hotspotId: string;
  platform: Platform;
  direction: string;
  scriptStatus: ScriptStatus;
  versions: Script[];
  ruleResultsByVersion: Record<number, RuleResult[]>;
  reviewsByVersion: Record<number, Review>;
  revisions: RevisionRecord[];
  unresolvedWarning: boolean;
  selectedAt: string;
  approvedAt?: string;
}

export type LogActor = "运营·演示用户" | "系统" | "模型";

export interface LogEntry {
  id: string;
  timestamp: string;
  actor: LogActor;
  action: string;
  target: string;
  detail: string;
}
