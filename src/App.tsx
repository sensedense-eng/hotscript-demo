import { lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { Layout } from "@/components/Layout";

const HotspotsPage = lazy(() =>
  import("@/pages/HotspotsPage").then((m) => ({ default: m.HotspotsPage }))
);
const TopicsPage = lazy(() =>
  import("@/pages/TopicsPage").then((m) => ({ default: m.TopicsPage }))
);
const TopicDetailPage = lazy(() =>
  import("@/pages/TopicDetailPage").then((m) => ({
    default: m.TopicDetailPage,
  }))
);
const KnowledgePage = lazy(() =>
  import("@/pages/KnowledgePage").then((m) => ({ default: m.KnowledgePage }))
);
const LogsPage = lazy(() =>
  import("@/pages/LogsPage").then((m) => ({ default: m.LogsPage }))
);
const AboutPage = lazy(() =>
  import("@/pages/AboutPage").then((m) => ({ default: m.AboutPage }))
);

export function App() {
  return (
    <TooltipProvider delayDuration={200}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HotspotsPage />} />
            <Route path="/topics" element={<TopicsPage />} />
            <Route path="/topics/:hotspotId" element={<TopicDetailPage />} />
            <Route path="/knowledge" element={<KnowledgePage />} />
            <Route path="/logs" element={<LogsPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster position="bottom-center" richColors />
    </TooltipProvider>
  );
}

export default App;
