import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Download,
  HelpCircle,
  History,
  Loader2,
  Music,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import hotspotsData from "@data/hotspots.json";
import metaData from "@data/meta.json";
import platformsData from "@data/platforms.json";
import {
  buildScriptMarkdown,
  createCompletedPipelineSteps,
  INITIAL_PIPELINE_STEPS,
  runGenerationPipeline,
  runHumanReturnRevision,
  type PipelineProgress,
  type PipelineStepState,
} from "@/core/pipeline";
import { useHotscriptStore } from "@/store";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  Hotspot,
  MetaConfig,
  PlatformsConfig,
  ReviewIssue,
  Script,
  ScriptStatus,
} from "@/types";

const hotspots = hotspotsData as Hotspot[];
const meta = metaData as MetaConfig;
const platforms = platformsData as PlatformsConfig;

const SCRIPT_STATUS_BADGE: Record<
  ScriptStatus,
  { label: string; className: string }
> = {
  idle: {
    label: "待生成",
    className: "bg-slate-100 text-slate-600 border-slate-200",
  },
  generating: {
    label: "生成中",
    className: "bg-[#F0FDFA] text-[#0F766E] border-[#99F6E4]/80",
  },
  checking: {
    label: "检查中",
    className: "bg-[#F0FDFA] text-[#0F766E] border-[#99F6E4]/80",
  },
  revising: {
    label: "修订中",
    className: "bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]/80",
  },
  pending_final: {
    label: "待终审",
    className: "bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]/80",
  },
  approved: {
    label: "已定稿",
    className: "bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]/80",
  },
  returned: {
    label: "已退回",
    className: "bg-[#FFF1F2] text-[#E11D48] border-[#FECDD3]/80",
  },
};

const SOURCE_LABELS: Record<Script["source"], string> = {
  llm: "模型生成",
  revision: "自动修订",
  human_return: "人工退回后修订",
  preset: "预置",
};

const SEVERITY_META: Record<
  ReviewIssue["severity"],
  { label: string; className: string }
> = {
  high: {
    label: "高",
    className: "bg-[#FFF1F2] text-[#E11D48] border-[#FECDD3]/80",
  },
  medium: {
    label: "中",
    className: "bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]/80",
  },
  low: {
    label: "低",
    className: "bg-slate-100 text-slate-600 border-slate-200",
  },
};

const SCORE_LABELS: Array<{
  key: "consistency" | "persona" | "hook" | "platformFit";
  label: string;
}> = [
  { key: "consistency", label: "设定一致性" },
  { key: "persona", label: "角色人设" },
  { key: "hook", label: "钩子吸引力" },
  { key: "platformFit", label: "平台适配" },
];

