import gameData from "@data/game.json";
import hotspotsData from "@data/hotspots.json";
import lexiconData from "@data/lexicon.json";
import metaData from "@data/meta.json";
import platformsData from "@data/platforms.json";
import { checkScriptRules } from "@/core/rules";
import {
  generateScriptApi,
  resetFallbackNotice,
  reviewScriptApi,
  reviseScriptApi,
} from "@/lib/api";
import { useHotscriptStore } from "@/store";
import type {
  GameConfig,
  Hotspot,
  LexiconConfig,
  MetaConfig,
  PlatformsConfig,
  RevisionRecord,
  RuleResult,
  Script,
} from "@/types";

const game = gameData as GameConfig;
const hotspots = hotspotsData as Hotspot[];
const lexicon = lexiconData as LexiconConfig;
const meta = metaData as MetaConfig;
const platforms = platformsData as PlatformsConfig;

export type PipelineStepKey =
  | "brief"
  | "retrieve"
  | "generate"
  | "rules"
  | "review"
  | "revise"
  | "pending_final";

export type StepStatus = "waiting" | "running" | "done" | "failed" | "skipped";

export interface PipelineStepState {
  key: PipelineStepKey;
  label: string;
  status: StepStatus;
  detail?: string;
}

export interface PipelineProgress {
  steps: PipelineStepState[];
  activeMessage: string;
  running: boolean;
}

export const INITIAL_PIPELINE_STEPS: PipelineStepState[] = [
  { key: "brief", label: "热点简报", status: "waiting" },
  { key: "retrieve", label: "检索设定", status: "waiting" },
  { key: "generate", label: "生成脚本", status: "waiting" },
  { key: "rules", label: "规则检查", status: "waiting" },
  { key: "review", label: "模型评审", status: "waiting" },
  { key: "revise", label: "自动修订", status: "waiting" },
  { key: "pending_final", label: "待终审", status: "waiting" },
];

export function createCompletedPipelineSteps(
  hasRevisions: boolean,
  hasWarning: boolean
): PipelineStepState[] {
  return [
    { key: "brief", label: "热点简报", status: "done" },
    { key: "retrieve", label: "检索设定", status: "done" },
    { key: "generate", label: "生成脚本", status: "done" },
    { key: "rules", label: "规则检查", status: hasWarning ? "failed" : "done" },
    { key: "review", label: "模型评审", status: hasWarning ? "failed" : "done" },
    {
      key: "revise",
      label: "自动修订",
      status: hasRevisions ? "done" : "skipped",
      detail: hasRevisions ? undefined : "无需修订",
    },
    { key: "pending_final", label: "待终审", status: "done" },
  ];
}

