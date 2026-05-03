
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle2, 
  Circle, 
  AlertCircle, 
  Upload,
  Sparkles,
  Scissors,
  Palette,
  Wand2,
  Download,
  Music,
  Type,
  GripVertical,
  TrendingUp
} from "lucide-react";

interface TestItem {
  id: string;
  label: string;
  category: "ingestion" | "intent" | "ai-analysis" | "clip-picker" | "style-mimicry" | "audio" | "finalization" | "export";
  status: "pending" | "pass" | "fail";
  critical: boolean;
}

const comprehensiveTests: TestItem[] = [
  // SEAMLESS INGESTION
  { id: "ingest-1", label: "Upload video file via drag & drop", category: "ingestion", status: "pending", critical: true },
  { id: "ingest-2", label: "Upload via file picker (< 100MB)", category: "ingestion", status: "pending", critical: true },
  { id: "ingest-3", label: "Upload via file picker (> 100MB)", category: "ingestion", status: "pending", critical: false },
  { id: "ingest-4", label: "Paste YouTube URL and download", category: "ingestion", status: "pending", critical: true },
  { id: "ingest-5", label: "Upload progress indicator shows correctly", category: "ingestion", status: "pending", critical: false },
  { id: "ingest-6", label: "Select from previous uploads", category: "ingestion", status: "pending", critical: true },
  { id: "ingest-7", label: "Script-to-content generation (text input)", category: "ingestion", status: "pending", critical: false },

  // INTENT SELECTION (Key Differentiator)
  { id: "intent-1", label: "Select 'Single video' intent", category: "intent", status: "pending", critical: true },
  { id: "intent-2", label: "Select 'Multiple short clips' intent", category: "intent", status: "pending", critical: true },
  { id: "intent-3", label: "Select 'Comprehensive edit' intent", category: "intent", status: "pending", critical: true },
  { id: "intent-4", label: "Select 'Let AI decide' intent", category: "intent", status: "pending", critical: true },
  { id: "intent-5", label: "Change aspect ratio (9:16, 16:9, 1:1)", category: "intent", status: "pending", critical: true },
  { id: "intent-6", label: "AI only generates requested video types", category: "intent", status: "pending", critical: true },
  { id: "intent-7", label: "Intent presets suggest optimal choices", category: "intent", status: "pending", critical: false },

  // AI ANALYSIS & PROCESSING
  { id: "analysis-1", label: "AI analysis completes without errors", category: "ai-analysis", status: "pending", critical: true },
  { id: "analysis-2", label: "Progress indicator shows all stages", category: "ai-analysis", status: "pending", critical: false },
  { id: "analysis-3", label: "Smart slices generated with timestamps", category: "ai-analysis", status: "pending", critical: true },
  { id: "analysis-4", label: "Engagement scores calculated (0-100)", category: "ai-analysis", status: "pending", critical: true },
  { id: "analysis-5", label: "Vision API provides diverse scores", category: "ai-analysis", status: "pending", critical: true },
  { id: "analysis-6", label: "Clip types identified (hook, talking_head, broll, action)", category: "ai-analysis", status: "pending", critical: false },
  { id: "analysis-7", label: "Speech integrity detection works", category: "ai-analysis", status: "pending", critical: false },
  { id: "analysis-8", label: "Audio-aware slicing (music structure)", category: "ai-analysis", status: "pending", critical: false },

  // INTUITIVE CLIP PICKER (Core Innovation)
  { id: "clip-1", label: "Drag clip from pool to video timeline", category: "clip-picker", status: "pending", critical: true },
  { id: "clip-2", label: "Drag clip between different videos", category: "clip-picker", status: "pending", critical: true },
  { id: "clip-3", label: "AI auto-refits video duration (±5s tolerance)", category: "clip-picker", status: "pending", critical: true },
  { id: "clip-4", label: "Drop zones appear when dragging", category: "clip-picker", status: "pending", critical: false },
  { id: "clip-5", label: "Clip preview modal plays correctly", category: "clip-picker", status: "pending", critical: false },
  { id: "clip-6", label: "Unused clips pool updates dynamically", category: "clip-picker", status: "pending", critical: false },
  { id: "clip-7", label: "Engagement scores visible on clips", category: "clip-picker", status: "pending", critical: false },
  { id: "clip-8", label: "Timeline shows target vs actual duration", category: "clip-picker", status: "pending", critical: true },

  // STYLE MIMICRY (Key Differentiator)
  { id: "style-1", label: "Reference video URL analysis works", category: "style-mimicry", status: "pending", critical: true },
  { id: "style-2", label: "Cut tempo extracted (ms per cut)", category: "style-mimicry", status: "pending", critical: true },
  { id: "style-3", label: "Color profile detected", category: "style-mimicry", status: "pending", critical: true },
  { id: "style-4", label: "Transition types identified", category: "style-mimicry", status: "pending", critical: false },
  { id: "style-5", label: "Style automatically applied to videos", category: "style-mimicry", status: "pending", critical: true },
  { id: "style-6", label: "All 14 color grading presets work", category: "style-mimicry", status: "pending", critical: true },
  { id: "style-7", label: "Pacing controls adjust tempo", category: "style-mimicry", status: "pending", critical: true },

  // AUDIO MIXER (Production Feature)
  { id: "audio-1", label: "Upload background music track", category: "audio", status: "pending", critical: false },
  { id: "audio-2", label: "Upload voiceover track", category: "audio", status: "pending", critical: false },
  { id: "audio-3", label: "Upload SFX track", category: "audio", status: "pending", critical: false },
  { id: "audio-4", label: "Volume sliders work (0-100%)", category: "audio", status: "pending", critical: false },
  { id: "audio-5", label: "Audio ducking enabled/disabled", category: "audio", status: "pending", critical: false },
  { id: "audio-6", label: "Ducking parameters adjustable", category: "audio", status: "pending", critical: false },
  { id: "audio-7", label: "Master volume control works", category: "audio", status: "pending", critical: false },
  { id: "audio-8", label: "Fade in/out per track", category: "audio", status: "pending", critical: false },

  // VIDEO FINALIZATION
  { id: "final-1", label: "Subtitle generation works", category: "finalization", status: "pending", critical: false },
  { id: "final-2", label: "Subtitle styling customizable (font, color, position)", category: "finalization", status: "pending", critical: false },
  { id: "final-3", label: "Custom text overlays with positioning", category: "finalization", status: "pending", critical: false },
  { id: "final-4", label: "Text-based watermark added", category: "finalization", status: "pending", critical: false },
  { id: "final-5", label: "AI text positioning analyzes frames", category: "finalization", status: "pending", critical: false },
  { id: "final-6", label: "Face detection positioning logic", category: "finalization", status: "pending", critical: false },
  { id: "final-7", label: "Finalized video downloads correctly", category: "finalization", status: "pending", critical: false },

  // FRICTIONLESS EXPORT
  { id: "export-1", label: "Export single video (MP4)", category: "export", status: "pending", critical: true },
  { id: "export-2", label: "Export with format selection (MP4/WebM/MOV)", category: "export", status: "pending", critical: true },
  { id: "export-3", label: "Export with quality selection (high/medium/low)", category: "export", status: "pending", critical: true },
  { id: "export-4", label: "Export all videos as ZIP", category: "export", status: "pending", critical: true },
  { id: "export-5", label: "Downloaded videos play correctly", category: "export", status: "pending", critical: true },
  { id: "export-6", label: "File extensions match selected format", category: "export", status: "pending", critical: false },
];

