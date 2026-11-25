import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getHotspotById,
  getPlatforms,
  normalizeScript,
  type Platform,
} from "./_lib/data.js";
import { chatJSON, getLlmConfig } from "./_lib/llm.js";
import { buildGeneratePrompt } from "./_lib/prompts.js";
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
    const platform =
      typeof body.platform === "string"
        ? (body.platform.trim() as Platform)
        : "douyin";
    const direction =
      typeof body.direction === "string" ? body.direction.trim() : undefined;

    const hotspot = getHotspotById(hotspotId);
    const platforms = getPlatforms();
    if (!hotspot) {
      return res
        .status(200)
        .json({ error: `未找到热点 ${hotspotId}`, fallback: true });
    }
    if (!platforms[platform]) {
      return res
        .status(200)
        .json({ error: `不支持的平台 ${platform}`, fallback: true });
    }

    const prompt = buildGeneratePrompt({ hotspot, platform, direction });
    const raw = await chatJSON({
      system: prompt.system,
      user: prompt.user,
      maxTokens: 2000,
    });

    const script = normalizeScript(raw, {
      hotspotId: hotspot.id,
      platform,
      version: 1,
      source: "llm",
      fallbackEvidenceIds: hotspot.evidence.slice(0, 1).map((e) => e.id),
    });

    return res.status(200).json({ script, source: "llm" });
  } catch (err) {
    return res.status(200).json({
      error: err instanceof Error ? err.message : "生成脚本失败",
      fallback: true,
    });
  }
}
