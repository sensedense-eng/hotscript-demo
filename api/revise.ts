import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getHotspotById,
  normalizeScript,
  type ReviewIssue,
  type Script,
} from "./_lib/data.js";
import { chatJSON, getLlmConfig } from "./_lib/llm.js";
import { buildRevisePrompt } from "./_lib/prompts.js";
import { checkRateLimit } from "./_lib/ratelimit.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(200).json({ error: "仅支持 POST 请求", fallback: true });
  }

  if (!getLlmConfig()) {
    return res
      .status(200)
      .json({ error: "未配置模型环境变量", fallback: true });
  }

  const rate = checkRateLimit(req);
  if (!rate.allowed) {
    return res.status(200).json({
      error: `请求过于频繁，请 ${rate.retryAfterSec} 秒后再试`,
      fallback: true,
    });
  }

  try {
    const body =
      typeof req.body === "string"
        ? (JSON.parse(req.body) as Record<string, unknown>)
        : ((req.body ?? {}) as Record<string, unknown>);

    const hotspotId =
      typeof body.hotspotId === "string" ? body.hotspotId.trim() : "";
    const script = body.script as Script | undefined;
    const issues = Array.isArray(body.issues)
      ? (body.issues as ReviewIssue[])
      : [];
    const ruleFailures = Array.isArray(body.ruleFailures)
      ? (body.ruleFailures as Array<{
          id: string;
          name: string;
          hits: string[];
          message: string;
        }>)
      : [];
    const humanNote =
      typeof body.humanNote === "string" ? body.humanNote.trim() : undefined;

    const hotspot = getHotspotById(hotspotId);
    if (!hotspot || !script) {
      return res
        .status(200)
        .json({ error: "缺少热点或脚本参数", fallback: true });
    }

    const prompt = buildRevisePrompt({
      hotspot,
      script,
      issues,
      ruleFailures,
      humanNote,
    });

    const raw = await chatJSON<Record<string, unknown>>({
      system: prompt.system,
      user: prompt.user,
      maxTokens: 2000,
    });

    const rawScript =
      raw.script && typeof raw.script === "object" ? raw.script : raw;
    const changes = Array.isArray(raw.changes)
      ? raw.changes
          .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
          .map((x) => x.trim())
      : ["已按评审意见与规则检查结果完成修订"];

    const nextVersion = (Number(script.version) || 1) + 1;
    const revised = normalizeScript(rawScript, {
      hotspotId: hotspot.id,
      platform: script.platform,
      version: nextVersion,
      source: humanNote ? "human_return" : "revision",
      fallbackEvidenceIds:
        script.evidenceRefs?.length > 0
          ? script.evidenceRefs
          : hotspot.evidence.slice(0, 1).map((e) => e.id),
    });

    return res.status(200).json({
      script: revised,
      changes,
      source: "llm",
    });
  } catch (err) {
    return res.status(200).json({
      error: err instanceof Error ? err.message : "修订脚本失败",
      fallback: true,
    });
  }
}
