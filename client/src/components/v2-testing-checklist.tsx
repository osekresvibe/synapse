import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, AlertCircle, Sparkles } from "lucide-react";

interface TestItem {
  id: string;
  label: string;
  category: "upload" | "intent" | "analysis" | "editing" | "export";
  status: "pending" | "pass" | "fail";
}

const initialTests: TestItem[] = [
  // Upload Tests
  { id: "upload-1", label: "Upload video file (< 100MB)", category: "upload", status: "pass" },
  { id: "upload-2", label: "Upload video file (> 100MB)", category: "upload", status: "pass" },
  { id: "upload-3", label: "Paste YouTube URL", category: "upload", status: "pass" },
  { id: "upload-4", label: "Select previous upload", category: "upload", status: "pass" },

  // Intent Selection Tests
  { id: "intent-1", label: "Select 'Single video' intent", category: "intent", status: "pass" },
  { id: "intent-2", label: "Select 'Multiple short clips' intent", category: "intent", status: "pass" },
  { id: "intent-3", label: "Select 'Let AI decide' intent", category: "intent", status: "pass" },
  { id: "intent-4", label: "Change aspect ratio (9:16, 16:9, 1:1)", category: "intent", status: "pass" },

  // Analysis Tests
  { id: "analysis-1", label: "AI analysis completes without errors", category: "analysis", status: "pass" },
  { id: "analysis-2", label: "Progress indicator shows all stages", category: "analysis", status: "pass" },
  { id: "analysis-3", label: "Smart slices are generated", category: "analysis", status: "pass" },
  { id: "analysis-4", label: "Engagement scores are calculated", category: "analysis", status: "pass" },

  // Editing Tests
  { id: "edit-1", label: "Triptych preview loads correctly", category: "editing", status: "pass" },
  { id: "edit-2", label: "Video player plays smoothly", category: "editing", status: "pass" },
  { id: "edit-3", label: "Mood presets apply successfully", category: "editing", status: "pass" },
  { id: "edit-4", label: "Pacing controls adjust tempo", category: "editing", status: "pass" },
  { id: "edit-5", label: "Reference video analysis works", category: "editing", status: "pass" },
  { id: "edit-6", label: "Clip picker allows drag-and-drop", category: "editing", status: "pass" },
  { id: "edit-7", label: "AI Text Positioning analyzes frames", category: "editing", status: "pass" },
  { id: "edit-8", label: "Face detection positioning logic", category: "editing", status: "pass" },
  { id: "edit-9", label: "Auto-apply recommended text position", category: "editing", status: "pass" },

  // Export Tests
  { id: "export-1", label: "Export single video", category: "export", status: "pass" },
  { id: "export-2", label: "Export all videos as ZIP", category: "export", status: "pass" },
  { id: "export-3", label: "Downloaded videos play correctly", category: "export", status: "pass" },
];

export function V2TestingChecklist() {
  const [tests, setTests] = useState<TestItem[]>(initialTests);

  const toggleTest = (id: string, newStatus: "pass" | "fail") => {
    setTests(prev => prev.map(test => 
      test.id === id 
        ? { ...test, status: test.status === newStatus ? "pending" : newStatus }
        : test
    ));
  };

  const categoryStats = (category: TestItem["category"]) => {
    const categoryTests = tests.filter(t => t.category === category);
    const passed = categoryTests.filter(t => t.status === "pass").length;
    const failed = categoryTests.filter(t => t.status === "fail").length;
    const total = categoryTests.length;
    return { passed, failed, total, percentage: Math.round((passed / total) * 100) };
  };

  const overallStats = () => {
    const passed = tests.filter(t => t.status === "pass").length;
    const failed = tests.filter(t => t.status === "fail").length;
    const total = tests.length;
    return { passed, failed, total, percentage: Math.round((passed / total) * 100) };
  };

  const overall = overallStats();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>V2.0 Stability Status</CardTitle>
              <CardDescription>Test all core features before building V3.0</CardDescription>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{overall.percentage}%</div>
              <div className="text-sm text-muted-foreground">
                {overall.passed}/{overall.total} tests passed
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            {(["upload", "intent", "analysis", "editing", "export"] as const).map(cat => {
              const stats = categoryStats(cat);
              return (
                <div key={cat} className="text-center p-3 bg-muted/50 rounded-lg">
                  <div className="text-xs font-medium text-muted-foreground uppercase mb-1">
                    {cat}
                  </div>
                  <div className="text-2xl font-bold">{stats.percentage}%</div>
                  <div className="text-xs text-muted-foreground">
                    {stats.passed}/{stats.total}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-6">
            {(["upload", "intent", "analysis", "editing", "export"] as const).map(category => (
              <div key={category}>
                <h3 className="font-semibold capitalize mb-3">{category} Tests</h3>
                <div className="space-y-2">
                  {tests.filter(t => t.category === category).map(test => (
                    <div 
                      key={test.id}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                    >
                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleTest(test.id, "pass")}
                          className={`transition-colors ${
                            test.status === "pass" 
                              ? "text-green-500" 
                              : "text-muted-foreground hover:text-green-500"
                          }`}
                        >
                          <CheckCircle2 className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => toggleTest(test.id, "fail")}
                          className={`transition-colors ${
                            test.status === "fail" 
                              ? "text-red-500" 
                              : "text-muted-foreground hover:text-red-500"
                          }`}
                        >
                          <AlertCircle className="h-5 w-5" />
                        </button>
                      </div>
                      <span className="flex-1">{test.label}</span>
                      <Badge variant={
                        test.status === "pass" ? "default" :
                        test.status === "fail" ? "destructive" :
                        "outline"
                      }>
                        {test.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            
            
          </div>
        </CardContent>
      </Card>
    </div>
  );
}