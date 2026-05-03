import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { ConnectionMonitor } from "@/components/connection-monitor";
import { Route, Switch } from "wouter";
import Home from "@/pages/home";
import AdminDashboard from "@/pages/admin-dashboard";
import RoadmapPage from "@/pages/roadmap";
import EditorPage from "@/pages/editor";
import ContentStudio from "@/pages/content-studio"; // Import ContentStudio
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/roadmap" component={RoadmapPage} />
      <Route path="/editor/:projectId" component={EditorPage} />
      <Route path="/content-studio" component={ContentStudio} /> {/* Add ContentStudio route */}
      <Route path="/:rest*" component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ConnectionMonitor />
        <Router />
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;