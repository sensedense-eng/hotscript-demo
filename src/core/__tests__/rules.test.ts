import { describe, expect, it } from "vitest";
import gameData from "@data/game.json";
import hotspotsData from "@data/hotspots.json";
import lexiconData from "@data/lexicon.json";
import platformsData from "@data/platforms.json";
import presetsData from "@data/presets.json";
import { checkScriptRules } from "@/core/rules";
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

function getHotspot(id: string): Hotspot {
  const found = hotspots.find((h) => h.id === id);
  if (!found) throw new Error(`Missing hotspot ${id}`);
  return found;
}

describe("规则引擎 checkScriptRules (R1-R7)", () => {
  it("presets.h10.v1 必须在 R1、R3、R4、R7 失败，其余通过", () => {
    const script = presetsData.h10.v1 as Script;
    const results = checkScriptRules({
      script,
      hotspot: getHotspot("h10"),
      platform: platforms[script.platform],
      game,
      lexicon,
    });

    const failedIds = results.filter((r) => !r.passed).map((r) => r.id);
    expect(failedIds).toEqual(["R1", "R3", "R4", "R7"]);

    const r3 = results.find((r) => r.id === "R3");
    expect(r3?.hits).toContain("最治愈");

    const r4 = results.find((r) => r.id === "R4");
    expect(r4?.hits).toContain("适龄提示：12+");
    expect(r4?.hits).toContain("抵制不良游戏，拒绝盗版游戏");

    const r7 = results.find((r) => r.id === "R7");
    expect(r7?.hits.length).toBeGreaterThan(0);
  });

  it("presets.h10.v2 全部通过", () => {
    const script = presetsData.h10.v2 as Script;
    const results = checkScriptRules({
      script,
      hotspot: getHotspot("h10"),
      platform: platforms[script.platform],
      game,
      lexicon,
    });

    const failedIds = results.filter((r) => !r.passed).map((r) => r.id);
    expect(failedIds).toEqual([]);
  });

  it("presets.h08.v1 必须在 R5 失败，其余通过", () => {
    const script = presetsData.h08.v1 as Script;
    const results = checkScriptRules({
      script,
      hotspot: getHotspot("h08"),
      platform: platforms[script.platform],
      game,
      lexicon,
    });

    const failedIds = results.filter((r) => !r.passed).map((r) => r.id);
    expect(failedIds).toEqual(["R5"]);

    const r5 = results.find((r) => r.id === "R5");
    expect(r5?.hits).toContain("冬至灯会");
    expect(r5?.hits).toContain("灯娘");
  });

  it("presets.h01.final 全部通过", () => {
    const script = presetsData.h01.final as Script;
    const results = checkScriptRules({
      script,
      hotspot: getHotspot("h01"),
      platform: platforms[script.platform],
      game,
      lexicon,
    });

    const failedIds = results.filter((r) => !r.passed).map((r) => r.id);
    expect(failedIds).toEqual([]);
  });
});
