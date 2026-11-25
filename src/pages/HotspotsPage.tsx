import { useMemo, useState } from "react";
import {
  ChevronRight,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Ban,
  X,
} from "lucide-react";
import hotspotsData from "@data/hotspots.json";
import metaData from "@data/meta.json";
import { calculateTotalScore } from "@/core/scoring";
import { formatRemainingWindow } from "@/core/time";
import { useHotscriptStore } from "@/store";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HeatSparkline } from "@/components/HeatSparkline";
import { HotspotDetailSheet } from "@/components/HotspotDetailSheet";
import type {
  Hotspot,
  HotspotStatus,
  LifecycleStage,
  MetaConfig,
  SourcePlatform,
} from "@/types";

const hotspots = hotspotsData as Hotspot[];
const meta = metaData as MetaConfig;

type FilterTab = "all" | "recommended" | "pending" | "blocked" | "expired";

const STATUS_PRIORITY: Record<HotspotStatus, number> = {
  recommended: 0,
  selected: 1,
  verified: 2,
  pending: 3,
  blocked: 4,
  expired: 5,
  dismissed: 6,
  collected: 7,
};

const STATUS_META: Record<
  HotspotStatus,
  { label: string; className: string }
> = {
  recommended: {
    label: "可选题",
    className: "bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]/70",
  },
  selected: {
    label: "已选题",
    className: "bg-[#F0FDFA] text-[#0F766E] border-[#99F6E4]/80",
  },
  verified: {
    label: "已核验",
    className: "bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]/70",
  },
  pending: {
    label: "待核实",
    className: "bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]/80",
  },
  blocked: {
    label: "已拦截",
    className: "bg-[#FFF1F2] text-[#E11D48] border-[#FECDD3]/80",
  },
  expired: {
    label: "已过期",
    className: "bg-[#F1F5F9] text-[#64748B] border-slate-200",
  },
  dismissed: {
    label: "已放弃",
    className: "bg-[#F1F5F9] text-[#64748B] border-slate-200",
  },
  collected: {
    label: "已采集",
    className: "bg-[#F1F5F9] text-[#64748B] border-slate-200",
  },
};

const LIFECYCLE_STYLE: Record<LifecycleStage, string> = {
  emerging: "bg-slate-50 text-slate-600 border-slate-200",
  rising: "bg-[#F0FDFA] text-[#0F766E] border-[#99F6E4]/70",
  peak: "bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]/70",
  declining: "bg-[#F1F5F9] text-[#64748B] border-slate-200",
};

const PLATFORM_FILTER_OPTIONS: SourcePlatform[] = [
  "weibo",
  "douyin",
  "bilibili",
  "xiaohongshu",
  "news",
  "official",
];

interface EnrichedHotspot {
  hotspot: Hotspot;
  status: HotspotStatus;
  score: number;
  remainingText: string;
}

