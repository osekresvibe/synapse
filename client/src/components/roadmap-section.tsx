import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Mic, Music, Type, Image, Zap, Clock, Upload, Video } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { V2TestingChecklist } from "@/components/v2-testing-checklist";
import { Button } from "@/components/ui/button";

interface RoadmapFeature {
  id: string;
  title: string;
  description: string;
  icon: typeof Sparkles;
  status: "coming-soon" | "in-progress" | "beta";
  category: "content-input" | "ai-generation" | "export";
}

const v3Features: RoadmapFeature[] = [
  {
    id: "text-to-carousel",
    title: "Script-to-Content Generator",
    description: "Paste text scripts → AI generates video reels, carousel images, or audio MP3s",
    icon: Type,
    status: "beta",
    category: "content-input",
  },
  {
    id: "platform-analyzer",
    title: "Platform Content Analyzer",
    description: "AI analyzes top-performing content on target platforms to inform editing decisions",
    icon: Sparkles,
    status: "coming-soon",
    category: "ai-generation",
  },
  {
    id: "multi-format-export",
    title: "Multi-Format Generator",
    description: "One video → Auto-generate optimized versions for TikTok, Instagram, YouTube, LinkedIn",
    icon: Video,
    status: "coming-soon",
    category: "export",
  },
  {
    id: "ai-voiceover",
    title: "AI Voiceover Generation",
    description: "Professional text-to-speech narration with ElevenLabs integration",
    icon: Mic,
    status: "coming-soon",
    category: "ai-generation",
  },
  {
    id: "background-music",
    title: "Smart Soundtrack Selection",
    description: "Royalty-free music library with auto-ducking for voiceovers",
    icon: Music,
    status: "coming-soon",
    category: "ai-generation",
  },
  {
    id: "text-overlays",
    title: "Animated Text Overlays",
    description: "Add dynamic, viral-style text animations to your videos",
    icon: Sparkles,
    status: "coming-soon",
    category: "ai-generation",
  },
  {
    id: "slide-import",
    title: "Canva Slide Integration",
    description: "Import Canva or PDF slides directly as visual assets",
    icon: Image,
    status: "coming-soon",
    category: "content-input",
  },
  {
    id: "viral-templates",
    title: "Viral Content Presets",
    description: "Instagram carousels, YouTube Shorts, TikTok templates optimized for engagement",
    icon: Zap,
    status: "coming-soon",
    category: "export",
  },
];

const v4Features: RoadmapFeature[] = [
  {
    id: "batch-upload",
    title: "Batch Video Processing",
    description: "Upload multiple videos at once and process them in parallel with the same intent",
    icon: Upload,
    status: "beta",
    category: "content-input",
  },
  {
    id: "batch-progress",
    title: "Batch Progress Tracking",
    description: "Monitor processing status for all videos in a batch with individual progress indicators",
    icon: Video,
    status: "beta",
    category: "ai-generation",
  },
  {
    id: "distribution-intelligence",
    title: "AI Distribution Intelligence",
    description: "Smart platform analysis and multi-format generation for TikTok, Instagram, YouTube, LinkedIn",
    icon: Sparkles,
    status: "in-progress",
    category: "ai-generation",
  },
  {
    id: "platform-optimizer",
    title: "Platform-Specific Optimizer",
    description: "Auto-adapt content format, length, and style per platform (TikTok hooks vs LinkedIn professionalism)",
    icon: Zap,
    status: "coming-soon",
    category: "ai-generation",
  },
  {
    id: "distribution-dashboard",
    title: "Distribution Dashboard",
    description: "Unified view of content performance across all platforms with AI-suggested posting times",
    icon: Video,
    status: "coming-soon",
    category: "export",
  },
  {
    id: "auto-scheduler",
    title: "Smart Auto-Scheduler",
    description: "AI analyzes audience data and auto-schedules posts for maximum engagement on each platform",
    icon: Sparkles,
    status: "coming-soon",
    category: "export",
  },
  {
    id: "download-share",
    title: "Download & Share",
    description: "Export finished videos and share directly to social platforms",
    icon: Upload,
    status: "coming-soon",
    category: "export",
  },
];

