import { describe, expect, it } from "vitest";
import gameData from "@data/game.json";
import hotspotsData from "@data/hotspots.json";
import lexiconData from "@data/lexicon.json";
import platformsData from "@data/platforms.json";
import presetsData from "@data/presets.json";
import { checkScriptRules } from "@/core/rules";
import { adaptPresetScriptForHotspot } from "@/lib/api";
import { getAllowedGameCards } from "../../../api/_lib/data";
import generateHandler from "../../../api/generate";
import healthHandler from "../../../api/health";
import type {
  GameConfig,
  Hotspot,
  LexiconConfig,
  PlatformsConfig,
  Script,
} from "@/types";

const game = gameData as GameConfig;
const hotspots = hotspotsData as Hotspot[];
const lexicon = lexiconData as LexiconConfig;
const platforms = platformsData as PlatformsConfig;

function createMockRes() {
  let statusCode = 0;
  let payload: unknown = null;
  const res = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(body: unknown) {
      payload = body;
      return res;
    },
  };
  return {
    res,
    getStatus: () => statusCode,
    getPayload: () => payload,
  };
}

describe("T4 服务器函数与前端回退适配", () => {
  it("getAllowedGameCards 严格过滤 unreleased 未公开设定卡", () => {
    const allowed = getAllowedGameCards();
    expect(allowed.length).toBeGreaterThan(0);
    expect(allowed.every((c) => c.confidentiality !== "unreleased")).toBe(true);
    expect(allowed.some((c) => c.id === "c09" || c.id === "c10")).toBe(false);
  });

  it("未配置 Key 时，/api/health 返回 ok:false，/api/generate 返回 fallback:true 且 HTTP 200", async () => {
    const savedProvider = process.env.LLM_PROVIDER;
    const savedKey = process.env.LLM_API_KEY;
    const savedModel = process.env.LLM_MODEL;

    delete process.env.LLM_PROVIDER;
    delete process.env.LLM_API_KEY;
    delete process.env.LLM_MODEL;

    try {
      const hMock = createMockRes();
      healthHandler({} as never, hMock.res as never);
      expect(hMock.getStatus()).toBe(200);
      expect(hMock.getPayload()).toEqual({
        ok: false,
        provider: null,
        model: null,
      });

      const gMock = createMockRes();
      await generateHandler(
        {
          method: "POST",
          headers: {},
          socket: { remoteAddress: "127.0.0.1" },
          body: { hotspotId: "h10", platform: "douyin" },
        } as never,
        gMock.res as never
      );
      expect(gMock.getStatus()).toBe(200);
      expect(gMock.getPayload()).toMatchObject({ fallback: true });
    } finally {
      if (savedProvider !== undefined) process.env.LLM_PROVIDER = savedProvider;
      if (savedKey !== undefined) process.env.LLM_API_KEY = savedKey;
      if (savedModel !== undefined) process.env.LLM_MODEL = savedModel;
    }
  });

  it("非 h10 双证据热点回退时正确映射 evidenceRefs 与 shot.evidenceRef，并通过全部规则含 R6", () => {
    const h02 = hotspots.find((h) => h.id === "h02")!;
    const v2 = presetsData.h10.v2 as Script;
    const adapted = adaptPresetScriptForHotspot(v2, h02, "xiaohongshu", 2);

    expect(adapted.hotspotId).toBe("h02");
    expect(adapted.platform).toBe("xiaohongshu");
    expect(adapted.source).toBe("preset");
    expect(adapted.evidenceRefs).toEqual(["h02-e1", "h02-e2"]);
    expect(adapted.shots[0].evidenceRef).toBe("h02-e1");
    expect(adapted.shots[2].evidenceRef).toBe("h02-e2");

    const results = checkScriptRules({
      script: adapted,
      hotspot: h02,
      platform: platforms.xiaohongshu,
      game,
      lexicon,
    });
    expect(results.every((r) => r.passed)).toBe(true);
  });

  it("单证据热点回退时所有证据引用全部映射到第 1 条证据且去重", () => {
    const h04 = hotspots.find((h) => h.id === "h04")!;
    const v2 = presetsData.h10.v2 as Script;
    const adapted = adaptPresetScriptForHotspot(v2, h04, "douyin", 2);

    expect(adapted.evidenceRefs).toEqual(["h04-e1"]);
    expect(adapted.shots[0].evidenceRef).toBe("h04-e1");
    expect(adapted.shots[2].evidenceRef).toBe("h04-e1");
  });
});
