import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import gameData from "@data/game.json";
import hotspotsData from "@data/hotspots.json";
import lexiconData from "@data/lexicon.json";
import metaData from "@data/meta.json";
import platformsData from "@data/platforms.json";
import presetsData from "@data/presets.json";
import { checkScriptRules } from "@/core/rules";
import {
  deriveInitialHotspotStatus,
  transitionHotspot,
  transitionScript,
} from "@/core/stateMachine";
import type {
  GameConfig,
  Hotspot,
  HotspotStatus,
  LexiconConfig,
  LogActor,
  LogEntry,
  MetaConfig,
  Platform,
  PlatformsConfig,
  Review,
  RevisionRecord,
  RuleResult,
  Script,
  ScriptStatus,
  TopicSession,
} from "@/types";

const meta = metaData as MetaConfig;
const game = gameData as GameConfig;
const platforms = platformsData as PlatformsConfig;
const lexicon = lexiconData as LexiconConfig;
const hotspots = hotspotsData as Hotspot[];

const STORE_KEY = "hotscript-demo-v1";

const memoryStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

function getSafeStorage(): StateStorage {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return memoryStorage;
}

function buildInitialHotspotStatuses(): Record<string, HotspotStatus> {
  const statuses: Record<string, HotspotStatus> = {};
  for (const hotspot of hotspots) {
    statuses[hotspot.id] = deriveInitialHotspotStatus(hotspot, meta, {
      applyInitialSelected: true,
    });
  }
  return statuses;
}

function buildInitialTopics(): Record<string, TopicSession> {
  const h01 = hotspots.find((h) => h.id === "h01");
  const finalScript = presetsData.h01.final as Script;
  const finalReview = presetsData.h01.finalReview as Review;

  if (!h01) {
    return {};
  }

  const ruleResults = checkScriptRules({
    script: finalScript,
    hotspot: h01,
    platform: platforms[finalScript.platform],
    game,
    lexicon,
  });

  return {
    h01: {
      hotspotId: "h01",
      platform: finalScript.platform,
      direction: "结合 2.2 版本「初雪庆典」限时菜谱「初雪热汤」，突出温暖治愈氛围",
      scriptStatus: "approved",
      versions: [finalScript],
      ruleResultsByVersion: {
        [finalScript.version]: ruleResults,
      },
      reviewsByVersion: {
        [finalScript.version]: finalReview,
      },
      revisions: [],
      unresolvedWarning: false,
      selectedAt: "2026-11-25T19:55:00+08:00",
      approvedAt: "2026-11-25T19:59:00+08:00",
    },
  };
}

function buildInitialLogs(): LogEntry[] {
  // 最新日志在前
  return [
    {
      id: "log-init-08",
      timestamp: "2026-11-25T19:59:00+08:00",
      actor: "运营·演示用户",
      action: "定稿确认",
      target: "h01 · 多地迎来今冬初雪",
      detail: "脚本 v2 规则检查（7/7）与模型评审全部通过，已确认定稿。",
    },
    {
      id: "log-init-07",
      timestamp: "2026-11-25T19:55:00+08:00",
      actor: "运营·演示用户",
      action: "确认选题",
      target: "h01 · 多地迎来今冬初雪",
      detail: "目标平台：抖音；方向：结合 2.2 版本「初雪庆典」限时菜谱「初雪热汤」。",
    },
    {
      id: "log-init-06",
      timestamp: "2026-11-25T19:54:00+08:00",
      actor: "系统",
      action: "状态流转 · 已过期",
      target: "h09 · 「早八人」冬天起床挑战",
      detail: "生命周期进入衰退期且超出时效窗口，自动标记为已过期。",
    },
    {
      id: "log-init-05",
      timestamp: "2026-11-25T19:53:30+08:00",
      actor: "系统",
      action: "核验待核实",
      target: "h04 · 网传某市将发放冬季消费券",
      detail: "仅采集到 1 个独立来源，未达到交叉核验门槛，暂禁止选题。",
    },
    {
      id: "log-init-04",
      timestamp: "2026-11-25T19:53:00+08:00",
      actor: "系统",
      action: "风险拦截",
      target: "h06 · 网传「猫咪下雪天会冬眠」",
      detail: "已被科普渠道证伪，判定为不实信息，自动拦截。",
    },
    {
      id: "log-init-03",
      timestamp: "2026-11-25T19:52:30+08:00",
      actor: "系统",
      action: "风险拦截",
      target: "h05 · 某地山体滑坡致道路中断",
      detail: "涉及自然灾害与公共安全，严禁商业借势，自动拦截。",
    },
    {
      id: "log-init-02",
      timestamp: "2026-11-25T19:52:00+08:00",
      actor: "系统",
      action: "交叉核验与适配评分",
      target: "今日热点批次（10 条）",
      detail: "完成多源交叉核验：已核验 7 条（其中 6 条达推荐阈值）、待核实 1 条、已拦截 2 条。",
    },
    {
      id: "log-init-01",
      timestamp: "2026-11-25T19:50:00+08:00",
      actor: "系统",
      action: "热点采集完成",
      target: "多平台热榜快照",
      detail: "从微博、抖音、B站、小红书及资讯源采集热点 10 条，已生成证据快照哈希。",
    },
  ];
}