export function HotspotsPage() {
  const hotspotStatuses = useHotscriptStore((s) => s.hotspotStatuses);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [selectedPlatforms, setSelectedPlatforms] = useState<SourcePlatform[]>(
    []
  );
  const [activeHotspotId, setActiveHotspotId] = useState<string | null>(null);

  const enrichedList = useMemo<EnrichedHotspot[]>(() => {
    return hotspots
      .map((hotspot) => {
        const status = hotspotStatuses[hotspot.id] ?? "collected";
        const score = calculateTotalScore(
          hotspot.fit.dims,
          meta.scoring.weights
        );
        const remainingText =
          status === "expired"
            ? "已过期"
            : formatRemainingWindow(hotspot.windowEnd, meta.demoNow);
        return { hotspot, status, score, remainingText };
      })
      .sort((a, b) => {
        const pDiff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
        if (pDiff !== 0) return pDiff;
        return b.score - a.score;
      });
  }, [hotspotStatuses]);

  const stats = useMemo(() => {
    const total = enrichedList.length;
    const verified = enrichedList.filter(
      (item) => item.hotspot.verification.status === "verified"
    ).length;
    const recommended = enrichedList.filter(
      (item) => item.status === "recommended"
    ).length;
    const blockedOrPending = enrichedList.filter(
      (item) => item.status === "blocked" || item.status === "pending"
    ).length;
    const pending = enrichedList.filter(
      (item) => item.status === "pending"
    ).length;
    const blocked = enrichedList.filter(
      (item) => item.status === "blocked"
    ).length;
    const expired = enrichedList.filter(
      (item) => item.status === "expired"
    ).length;

    return {
      total,
      verified,
      recommended,
      blockedOrPending,
      pending,
      blocked,
      expired,
    };
  }, [enrichedList]);

  const filteredList = useMemo(() => {
    return enrichedList.filter((item) => {
      if (activeTab !== "all" && item.status !== activeTab) {
        return false;
      }
      if (selectedPlatforms.length > 0) {
        const hasMatch = item.hotspot.platforms.some((p) =>
          selectedPlatforms.includes(p)
        );
        if (!hasMatch) return false;
      }
      return true;
    });
  }, [enrichedList, activeTab, selectedPlatforms]);

  const togglePlatform = (platform: SourcePlatform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  };

  const activeItem = useMemo(
    () =>
      enrichedList.find((item) => item.hotspot.id === activeHotspotId) ?? null,
    [enrichedList, activeHotspotId]
  );

  return (
    <div className="space-y-6">
      {/* 页面标题区 */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-slate-900 leading-tight">
            热点工作台
          </h1>
          <p className="mt-1 text-[13px] text-slate-500">
            多源证据核验与游戏适配评估，辅助快速决策选题
          </p>
        </div>
      </div>

      {/* 顶部 4 个统计卡 */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="rounded-[12px] border border-[#E2E8F0] bg-white px-5 py-4 shadow-sm">
          <div className="text-[13px] font-medium text-slate-500">今日热点</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[28px] font-semibold tracking-tight text-slate-900 tabular-nums leading-none">
              {stats.total}
            </span>
            <span className="text-[13px] text-slate-400">条</span>
          </div>
        </Card>

        <Card className="rounded-[12px] border border-[#E2E8F0] bg-white px-5 py-4 shadow-sm">
          <div className="text-[13px] font-medium text-slate-500">已核验</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[28px] font-semibold tracking-tight text-[#059669] tabular-nums leading-none">
              {stats.verified}
            </span>
            <span className="text-[13px] text-slate-400">多源交叉通过</span>
          </div>
        </Card>

        <Card className="rounded-[12px] border border-[#E2E8F0] bg-white px-5 py-4 shadow-sm">
          <div className="text-[13px] font-medium text-slate-500">可选题</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[28px] font-semibold tracking-tight text-[#0F766E] tabular-nums leading-none">
              {stats.recommended}
            </span>
            <span className="text-[13px] text-slate-400">
              适配分 ≥ {meta.scoring.threshold}
            </span>
          </div>
        </Card>

        <Card className="rounded-[12px] border border-[#E2E8F0] bg-white px-5 py-4 shadow-sm">
          <div className="text-[13px] font-medium text-slate-500">
            已拦截 / 待核实
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[28px] font-semibold tracking-tight text-[#E11D48] tabular-nums leading-none">
              {stats.blockedOrPending}
            </span>
            <span className="text-[13px] text-slate-400 tabular-nums">
              拦截 {stats.blocked} · 待核实 {stats.pending}
            </span>
          </div>
        </Card>
      </div>

      {/* 筛选栏：状态 Tabs + 平台多选 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as FilterTab)}
        >
          <TabsList className="bg-white border border-[#E2E8F0] p-1 h-10 rounded-[10px]">
            <TabsTrigger
              value="all"
              className="text-[13px] px-3 data-[state=active]:bg-[#F0FDFA] data-[state=active]:text-[#0F766E] data-[state=active]:shadow-none rounded-[7px]"
            >
              全部
              <span className="ml-1.5 tabular-nums text-slate-400">
                {stats.total}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="recommended"
              className="text-[13px] px-3 data-[state=active]:bg-[#F0FDFA] data-[state=active]:text-[#0F766E] data-[state=active]:shadow-none rounded-[7px]"
            >
              可选题
              <span className="ml-1.5 tabular-nums text-slate-400">
                {stats.recommended}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="pending"
              className="text-[13px] px-3 data-[state=active]:bg-[#F0FDFA] data-[state=active]:text-[#0F766E] data-[state=active]:shadow-none rounded-[7px]"
            >
              待核实
              <span className="ml-1.5 tabular-nums text-slate-400">
                {stats.pending}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="blocked"
              className="text-[13px] px-3 data-[state=active]:bg-[#F0FDFA] data-[state=active]:text-[#0F766E] data-[state=active]:shadow-none rounded-[7px]"
            >
              已拦截
              <span className="ml-1.5 tabular-nums text-slate-400">
                {stats.blocked}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="expired"
              className="text-[13px] px-3 data-[state=active]:bg-[#F0FDFA] data-[state=active]:text-[#0F766E] data-[state=active]:shadow-none rounded-[7px]"
            >
              已过期
              <span className="ml-1.5 tabular-nums text-slate-400">
                {stats.expired}
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* 平台多选 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[13px] text-slate-500 mr-1">来源平台</span>
          {PLATFORM_FILTER_OPTIONS.map((platform) => {
            const active = selectedPlatforms.includes(platform);
            return (
              <button
                key={platform}
                type="button"
                onClick={() => togglePlatform(platform)}
                className={cn(
                  "h-8 px-2.5 rounded-lg border text-[13px] font-medium transition-colors duration-150",
                  active
                    ? "bg-[#F0FDFA] border-[#0F766E] text-[#0F766E]"
                    : "bg-white border-[#E2E8F0] text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                {meta.platformLabels[platform]}
              </button>
            );
          })}
          {selectedPlatforms.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedPlatforms([])}
              className="h-8 px-2 rounded-lg text-[13px] text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              清空
            </button>
          )}
        </div>
      </div>

      {/* 热点列表卡片容器 */}
      <div className="rounded-[12px] border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
        {/* 表头 */}
        <div className="grid grid-cols-[minmax(260px,1fr)_140px_132px_120px_112px_20px] items-center gap-4 px-5 py-3 bg-slate-50/80 border-b border-[#E2E8F0] text-[13px] font-medium text-slate-500">
          <div>热点事件与来源平台</div>
          <div>核验状态 / 阶段</div>
          <div>证据与时效</div>
          <div>热度趋势</div>
          <div>适配总分</div>
          <div />
        </div>

        {/* 列表行 */}
        {filteredList.length === 0 ? (
          <div className="py-14 text-center text-[14px] text-slate-500">
            当前筛选条件下暂无热点事件
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredList.map(({ hotspot, status, score, remainingText }) => {
              const statusInfo = STATUS_META[status];
              const isMuted =
                status === "blocked" ||
                status === "expired" ||
                status === "dismissed";

              return (
                <div
                  key={hotspot.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveHotspotId(hotspot.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setActiveHotspotId(hotspot.id);
                    }
                  }}
                  className={cn(
                    "grid grid-cols-[minmax(260px,1fr)_140px_132px_120px_112px_20px] items-center gap-4 px-5 py-4 min-h-[82px] cursor-pointer transition-colors duration-150 hover:bg-slate-50/90 focus:outline-none focus-visible:bg-[#F0FDFA]/50",
                    isMuted && "opacity-80"
                  )}
                >
                  {/* 标题 + 关联平台徽标 */}
                  <div className="min-w-0 space-y-2">
                    <div className="text-[16px] font-medium text-slate-900 truncate">
                      {hotspot.title}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {hotspot.platforms.map((p) => (
                        <Badge
                          key={p}
                          variant="outline"
                          className="text-[12px] font-normal px-2 py-0 h-5 rounded-md bg-slate-50 text-slate-600 border-slate-200"
                        >
                          {meta.platformLabels[p]}
                        </Badge>
                      ))}
                      <span className="text-[13px] text-slate-400 ml-1">
                        {hotspot.category}
                      </span>
                    </div>
                  </div>

                  {/* 核验状态 + 生命周期 */}
                  <div className="flex flex-col items-start gap-1.5">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[12px] font-medium px-2 py-0.5 rounded-md border",
                        statusInfo.className
                      )}
                    >
                      {statusInfo.label}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[12px] font-normal px-2 py-0 h-5 rounded-md border",
                        LIFECYCLE_STYLE[hotspot.lifecycle]
                      )}
                    >
                      {meta.lifecycleLabels[hotspot.lifecycle]}
                    </Badge>
                  </div>

                  {/* 证据数 + 时效窗口 */}
                  <div className="space-y-1.5 text-[13px] tabular-nums">
                    <div className="flex items-center gap-1.5 text-slate-700">
                      {hotspot.verification.status === "verified" ? (
                        <ShieldCheck className="h-3.5 w-3.5 text-[#059669] shrink-0" />
                      ) : hotspot.verification.status === "pending" ? (
                        <ShieldAlert className="h-3.5 w-3.5 text-[#D97706] shrink-0" />
                      ) : (
                        <Ban className="h-3.5 w-3.5 text-[#E11D48] shrink-0" />
                      )}
                      <span>{hotspot.evidence.length} 个来源</span>
                    </div>
                    <div
                      className={cn(
                        "flex items-center gap-1.5",
                        remainingText === "已过期"
                          ? "text-slate-400"
                          : "text-slate-500"
                      )}
                    >
                      <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span>{remainingText}</span>
                    </div>
                  </div>

                  {/* 迷你热度曲线 */}
                  <div className="flex items-center">
                    <HeatSparkline
                      data={hotspot.heatCurve}
                      id={hotspot.id}
                      muted={isMuted}
                    />
                  </div>

                  {/* 适配总分 + 细进度条 */}
                  <div className="space-y-1.5">
                    <div className="flex items-baseline justify-between">
                      <span
                        className={cn(
                          "text-[22px] font-semibold tracking-tight tabular-nums leading-none",
                          isMuted
                            ? "text-slate-400"
                            : score >= meta.scoring.threshold
                              ? "text-slate-900"
                              : "text-slate-600"
                        )}
                      >
                        {score}
                      </span>
                      <span className="text-[13px] text-slate-400 tabular-nums">
                        / 100
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-200",
                          isMuted
                            ? "bg-slate-300"
                            : score >= meta.scoring.threshold
                              ? "bg-[#0F766E]"
                              : "bg-slate-400"
                        )}
                        style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                      />
                    </div>
                  </div>

                  {/* 详情指示箭头 */}
                  <div className="flex justify-end text-slate-400">
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 右侧热点详情抽屉 */}
      <HotspotDetailSheet
        hotspot={activeItem?.hotspot ?? null}
        status={activeItem?.status ?? null}
        onClose={() => setActiveHotspotId(null)}
      />
    </div>
  );
}
