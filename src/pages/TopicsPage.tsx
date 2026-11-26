import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, Clock, FileText, Sparkles } from "lucide-react";
import hotspotsData from "@data/hotspots.json";
import platformsData from "@data/platforms.json";
import { formatShortDateTime } from "@/core/time";
import { useHotscriptStore } from "@/store";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Hotspot, PlatformsConfig, ScriptStatus } from "@/types";

const hotspots = hotspotsData as Hotspot[];
const platforms = platformsData as PlatformsConfig;

const SCRIPT_STATUS_META: Record<
  ScriptStatus,
  { label: string; className: string }
> = {
  idle: {
    label: "待生成脚本",
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

export function TopicsPage() {
  const navigate = useNavigate();
  const topics = useHotscriptStore((s) => s.topics);

  const topicList = useMemo(() => {
    return Object.values(topics)
      .map((session) => {
        const hotspot = hotspots.find((h) => h.id === session.hotspotId);
        return hotspot ? { session, hotspot } : null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => b.session.selectedAt.localeCompare(a.session.selectedAt));
  }, [topics]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-slate-900 leading-tight">
          选题与脚本
        </h1>
        <p className="mt-1 text-[13px] text-slate-500">
          管理已确认选题的脚本生成、规则核查、独立评审与终稿交付
        </p>
      </div>

      {topicList.length === 0 ? (
        <Card className="rounded-[12px] border border-[#E2E8F0] bg-white p-12 text-center shadow-sm space-y-4">
          <div className="mx-auto h-11 w-11 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
            <FileText className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="text-[16px] font-semibold text-slate-900">
              暂无已确认的选题
            </div>
            <p className="text-[14px] text-slate-500">
              请先前往热点工作台审阅核验证据并确认选题
            </p>
          </div>
          <Button
            type="button"
            onClick={() => navigate("/")}
            className="bg-[#0F766E] hover:bg-[#115E59] text-white"
          >
            去热点工作台
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {topicList.map(({ session, hotspot }) => {
            const statusInfo = SCRIPT_STATUS_META[session.scriptStatus];
            const latestScript =
              session.versions[session.versions.length - 1] ?? null;
            const latestRules = latestScript
              ? session.ruleResultsByVersion[latestScript.version] ?? []
              : [];
            const passedRulesCount = latestRules.filter((r) => r.passed).length;
            const platformRule = platforms[session.platform];

            return (
              <Card
                key={session.hotspotId}
                onClick={() => navigate(`/topics/${session.hotspotId}`)}
                className="rounded-[12px] border border-[#E2E8F0] bg-white p-5 shadow-sm hover:border-slate-300 transition-colors cursor-pointer flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
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
                        className="text-[12px] font-normal px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 border-slate-200"
                      >
                        {platformRule.name}
                      </Badge>
                      {latestScript && (
                        <Badge
                          variant="outline"
                          className="text-[12px] font-normal px-2 py-0.5 rounded-md bg-white text-slate-600 border-slate-200 tabular-nums"
                        >
                          v{latestScript.version}
                        </Badge>
                      )}
                    </div>
                    <span className="text-[13px] text-slate-400 tabular-nums inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {formatShortDateTime(session.selectedAt)}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h2 className="text-[16px] font-semibold text-slate-900 leading-snug">
                      {hotspot.title}
                    </h2>
                    <p className="text-[14px] text-slate-600 line-clamp-2">
                      {latestScript
                        ? `脚本标题：${latestScript.title}`
                        : session.direction || hotspot.summary}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
                  <div className="text-[13px] text-slate-500 tabular-nums flex items-center gap-3">
                    {latestRules.length > 0 ? (
                      <span className="inline-flex items-center gap-1 text-slate-700">
                        <CheckCircle2
                          className={cn(
                            "h-3.5 w-3.5",
                            passedRulesCount === latestRules.length
                              ? "text-[#059669]"
                              : "text-[#D97706]"
                          )}
                        />
                        规则 {passedRulesCount}/{latestRules.length}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-500">
                        <Sparkles className="h-3.5 w-3.5 text-[#0F766E]" />
                        尚未生成脚本
                      </span>
                    )}
                    <span>版本数 {session.versions.length}</span>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/topics/${session.hotspotId}`);
                    }}
                    className="h-8 px-3 text-[13px] border-slate-200 text-slate-700 hover:bg-slate-50 gap-1"
                  >
                    <span>
                      {latestScript ? "进入审阅台" : "去生成脚本"}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
