import { useParams } from "react-router-dom";

export function TopicDetailPage() {
  const { hotspotId } = useParams<{ hotspotId: string }>();
  return (
    <div className="space-y-6">
      <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">
        脚本审阅台 {hotspotId ? `· ${hotspotId}` : ""}
      </h1>
    </div>
  );
}
