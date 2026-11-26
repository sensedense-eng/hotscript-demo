import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  Ban,
  Check,
  Clock,
  Copy,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import metaData from "@data/meta.json";
import platformsData from "@data/platforms.json";
import { calculateTotalScore } from "@/core/scoring";
import { getSelectDisabledReason } from "@/core/stateMachine";
import {
  formatRemainingWindow,
  formatRelativeTime,
  formatShortDateTime,
} from "@/core/time";
import { useHotscriptStore } from "@/store";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type {
  Hotspot,
  HotspotStatus,
  MetaConfig,
  Platform,
  PlatformsConfig,
  RiskLevel,
  ScoreDimension,
} from "@/types";

const meta = metaData as MetaConfig;
const platforms = platformsData as PlatformsConfig;

const SCORE_DIMENSIONS: ScoreDimension[] = [
  "relevance",
  "heat",
  "timeliness",
  "risk",
  "tone",
];

const PUBLISH_PLATFORMS: Platform[] = ["douyin", "bilibili", "xiaohongshu"];

const STATUS_BADGE: Record<HotspotStatus, { label: string; className: string }> =
  {
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

const LIFECYCLE_BADGE_CLASS =
  "bg-slate-50 text-slate-600 border-slate-200";

const RISK_META: Record<RiskLevel, { label: string; className: string }> = {
  low: {
    label: "低风险",
    className: "bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]/70",
  },
  medium: {
    label: "中风险",
    className: "bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]/80",
  },
  high: {
    label: "高风险",
    className: "bg-[#FFF1F2] text-[#E11D48] border-[#FECDD3]/80",
  },
};

function formatHeatValue(heat: number): string {
  if (heat >= 10000) {
    const wan = heat / 10000;
    return `${wan >= 100 ? Math.round(wan) : wan.toFixed(1)} 万`;
  }
  return heat.toLocaleString("zh-CN");
}

function formatAxisTime(iso: string): string {
  const match = iso.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : iso;
}

interface HotspotDetailSheetProps {
  hotspot: Hotspot | null;
  status: HotspotStatus | null;
  onClose: () => void;
}

export function HotspotDetailSheet({
  hotspot,
  status,
  onClose,
}: HotspotDetailSheetProps) {
  const navigate = useNavigate();
  const selectHotspot = useHotscriptStore((s) => s.selectHotspot);
  const dismissHotspot = useHotscriptStore((s) => s.dismissHotspot);

  const [selectedPlatform, setSelectedPlatform] = useState<Platform>("douyin");
  const [direction, setDirection] = useState<string>("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (hotspot) {
      setSelectedPlatform(hotspot.fit.suggestedPlatform);
      setDirection("");
      setCopiedId(null);
    }
  }, [hotspot]);

  const handleCopyHash = async (evidenceId: string, hash: string) => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopiedId(evidenceId);
      toast.success("已复制完整快照哈希");
      window.setTimeout(() => {
        setCopiedId((cur) => (cur === evidenceId ? null : cur));
      }, 1800);
    } catch {
      toast.error("复制失败，请手动复制");
    }
  };

  const handleConfirmSelect = () => {
    if (!hotspot || status !== "recommended") return;
    try {
      selectHotspot(hotspot.id, selectedPlatform, direction);
      toast.success(`已确认选题：${hotspot.title}`);
      onClose();
      navigate(`/topics/${hotspot.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "选题操作失败");
    }
  };

  const handleDismiss = () => {
    if (!hotspot || status !== "recommended") return;
    try {
      dismissHotspot(hotspot.id);
      toast.info(`已放弃热点：${hotspot.title}`);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败");
    }
  };

  if (!hotspot || !status) {
    return (
      <Sheet open={false} onOpenChange={() => {}}>
        <SheetContent className="w-[640px] sm:max-w-[640px]" />
      </Sheet>
    );
  }

  const totalScore = calculateTotalScore(
    hotspot.fit.dims,
    meta.scoring.weights
  );
  const statusInfo = STATUS_BADGE[status];
  const riskInfo = RISK_META[hotspot.risk.level];
  const disabledReason = getSelectDisabledReason(hotspot, status);
  const canSelect = status === "recommended";
  const remainingText =
    status === "blocked"
      ? "不跟进"
      : status === "expired"
        ? "已过期"
        : formatRemainingWindow(hotspot.windowEnd, meta.demoNow);

  const chartData = hotspot.heatCurve.map((pt) => ({
    time: formatAxisTime(pt.t),
    value: pt.v,
  }));

  return (
    <Sheet
      open={Boolean(hotspot)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="w-full max-w-[100vw] md:w-[640px] sm:max-w-[640px] p-0 gap-0 flex flex-col bg-white">
        {/* 1. 顶部：标题 + 状态 + 一句摘要 */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-slate-200 shrink-0 text-left space-y-2.5">
          <div className="flex items-center gap-2 flex-wrap pr-8">
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
                "text-[12px] font-normal px-2 py-0.5 rounded-md border",
                LIFECYCLE_BADGE_CLASS
              )}
            >
              {meta.lifecycleLabels[hotspot.lifecycle]}期
            </Badge>
            <span className="text-[13px] text-slate-500">
              {hotspot.category}
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1 text-[13px] text-slate-500 tabular-nums">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              {remainingText}
            </span>
          </div>
          <SheetTitle className="text-[19px] font-semibold tracking-tight text-slate-900 leading-snug">
            {hotspot.title}
          </SheetTitle>
          <SheetDescription className="text-[14px] text-slate-600 leading-relaxed">
            {hotspot.summary}
          </SheetDescription>
        </SheetHeader>

        {/* 中间可滚动详情区 */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* 2. 证据（核心） */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[16px] font-semibold text-slate-900">
                核验证据
              </h2>
              <div
                className={cn(
                  "inline-flex items-center gap-1.5 text-[13px] font-medium",
                  hotspot.verification.status === "verified"
                    ? "text-[#059669]"
                    : hotspot.verification.status === "pending"
                      ? "text-[#D97706]"
                      : "text-[#E11D48]"
                )}
              >
                {hotspot.verification.status === "verified" ? (
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                ) : hotspot.verification.status === "pending" ? (
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                ) : (
                  <Ban className="h-4 w-4 shrink-0" />
                )}
                <span>{hotspot.verification.conclusion}</span>
              </div>
            </div>

            <div className="space-y-3">
              {hotspot.evidence.map((ev) => {
                const isCopied = copiedId === ev.id;
                return (
                  <div
                    key={ev.id}
                    className="rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC]/70 p-4 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className="text-[12px] font-medium px-2 py-0 h-5 rounded-md bg-white text-slate-700 border-slate-200"
                        >
                          {meta.platformLabels[ev.platform]}
                        </Badge>
                        <span className="text-[13px] text-slate-600 tabular-nums">
                          {ev.rank !== null ? `热榜第 ${ev.rank} 名` : "资讯来源"}
                        </span>
                        {ev.heat !== null && (
                          <>
                            <span className="text-slate-300">·</span>
                            <span className="text-[13px] text-slate-600 tabular-nums">
                              热度 {formatHeatValue(ev.heat)}
                            </span>
                          </>
                        )}
                      </div>

                      <a
                        href={ev.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[13px] font-medium text-[#0F766E] hover:text-[#115E59] transition-colors"
                      >
                        <span>打开来源</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>

                    <p className="text-[14px] text-slate-800 leading-relaxed">
                      {ev.excerpt}
                    </p>

                    <div className="flex items-center justify-between gap-2 pt-1 text-[13px] text-slate-500 flex-wrap">
                      <span className="tabular-nums">
                        抓取于 {formatShortDateTime(ev.capturedAt)}（
                        {formatRelativeTime(ev.capturedAt, meta.demoNow)}）
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyHash(ev.id, ev.snapshotHash)}
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[13px] text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors"
                        title={`点击复制完整哈希：${ev.snapshotHash}`}
                      >
                        <span className="font-mono tabular-nums">
                          SHA {ev.snapshotHash.slice(0, 10)}
                        </span>
                        {isCopied ? (
                          <Check className="h-3.5 w-3.5 text-[#059669]" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 text-slate-400" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <Separator />

          {/* 3. 热度曲线 */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[16px] font-semibold text-slate-900">
                热度曲线
              </h2>
              <Badge
                variant="outline"
                className={cn(
                  "text-[12px] font-medium px-2 py-0.5 rounded-md border",
                  LIFECYCLE_BADGE_CLASS
                )}
              >
                当前阶段：{meta.lifecycleLabels[hotspot.lifecycle]}
              </Badge>
            </div>

            <div className="rounded-[12px] border border-[#E2E8F0] bg-white p-4">
              <div className="h-[168px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#E2E8F0"
                    />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 12, fill: "#64748B" }}
                      tickLine={false}
                      axisLine={{ stroke: "#E2E8F0" }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: "#64748B" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) =>
                        v >= 10000 ? `${Math.round(v / 10000)}万` : String(v)
                      }
                    />
                    <RechartsTooltip
                      formatter={(value: number) => [
                        formatHeatValue(value),
                        "热度值",
                      ]}
                      contentStyle={{
                        borderRadius: "8px",
                        borderColor: "#E2E8F0",
                        fontSize: "13px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#0F766E"
                      strokeWidth={2}
                      fill="#F0FDFA"
                      fillOpacity={1}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <Separator />

          {/* 4. 适配评估 */}
          <section className="space-y-4">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-[16px] font-semibold text-slate-900">
                适配评估
              </h2>
              <div className="flex items-baseline gap-1.5 tabular-nums">
                <span className="text-[24px] font-semibold text-slate-900 leading-none">
                  {totalScore}
                </span>
                <span className="text-[13px] text-slate-400">
                  / 100（推荐阈值 {meta.scoring.threshold}）
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {SCORE_DIMENSIONS.map((dim) => {
                const value = hotspot.fit.dims[dim];
                const weightPct = Math.round(meta.scoring.weights[dim] * 100);
                return (
                  <div key={dim} className="space-y-1">
                    <div className="flex items-center justify-between text-[13px]">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-800">
                          {meta.scoring.labels[dim]}
                        </span>
                        <span className="text-slate-400 tabular-nums">
                          权重 {weightPct}%
                        </span>
                      </div>
                      <span className="font-semibold text-slate-900 tabular-nums">
                        {value}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          value >= 60 ? "bg-[#0F766E]" : "bg-slate-400"
                        )}
                        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
                      />
                    </div>
                    <p className="text-[13px] text-slate-600">
                      {hotspot.fit.reasons[dim]}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-2.5">
              <div className="text-[13px] font-medium text-slate-700">
                综合推荐理由
              </div>
              <p className="text-[14px] text-slate-800 leading-relaxed">
                {hotspot.fit.recommendation}
              </p>

              {hotspot.fit.angles.length > 0 && (
                <div className="pt-1 space-y-1.5">
                  <div className="text-[13px] font-medium text-slate-700">
                    建议切入角度
                  </div>
                  <ul className="space-y-1 text-[14px] text-slate-700 list-disc pl-5">
                    {hotspot.fit.angles.map((angle, idx) => (
                      <li key={idx}>{angle}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>

          <Separator />

          {/* 5. 风险 */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[16px] font-semibold text-slate-900">
                风险评估
              </h2>
              <Badge
                variant="outline"
                className={cn(
                  "text-[12px] font-medium px-2 py-0.5 rounded-md border",
                  riskInfo.className
                )}
              >
                {riskInfo.label}
              </Badge>
            </div>
            <p className="text-[14px] text-slate-700 leading-relaxed rounded-[12px] border border-[#E2E8F0] bg-white px-4 py-3">
              {hotspot.risk.note}
            </p>
          </section>
        </div>

        {/* 6. 底部固定操作区（人工节点①） */}
        <div className="shrink-0 border-t border-slate-200 bg-[#F8FAFC] px-6 py-4">
          <div className="rounded-[12px] border border-[#0F766E] bg-white p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[15px] font-semibold text-[#0F766E]">
                需要你确认
              </span>
              <span className="text-[13px] text-slate-500">
                人工节点 ① · 选题确认
              </span>
            </div>

            {canSelect ? (
              <>
                <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2.5">
                  <span className="text-[13px] font-medium text-slate-700">
                    目标平台
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {PUBLISH_PLATFORMS.map((p) => {
                      const isSelected = selectedPlatform === p;
                      const isSuggested = hotspot.fit.suggestedPlatform === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setSelectedPlatform(p)}
                          className={cn(
                            "h-8 px-3 rounded-lg border text-[13px] font-medium transition-colors duration-150 inline-flex items-center gap-1.5",
                            isSelected
                              ? "bg-[#F0FDFA] border-[#0F766E] text-[#0F766E]"
                              : "bg-white border-[#E2E8F0] text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                          )}
                        >
                          <span>{platforms[p].name}</span>
                          {isSuggested && (
                            <span className="text-[12px] text-[#0F766E]/80">
                              推荐
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <label
                    htmlFor="hotspot-direction-input"
                    className="text-[13px] font-medium text-slate-700"
                  >
                    补充方向
                  </label>
                  <input
                    id="hotspot-direction-input"
                    type="text"
                    value={direction}
                    onChange={(e) => setDirection(e.target.value)}
                    placeholder="可选，例如指定出场角色、口吻或重点活动"
                    className="h-9 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 text-[14px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDismiss}
                    className="h-9 px-4 text-[14px] border-slate-200 text-slate-700 hover:bg-slate-50"
                  >
                    放弃
                  </Button>
                  <Button
                    type="button"
                    onClick={handleConfirmSelect}
                    className="h-9 px-4 text-[14px] bg-[#0F766E] hover:bg-[#115E59] text-white"
                  >
                    确认选题
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Button
                    type="button"
                    disabled
                    className="h-9 px-4 text-[14px] shrink-0 bg-slate-200 text-slate-500 cursor-not-allowed"
                  >
                    确认选题
                  </Button>
                  {disabledReason && (
                    <span className="text-[13px] text-slate-600 leading-snug">
                      {disabledReason}
                    </span>
                  )}
                </div>

                {status === "selected" && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      onClose();
                      navigate(`/topics/${hotspot.id}`);
                    }}
                    className="h-9 px-3.5 text-[13px] border-[#0F766E] text-[#0F766E] hover:bg-[#F0FDFA] shrink-0 gap-1.5"
                  >
                    <span>前往脚本审阅台</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
