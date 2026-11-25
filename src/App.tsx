import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { Layout } from "@/components/Layout";
import { HotspotsPage } from "@/pages/HotspotsPage";
import { TopicsPage } from "@/pages/TopicsPage";
import { TopicDetailPage } from "@/pages/TopicDetailPage";
import { KnowledgePage } from "@/pages/KnowledgePage";
import { LogsPage } from "@/pages/LogsPage";
import { AboutPage } from "@/pages/AboutPage";

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