function makeUniqueScriptId(hotspotId: string, version: number): string {
  const rand = Math.random().toString(36).slice(2, 7);
  return `s-${hotspotId}-v${version}-${Date.now()}-${rand}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getHotspotOrThrow(hotspotId: string): Hotspot {
  const found = hotspots.find((h) => h.id === hotspotId);
  if (!found) {
    throw new Error(`未找到热点 ${hotspotId}`);
  }
  return found;
}

function updateSteps(
  steps: PipelineStepState[],
  key: PipelineStepKey,
  status: StepStatus,
  detail?: string
): PipelineStepState[] {
  return steps.map((s) => (s.key === key ? { ...s, status, detail } : s));
}

function summarizeRuleFailures(results: RuleResult[]): string {
  const failed = results.filter((r) => !r.passed);
  if (failed.length === 0) return "7/7 全部通过";
  return `未通过 ${failed.map((f) => f.id).join("、")}`;
}

export async function runGenerationPipeline(
  hotspotId: string,
  onProgress: (progress: PipelineProgress) => void
): Promise<void> {
  const store = useHotscriptStore.getState();
  const session = store.topics[hotspotId];
  if (!session) {
    throw new Error(`未找到选题会话 ${hotspotId}`);
  }

  const hotspot = getHotspotOrThrow(hotspotId);
  const platformRule = platforms[session.platform];
  const targetLabel = `${hotspot.id} · ${hotspot.title}`;

  resetFallbackNotice();

  let steps: PipelineStepState[] = INITIAL_PIPELINE_STEPS.map((s) => ({
    ...s,
  }));

  const emit = (activeMessage: string, running = true) => {
    onProgress({ steps: [...steps], activeMessage, running });
  };

  // Step 1: 热点简报
  steps = updateSteps(steps, "brief", "running");
  emit("正在整理热点简报与已核验证据快照…");
  await sleep(260);
  steps = updateSteps(
    steps,
    "brief",
    "done",
    `${hotspot.evidence.length} 条核验证据`
  );
  emit("热点简报已就绪");

  // Step 2: 检索设定
  steps = updateSteps(steps, "retrieve", "running");
  emit("正在检索公开与内部设定卡（自动隔离未公开剧透设定）…");
  const allowedCount = game.cards.filter(
    (c) => c.confidentiality !== "unreleased"
  ).length;
  const blockedCount = game.cards.length - allowedCount;
  await sleep(280);
  steps = updateSteps(
    steps,
    "retrieve",
    "done",
    `载入 ${allowedCount} 张 · 隔离 ${blockedCount} 张`
  );
  useHotscriptStore.getState().appendLog({
    actor: "系统",
    action: "检索游戏设定",
    target: targetLabel,
    detail: `载入 ${allowedCount} 张公开/内部设定卡进入上下文，已隔离 ${blockedCount} 张未公开设定卡。`,
  });
  emit("游戏设定检索完成");

  // Step 3: 生成脚本
  steps = updateSteps(steps, "generate", "running");
  useHotscriptStore.getState().setScriptStatus(hotspotId, "generating");
  emit(
    `正在调用大模型生成 ${platformRule.name} v1 脚本（通常需要 10–30 秒，请稍候）…`
  );

  const genRes = await generateScriptApi({
    hotspotId,
    platform: session.platform,
    direction: session.direction || undefined,
  });

  let currentScript: Script = {
    ...genRes.script,
    id: makeUniqueScriptId(hotspotId, 1),
    hotspotId,
    platform: session.platform,
    version: 1,
    source: genRes.usedFallback ? "preset" : "llm",
  };

  useHotscriptStore.getState().addScriptVersion(hotspotId, currentScript);
  useHotscriptStore.getState().appendLog({
    actor: genRes.usedFallback ? "系统" : "模型",
    action: genRes.usedFallback ? "生成脚本 v1（预置回退）" : "生成脚本 v1",
    target: targetLabel,
    detail: `标题「${currentScript.title}」，共 ${currentScript.shots.length} 个镜头。`,
  });

  steps = updateSteps(
    steps,
    "generate",
    "done",
    genRes.usedFallback ? "预置 v1" : "模型生成 v1"
  );
  emit("v1 脚本已生成，进入程序规则检查…");

  // 循环：规则检查 + 模型评审 + 自动修订
  let revisionRound = 0;
  let passedAll = false;

  while (true) {
    // Step 4: 规则检查
    steps = updateSteps(steps, "rules", "running");
    useHotscriptStore.getState().setScriptStatus(hotspotId, "checking");
    emit(`正在执行程序规则检查（R1–R7 · v${currentScript.version}）…`);
    await sleep(220);

    const ruleResults = checkScriptRules({
      script: currentScript,
      hotspot,
      platform: platformRule,
      game,
      lexicon,
    });
    const ruleFailures = ruleResults.filter((r) => !r.passed);
    const rulesPassed = ruleFailures.length === 0;

    steps = updateSteps(
      steps,
      "rules",
      rulesPassed ? "done" : "failed",
      summarizeRuleFailures(ruleResults)
    );
    useHotscriptStore.getState().setVersionCheckResult(
      hotspotId,
      currentScript.version,
      ruleResults
    );
    useHotscriptStore.getState().appendLog({
      actor: "系统",
      action: `规则检查 v${currentScript.version}`,
      target: targetLabel,
      detail: rulesPassed
        ? "R1–R7 全部通过（7/7）。"
        : `未通过 ${ruleFailures.length} 项：${ruleFailures.map((f) => `${f.id} ${f.name}`).join("、")}。`,
    });

    // Step 5: 模型评审
    steps = updateSteps(steps, "review", "running");
    emit(
      `正在调用独立评审模型评估 v${currentScript.version}（通常需要 8–20 秒）…`
    );

    const reviewRes = await reviewScriptApi({
      hotspotId,
      script: currentScript,
      ruleResults,
    });

    useHotscriptStore.getState().setVersionCheckResult(
      hotspotId,
      currentScript.version,
      ruleResults,
      reviewRes.review
    );
    useHotscriptStore.getState().appendLog({
      actor: reviewRes.usedFallback ? "系统" : "模型",
      action: reviewRes.usedFallback
        ? `独立评审 v${currentScript.version}（预置回退）`
        : `独立评审 v${currentScript.version}`,
      target: targetLabel,
      detail: `${reviewRes.review.passed ? "评审通过" : "评审未通过"}（问题 ${reviewRes.review.issues.length} 条）：${reviewRes.review.summary}`,
    });

    steps = updateSteps(
      steps,
      "review",
      reviewRes.review.passed ? "done" : "failed",
      reviewRes.review.passed
        ? "评审通过"
        : `${reviewRes.review.issues.length} 条待修`
    );

    if (rulesPassed && reviewRes.review.passed) {
      passedAll = true;
      break;
    }

    if (revisionRound >= meta.maxRevisionRounds) {
      passedAll = false;
      break;
    }

    // Step 6: 自动修订
    revisionRound += 1;
    steps = updateSteps(
      steps,
      "revise",
      "running",
      `第 ${revisionRound} 轮修订中`
    );
    useHotscriptStore.getState().setScriptStatus(hotspotId, "revising");
    emit(
      `发现问题，正在执行第 ${revisionRound} 轮自动修订（生成 v${currentScript.version + 1}）…`
    );

    const reviseRes = await reviseScriptApi({
      hotspotId,
      script: currentScript,
      issues: reviewRes.review.issues,
      ruleFailures,
    });

    const nextVersion = currentScript.version + 1;
    const revisedScript: Script = {
      ...reviseRes.script,
      id: makeUniqueScriptId(hotspotId, nextVersion),
      hotspotId,
      platform: session.platform,
      version: nextVersion,
      source: reviseRes.usedFallback ? "preset" : "revision",
    };

    const revRecord: RevisionRecord = {
      round: revisionRound,
      version: nextVersion,
      source: revisedScript.source,
      changes: reviseRes.changes,
      createdAt: meta.demoNow,
    };

    useHotscriptStore
      .getState()
      .addScriptVersion(hotspotId, revisedScript, revRecord);
    useHotscriptStore.getState().appendLog({
      actor: reviseRes.usedFallback ? "系统" : "模型",
      action: `自动修订 v${nextVersion}（第 ${revisionRound} 轮）`,
      target: targetLabel,
      detail:
        reviseRes.changes.length > 0
          ? reviseRes.changes.join("；")
          : "已按检查结果完成自动修订。",
    });

    currentScript = revisedScript;
    steps = updateSteps(
      steps,
      "revise",
      "done",
      `已完成 ${revisionRound} 轮修订`
    );
  }

  // Step 7: 待终审
  if (revisionRound === 0) {
    steps = updateSteps(steps, "revise", "skipped", "首版即通过");
  }
  steps = updateSteps(
    steps,
    "pending_final",
    "done",
    passedAll ? "检查通过，待确认" : "达上限，带警示待审"
  );

  useHotscriptStore.getState().setScriptStatus(hotspotId, "pending_final", {
    unresolvedWarning: !passedAll,
  });
  useHotscriptStore.getState().appendLog({
    actor: "系统",
    action: "进入待终审",
    target: targetLabel,
    detail: passedAll
      ? `脚本 v${currentScript.version} 已通过全部规则与评审，等待人工终稿确认。`
      : `已达最大自动修订轮次（${meta.maxRevisionRounds} 轮），脚本 v${currentScript.version} 仍存在未解决问题，已标红移交人工审阅。`,
  });

  emit(
    passedAll
      ? `流水线完成：v${currentScript.version} 已通过全部检查，等待人工定稿`
      : `已达最大修订轮次，v${currentScript.version} 仍存在未解决问题，请人工审阅`,
    false
  );
}

export async function runHumanReturnRevision(
  hotspotId: string,
  humanNote: string,
  onProgress: (progress: PipelineProgress) => void
): Promise<void> {
  const store = useHotscriptStore.getState();
  const session = store.topics[hotspotId];
  if (!session || session.versions.length === 0) {
    throw new Error(`未找到可修订的脚本 ${hotspotId}`);
  }

  const hotspot = getHotspotOrThrow(hotspotId);
  const platformRule = platforms[session.platform];
  const targetLabel = `${hotspot.id} · ${hotspot.title}`;
  const latestScript = session.versions[session.versions.length - 1];
  const latestRules = session.ruleResultsByVersion[latestScript.version] ?? [];
  const latestReview = session.reviewsByVersion[latestScript.version];

  let steps: PipelineStepState[] = [
    { key: "brief", label: "热点简报", status: "done" },
    { key: "retrieve", label: "检索设定", status: "done" },
    { key: "generate", label: "生成脚本", status: "done" },
    { key: "rules", label: "规则检查", status: "waiting" },
    { key: "review", label: "模型评审", status: "waiting" },
    { key: "revise", label: "自动修订", status: "running", detail: "人工退回修订" },
    { key: "pending_final", label: "待终审", status: "waiting" },
  ];

  const emit = (activeMessage: string, running = true) => {
    onProgress({ steps: [...steps], activeMessage, running });
  };

  store.returnScript(hotspotId, humanNote);
  useHotscriptStore.getState().setScriptStatus(hotspotId, "revising");
  emit(`正在按你的退回意见修订脚本（生成 v${latestScript.version + 1}）…`);

  const reviseRes = await reviseScriptApi({
    hotspotId,
    script: latestScript,
    issues: latestReview?.issues ?? [],
    ruleFailures: latestRules.filter((r) => !r.passed),
    humanNote,
  });

  const nextVersion = latestScript.version + 1;
  const revisedScript: Script = {
    ...reviseRes.script,
    id: makeUniqueScriptId(hotspotId, nextVersion),
    hotspotId,
    platform: session.platform,
    version: nextVersion,
    source: reviseRes.usedFallback ? "preset" : "human_return",
  };

  const nextRound = session.revisions.length + 1;
  const revRecord: RevisionRecord = {
    round: nextRound,
    version: nextVersion,
    source: revisedScript.source,
    changes: reviseRes.changes,
    humanNote: humanNote.trim(),
    createdAt: meta.demoNow,
  };

  useHotscriptStore
    .getState()
    .addScriptVersion(hotspotId, revisedScript, revRecord);
  useHotscriptStore.getState().appendLog({
    actor: reviseRes.usedFallback ? "系统" : "模型",
    action: `人工退回后修订 v${nextVersion}`,
    target: targetLabel,
    detail:
      reviseRes.changes.length > 0
        ? reviseRes.changes.join("；")
        : `已按人工意见「${humanNote.trim()}」完成修订。`,
  });

  steps = updateSteps(steps, "revise", "done", `已生成 v${nextVersion}`);

  // 重新检查规则 + 评审
  steps = updateSteps(steps, "rules", "running");
  useHotscriptStore.getState().setScriptStatus(hotspotId, "checking");
  emit(`正在重新执行程序规则检查（R1–R7 · v${nextVersion}）…`);
  await sleep(220);

  const ruleResults = checkScriptRules({
    script: revisedScript,
    hotspot,
    platform: platformRule,
    game,
    lexicon,
  });
  const rulesPassed = ruleResults.every((r) => r.passed);

  steps = updateSteps(
    steps,
    "rules",
    rulesPassed ? "done" : "failed",
    summarizeRuleFailures(ruleResults)
  );
  useHotscriptStore
    .getState()
    .setVersionCheckResult(hotspotId, nextVersion, ruleResults);
  useHotscriptStore.getState().appendLog({
    actor: "系统",
    action: `规则检查 v${nextVersion}`,
    target: targetLabel,
    detail: rulesPassed
      ? "R1–R7 全部通过（7/7）。"
      : `未通过项：${ruleResults
          .filter((r) => !r.passed)
          .map((r) => `${r.id} ${r.name}`)
          .join("、")}。`,
  });

  steps = updateSteps(steps, "review", "running");
  emit(`正在调用独立评审模型评估 v${nextVersion}…`);

  const reviewRes = await reviewScriptApi({
    hotspotId,
    script: revisedScript,
    ruleResults,
  });

  useHotscriptStore
    .getState()
    .setVersionCheckResult(hotspotId, nextVersion, ruleResults, reviewRes.review);
  useHotscriptStore.getState().appendLog({
    actor: reviewRes.usedFallback ? "系统" : "模型",
    action: `独立评审 v${nextVersion}`,
    target: targetLabel,
    detail: `${reviewRes.review.passed ? "评审通过" : "评审未通过"}：${reviewRes.review.summary}`,
  });

  steps = updateSteps(
    steps,
    "review",
    reviewRes.review.passed ? "done" : "failed",
    reviewRes.review.passed
      ? "评审通过"
      : `${reviewRes.review.issues.length} 条待修`
  );

  const allOk = rulesPassed && reviewRes.review.passed;
  steps = updateSteps(steps, "pending_final", "done", "等待终稿确认");
  useHotscriptStore.getState().setScriptStatus(hotspotId, "pending_final", {
    unresolvedWarning: !allOk,
  });
  useHotscriptStore.getState().appendLog({
    actor: "系统",
    action: "重新进入待终审",
    target: targetLabel,
    detail: `人工退回修订版 v${nextVersion} 检查完成，等待终稿确认。`,
  });

  emit(`v${nextVersion} 修订并重新检查完成，请审阅确认`, false);
}

export function buildScriptMarkdown(script: Script, hotspot: Hotspot): string {
  const platformRule = platforms[script.platform];
  const totalSec = script.shots.reduce(
    (sum, s) => sum + Math.max(0, s.end - s.start),
    0
  );

  const shotRows = script.shots
    .map((s) => {
      const refTag = s.evidenceRef ? ` (${s.evidenceRef})` : "";
      const escape = (str: string) => str.replace(/\|/g, "\\|").replace(/\n/g, " ");
      return `| ${s.start}–${s.end}s | ${escape(s.visual)}${refTag} | ${escape(s.line)} | ${escape(s.subtitle)} |`;
    })
    .join("\n");

  const referencedEvidence = hotspot.evidence.filter((e) =>
    script.evidenceRefs.includes(e.id)
  );
  const evidenceLines =
    referencedEvidence.length > 0
      ? referencedEvidence
          .map(
            (e, i) =>
              `${i + 1}. **[E${i + 1}]** \`${e.id}\`（${meta.platformLabels[e.platform as keyof typeof meta.platformLabels] ?? e.platform}）— ${e.excerpt}  \n   来源链接：${e.url}  \n   快照哈希：\`${e.snapshotHash}\``
          )
          .join("\n")
      : "无";

  return [
    `# ${script.title}`,
    "",
    `- **关联热点**：${hotspot.title}（\`${hotspot.id}\`）`,
    `- **发布平台**：${platformRule.name}（${platformRule.aspect}）`,
    `- **版本号**：v${script.version}`,
    `- **总时长**：${totalSec} 秒`,
    `- **封面文案**：${script.coverText}`,
    `- **开场钩子**：${script.hook}`,
    "",
    "## 分镜脚本",
    "",
    "| 时间段 | 画面 | 台词 / 旁白 | 字幕 |",
    "| --- | --- | --- | --- |",
    shotRows,
    "",
    "## 片尾与音乐",
    "",
    `- **片尾卡**：${script.endCard}`,
    `- **BGM 建议**：${script.bgm}`,
    "",
    "## 引用热点证据",
    "",
    evidenceLines,
    "",
  ].join("\n");
}
