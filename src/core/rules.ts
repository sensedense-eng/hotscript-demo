import type {
  GameConfig,
  Hotspot,
  LexiconConfig,
  PlatformRule,
  RuleResult,
  Script,
} from "@/types";

export interface RuleCheckInput {
  script: Script;
  hotspot: Hotspot;
  platform: PlatformRule;
  game: GameConfig;
  lexicon: LexiconConfig;
}

interface LabeledField {
  label: string;
  text: string;
}

function getScriptFields(script: Script): LabeledField[] {
  const fields: LabeledField[] = [
    { label: "标题", text: script.title ?? "" },
    { label: "封面文案", text: script.coverText ?? "" },
    { label: "开场钩子", text: script.hook ?? "" },
    { label: "片尾卡", text: script.endCard ?? "" },
  ];

  script.shots.forEach((shot, index) => {
    const n = index + 1;
    fields.push({ label: `镜头${n}画面`, text: shot.visual ?? "" });
    fields.push({ label: `镜头${n}台词`, text: shot.line ?? "" });
    fields.push({ label: `镜头${n}字幕`, text: shot.subtitle ?? "" });
  });

  return fields;
}

function charLength(str: string): number {
  return [...str].length;
}

export function checkScriptRules(input: RuleCheckInput): RuleResult[] {
  const { script, hotspot, platform, game, lexicon } = input;
  const fields = getScriptFields(script);
  const fullText = fields.map((f) => f.text).join("\n");

  // R1 时长
  const totalSec = script.shots.reduce(
    (sum, shot) => sum + Math.max(0, shot.end - shot.start),
    0
  );
  const r1Passed =
    totalSec >= platform.durationSec.min && totalSec <= platform.durationSec.max;
  const r1: RuleResult = {
    id: "R1",
    name: "时长校验",
    passed: r1Passed,
    hits: r1Passed ? [] : [`${totalSec} 秒`],
    message: r1Passed
      ? `总时长 ${totalSec} 秒，符合${platform.name}规范（${platform.durationSec.min}–${platform.durationSec.max} 秒）`
      : `总时长 ${totalSec} 秒，超出${platform.name}要求（${platform.durationSec.min}–${platform.durationSec.max} 秒）`,
  };

  // R2 文案长度
  const titleLen = charLength(script.title ?? "");
  const coverLen = charLength(script.coverText ?? "");
  const r2Hits: string[] = [];
  if (titleLen > platform.titleMaxChars) {
    r2Hits.push(`标题 ${titleLen} 字（上限 ${platform.titleMaxChars} 字）`);
  }
  if (coverLen > platform.coverMaxChars) {
    r2Hits.push(`封面 ${coverLen} 字（上限 ${platform.coverMaxChars} 字）`);
  }
  const r2Passed = r2Hits.length === 0;
  const r2: RuleResult = {
    id: "R2",
    name: "文案长度",
    passed: r2Passed,
    hits: r2Hits,
    message: r2Passed
      ? `标题 ${titleLen}/${platform.titleMaxChars} 字，封面 ${coverLen}/${platform.coverMaxChars} 字`
      : `文案字数超限：${r2Hits.join("；")}`,
  };

  // R3 广告法与敏感词
  const forbiddenWords = [...lexicon.adLawWords, ...lexicon.sensitiveWords];
  const r3Hits = Array.from(
    new Set(forbiddenWords.filter((word) => word && fullText.includes(word)))
  );
  const r3Passed = r3Hits.length === 0;
  const r3: RuleResult = {
    id: "R3",
    name: "广告法与敏感词",
    passed: r3Passed,
    hits: r3Hits,
    message: r3Passed
      ? "未命中广告法极限词或敏感词"
      : `命中禁用词：${r3Hits.join("、")}`,
  };

  // R4 必带提示
  const missingNotices = platform.requiredNotices.filter(
    (notice) => !(script.endCard ?? "").includes(notice)
  );
  const r4Passed = missingNotices.length === 0;
  const r4: RuleResult = {
    id: "R4",
    name: "必带提示",
    passed: r4Passed,
    hits: missingNotices,
    message: r4Passed
      ? `片尾已包含${platform.name}全部必带提示`
      : `片尾缺少必带提示：${missingNotices.join("、")}`,
  };

  // R5 剧透拦截
  const unreleasedKeywords = game.cards
    .filter((card) => card.confidentiality === "unreleased")
    .flatMap((card) => card.keywords);
  const r5Hits = Array.from(
    new Set(
      unreleasedKeywords.filter((kw) => kw && fullText.includes(kw))
    )
  );
  const r5Passed = r5Hits.length === 0;
  const r5: RuleResult = {
    id: "R5",
    name: "剧透拦截",
    passed: r5Passed,
    hits: r5Hits,
    message: r5Passed
      ? "未包含未公开版本或剧情关键词"
      : `命中未公开设定关键词：${r5Hits.join("、")}`,
  };

  // R6 证据引用
  const validEvidenceIds = new Set(hotspot.evidence.map((e) => e.id));
  const r6Hits: string[] = [];
  if (!script.evidenceRefs || script.evidenceRefs.length === 0) {
    r6Hits.push("未引用任何热点证据");
  } else {
    for (const refId of script.evidenceRefs) {
      if (!validEvidenceIds.has(refId)) {
        r6Hits.push(`无效证据 ID: ${refId}`);
      }
    }
  }
  if (hotspot.verification.status !== "verified") {
    r6Hits.push(`热点未通过核验（当前：${hotspot.verification.status}）`);
  }
  const r6Passed = r6Hits.length === 0;
  const r6: RuleResult = {
    id: "R6",
    name: "证据引用",
    passed: r6Passed,
    hits: r6Hits,
    message: r6Passed
      ? `已引用 ${script.evidenceRefs.length} 条已核验热点证据`
      : `证据引用校验失败：${r6Hits.join("；")}`,
  };

  // R7 设定硬事实（逐个字段单独检查，不拼接）
  const r7Hits: string[] = [];
  for (const card of game.cards) {
    for (const pattern of card.forbiddenClaims) {
      if (!pattern) continue;
      const regex = new RegExp(pattern);
      for (const field of fields) {
        const match = field.text.match(regex);
        if (match) {
          r7Hits.push(`${field.label}命中「${match[0]}」（冲突设定：${card.name}）`);
        }
      }
    }
  }
  const r7Passed = r7Hits.length === 0;
  const r7: RuleResult = {
    id: "R7",
    name: "设定硬事实",
    passed: r7Passed,
    hits: r7Hits,
    message: r7Passed
      ? "未触发任何游戏设定禁止表述"
      : `触发设定冲突：${r7Hits.join("；")}`,
  };

  return [r1, r2, r3, r4, r5, r6, r7];
}