export function RoadmapSection({ onOpenScriptGenerator }: { onOpenScriptGenerator?: () => void }) {
  const statusColors = {
    "coming-soon": "bg-muted text-muted-foreground",
    "in-progress": "bg-chart-2/10 text-chart-2",
    "beta": "bg-chart-4/10 text-chart-4",
  };

  const statusLabels = {
    "coming-soon": "Coming Soon",
    "in-progress": "In Progress",
    "beta": "Beta Access",
  };

  return (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary">
          <Sparkles className="h-4 w-4" />
          <span className="font-semibold">Version 3.0 Roadmap</span>
        </div>
        <h2 className="text-3xl font-bold">The Future of Viral Content Creation</h2>
        <p className="text-xl font-semibold text-primary mb-2">
          "AI does the hard work, you make decisions"
        </p>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          No templates to browse. No manual timeline editing. Just upload, describe your intent, and get polished videos.
          Transform raw ideas into viral-ready content with AI-powered automation.
        </p>
      </div>

      <Tabs defaultValue="stability" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="stability">V2.0 Stability</TabsTrigger>
            <TabsTrigger value="features">V3.0 Features</TabsTrigger>
            <TabsTrigger value="v4">V4.0 Batch</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="stability" className="space-y-6">
            <V2TestingChecklist />
          </TabsContent>

          <TabsContent value="features" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {v3Features.map((feature) => (
                <Card key={feature.id} className="p-6 hover-elevate transition-all">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="p-3 rounded-lg bg-primary/10">
                        <feature.icon className="h-6 w-6 text-primary" />
                      </div>
                      <Badge variant="secondary" className={statusColors[feature.status]}>
                        {statusLabels[feature.status]}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <h3 className="font-semibold text-lg">{feature.title}</h3>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </div>
                  </div>

                  {feature.id === "text-to-carousel" && onOpenScriptGenerator && (
                    <Button
                      onClick={onOpenScriptGenerator}
                      className="w-full mt-4"
                      variant="outline"
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      Try Script Generator
                    </Button>
                  )}
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="v4" className="space-y-6">
            <div className="space-y-6">
              <Card className="p-6 bg-primary/5 border-primary/20">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <Upload className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">V4.0: Batch Processing</h3>
                      <p className="text-sm text-muted-foreground">
                        Process multiple videos simultaneously with intelligent parallel processing
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3 pl-14">
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="secondary" className="bg-chart-4/10 text-chart-4">Beta</Badge>
                      <span className="text-muted-foreground">Already implemented - needs polish</span>
                    </div>
                    <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                      <li>Upload up to 10 videos at once</li>
                      <li>Process with same intent across all videos</li>
                      <li>Parallel processing with concurrency control (3 videos at a time)</li>
                      <li>Real-time progress tracking for each video</li>
                      <li>Batch results view with individual video access</li>
                    </ul>
                  </div>
                </div>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {v4Features.map((feature) => (
                  <Card key={feature.id} className="p-6 hover-elevate transition-all">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="p-3 rounded-lg bg-primary/10">
                          <feature.icon className="h-6 w-6 text-primary" />
                        </div>
                        <Badge variant="secondary" className={statusColors[feature.status]}>
                          {statusLabels[feature.status]}
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        <h3 className="font-semibold text-lg">{feature.title}</h3>
                        <p className="text-sm text-muted-foreground">{feature.description}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <Card className="p-6 bg-muted/30">
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Technical Implementation
                  </h4>
                  <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside pl-2">
                    <li><strong>Backend:</strong> Multi-file upload endpoint with batch ID grouping</li>
                    <li><strong>Processing:</strong> p-limit concurrency control (3 parallel videos)</li>
                    <li><strong>Database:</strong> batchId and batchIndex fields in projects table</li>
                    <li><strong>Frontend:</strong> Drag-and-drop batch upload UI with file preview</li>
                    <li><strong>Progress:</strong> Aggregated batch progress with per-video breakdown</li>
                  </ul>
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="timeline" className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Projected Launch: Q4 2023</h3>
                  <p className="text-sm text-muted-foreground">
                    We're aiming for a full release by the end of the year.
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

      <Card className="p-6 bg-muted/50 border-dashed">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 space-y-2">
              <h4 className="font-semibold">Beta Testing Active</h4>
              <p className="text-sm text-muted-foreground">
                You're viewing unreleased features. Some functionality may be incomplete or change before official launch.
                Report bugs or suggestions directly to the development team.
              </p>
            </div>
          </div>
        </Card>
    </div>
  );
}