export function TopicDetailPage() {
  const { hotspotId = "" } = useParams<{ hotspotId: string }>();
  const navigate = useNavigate();

  const session = useHotscriptStore((s) => s.topics[hotspotId]);
  const approveScript = useHotscriptStore((s) => s.approveScript);

  const hotspot = useMemo(
    () => hotspots.find((h) => h.id === hotspotId) ?? null,
    [hotspotId]
  );

  const [progress, setProgress] = useState<PipelineProgress | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [returnMode, setReturnMode] = useState(false);
  const [humanNote, setHumanNote] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  // 当新版本产生或切换热点时，自动切到最新版本
  const latestVersion =
    session && session.versions.length > 0
      ? session.versions[session.versions.length - 1].version
      : null;

  useEffect(() => {
    setSelectedVersion(latestVersion);
  }, [hotspotId, latestVersion]);

  useEffect(() => {
    setProgress(null);
    setReturnMode(false);
    setHumanNote("");
  }, [hotspotId]);

  const evidenceIndexMap = useMemo(() => {
    const map = new Map<string, { code: string; excerpt: string; platform: string }>();
    if (!hotspot) return map;
    hotspot.evidence.forEach((ev, idx) => {
      map.set(ev.id, {
        code: `E${idx + 1}`,
        excerpt: ev.excerpt,
        platform: meta.platformLabels[ev.platform] ?? ev.platform,
      });
    });
    return map;
  }, [hotspot]);

  if (!hotspot || !session) {
    return (
      <Card className="rounded-[12px] border border-[#E2E8F0] bg-white p-10 text-center space-y-4 shadow-sm">
        <div className="text-[16px] font-semibold text-slate-900">
          未找到该选题的脚本会话
        </div>
        <p className="text-[14px] text-slate-500">
          请先在热点工作台确认选题，或从选题列表进入。
        </p>
        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={() => navigate("/topics")}>
            返回选题列表
          </Button>
          <Button
            onClick={() => navigate("/")}
            className="bg-[#0F766E] hover:bg-[#115E59] text-white"
          >
            去热点工作台
          </Button>
        </div>
      </Card>
    );
  }

  const platformRule = platforms[session.platform];
  const statusInfo = SCRIPT_STATUS_BADGE[session.scriptStatus];

  const activeScript: Script | null =
    session.versions.find((v) => v.version === selectedVersion) ??
    session.versions[session.versions.length - 1] ??
    null;

  const activeRules = activeScript
    ? session.ruleResultsByVersion[activeScript.version] ?? []
    : [];
  const activeReview = activeScript
    ? session.reviewsByVersion[activeScript.version] ?? null
    : null;

  const displaySteps: PipelineStepState[] = useMemo(() => {
    if (progress) return progress.steps;
    if (
      session.scriptStatus === "pending_final" ||
      session.scriptStatus === "approved"
    ) {
      return createCompletedPipelineSteps(
        session.revisions.length > 0,
        session.unresolvedWarning
      );
    }
    return INITIAL_PIPELINE_STEPS;
  }, [progress, session.scriptStatus, session.revisions.length, session.unresolvedWarning]);

  const handleStartPipeline = async (useFlawedPresetV1 = false) => {
    if (isRunning) return;
    setIsRunning(true);
    try {
      await runGenerationPipeline(
        hotspot.id,
        (next) => {
          setProgress(next);
        },
        { useFlawedPresetV1 }
      );
      toast.success(
        useFlawedPresetV1
          ? "拦截与自动修订演示已完成"
          : "脚本生成与核查流水线已完成"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "流水线执行失败");
    } finally {
      setIsRunning(false);
    }
  };

  const handleApprove = () => {
    try {
      approveScript(hotspot.id);
      toast.success("脚本已确认定稿，可导出 Markdown");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "定稿操作失败");
    }
  };

  const handleSubmitReturn = async () => {
    if (!humanNote.trim() || isRunning) {
      toast.error("请填写具体的修改意见");
      return;
    }
    const note = humanNote.trim();
    setIsRunning(true);
    setReturnMode(false);
    setHumanNote("");
    try {
      await runHumanReturnRevision(hotspot.id, note, (next) => {
        setProgress(next);
      });
      toast.success("已按你的意见完成修订并重新核查");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "退回修订失败");
    } finally {
      setIsRunning(false);
    }
  };

  const handleExportMarkdown = () => {
    if (!activeScript) return;
    const md = buildScriptMarkdown(activeScript, hotspot);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${hotspot.id}-v${activeScript.version}-script.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("已导出 Markdown 脚本文件");
  };

  const totalSec = activeScript
    ? activeScript.shots.reduce(
        (sum, shot) => sum + Math.max(0, shot.end - shot.start),
        0
      )
    : 0;
  const passedRuleCount = activeRules.filter((r) => r.passed).length;

  return (
    <div className="space-y-5">
      {/* 顶部返回与标题栏 */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1.5 min-w-0">
          <Link
            to="/topics"
            className="inline-flex items-center gap-1 text-[13px] text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>返回选题与脚本</span>
          </Link>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">
              {hotspot.title}
            </h1>
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
              className="text-[12px] font-normal px-2 py-0.5 rounded-md bg-white text-slate-600 border-slate-200"
            >
              {platformRule.name} · {platformRule.aspect}
            </Badge>
          </div>
          {session.direction && (
            <p className="text-[13px] text-slate-500">
              补充方向：{session.direction}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {session.scriptStatus === "idle" && (
            <>
              <Button
                type="button"
                disabled={isRunning}
                onClick={() => handleStartPipeline(false)}
                className="h-9 px-4 bg-[#0F766E] hover:bg-[#115E59] text-white gap-1.5"
              >
                {isRunning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                <span>{isRunning ? "流水线运行中…" : "生成脚本"}</span>
              </Button>
              {hotspot.id === "h10" && (
                <div className="inline-flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isRunning}
                    onClick={() => handleStartPipeline(true)}
                    className="h-9 px-3.5 border-slate-300 text-slate-700 hover:bg-slate-50 gap-1.5"
                  >
                    <ShieldCheck className="h-4 w-4 text-[#0F766E]" />
                    <span>演示：拦截有问题的初稿</span>
                  </Button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label="演示说明"
                        className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        <HelpCircle className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-[13px] max-w-[280px]">
                      载入一份含设定错误的初稿，观察程序拦截与模型修订
                    </TooltipContent>
                  </Tooltip>
                </div>
              )}
            </>
          )}

          {session.scriptStatus === "approved" && activeScript && (
            <Button
              type="button"
              variant="outline"
              onClick={handleExportMarkdown}
              className="h-9 px-4 border-[#0F766E] text-[#0F766E] hover:bg-[#F0FDFA] gap-1.5"
            >
              <Download className="h-4 w-4" />
              <span>导出 Markdown</span>
            </Button>
          )}
        </div>
      </div>

      {/* A. 生成流水线（顶部横向步骤条） */}
      <Card className="rounded-[12px] border border-[#E2E8F0] bg-white p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-7 gap-2">
          {displaySteps.map((step, idx) => {
            const isStepRunning = step.status === "running";
            const isStepDone = step.status === "done";
            const isStepFailed = step.status === "failed";
            const isStepSkipped = step.status === "skipped";

            return (
              <div
                key={step.key}
                className={cn(
                  "rounded-lg border px-2.5 py-2.5 transition-colors duration-200",
                  isStepRunning
                    ? "border-[#0F766E] bg-[#F0FDFA]"
                    : isStepDone
                      ? "border-[#A7F3D0] bg-[#ECFDF5]/60"
                      : isStepFailed
                        ? "border-[#FECDD3] bg-[#FFF1F2]/70"
                        : "border-slate-200 bg-slate-50/50"
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span className="shrink-0">
                    {isStepRunning ? (
                      <Loader2 className="h-4 w-4 text-[#0F766E] animate-spin" />
                    ) : isStepDone ? (
                      <CheckCircle2 className="h-4 w-4 text-[#059669]" />
                    ) : isStepFailed ? (
                      <XCircle className="h-4 w-4 text-[#E11D48]" />
                    ) : (
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[12px] text-slate-400 tabular-nums">
                        {idx + 1}
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "text-[13px] font-medium truncate",
                      isStepRunning
                        ? "text-[#0F766E]"
                        : isStepDone
                          ? "text-slate-900"
                          : isStepFailed
                            ? "text-[#E11D48]"
                            : isStepSkipped
                              ? "text-slate-400"
                              : "text-slate-500"
                    )}
                  >
                    {step.label}
                  </span>
                </div>
                <div className="mt-1 text-[13px] text-slate-500 truncate min-h-[18px]">
                  {step.detail ??
                    (isStepRunning
                      ? "执行中…"
                      : isStepDone
                        ? "已完成"
                        : isStepSkipped
                          ? "已跳过"
                          : "等待中")}
                </div>
              </div>
            );
          })}
        </div>

        {/* 实时动态进度条与说明 */}
        {(isRunning || progress?.activeMessage) && (
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-[13px]",
              isRunning
                ? "bg-[#F0FDFA] text-[#0F766E]"
                : "bg-slate-50 text-slate-600"
            )}
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            ) : (
              <Check className="h-4 w-4 text-[#059669] shrink-0" />
            )}
            <span>{progress?.activeMessage}</span>
          </div>
        )}
      </Card>

      {/* 主内容区：左侧脚本正文 + 终稿确认，右侧检查结果 */}
      {!activeScript ? (
        <Card className="rounded-[12px] border border-[#E2E8F0] bg-white p-12 text-center shadow-sm space-y-4">
          <div className="mx-auto h-11 w-11 rounded-full bg-[#F0FDFA] flex items-center justify-center text-[#0F766E]">
            {isRunning ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Sparkles className="h-5 w-5" />
            )}
          </div>
          <div className="space-y-1">
            <div className="text-[16px] font-semibold text-slate-900">
              {isRunning
                ? "正在生成并核查脚本，请稍候…"
                : "准备就绪，点击开始生成分镜脚本"}
            </div>
            <p className="text-[14px] text-slate-500">
              {isRunning
                ? "模型生成与独立评审通常需要 10–40 秒，上方步骤条将实时推进"
                : "系统将自动隔离未公开设定卡，生成后依次执行 R1–R7 规则检查、模型独立评审与自动修订"}
            </p>
          </div>
          {!isRunning && (
            <div className="flex items-center justify-center gap-2.5 flex-wrap">
              <Button
                type="button"
                onClick={() => handleStartPipeline(false)}
                className="bg-[#0F766E] hover:bg-[#115E59] text-white gap-1.5"
              >
                <Play className="h-4 w-4" />
                <span>生成脚本</span>
              </Button>
              {hotspot.id === "h10" && (
                <div className="inline-flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleStartPipeline(true)}
                    className="border-slate-300 text-slate-700 hover:bg-slate-50 gap-1.5"
                  >
                    <ShieldCheck className="h-4 w-4 text-[#0F766E]" />
                    <span>演示：拦截有问题的初稿</span>
                  </Button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label="演示说明"
                        className="h-8 w-8 rounded-lg inline-flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      >
                        <HelpCircle className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-[13px] max-w-[280px]">
                      载入一份含设定错误的初稿，观察程序拦截与模型修订
                    </TooltipContent>
                  </Tooltip>
                </div>
              )}
            </div>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
          {/* 左侧：脚本正文 + 终稿确认（人工节点②） */}
          <div className="space-y-5 min-w-0">
            {/* B. 脚本正文 */}
            <Card className="rounded-[12px] border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
              {/* 版本切换栏 */}
              <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3 flex-wrap">
                <Tabs
                  value={String(activeScript.version)}
                  onValueChange={(v) => setSelectedVersion(Number(v))}
                >
                  <TabsList className="bg-white border border-slate-200 h-9 p-1 rounded-lg">
                    {session.versions.map((ver) => (
                      <TabsTrigger
                        key={ver.id}
                        value={String(ver.version)}
                        className="text-[13px] px-3 data-[state=active]:bg-[#F0FDFA] data-[state=active]:text-[#0F766E] data-[state=active]:shadow-none rounded-md gap-1.5"
                      >
                        <span className="tabular-nums font-medium">
                          v{ver.version}
                        </span>
                        <span className="text-slate-400">
                          {ver.sourceLabel ?? SOURCE_LABELS[ver.source]}
                        </span>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>

                <div className="flex items-center gap-3 text-[13px] text-slate-600 tabular-nums">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    总时长 {totalSec} 秒
                  </span>
                  <span>
                    {platformRule.durationSec.min}–{platformRule.durationSec.max}s
                  </span>
                </div>
              </div>

              {/* 脚本头信息：标题、封面、钩子 */}
              <div className="p-5 space-y-4">
                <div className="space-y-2">
                  <div className="text-[18px] font-semibold text-slate-900">
                    {activeScript.title}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="rounded-lg border border-slate-200 bg-[#F8FAFC] px-3.5 py-2.5">
                      <div className="text-[13px] text-slate-500">封面文案</div>
                      <div className="mt-0.5 text-[14px] font-medium text-slate-900">
                        {activeScript.coverText || "—"}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-[#F8FAFC] px-3.5 py-2.5">
                      <div className="text-[13px] text-slate-500">开场钩子</div>
                      <div className="mt-0.5 text-[14px] font-medium text-slate-900">
                        {activeScript.hook || "—"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 分镜表格 */}
                <div className="rounded-[10px] border border-slate-200 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                        <TableHead className="w-[78px] text-[13px] font-medium text-slate-500">
                          时间段
                        </TableHead>
                        <TableHead className="text-[13px] font-medium text-slate-500">
                          画面
                        </TableHead>
                        <TableHead className="text-[13px] font-medium text-slate-500">
                          台词 / 旁白
                        </TableHead>
                        <TableHead className="w-[150px] text-[13px] font-medium text-slate-500">
                          字幕
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeScript.shots.map((shot, idx) => {
                        const evMeta = shot.evidenceRef
                          ? evidenceIndexMap.get(shot.evidenceRef)
                          : undefined;
                        return (
                          <TableRow key={idx} className="align-top">
                            <TableCell className="text-[13px] font-medium text-slate-600 tabular-nums whitespace-nowrap">
                              {shot.start}–{shot.end}s
                            </TableCell>
                            <TableCell className="text-[14px] text-slate-800 leading-relaxed">
                              <span>{shot.visual}</span>
                              {evMeta && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge
                                      variant="outline"
                                      className="ml-1.5 align-middle text-[12px] font-medium px-1.5 py-0 h-5 bg-[#F0FDFA] text-[#0F766E] border-[#99F6E4] cursor-default"
                                    >
                                      [{evMeta.code}]
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent
                                    side="top"
                                    className="max-w-[300px] text-[13px] leading-relaxed"
                                  >
                                    <div className="font-medium mb-0.5">
                                      证据 {evMeta.code} · {evMeta.platform}
                                    </div>
                                    <div>{evMeta.excerpt}</div>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </TableCell>
                            <TableCell className="text-[14px] text-slate-800 leading-relaxed">
                              {shot.line}
                            </TableCell>
                            <TableCell className="text-[13px] text-slate-600 leading-relaxed">
                              {shot.subtitle}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* 片尾卡与 BGM 建议 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-slate-200 bg-[#F8FAFC] px-3.5 py-3 space-y-1">
                    <div className="text-[13px] font-medium text-slate-500">
                      片尾卡
                    </div>
                    <div className="text-[14px] text-slate-800 leading-relaxed">
                      {activeScript.endCard || "—"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-[#F8FAFC] px-3.5 py-3 space-y-1">
                    <div className="text-[13px] font-medium text-slate-500 inline-flex items-center gap-1">
                      <Music className="h-3.5 w-3.5" />
                      BGM 建议
                    </div>
                    <div className="text-[14px] text-slate-800 leading-relaxed">
                      {activeScript.bgm || "—"}
                    </div>
                  </div>
                </div>

                {/* 引用证据汇总 */}
                {activeScript.evidenceRefs.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <span className="text-[13px] text-slate-500">引用证据</span>
                    {activeScript.evidenceRefs.map((refId) => {
                      const evMeta = evidenceIndexMap.get(refId);
                      return (
                        <Tooltip key={refId}>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="outline"
                              className="text-[12px] font-medium px-2 py-0.5 bg-[#F0FDFA] text-[#0F766E] border-[#99F6E4] cursor-default"
                            >
                              {evMeta
                                ? `[${evMeta.code}] ${evMeta.platform}`
                                : refId}
                            </Badge>
                          </TooltipTrigger>
                          {evMeta && (
                            <TooltipContent
                              side="top"
                              className="max-w-[300px] text-[13px]"
                            >
                              {evMeta.excerpt}
                            </TooltipContent>
                          )}
                        </Tooltip>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>

            {/* D. 终稿确认（人工节点②） */}
            {session.scriptStatus === "pending_final" && (
              <Card className="rounded-[12px] border border-[#0F766E] bg-white p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[16px] font-semibold text-[#0F766E]">
                    需要你确认
                  </span>
                  <span className="text-[13px] text-slate-500">
                    人工节点 ② · 终稿确认
                  </span>
                </div>

                {session.unresolvedWarning && (
                  <div className="rounded-lg border border-[#FECDD3] bg-[#FFF1F2] px-3.5 py-2.5 flex items-start gap-2 text-[13px] text-[#E11D48]">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      已达最大自动修订轮次（{meta.maxRevisionRounds} 轮），当前版本仍存在未解决的规则或评审问题，请仔细核对后再决定定稿或退回修改。
                    </span>
                  </div>
                )}

                {returnMode ? (
                  <div className="space-y-3">
                    <label
                      htmlFor="human-return-note"
                      className="block text-[13px] font-medium text-slate-700"
                    >
                      退回修改意见（提交后将调用修订接口生成新版本并重新检查）
                    </label>
                    <textarea
                      id="human-return-note"
                      rows={3}
                      value={humanNote}
                      onChange={(e) => setHumanNote(e.target.value)}
                      placeholder="例如：结尾互动问题更有画面感一点，多给墨白一句台词"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[14px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20 focus:border-[#0F766E]"
                    />
                    <div className="flex items-center justify-end gap-2.5">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isRunning}
                        onClick={() => {
                          setReturnMode(false);
                          setHumanNote("");
                        }}
                      >
                        取消
                      </Button>
                      <Button
                        type="button"
                        disabled={isRunning || !humanNote.trim()}
                        onClick={handleSubmitReturn}
                        className="bg-[#0F766E] hover:bg-[#115E59] text-white gap-1.5"
                      >
                        {isRunning && (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                        <span>提交并重新修订</span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <span className="text-[14px] text-slate-600">
                      当前审阅版本：v{latestVersion}，确认无误后即可定稿导出。
                    </span>
                    <div className="flex items-center gap-2.5">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isRunning}
                        onClick={() => setReturnMode(true)}
                        className="h-9 px-4 border-slate-200 text-slate-700 hover:bg-slate-50 gap-1.5"
                      >
                        <RotateCcw className="h-4 w-4" />
                        <span>退回修改</span>
                      </Button>
                      <Button
                        type="button"
                        disabled={isRunning}
                        onClick={handleApprove}
                        className="h-9 px-5 bg-[#0F766E] hover:bg-[#115E59] text-white gap-1.5"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span>定稿</span>
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            )}

            {session.scriptStatus === "approved" && (
              <Card className="rounded-[12px] border border-[#A7F3D0] bg-[#ECFDF5]/60 p-5 shadow-sm flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-5 w-5 text-[#059669] shrink-0" />
                  <div>
                    <div className="text-[15px] font-semibold text-[#059669]">
                      脚本已定稿
                    </div>
                    <div className="text-[13px] text-slate-600">
                      最终版本 v{latestVersion} 已通过全部确认流程，可直接导出交付拍摄。
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={handleExportMarkdown}
                  className="h-9 px-4 bg-[#0F766E] hover:bg-[#115E59] text-white gap-1.5"
                >
                  <Download className="h-4 w-4" />
                  <span>导出 Markdown</span>
                </Button>
              </Card>
            )}
          </div>

          {/* 右侧：C. 检查结果与修订记录 */}
          <div className="space-y-4 min-w-0">
            {/* 1. 规则检查 · 程序执行 */}
            <Card className="rounded-[12px] border border-[#E2E8F0] bg-white p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-[#0F766E]" />
                  <h2 className="text-[15px] font-semibold text-slate-900">
                    规则检查 · 程序执行
                  </h2>
                </div>
                {activeRules.length > 0 && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[12px] font-medium px-2 py-0.5 rounded-md tabular-nums border",
                      passedRuleCount === activeRules.length
                        ? "bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]"
                        : "bg-[#FFF1F2] text-[#E11D48] border-[#FECDD3]"
                    )}
                  >
                    {passedRuleCount}/{activeRules.length} 通过
                  </Badge>
                )}
              </div>

              {activeRules.length === 0 ? (
                <div className="text-[13px] text-slate-500 py-2">
                  等待执行规则检查…
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {activeRules.map((rule) => (
                    <div key={rule.id} className="py-2.5 first:pt-1 last:pb-0 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {rule.passed ? (
                            <CheckCircle2 className="h-4 w-4 text-[#059669] shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-[#E11D48] shrink-0" />
                          )}
                          <span className="text-[13px] font-medium text-slate-800">
                            {rule.id} {rule.name}
                          </span>
                        </div>
                        <span
                          className={cn(
                            "text-[13px] shrink-0",
                            rule.passed ? "text-[#059669]" : "text-[#E11D48]"
                          )}
                        >
                          {rule.passed ? "通过" : "未通过"}
                        </span>
                      </div>
                      <p className="text-[13px] text-slate-500 pl-6 leading-snug">
                        {rule.message}
                      </p>
                      {!rule.passed && rule.hits.length > 0 && (
                        <div className="pl-6 pt-1 flex flex-wrap gap-1">
                          {rule.hits.map((hit, i) => (
                            <Badge
                              key={i}
                              variant="outline"
                              className="text-[12px] font-normal bg-[#FFF1F2] text-[#E11D48] border-[#FECDD3]"
                            >
                              {hit}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* 2. 模型评审 · 独立评审 */}
            <Card className="rounded-[12px] border border-[#E2E8F0] bg-white p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[15px] font-semibold text-slate-900">
                  模型评审 · 独立评审
                </h2>
                {activeReview && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[12px] font-medium px-2 py-0.5 rounded-md border",
                      activeReview.passed
                        ? "bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]"
                        : "bg-[#FFF1F2] text-[#E11D48] border-[#FECDD3]"
                    )}
                  >
                    {activeReview.passed ? "评审通过" : "建议修订"}
                  </Badge>
                )}
              </div>

              {!activeReview ? (
                <div className="text-[13px] text-slate-500 py-2">
                  等待独立评审返回结果…
                </div>
              ) : (
                <div className="space-y-3.5">
                  {/* 4 项评分 */}
                  <div className="grid grid-cols-2 gap-2.5">
                    {SCORE_LABELS.map(({ key, label }) => {
                      const val = activeReview.scores[key];
                      return (
                        <div
                          key={key}
                          className="rounded-lg border border-slate-200 bg-[#F8FAFC] px-3 py-2 space-y-1"
                        >
                          <div className="flex items-center justify-between text-[13px]">
                            <span className="text-slate-600">{label}</span>
                            <span className="font-semibold text-slate-900 tabular-nums">
                              {val} / 5
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                val >= 4
                                  ? "bg-[#0F766E]"
                                  : val >= 3
                                    ? "bg-[#D97706]"
                                    : "bg-[#E11D48]"
                              )}
                              style={{ width: `${(val / 5) * 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* 评语 */}
                  <p className="text-[13px] text-slate-700 leading-relaxed bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
                    {activeReview.summary}
                  </p>

                  {/* 问题清单 */}
                  {activeReview.issues.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[13px] font-medium text-slate-700">
                        问题清单（{activeReview.issues.length}）
                      </div>
                      <div className="space-y-2">
                        {activeReview.issues.map((issue, idx) => {
                          const sev = SEVERITY_META[issue.severity];
                          return (
                            <div
                              key={idx}
                              className="rounded-lg border border-slate-200 bg-white p-3 space-y-1.5"
                            >
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[12px] font-medium px-1.5 py-0 h-5 border",
                                    sev.className
                                  )}
                                >
                                  {sev.label}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className="text-[12px] font-normal px-1.5 py-0 h-5 bg-slate-50 text-slate-600 border-slate-200"
                                >
                                  {issue.category}
                                </Badge>
                                <span className="text-[13px] text-slate-500">
                                  {issue.location}
                                </span>
                              </div>
                              <p className="text-[13px] text-slate-800 leading-snug">
                                {issue.detail}
                              </p>
                              {issue.suggestion && (
                                <p className="text-[13px] text-[#0F766E] leading-snug">
                                  建议：{issue.suggestion}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* 3. 修订记录 */}
            {session.revisions.length > 0 && (
              <Card className="rounded-[12px] border border-[#E2E8F0] bg-white p-4 shadow-sm space-y-3">
                <div className="flex items-center gap-1.5">
                  <History className="h-4 w-4 text-slate-500" />
                  <h2 className="text-[15px] font-semibold text-slate-900">
                    修订记录
                  </h2>
                </div>
                <div className="space-y-3">
                  {session.revisions.map((rev, idx) => (
                    <div key={idx} className="space-y-1.5">
                      {idx > 0 && <Separator className="mb-2.5" />}
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="font-medium text-slate-800 tabular-nums">
                          第 {rev.round} 轮 · 生成 v{rev.version}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[12px] font-normal px-1.5 py-0 h-5 bg-slate-50 text-slate-600 border-slate-200"
                        >
                          {SOURCE_LABELS[rev.source]}
                        </Badge>
                      </div>
                      {rev.humanNote && (
                        <div className="text-[13px] text-[#0F766E] bg-[#F0FDFA] rounded-md px-2.5 py-1.5">
                          退回意见：{rev.humanNote}
                        </div>
                      )}
                      <ul className="list-disc pl-4 space-y-1 text-[13px] text-slate-600">
                        {rev.changes.map((c, ci) => (
                          <li key={ci}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
