import metaData from "@data/meta.json";
import type { MetaConfig, ScoreDimension } from "@/types";

const defaultMeta = metaData as MetaConfig;

export function calculateTotalScore(
  dims: Record<ScoreDimension, number>,
  weights: Record<ScoreDimension, number> = defaultMeta.scoring.weights
): number {
  const keys = Object.keys(weights) as ScoreDimension[];
  const weightedSum = keys.reduce((sum, key) => {
    const dimValue = dims[key] ?? 0;
    const weight = weights[key] ?? 0;
    return sum + dimValue * weight;
  }, 0);
  return Math.round(weightedSum);
}
