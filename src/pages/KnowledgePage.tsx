import { BookOpen, Lock, ShieldAlert, SlidersHorizontal } from "lucide-react";
import gameData from "@data/game.json";
import lexiconData from "@data/lexicon.json";
import platformsData from "@data/platforms.json";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  Confidentiality,
  GameConfig,
  LexiconConfig,
  Platform,
  PlatformsConfig,
} from "@/types";

const game = gameData as GameConfig;
const platforms = platformsData as PlatformsConfig;
const lexicon = lexiconData as LexiconConfig;

const CONFIDENTIALITY_META: Record<
  Confidentiality,
  { label: string; className: string }
> = {
  public: {
    label: "公开",
    className: "bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]/80",
  },
  internal: {
    label: "内部",
    className: "bg-slate-100 text-slate-700 border-slate-200",
  },
  unreleased: {
    label: "未公开",
    className: "bg-[#FFF1F2] text-[#E11D48] border-[#FECDD3]/80",
  },
};

const PLATFORM_KEYS: Platform[] = ["douyin", "bilibili", "xiaohongshu"];

export function KnowledgePage() {
  const unreleasedCount = game.cards.filter(
    (c) => c.confidentiality === "unreleased"
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-slate-900 leading-tight">
          知识库
        </h1>
        <p className="mt-1 text-[13px] text-slate-500">
          游戏设定卡、平台规范与合规词表，为模型生成与程序规则提供唯一事实依据
        </p>
      </div>

      <Tabs defaultValue="game" className="space-y-5">
        <TabsList className="bg-white border border-[#E2E8F0] p-1 h-10 rounded-[10px]">
          <TabsTrigger
            value="game"
            className="text-[13px] px-3.5 data-[state=active]:bg-[#F0FDFA] data-[state=active]:text-[#0F766E] data-[state=active]:shadow-none rounded-[7px] gap-1.5"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>游戏设定</span>
            <span className="tabular-nums text-slate-400">
              {game.cards.length}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="platforms"
            className="text-[13px] px-3.5 data-[state=active]:bg-[#F0FDFA] data-[state=active]:text-[#0F766E] data-[state=active]:shadow-none rounded-[7px] gap-1.5"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>平台规范</span>
            <span className="tabular-nums text-slate-400">
              {PLATFORM_KEYS.length}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="lexicon"
            className="text-[13px] px-3.5 data-[state=active]:bg-[#F0FDFA] data-[state=active]:text-[#0F766E] data-[state=active]:shadow-none rounded-[7px] gap-1.5"
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>合规词表</span>
            <span className="tabular-nums text-slate-400">
              {lexicon.adLawWords.length + lexicon.sensitiveWords.length}
            </span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: 游戏设定 */}
        <TabsContent value="game" className="space-y-5 mt-0">
          <Card className="rounded-[12px] border border-[#E2E8F0] bg-white px-5 py-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[16px] font-semibold text-slate-900">
                    {game.name}
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[12px] font-normal bg-slate-50 text-slate-600 border-slate-200"
                  >
                    v{game.currentVersion}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[12px] font-normal bg-[#F0FDFA] text-[#0F766E] border-[#99F6E4]"
                  >
                    {game.currentEvent}
                  </Badge>
                </div>
                <p className="text-[14px] text-slate-600">
                  {game.genre} · 品牌调性：{game.tone}
                </p>
              </div>
              <div className="text-[13px] text-slate-500 tabular-nums">
                共 {game.cards.length} 张设定卡（含 {unreleasedCount} 张未公开隔离）
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {game.cards.map((card) => {
              const isUnreleased = card.confidentiality === "unreleased";
              const confMeta = CONFIDENTIALITY_META[card.confidentiality];

              return (
                <Card
                  key={card.id}
                  className={cn(
                    "rounded-[12px] border bg-white p-5 shadow-sm flex flex-col justify-between gap-4",
                    isUnreleased
                      ? "border-[#FECDD3] bg-[#FFF1F2]/25"
                      : "border-[#E2E8F0]"
                  )}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge
                          variant="outline"
                          className="text-[12px] font-normal px-2 py-0 h-5 bg-slate-50 text-slate-600 border-slate-200"
                        >
                          {card.type}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[12px] font-medium px-2 py-0 h-5 border gap-1",
                            confMeta.className
                          )}
                        >
                          {isUnreleased && <Lock className="h-3 w-3" />}
                          <span>{confMeta.label}</span>
                        </Badge>
                      </div>
                      <span className="text-[13px] text-slate-400 tabular-nums">
                        v{card.effectiveVersion}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <h3 className="text-[16px] font-semibold text-slate-900 flex items-center gap-1.5">
                        {isUnreleased && (
                          <Lock className="h-4 w-4 text-[#E11D48] shrink-0" />
                        )}
                        <span>{card.name}</span>
                      </h3>
                      <p className="text-[14px] text-slate-700 leading-relaxed">
                        {card.summary}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2.5 pt-3 border-t border-slate-100">
                    {isUnreleased && (
                      <div className="rounded-lg border border-[#FECDD3] bg-[#FFF1F2] px-3 py-2 text-[13px] text-[#E11D48] flex items-start gap-1.5 leading-snug">
                        <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>
                          不进入模型上下文；出现在脚本中会被 R5 拦截
                        </span>
                      </div>
                    )}
                    <div className="text-[13px] text-slate-500">
                      出处：{card.source}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Tab 2: 平台规范 */}
        <TabsContent value="platforms" className="mt-0">
          <Card className="rounded-[12px] border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                  <TableHead className="w-[100px] text-[13px] font-medium text-slate-500">
                    平台
                  </TableHead>
                  <TableHead className="w-[84px] text-[13px] font-medium text-slate-500">
                    画幅
                  </TableHead>
                  <TableHead className="w-[120px] text-[13px] font-medium text-slate-500">
                    时长范围
                  </TableHead>
                  <TableHead className="w-[130px] text-[13px] font-medium text-slate-500">
                    字数上限
                  </TableHead>
                  <TableHead className="text-[13px] font-medium text-slate-500">
                    必带提示（R4）
                  </TableHead>
                  <TableHead className="text-[13px] font-medium text-slate-500">
                    风格与节奏要求
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {PLATFORM_KEYS.map((key) => {
                  const rule = platforms[key];
                  return (
                    <TableRow key={key} className="align-top">
                      <TableCell className="text-[14px] font-semibold text-slate-900">
                        {rule.name}
                      </TableCell>
                      <TableCell className="text-[14px] text-slate-700 tabular-nums">
                        {rule.aspect}
                      </TableCell>
                      <TableCell className="text-[14px] text-slate-700 tabular-nums">
                        {rule.durationSec.min}–{rule.durationSec.max} 秒
                      </TableCell>
                      <TableCell className="text-[13px] text-slate-700 tabular-nums space-y-0.5">
                        <div>标题 ≤ {rule.titleMaxChars} 字</div>
                        <div>封面 ≤ {rule.coverMaxChars} 字</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {rule.requiredNotices.map((notice) => (
                            <Badge
                              key={notice}
                              variant="outline"
                              className="text-[12px] font-normal bg-slate-50 text-slate-700 border-slate-200"
                            >
                              {notice}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-[14px] text-slate-700 leading-relaxed">
                        {rule.style}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Tab 3: 合规词表 */}
        <TabsContent value="lexicon" className="space-y-4 mt-0">
          <Card className="rounded-[12px] border border-[#E2E8F0] bg-white p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[16px] font-semibold text-slate-900">
                广告法极限词
              </h2>
              <span className="text-[13px] text-slate-500 tabular-nums">
                {lexicon.adLawWords.length} 词 · 由规则 R3 实时拦截
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {lexicon.adLawWords.map((word) => (
                <Badge
                  key={word}
                  variant="outline"
                  className="text-[12px] font-medium px-2.5 py-1 rounded-md bg-[#FFF1F2] text-[#E11D48] border-[#FECDD3]/80"
                >
                  {word}
                </Badge>
              ))}
            </div>
          </Card>

          <Card className="rounded-[12px] border border-[#E2E8F0] bg-white p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[16px] font-semibold text-slate-900">
                品牌与诱导敏感词
              </h2>
              <span className="text-[13px] text-slate-500 tabular-nums">
                {lexicon.sensitiveWords.length} 词 · 由规则 R3 实时拦截
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {lexicon.sensitiveWords.map((word) => (
                <Badge
                  key={word}
                  variant="outline"
                  className="text-[12px] font-medium px-2.5 py-1 rounded-md bg-[#FFFBEB] text-[#D97706] border-[#FDE68A]/80"
                >
                  {word}
                </Badge>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
