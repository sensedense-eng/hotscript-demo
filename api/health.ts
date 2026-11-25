import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getLlmConfig } from "./_lib/llm.js";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const config = getLlmConfig();
  if (!config) {
    return res.status(200).json({
      ok: false,
      provider: null,
      model: null,
    });
  }

  return res.status(200).json({
    ok: true,
    provider: config.provider,
    model: config.model,
  });
}
