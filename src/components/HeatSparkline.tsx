import { Area, AreaChart } from "recharts";
import type { HeatPoint } from "@/types";

interface HeatSparklineProps {
  data: HeatPoint[];
  id: string;
  muted?: boolean;
}

export function HeatSparkline({
  data,
  id,
  muted = false,
}: HeatSparklineProps) {
  const strokeColor = muted ? "#94A3B8" : "#0F766E";
  const fillColor = muted ? "#F1F5F9" : "#F0FDFA";

  return (
    <div
      className="w-[120px] h-[36px] shrink-0 overflow-hidden"
      aria-label="热度趋势"
    >
      <AreaChart
        width={120}
        height={36}
        data={data}
        margin={{ top: 4, right: 2, bottom: 2, left: 2 }}
      >
        <Area
          type="monotone"
          dataKey="v"
          stroke={strokeColor}
          strokeWidth={1.75}
          fill={fillColor}
          fillOpacity={1}
          isAnimationActive={false}
          dot={false}
          activeDot={false}
          name={id}
        />
      </AreaChart>
    </div>
  );
}
