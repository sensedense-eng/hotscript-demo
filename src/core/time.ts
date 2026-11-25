import metaData from "@data/meta.json";
import type { MetaConfig } from "@/types";

const defaultMeta = metaData as MetaConfig;

export function getDemoNowMs(nowIso: string = defaultMeta.demoNow): number {
  return new Date(nowIso).getTime();
}

export function formatDemoClock(iso: string = defaultMeta.demoNow): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return iso;
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  return `演示时间 ${month}月${day}日 ${match[4]}:${match[5]}`;
}

export function formatRelativeTime(
  targetIso: string,
  nowIso: string = defaultMeta.demoNow
): string {
  const targetMs = new Date(targetIso).getTime();
  const nowMs = new Date(nowIso).getTime();
  if (Number.isNaN(targetMs) || Number.isNaN(nowMs)) {
    return targetIso;
  }

  const diffSec = Math.round((nowMs - targetMs) / 1000);
  if (diffSec < 0) {
    const absMin = Math.round(Math.abs(diffSec) / 60);
    if (absMin < 60) return `${absMin} 分钟后`;
    const absHours = Math.round(absMin / 60);
    return `${absHours} 小时后`;
  }

  if (diffSec < 60) {
    return "刚刚";
  }

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return `${diffMin} 分钟前`;
  }

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return `${diffHours} 小时前`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} 天前`;
}

export function formatRemainingWindow(
  windowEndIso: string,
  nowIso: string = defaultMeta.demoNow
): string {
  const endMs = new Date(windowEndIso).getTime();
  const nowMs = new Date(nowIso).getTime();
  if (Number.isNaN(endMs) || Number.isNaN(nowMs)) {
    return "—";
  }

  const diffMs = endMs - nowMs;
  if (diffMs <= 0) {
    return "已过期";
  }

  const totalMinutes = Math.floor(diffMs / (60 * 1000));
  if (totalMinutes < 60) {
    return "剩余不足 1 小时";
  }

  const totalHours = Math.round(diffMs / (60 * 60 * 1000));
  return `剩余 ${totalHours} 小时`;
}

export function formatShortDateTime(iso: string): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return iso;
  return `${match[2]}-${match[3]} ${match[4]}:${match[5]}`;
}
