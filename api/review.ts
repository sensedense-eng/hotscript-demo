import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getHotspotById,
  normalizeReview,
  type Script,
} from "./_lib/data";
import { chatJSON, getLlmConfig } from "./_lib/llm";
import { buildReviewPrompt } from "./_lib/prompts";
import { checkRateLimit } from "./_lib/ratelimit";

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
    const ruleResults = Array.isArray(body.ruleResults)
      ? (body.ruleResults as Array<{
          id: string;
          name: string;
          passed: boolean;
          hits: string[];
          message: string;
        }>)
      : undefined;

    const hotspot = getHotspotById(hotspotId);
    if (!hotspot || !script) {
      return res
        .status(200)
        .json({ error: "缺少热点或脚本参数", fallback: true });
    }

    const prompt = buildReviewPrompt({ hotspot, script, ruleResults });
    const raw = await chatJSON({
      system: prompt.system,
      user: prompt.user,
      maxTokens: 1200,
    });

    const review = normalizeReview(raw);
    return res.status(200).json({ review, source: "llm" });
  } catch (err) {
    return res.status(200).json({
      error: err instanceof Error ? err.message : "评审脚本失败",
      fallback: true,
    });
  }
}
