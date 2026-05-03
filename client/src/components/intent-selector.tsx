import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Target, Scissors, Film, Sparkles, Settings, Square, Maximize, Smartphone, Lightbulb, Brain, Zap, Info, Clock, Palette, FileVideo } from "lucide-react";
import { useState, useEffect } from "react";
import type { UserIntent, IntentConfig, VideoContext, OutputMode } from "@shared/schema";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { ReferenceVideoInput } from "./reference-video-input";

interface AIRecommendations {
  recommendedIntent: "single-video" | "multiple-clips" | "comprehensive" | "ai-decide";
  recommendedDuration: number;
  recommendedClipCount?: number;
  recommendedClipDuration?: number;
  recommendedContext: string;
  reasoning: string;
  confidenceScore: number;
  insights: string[];
}

interface IntentSelectorProps {
  videoDuration: number;
  onSelect: (intent: UserIntent, config: IntentConfig) => void;
  onSchedule?: (intent: UserIntent, config: IntentConfig) => void; // Schedule for later processing
  isLoading?: boolean;
  isScheduling?: boolean;
  projectId?: string; // For fetching AI recommendations
}

export function IntentSelector({
  videoDuration,
  onSelect,
  onSchedule,
  isLoading = false,
  isScheduling = false,
  defaultAspectRatio = "9:16",
  projectId,
}: IntentSelectorProps & { defaultAspectRatio?: "9:16" | "1:1" | "16:9" }) {
  // Load saved preferences from localStorage
  const getSavedPreferences = () => {
    try {
      const saved = localStorage.getItem("synapse_edit_preferences");
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.log("[IntentSelector] No saved preferences found");
    }
    return null;
  };

  const savedPrefs = getSavedPreferences();

  const [selectedIntent, setSelectedIntent] = useState<UserIntent | null>(null);
  const [customDuration, setCustomDuration] = useState<number>(Math.min(60, videoDuration));
  const [clipDuration, setClipDuration] = useState<number>(savedPrefs?.clipDuration || 15);
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "1:1" | "16:9">(savedPrefs?.aspectRatio || defaultAspectRatio);
  const [vibe, setVibe] = useState<string>(savedPrefs?.vibe || "vibrant");
  const [videoContext, setVideoContext] = useState<VideoContext>(savedPrefs?.videoContext || "generic");
  const [outputMode, setOutputMode] = useState<OutputMode>(savedPrefs?.outputMode || "polished_reels");
  const [referenceVideoId, setReferenceVideoId] = useState<string | null>(null);
  const [preferencesLoaded, setPreferencesLoaded] = useState<boolean>(!!savedPrefs);

  // Save preferences when they change
  useEffect(() => {
    const prefs = {
      aspectRatio,
      vibe,
      videoContext,
      outputMode,
      clipDuration,
    };
    localStorage.setItem("synapse_edit_preferences", JSON.stringify(prefs));
  }, [aspectRatio, vibe, videoContext, outputMode, clipDuration]);


  // Calculate maximum possible clips based on video duration and clip duration
  const maxPossibleClips = Math.max(1, Math.floor(videoDuration / clipDuration));
  const defaultClipCount = Math.min(5, maxPossibleClips);
  const [clipCount, setClipCount] = useState<number>(defaultClipCount);

  // Track if recommendations have been applied to prevent re-application on refetch
  const [recommendationsApplied, setRecommendationsApplied] = useState(false);

  // Fetch AI recommendations if projectId is available
  const { data: recommendationsData, isLoading: isLoadingRecommendations } = useQuery<{
    recommendations: AIRecommendations;
    videoCategory: string;
  }>({
    queryKey: [`/api/projects/${projectId}/recommendations`],
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const recommendations = recommendationsData?.recommendations;
  const videoCategory = recommendationsData?.videoCategory;

  // Apply AI recommendations when they load (only once on first load)
  useEffect(() => {
    if (recommendations && !selectedIntent && !recommendationsApplied) {
      setRecommendationsApplied(true);
      if (recommendations.recommendedContext && recommendations.recommendedContext !== "generic") {
        setVideoContext(recommendations.recommendedContext as VideoContext);
      }
      if (recommendations.recommendedClipCount) {
        setClipCount(Math.min(recommendations.recommendedClipCount, maxPossibleClips));
      }
      if (recommendations.recommendedClipDuration) {
        setClipDuration(recommendations.recommendedClipDuration);
      }
      if (recommendations.recommendedDuration) {
        setCustomDuration(Math.min(recommendations.recommendedDuration, videoDuration));
      }
    }
  }, [recommendations, selectedIntent, recommendationsApplied, maxPossibleClips, videoDuration]);

  // Update clipCount when clipDuration changes to stay within bounds
  const handleClipDurationChange = (newDuration: number) => {
    setClipDuration(newDuration);
    const newMax = Math.floor(videoDuration / newDuration);
    if (clipCount > newMax) {
      setClipCount(Math.max(1, newMax));
    }
  };

  const presets = [
    {
      intent: "single-video" as const,
      icon: Target,
      title: "One Polished Video",
      description: "Create a single, well-crafted video",
      config: { targetDuration: 60 },
      color: "text-chart-1",
      bgColor: "bg-chart-1/10",
    },
    {
      intent: "multiple-clips" as const,
      icon: Scissors,
      title: "Smart Clips",
      description: "AI analyzes content structure and creates clips that match the story",
      config: { clipCount: 5, clipDuration: 15 },
      color: "text-chart-2",
      bgColor: "bg-chart-2/10",
    },
    {
      intent: "comprehensive" as const,
      icon: Film,
      title: "Comprehensive Edit",
      description: "Longer, detailed video (2-3 min)",
      config: { targetDuration: 180 },
      color: "text-chart-3",
      bgColor: "bg-chart-3/10",
    },
    {
      intent: "ai-decide" as const,
      icon: Sparkles,
      title: "Let AI Decide",
      description: "AI analyzes your content and creates the optimal format",
      config: {},
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      intent: "clean-slices" as const,
      icon: FileVideo,
      title: "Clean Slices",
      description: "Export usable clips without editing - perfect for external editing tools",
      config: { outputMode: "raw_slices" as OutputMode },
      color: "text-chart-4",
      bgColor: "bg-chart-4/10",
    },
  ];

  const handlePresetSelect = (intent: UserIntent, config: IntentConfig) => {
    setSelectedIntent(intent);
    // Don't auto-submit - let user configure settings first and click "Start Edit"
  };

  // Handle the actual submission when user clicks "Start Edit"
  const handleStartEdit = () => {
    if (!selectedIntent) return;

    const preset = presets.find(p => p.intent === selectedIntent);
    const baseConfig = preset?.config || {};

    // For clean-slices, force raw_slices output mode and use multiple-clips behavior
    if (selectedIntent === "clean-slices") {
      onSelect("multiple-clips", { 
        ...baseConfig, 
        aspectRatio, 
        vibe: "none", // No color grading for clean slices
        videoContext,
        outputMode: "raw_slices", // Force raw slices output
        clipCount: clipCount || 10, // Default to 10 clips
        clipDuration: clipDuration || 15, // Default 15s per clip
        targetDuration: customDuration,
      });
      return;
    }

    // For multiple-clips, include clip configuration (no targetDuration - it's derived from clips)
    if (selectedIntent === "multiple-clips") {
      onSelect("multiple-clips", {
        ...baseConfig,
        aspectRatio,
        vibe,
        videoContext,
        outputMode,
        clipCount,
        clipDuration,
        // targetDuration is intentionally omitted - for multiple clips, 
        // the total content duration is clipCount × clipDuration
        referenceVideoId: referenceVideoId || undefined,
      });
      return;
    }

    // For other intents
    onSelect(selectedIntent, { 
      ...baseConfig, 
      aspectRatio, 
      vibe, 
      videoContext, 
      outputMode,
      targetDuration: customDuration,
      referenceVideoId: referenceVideoId || undefined,
    });
  };

  const handleCustomSubmit = () => {
    const config: IntentConfig = {
      targetDuration: customDuration,
      clipCount,
      clipDuration,
      aspectRatio,
      vibe,
      videoContext, // V6.0: Include videoContext in custom config
      outputMode,   // V6.5: Include output mode
      referenceVideoId: referenceVideoId || undefined
    };
    // If smart clips was selected, submit as multiple-clips intent instead of custom
    const intent = selectedIntent === "multiple-clips" ? "multiple-clips" : "custom";
    onSelect(intent, config);
  };

  // One-click best edit handler - uses AI recommendations or smart defaults with smart heuristics
  const handleOneClickBestEdit = () => {
    // Smart defaults based on video duration
    let smartIntent: UserIntent;
    let smartDuration: number;
    let smartClipCount: number;
    let smartClipDuration: number;

    if (videoDuration <= 30) {
      // Very short video - just polish it
      smartIntent = "single-video";
      smartDuration = videoDuration;
      smartClipCount = 1;
      smartClipDuration = videoDuration;
    } else if (videoDuration <= 90) {
      // Short video - single polished edit or 2-3 clips
      smartIntent = "single-video";
      smartDuration = Math.min(60, videoDuration);
      smartClipCount = Math.min(3, Math.floor(videoDuration / 15));
      smartClipDuration = 15;
    } else if (videoDuration <= 300) {
      // Medium video - multiple clips work well
      smartIntent = "multiple-clips";
      smartDuration = 60;
      smartClipCount = Math.min(5, Math.floor(videoDuration / 15));
      smartClipDuration = 15;
    } else {
      // Long video - AI decide is best
      smartIntent = "ai-decide";
      smartDuration = 60;
      smartClipCount = Math.min(10, Math.floor(videoDuration / 15));
      smartClipDuration = 15;
    }

    // Override with AI recommendations if available (they're smarter)
    const bestIntent = recommendations?.recommendedIntent || smartIntent;
    const bestDuration = recommendations?.recommendedDuration || smartDuration;
    const bestClipCount = Math.min(
      recommendations?.recommendedClipCount || smartClipCount,
      Math.floor(videoDuration / 10) // Never exceed what's possible
    );
    const bestClipDuration = recommendations?.recommendedClipDuration || smartClipDuration;
    const bestContext = (recommendations?.recommendedContext as VideoContext) || "generic";

    const config: IntentConfig = {
      targetDuration: bestDuration,
      clipCount: Math.max(1, bestClipCount),
      clipDuration: bestClipDuration,
      aspectRatio: "9:16", // Optimized for TikTok/Reels/Shorts
      vibe: "vibrant",
      videoContext: bestContext,
      outputMode: "polished_reels",
      referenceVideoId: undefined,
      isOneClick: true, // Flag for backend to prioritize speed
    };

    onSelect(bestIntent, config);
  };

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-2xl md:text-3xl font-semibold text-foreground">What would you like to create?</h2>
        <p className="text-muted-foreground">
          Choose how you want your {Math.floor(videoDuration / 60)}:{String(videoDuration % 60).padStart(2, '0')} video edited
        </p>
      </div>

      {/* ONE-CLICK BEST EDIT - Clean Dark Card */}
      <div className="relative group">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-cyan-600/20 rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
        <button
          type="button"
          className="relative w-full p-6 rounded-xl border-2 border-purple-500/30 bg-card/80 backdrop-blur-sm hover:border-purple-500/50 transition-all cursor-pointer text-left"
          onClick={handleOneClickBestEdit}
          disabled={isLoading}
          data-testid="button-one-click-best-edit"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-purple-600 to-purple-700 text-white shrink-0 shadow-lg shadow-purple-500/30">
              <Zap className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h3 className="text-lg font-bold text-foreground">One-Click Best Edit</h3>
                <Badge className="bg-cyan-500/20 text-cyan-400 border-0 uppercase text-[10px] font-semibold tracking-wider">Recommended</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {recommendations 
                  ? `AI recommends ${recommendations.recommendedIntent.replace(/-/g, ' ')} • ${recommendations.confidenceScore}% confident`
                  : "AI will analyze and create the optimal edit for your video"
                }
              </p>
            </div>
          </div>
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1 border-t border-border/30" />
        <span className="text-xs text-muted-foreground uppercase tracking-widest">or customize your edit</span>
        <div className="flex-1 border-t border-border/30" />
      </div>

      {/* Video Length Configuration - Primary Controls */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Video Length</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Clip Duration */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Clip Duration</Label>
              <span className="text-sm font-medium text-purple-400">{clipDuration}s</span>
            </div>
            <Slider
              value={[clipDuration]}
              onValueChange={(value) => handleClipDurationChange(value[0])}
              min={5}
              max={30}
              step={5}
              className="w-full"
              data-testid="slider-clip-duration"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>5s</span>
              <span>30s</span>
            </div>
          </div>

          {/* Number of Clips */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Number of Clips</Label>
              <span className="text-sm font-medium text-purple-400">{clipCount}</span>
            </div>
            <Slider
              value={[clipCount]}
              onValueChange={(value) => setClipCount(value[0])}
              min={1}
              max={Math.min(10, maxPossibleClips)}
              step={1}
              className="w-full"
              data-testid="slider-clip-count"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1</span>
              <span>{Math.min(10, maxPossibleClips)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Two-Column Layout for Customization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column - Content Type */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Film className="h-4 w-4" />
            <span>Content Type</span>
          </div>
          <div className="space-y-2">
            {[
              { value: "hype", label: "Hype Reel" },
              { value: "tutorial", label: "Tutorial" },
              { value: "vlog", label: "Vlog" },
              { value: "demo", label: "Product Demo" },
              { value: "review", label: "Review" },
              { value: "storytelling", label: "Storytelling" },
            ].map((type) => (
              <div
                key={type.value}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  videoContext === type.value
                    ? "border-purple-500/50 bg-purple-500/10 text-foreground"
                    : "border-border/30 bg-card/50 text-muted-foreground hover:border-border/50 hover:bg-card"
                }`}
                onClick={() => setVideoContext(type.value as VideoContext)}
                data-testid={`content-type-${type.value}`}
              >
                {type.label}
              </div>
            ))}
          </div>
        </div>

        {/* Right Column - Output Format & Processing Mode */}
        <div className="space-y-8">
          {/* Output Format */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Maximize className="h-4 w-4" />
              <span>Output Format</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div
                className={`p-4 rounded-lg border cursor-pointer transition-all text-center ${
                  aspectRatio === "9:16"
                    ? "border-purple-500/50 bg-purple-600 text-white"
                    : "border-border/30 bg-card/50 text-muted-foreground hover:border-border/50"
                }`}
                onClick={() => setAspectRatio("9:16")}
                data-testid="format-vertical"
              >
                <Smartphone className="h-6 w-6 mx-auto mb-2" />
                <div className="font-medium text-sm">Vertical</div>
                <div className="text-[10px] opacity-70">9:16</div>
              </div>
              <div
                className={`p-4 rounded-lg border cursor-pointer transition-all text-center ${
                  aspectRatio === "1:1"
                    ? "border-purple-500/50 bg-purple-600 text-white"
                    : "border-border/30 bg-card/50 text-muted-foreground hover:border-border/50"
                }`}
                onClick={() => setAspectRatio("1:1")}
                data-testid="format-square"
              >
                <Square className="h-6 w-6 mx-auto mb-2" />
                <div className="font-medium text-sm">Square</div>
                <div className="text-[10px] opacity-70">1:1</div>
              </div>
              <div
                className={`p-4 rounded-lg border cursor-pointer transition-all text-center ${
                  aspectRatio === "16:9"
                    ? "border-purple-500/50 bg-purple-600 text-white"
                    : "border-border/30 bg-card/50 text-muted-foreground hover:border-border/50"
                }`}
                onClick={() => setAspectRatio("16:9")}
                data-testid="format-landscape"
              >
                <Maximize className="h-6 w-6 mx-auto mb-2" />
                <div className="font-medium text-sm">Landscape</div>
                <div className="text-[10px] opacity-70">16:9</div>
              </div>
            </div>
          </div>

          {/* Processing Mode */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Settings className="h-4 w-4" />
              <span>Processing Mode</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  outputMode === "polished_reels"
                    ? "border-purple-500/50 bg-purple-600 text-white"
                    : "border-border/30 bg-card/50 text-muted-foreground hover:border-border/50"
                }`}
                onClick={() => setOutputMode("polished_reels")}
                data-testid="mode-polished"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-4 w-4" />
                  <span className="font-medium">Polished Reel</span>
                </div>
                <p className="text-xs opacity-70">Full AI editing with transitions & effects</p>
              </div>
              <div
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  outputMode === "raw_slices"
                    ? "border-purple-500/50 bg-purple-600 text-white"
                    : "border-border/30 bg-card/50 text-muted-foreground hover:border-border/50"
                }`}
                onClick={() => setOutputMode("raw_slices")}
                data-testid="mode-raw"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Scissors className="h-4 w-4" />
                  <span className="font-medium">Raw Slices</span>
                </div>
                <p className="text-xs opacity-70">Fast extraction of highlights only</p>
              </div>
            </div>
          </div>

          {/* Reference Style */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Target className="h-4 w-4" />
              <span>Reference Style (Optional)</span>
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="Paste a video URL to mimic its vibe..."
                className="w-full p-3 rounded-lg border border-border/30 bg-card/50 text-foreground placeholder:text-muted-foreground focus:border-purple-500/50 focus:outline-none transition-colors"
                onChange={(e) => {
                  const url = e.target.value;
                  if (url && (url.includes('youtube.com') || url.includes('youtu.be') || url.includes('http'))) {
                    setReferenceVideoId(url);
                  } else {
                    setReferenceVideoId(null);
                  }
                }}
                data-testid="input-reference-url"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="flex items-center justify-between pt-4 border-t border-border/30">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Estimated Output</span>
          <span className="ml-2">~{clipDuration * clipCount}s total • {clipCount} clips • 1080p</span>
        </div>
        <Button
          size="lg"
          onClick={handleStartEdit}
          disabled={isLoading}
          className="min-w-[160px] bg-purple-600 hover:bg-purple-700"
          data-testid="button-generate-edit"
        >
          {isLoading ? (
            <>Processing...</>
          ) : (
            <>
              <Sparkles className="mr-2 h-5 w-5" />
              Generate Edit
            </>
          )}
        </Button>
      </div>

      {/* AI Smart Recommendations Card - Hidden in new design but kept for functionality */}
      {isLoadingRecommendations && projectId && (
        <Card className="p-4 border border-border/30 bg-card/50 animate-pulse hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Brain className="h-5 w-5 text-purple-400 animate-spin" />
            </div>
            <div>
              <h3 className="font-semibold">Analyzing your video...</h3>
              <p className="text-sm text-muted-foreground">AI is generating smart recommendations</p>
            </div>
          </div>
        </Card>
      )}

    </div>
  );
}