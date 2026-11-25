import { describe, expect, it } from "vitest";
import hotspotsData from "@data/hotspots.json";
import metaData from "@data/meta.json";
import { calculateTotalScore } from "@/core/scoring";
import {
  deriveInitialHotspotStatus,
  transitionHotspot,
  transitionScript,
} from "@/core/stateMachine";
import { formatDemoClock, formatRemainingWindow, formatRelativeTime } from "@/core/time";
import { useHotscriptStore } from "@/store";
import type { Hotspot, MetaConfig } from "@/types";

const hotspots = hotspotsData as Hotspot[];
const meta = metaData as MetaConfig;

describe("状态机与初始数据分布", () => {
  it("10 条热点初始状态分布：可选题 5、待核实 1、已拦截 2、已过期 1、已选题 1（h01）", () => {
    const counts: Record<string, number> = {};
    for (const h of hotspots) {
      const status = deriveInitialHotspotStatus(h, meta, {
        applyInitialSelected: true,
      });
      counts[status] = (counts[status] ?? 0) + 1;
    }

    expect(hotspots.length).toBe(10);
    expect(counts.recommended).toBe(5);
    expect(counts.pending).toBe(1);
    expect(counts.blocked).toBe(2);
    expect(counts.expired).toBe(1);
    expect(counts.selected).toBe(1);

    const h01 = hotspots.find((h) => h.id === "h01")!;
    expect(deriveInitialHotspotStatus(h01, meta)).toBe("selected");
  });

  it("热点状态机：合法流转通过，非法流转抛错", () => {
    expect(transitionHotspot("recommended", "selected")).toBe("selected");
    expect(transitionHotspot("recommended", "dismissed")).toBe("dismissed");

    // 非法流转用例 1：待核实不可直接选题
    expect(() => transitionHotspot("pending", "selected")).toThrow();
    // 非法流转用例 2：已拦截不可直接选题
    expect(() => transitionHotspot("blocked", "selected")).toThrow();
    // 非法流转用例 3：已过期不可直接选题
    expect(() => transitionHotspot("expired", "selected")).toThrow();
  });

  it("脚本状态机：合法流转通过，非法流转抛错", () => {
    expect(transitionScript("idle", "generating")).toBe("generating");
    expect(transitionScript("generating", "checking")).toBe("checking");
    expect(transitionScript("checking", "revising")).toBe("revising");
    expect(transitionScript("checking", "pending_final")).toBe("pending_final");
    expect(transitionScript("pending_final", "approved")).toBe("approved");
    expect(transitionScript("pending_final", "returned")).toBe("returned");
    expect(transitionScript("returned", "revising")).toBe("revising");

    // 非法流转用例 4：生成中不可直接定稿
    expect(() => transitionScript("generating", "approved")).toThrow();
    // 非法流转用例 5：已定稿不可退回
    expect(() => transitionScript("approved", "returned")).toThrow();
  });

  it("加权总分计算准确（四舍五入整数）", () => {
    const h01 = hotspots.find((h) => h.id === "h01")!;
    const h10 = hotspots.find((h) => h.id === "h10")!;
    expect(calculateTotalScore(h01.fit.dims, meta.scoring.weights)).toBe(90);
    expect(calculateTotalScore(h10.fit.dims, meta.scoring.weights)).toBe(88);
  });

  it("基于 meta.demoNow 的时间格式化准确", () => {
    expect(formatDemoClock(meta.demoNow)).toBe("演示时间 11月25日 20:00");
    expect(formatRelativeTime("2026-11-25T18:00:00+08:00", meta.demoNow)).toBe(
      "2 小时前"
    );
    expect(
      formatRemainingWindow("2026-11-26T14:00:00+08:00", meta.demoNow)
    ).toBe("剩余 18 小时");
    expect(
      formatRemainingWindow("2026-11-25T12:00:00+08:00", meta.demoNow)
    ).toBe("已过期");
  });

  it("store 初始化正确载入 h01 已定稿与系统日志，且 resetDemo 可恢复", () => {
    useHotscriptStore.getState().resetDemo();
    const state = useHotscriptStore.getState();

    expect(state.hotspotStatuses.h01).toBe("selected");
    expect(state.topics.h01?.scriptStatus).toBe("approved");
    expect(state.topics.h01?.versions).toHaveLength(1);
    expect(state.logs.length).toBeGreaterThanOrEqual(6);

    // 选题 h10 后，resetDemo 应恢复为 recommended
    state.selectHotspot("h10", "douyin", "测试方向");
    expect(useHotscriptStore.getState().hotspotStatuses.h10).toBe("selected");

    useHotscriptStore.getState().resetDemo();
    expect(useHotscriptStore.getState().hotspotStatuses.h10).toBe("recommended");
    expect(useHotscriptStore.getState().topics.h10).toBeUndefined();
  });
});