export function ComprehensiveTestChecklist() {
  const [tests, setTests] = useState<TestItem[]>(comprehensiveTests);

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
    const criticalTests = tests.filter(t => t.critical);
    const criticalPassed = criticalTests.filter(t => t.status === "pass").length;
    return { 
      passed, 
      failed, 
      total, 
      percentage: Math.round((passed / total) * 100),
      criticalPassed,
      criticalTotal: criticalTests.length,
      criticalPercentage: Math.round((criticalPassed / criticalTests.length) * 100)
    };
  };

  const overall = overallStats();

  const categories = [
    { key: "ingestion" as const, label: "Seamless Ingestion", icon: Upload, color: "text-chart-1" },
    { key: "intent" as const, label: "Intent Selection", icon: TrendingUp, color: "text-chart-2" },
    { key: "ai-analysis" as const, label: "AI Analysis", icon: Sparkles, color: "text-chart-3" },
    { key: "clip-picker" as const, label: "Clip Picker", icon: GripVertical, color: "text-chart-4" },
    { key: "style-mimicry" as const, label: "Style Mimicry", icon: Palette, color: "text-chart-5" },
    { key: "audio" as const, label: "Audio Mixer", icon: Music, color: "text-blue-500" },
    { key: "finalization" as const, label: "Finalization", icon: Type, color: "text-purple-500" },
    { key: "export" as const, label: "Export", icon: Download, color: "text-green-500" },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Comprehensive Feature Testing</CardTitle>
              <CardDescription>Test all core features and innovations</CardDescription>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold">{overall.percentage}%</div>
              <div className="text-sm text-muted-foreground">
                {overall.passed}/{overall.total} tests
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Critical Tests Progress */}
          <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold">Critical Features</span>
              <Badge variant="default">{overall.criticalPercentage}% Complete</Badge>
            </div>
            <Progress value={overall.criticalPercentage} className="h-2" />
            <p className="text-sm text-muted-foreground mt-2">
              {overall.criticalPassed} of {overall.criticalTotal} critical tests passed
            </p>
          </div>

          {/* Category Overview Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {categories.map(cat => {
              const stats = categoryStats(cat.key);
              return (
                <div key={cat.key} className="text-center p-4 bg-muted/30 rounded-lg">
                  <cat.icon className={`h-6 w-6 mx-auto mb-2 ${cat.color}`} />
                  <div className="text-xs font-medium text-muted-foreground uppercase mb-1">
                    {cat.label}
                  </div>
                  <div className="text-2xl font-bold">{stats.percentage}%</div>
                  <div className="text-xs text-muted-foreground">
                    {stats.passed}/{stats.total} passed
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detailed Test Lists */}
          <div className="space-y-8">
            {categories.map(category => {
              const categoryTests = tests.filter(t => t.category === category.key);
              const stats = categoryStats(category.key);
              
              return (
                <div key={category.key}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <category.icon className={`h-5 w-5 ${category.color}`} />
                      <h3 className="font-semibold text-lg">{category.label}</h3>
                    </div>
                    <Badge variant="outline">
                      {stats.passed}/{stats.total} passed
                    </Badge>
                  </div>
                  
                  <div className="space-y-2">
                    {categoryTests.map(test => (
                      <div 
                        key={test.id}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex gap-2">
                          <button
                            onClick={() => toggleTest(test.id, "pass")}
                            className={`transition-colors ${
                              test.status === "pass" 
                                ? "text-green-500" 
                                : "text-muted-foreground hover:text-green-500"
                            }`}
                            title="Mark as passed"
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
                            title="Mark as failed"
                          >
                            <AlertCircle className="h-5 w-5" />
                          </button>
                        </div>
                        
                        <span className="flex-1">
                          {test.label}
                          {test.critical && (
                            <Badge variant="destructive" className="ml-2 text-xs">
                              CRITICAL
                            </Badge>
                          )}
                        </span>
                        
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
              );
            })}
          </div>

          {/* Test Summary */}
          <div className="border-t pt-6">
            <h3 className="font-semibold mb-4">Testing Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4 bg-green-500/10 border-green-500/20">
                <div className="text-center">
                  <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold">{overall.passed}</div>
                  <div className="text-sm text-muted-foreground">Passed</div>
                </div>
              </Card>
              <Card className="p-4 bg-red-500/10 border-red-500/20">
                <div className="text-center">
                  <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                  <div className="text-2xl font-bold">{overall.failed}</div>
                  <div className="text-sm text-muted-foreground">Failed</div>
                </div>
              </Card>
              <Card className="p-4 bg-muted/50">
                <div className="text-center">
                  <Circle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <div className="text-2xl font-bold">{overall.total - overall.passed - overall.failed}</div>
                  <div className="text-sm text-muted-foreground">Pending</div>
                </div>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
