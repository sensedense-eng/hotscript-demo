import { Suspense, useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  Flame,
  FileText,
  BookOpen,
  History,
  Info,
  RotateCcw,
  ChevronsUpDown,
  UtensilsCrossed,
  Clock,
} from "lucide-react";
import game from "@data/game.json";
import meta from "@data/meta.json";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const NAV_ITEMS = [
  { to: "/", label: "热点工作台", icon: Flame, end: true },
  { to: "/topics", label: "选题与脚本", icon: FileText, end: false },
  { to: "/knowledge", label: "知识库", icon: BookOpen, end: false },
  { to: "/logs", label: "操作日志", icon: History, end: false },
  { to: "/about", label: "方案说明", icon: Info, end: false },
];

const TOPBAR_CONTEXT_LABEL = `${game.name} · ${game.currentVersion} ${game.currentEvent.split("（")[0]}`;

function formatDemoClock(iso: string): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return iso;
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  const hour = match[4];
  const minute = match[5];
  return `演示时间 ${month}月${day}日 ${hour}:${minute}`;
}

export function Layout() {
  const [modelOnline, setModelOnline] = useState<boolean>(false);
  const [resetOpen, setResetOpen] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    fetch("/api/health")
      .then((res) => (res.ok ? res.json() : { ok: false }))
      .then((data: { ok?: boolean }) => {
        if (active) {
          setModelOnline(Boolean(data?.ok));
        }
      })
      .catch(() => {
        if (active) {
          setModelOnline(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const handleResetDemo = () => {
    localStorage.removeItem("hotscript-demo-v1");
    localStorage.removeItem("hotscript-demo-guide-dismissed");
    setResetOpen(false);
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex">
      {/* 左侧固定侧边栏 */}
      <aside className="fixed inset-y-0 left-0 z-30 w-[232px] bg-white border-r border-slate-200 flex flex-col">
        {/* 产品名 + 游戏切换器 */}
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2.5 px-1">
            <div className="h-7 w-7 rounded-lg bg-[#0F766E] text-white flex items-center justify-center shrink-0">
              <UtensilsCrossed className="h-4 w-4" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-slate-900">
              热点脚本工作台
            </span>
          </div>

          <div
            className="w-full rounded-[12px] border border-slate-200 bg-slate-50/70 px-3 py-2 flex items-center justify-between cursor-default select-none"
            title="当前演示项目"
          >
            <div className="min-w-0">
              <div className="text-[14px] font-medium text-slate-900 truncate">
                云屿食堂
              </div>
              <div className="text-[13px] text-slate-500 tabular-nums">
                v{meta.gameVersion}
              </div>
            </div>
            <ChevronsUpDown className="h-4 w-4 text-slate-400 shrink-0" />
          </div>
        </div>

        <Separator />

        {/* 主导航 */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[14px] font-medium transition-colors duration-150",
                    isActive
                      ? "bg-[#F0FDFA] text-[#0F766E]"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <Separator />

        {/* 底部重置演示 */}
        <div className="p-3">
          <Dialog open={resetOpen} onOpenChange={setResetOpen}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-[14px] text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              >
                <RotateCcw className="h-4 w-4" />
                <span>重置演示</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle>重置演示数据？</DialogTitle>
                <DialogDescription className="text-[14px] text-slate-600">
                  将清空本地保存的选题、脚本与操作日志，恢复为初始演示状态。
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  variant="outline"
                  onClick={() => setResetOpen(false)}
                >
                  取消
                </Button>
                <Button
                  onClick={handleResetDemo}
                  className="bg-[#0F766E] hover:bg-[#115E59] text-white"
                >
                  确认重置
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </aside>

      {/* 右侧主区域 */}
      <div className="flex-1 pl-[232px] min-w-0 flex flex-col">
        {/* 顶栏 */}
        <header className="sticky top-0 z-20 h-14 bg-white/95 border-b border-slate-200 px-6 flex items-center justify-between gap-4">
          <div className="text-[14px] font-medium text-slate-700 truncate">
            {TOPBAR_CONTEXT_LABEL}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5 text-[13px] text-slate-600 tabular-nums">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span>{formatDemoClock(meta.demoNow)}</span>
            </div>

            <Separator orientation="vertical" className="h-4" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="secondary"
                  className="text-[12px] font-medium bg-slate-100 text-slate-700 hover:bg-slate-200/80 cursor-default"
                >
                  演示环境
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-[13px]">
                热点为模拟数据，脚本由大模型实时生成
              </TooltipContent>
            </Tooltip>

            <div className="flex items-center gap-1.5 text-[13px] text-slate-600">
              <span
                className={cn(
                  "h-2 w-2 rounded-full shrink-0",
                  modelOnline ? "bg-[#059669]" : "bg-slate-400"
                )}
              />
              <span>
                {modelOnline ? "模型在线" : "离线·使用预置结果"}
              </span>
            </div>
          </div>
        </header>

        {/* 内容区（最大宽 1280px 居中） */}
        <main className="flex-1 w-full max-w-[1280px] mx-auto px-6 py-6">
          <Suspense
            fallback={
              <div className="space-y-5 animate-pulse">
                <div className="space-y-2">
                  <div className="h-7 w-40 rounded-md bg-slate-200/80" />
                  <div className="h-4 w-72 rounded-md bg-slate-200/60" />
                </div>
                <div className="h-64 rounded-[12px] bg-white border border-slate-200" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