export interface HotscriptState {
  hotspotStatuses: Record<string, HotspotStatus>;
  topics: Record<string, TopicSession>;
  logs: LogEntry[];

  selectHotspot: (
    hotspotId: string,
    platform: Platform,
    direction?: string
  ) => void;
  dismissHotspot: (hotspotId: string) => void;
  setScriptStatus: (
    hotspotId: string,
    nextStatus: ScriptStatus,
    options?: { unresolvedWarning?: boolean }
  ) => void;
  addScriptVersion: (
    hotspotId: string,
    script: Script,
    revision?: RevisionRecord
  ) => void;
  setVersionCheckResult: (
    hotspotId: string,
    version: number,
    ruleResults: RuleResult[],
    review?: Review
  ) => void;
  approveScript: (hotspotId: string) => void;
  returnScript: (hotspotId: string, humanNote: string) => void;
  appendLog: (entry: {
    actor: LogActor;
    action: string;
    target: string;
    detail: string;
    timestamp?: string;
  }) => void;
  resetDemo: () => void;
}

function getInitialData() {
  return {
    hotspotStatuses: buildInitialHotspotStatuses(),
    topics: buildInitialTopics(),
    logs: buildInitialLogs(),
  };
}

function createLogId(): string {
  return `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function getHotspotTargetLabel(hotspotId: string): string {
  const h = hotspots.find((item) => item.id === hotspotId);
  return h ? `${h.id} · ${h.title}` : hotspotId;
}

export const useHotscriptStore = create<HotscriptState>()(
  persist(
    (set, get) => ({
      ...getInitialData(),

      selectHotspot: (hotspotId, platform, direction = "") => {
        const current = get().hotspotStatuses[hotspotId];
        if (!current) {
          throw new Error(`未找到热点: ${hotspotId}`);
        }
        const next = transitionHotspot(current, "selected");
        const now = meta.demoNow;

        const newSession: TopicSession = {
          hotspotId,
          platform,
          direction: direction.trim(),
          scriptStatus: "idle",
          versions: [],
          ruleResultsByVersion: {},
          reviewsByVersion: {},
          revisions: [],
          unresolvedWarning: false,
          selectedAt: now,
        };

        const platformName = platforms[platform]?.name ?? platform;
        const detailParts = [`目标平台：${platformName}`];
        if (direction.trim()) {
          detailParts.push(`补充方向：${direction.trim()}`);
        }

        const logEntry: LogEntry = {
          id: createLogId(),
          timestamp: now,
          actor: "运营·演示用户",
          action: "确认选题",
          target: getHotspotTargetLabel(hotspotId),
          detail: detailParts.join("；"),
        };

        set((state) => ({
          hotspotStatuses: {
            ...state.hotspotStatuses,
            [hotspotId]: next,
          },
          topics: {
            ...state.topics,
            [hotspotId]: newSession,
          },
          logs: [logEntry, ...state.logs],
        }));
      },

      dismissHotspot: (hotspotId) => {
        const current = get().hotspotStatuses[hotspotId];
        if (!current) {
          throw new Error(`未找到热点: ${hotspotId}`);
        }
        const next = transitionHotspot(current, "dismissed");

        const logEntry: LogEntry = {
          id: createLogId(),
          timestamp: meta.demoNow,
          actor: "运营·演示用户",
          action: "放弃热点",
          target: getHotspotTargetLabel(hotspotId),
          detail: "运营主动放弃该热点选题。",
        };

        set((state) => ({
          hotspotStatuses: {
            ...state.hotspotStatuses,
            [hotspotId]: next,
          },
          logs: [logEntry, ...state.logs],
        }));
      },

      setScriptStatus: (hotspotId, nextStatus, options) => {
        const session = get().topics[hotspotId];
        if (!session) {
          throw new Error(`未找到选题会话: ${hotspotId}`);
        }
        const validated = transitionScript(session.scriptStatus, nextStatus);

        set((state) => ({
          topics: {
            ...state.topics,
            [hotspotId]: {
              ...state.topics[hotspotId],
              scriptStatus: validated,
              unresolvedWarning:
                options?.unresolvedWarning ??
                state.topics[hotspotId].unresolvedWarning,
              approvedAt:
                validated === "approved"
                  ? meta.demoNow
                  : state.topics[hotspotId].approvedAt,
            },
          },
        }));
      },

      addScriptVersion: (hotspotId, script, revision) => {
        const session = get().topics[hotspotId];
        if (!session) {
          throw new Error(`未找到选题会话: ${hotspotId}`);
        }

        set((state) => {
          const cur = state.topics[hotspotId];
          const existingIdx = cur.versions.findIndex(
            (v) => v.version === script.version
          );
          const nextVersions =
            existingIdx >= 0
              ? cur.versions.map((v, i) => (i === existingIdx ? script : v))
              : [...cur.versions, script];

          return {
            topics: {
              ...state.topics,
              [hotspotId]: {
                ...cur,
                versions: nextVersions,
                revisions: revision
                  ? [...cur.revisions, revision]
                  : cur.revisions,
              },
            },
          };
        });
      },

      setVersionCheckResult: (hotspotId, version, ruleResults, review) => {
        const session = get().topics[hotspotId];
        if (!session) {
          throw new Error(`未找到选题会话: ${hotspotId}`);
        }

        set((state) => {
          const cur = state.topics[hotspotId];
          return {
            topics: {
              ...state.topics,
              [hotspotId]: {
                ...cur,
                ruleResultsByVersion: {
                  ...cur.ruleResultsByVersion,
                  [version]: ruleResults,
                },
                reviewsByVersion: review
                  ? {
                      ...cur.reviewsByVersion,
                      [version]: review,
                    }
                  : cur.reviewsByVersion,
              },
            },
          };
        });
      },

      approveScript: (hotspotId) => {
        const session = get().topics[hotspotId];
        if (!session) {
          throw new Error(`未找到选题会话: ${hotspotId}`);
        }
        const validated = transitionScript(session.scriptStatus, "approved");
        const latestVersion =
          session.versions[session.versions.length - 1]?.version ?? 1;

        const logEntry: LogEntry = {
          id: createLogId(),
          timestamp: meta.demoNow,
          actor: "运营·演示用户",
          action: "定稿确认",
          target: getHotspotTargetLabel(hotspotId),
          detail: `确认脚本 v${latestVersion} 定稿，可导出交付。`,
        };

        set((state) => ({
          topics: {
            ...state.topics,
            [hotspotId]: {
              ...state.topics[hotspotId],
              scriptStatus: validated,
              approvedAt: meta.demoNow,
            },
          },
          logs: [logEntry, ...state.logs],
        }));
      },

      returnScript: (hotspotId, humanNote) => {
        const session = get().topics[hotspotId];
        if (!session) {
          throw new Error(`未找到选题会话: ${hotspotId}`);
        }
        const validated = transitionScript(session.scriptStatus, "returned");

        const logEntry: LogEntry = {
          id: createLogId(),
          timestamp: meta.demoNow,
          actor: "运营·演示用户",
          action: "退回修改",
          target: getHotspotTargetLabel(hotspotId),
          detail: `退回意见：${humanNote.trim()}`,
        };

        set((state) => ({
          topics: {
            ...state.topics,
            [hotspotId]: {
              ...state.topics[hotspotId],
              scriptStatus: validated,
            },
          },
          logs: [logEntry, ...state.logs],
        }));
      },

      appendLog: (entry) => {
        const logEntry: LogEntry = {
          id: createLogId(),
          timestamp: entry.timestamp ?? meta.demoNow,
          actor: entry.actor,
          action: entry.action,
          target: entry.target,
          detail: entry.detail,
        };
        set((state) => ({
          logs: [logEntry, ...state.logs],
        }));
      },

      resetDemo: () => {
        if (typeof window !== "undefined" && window.localStorage) {
          window.localStorage.removeItem(STORE_KEY);
        }
        set(getInitialData());
      },
    }),
    {
      name: STORE_KEY,
      storage: createJSONStorage(getSafeStorage),
      partialize: (state) => ({
        hotspotStatuses: state.hotspotStatuses,
        topics: state.topics,
        logs: state.logs,
      }),
    }
  )
);
