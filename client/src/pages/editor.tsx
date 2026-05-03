import { useState, useEffect, useRef } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  ArrowLeft,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Palette,
  Gauge,
  Wand2,
  Download,
  Sparkles,
  Send,
  Type,
  Image,
  RefreshCw,
  ChevronDown,
  Film,
  Zap,
  TrendingUp,
  Clock,
  Target,
  Lightbulb,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { BrandReferencePicker } from "@/components/brand-reference-picker";
import type { Project, SmartSlice, GeneratedVideo } from "@shared/schema";
import { Card } from "@/components/ui/card"; // Import Card component
import { SmartSlicesTimeline } from "@/components/smart-slices-timeline"; // Assuming this component exists
import { StockMediaLibrary } from "@/components/stock-media-library";
import { AudioMixerControls } from "@/components/audio-mixer-controls";
import { SmartRefinement } from "@/components/smart-refinement";
import { Image as ImageIcon } from "lucide-react";

type Tool = "mood" | "pacing" | "refine" | "branding" | "media";

const moodPresets = [
  { id: "energetic", label: "Energetic", color: "bg-orange-500" },
  { id: "calm", label: "Calm", color: "bg-blue-400" },
  { id: "dramatic", label: "Dramatic", color: "bg-purple-600" },
  { id: "upbeat", label: "Upbeat", color: "bg-green-500" },
  { id: "cinematic", label: "Cinematic", color: "bg-amber-600" },
  { id: "minimal", label: "Minimal", color: "bg-gray-400" },
];

const videoCategories = [
  { id: "music_video", label: "Music Video", description: "Songs, performances, music clips" },
  { id: "talking_head", label: "Talking Head", description: "Vlogs, commentary, presentations" },
  { id: "podcast", label: "Podcast", description: "Interviews, discussions, audio-focused" },
  { id: "gaming", label: "Gaming", description: "Gameplay, reactions, highlights" },
  { id: "educational", label: "Educational", description: "Tutorials, how-tos, lectures" },
  { id: "cooking", label: "Cooking", description: "Recipes, food prep, cooking shows" },
  { id: "comedy", label: "Comedy", description: "Sketches, funny moments, entertainment" },
  { id: "trailer", label: "Trailer/Hype", description: "Promos, teasers, high-energy" },
  { id: "marketing", label: "Marketing", description: "Ads, product demos, promotional" },
  { id: "generic", label: "Generic", description: "Auto-detect best strategy" },
];

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatDuration(seconds: number): string {
  if (!seconds || !isFinite(seconds) || seconds > 10000) return "0.0s";
  return `${seconds.toFixed(1)}s`;
}

export default function EditorPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [activeTool, setActiveTool] = useState<Tool>("mood");
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [pacing, setPacing] = useState(50);
  const [feedback, setFeedback] = useState("");
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);
  const [watermarkText, setWatermarkText] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [selectedClipIndex, setSelectedClipIndex] = useState(0);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Fetch project data
  const { data: currentProject, isLoading: isLoadingProject } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
    enabled: !!projectId,
  });

  // Guard: Redirect to home if project is not ready for editing
  useEffect(() => {
    if (!isLoadingProject && currentProject) {
      // Check if project has completed required steps
      if (currentProject.status !== "ready" && currentProject.status !== "completed") {
        toast({
          title: "Project Not Ready",
          description: "Please complete video analysis before editing.",
          variant: "destructive",
        });
        setLocation("/");
      }
    }
  }, [currentProject, isLoadingProject, setLocation, toast]);

  // Fetch videos
  const { data: videos, isLoading: isLoadingVideos } = useQuery<{
    short: GeneratedVideo | null;
    standard: GeneratedVideo | null;
    comprehensive: GeneratedVideo | null;
    multipleClips?: GeneratedVideo[];
  }>({
    queryKey: ["/api/projects", projectId, "videos"],
    enabled: !!projectId && currentProject?.status === "ready",
  });

  // Guard: Redirect if no videos found after loading
  useEffect(() => {
    if (!isLoadingVideos && !isLoadingProject && currentProject?.status === "ready") {
      const hasVideos = videos?.multipleClips?.length || videos?.short || videos?.standard || videos?.comprehensive;
      if (!hasVideos) {
        toast({
          title: "No Videos Found",
          description: "This project has no generated videos. Please start a new edit.",
          variant: "destructive",
        });
        setLocation("/");
      }
    }
  }, [videos, isLoadingVideos, isLoadingProject, currentProject, setLocation, toast]);

  // Fetch slices for timeline
  const { data: slices = [] } = useQuery<SmartSlice[]>({
    queryKey: ["/api/projects", projectId, "slices"],
    enabled: !!projectId,
  });

  // Fetch quality report for AI suggestions
  const { data: qualityReport } = useQuery<{
    scores: {
      overall: number;
      hookScore: number;
      dynamism: number;
      usability: number;
      buildupScore: number;
      payoffScore: number;
      closerScore: number;
    };
    suggestions: string[];
    aiInsight?: string;
  }>({
    queryKey: ["/api/projects", projectId, "quality-report"],
    enabled: !!projectId && !!videos?.multipleClips?.length,
  });

  // Generate AI suggestions from quality scores
  const aiSuggestions = (() => {
    if (!qualityReport?.scores) return [];
    const suggestions: { text: string; icon: typeof Zap; priority: "high" | "medium" | "low" }[] = [];
    const scores = qualityReport.scores;

    // Hook suggestions
    if (scores.hookScore < 75) {
      suggestions.push({
        text: "Strengthen the opening hook with higher-energy content",
        icon: Zap,
        priority: scores.hookScore < 60 ? "high" : "medium",
      });
    }

    // Dynamism suggestions
    if (scores.dynamism < 75) {
      suggestions.push({
        text: "Add more visual variety and faster cuts",
        icon: TrendingUp,
        priority: scores.dynamism < 60 ? "high" : "medium",
      });
    }

    // Structure suggestions
    if (scores.buildupScore < 70) {
      suggestions.push({
        text: "Extend the video to create better story structure",
        icon: Target,
        priority: "medium",
      });
    }

    // Payoff suggestions
    if (scores.payoffScore < 70) {
      suggestions.push({
        text: "Enhance the climax/key moment for more impact",
        icon: Sparkles,
        priority: scores.payoffScore < 50 ? "high" : "medium",
      });
    }

    // Duration-based suggestions
    if (currentVideo && currentVideo.duration < 15) {
      suggestions.push({
        text: "Extend to 20-30 seconds for better engagement",
        icon: Clock,
        priority: "high",
      });
    }

    // Add any suggestions from the quality report
    if (qualityReport.suggestions) {
      qualityReport.suggestions.forEach(s => {
        if (!suggestions.some(existing => existing.text.toLowerCase().includes(s.toLowerCase().slice(0, 20)))) {
          suggestions.push({ text: s, icon: Lightbulb, priority: "medium" });
        }
      });
    }

    return suggestions.slice(0, 5); // Limit to top 5
  })();

  // Smart category suggestion based on slice analysis
  const suggestedCategory = (() => {
    if (!slices.length || !currentProject) return null; // Use currentProject

    const currentCat = currentProject.videoCategory || "generic"; // Use currentProject

    // Count clip types
    const clipTypeCounts: Record<string, number> = {};
    slices.forEach(s => {
      const type = (s.clipType || "generic").toLowerCase();
      clipTypeCounts[type] = (clipTypeCounts[type] || 0) + 1;
    });

    // Detect music content
    const musicTypes = ["intro", "verse", "chorus", "bridge", "hook", "outro", "pre-chorus", "breakdown"];
    const musicCount = musicTypes.reduce((sum, t) => sum + (clipTypeCounts[t] || 0), 0);
    const isMusicContent = musicCount >= slices.length * 0.4;

    // Detect talking head / speech content
    const speechTypes = ["talking_head", "speech", "explanation", "key_point"];
    const speechCount = speechTypes.reduce((sum, t) => sum + (clipTypeCounts[t] || 0), 0);
    const isSpeechContent = speechCount >= slices.length * 0.5;

    // Detect gaming content
    const gamingTypes = ["action", "highlight", "reaction", "gameplay"];
    const gamingCount = gamingTypes.reduce((sum, t) => sum + (clipTypeCounts[t] || 0), 0);
    const isGamingContent = gamingCount >= slices.length * 0.4;

    // Suggest better category if mismatch detected
    if (isMusicContent && currentCat !== "music_video") {
      return { id: "music_video", label: "Music Video", reason: "Detected song structure (verses, choruses, hooks)" };
    }
    if (isSpeechContent && currentCat !== "talking_head" && currentCat !== "podcast" && currentCat !== "educational") {
      return { id: "talking_head", label: "Talking Head", reason: "Detected speech-focused content" };
    }
    if (isGamingContent && currentCat !== "gaming") {
      return { id: "gaming", label: "Gaming", reason: "Detected gameplay and action clips" };
    }

    return null;
  })();

  // Get current video path
  const currentVideo = videos?.multipleClips?.[selectedClipIndex] 
    || videos?.standard 
    || videos?.short 
    || videos?.comprehensive;

  const videoPath = currentVideo?.videoPath;
  const videoList = videos?.multipleClips && videos.multipleClips.length > 0 
    ? videos.multipleClips 
    : [videos?.standard, videos?.short, videos?.comprehensive].filter(Boolean) as GeneratedVideo[];

  // Reset video state when clip changes
  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.load();
    }
  }, [selectedClipIndex, videoPath]);

  // Apply mood mutation
  const applyMoodMutation = useMutation({
    mutationFn: async (mood: string) => {
      const response = await apiRequest("POST", `/api/projects/${projectId}/apply-mood`, { mood });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "videos"] });
      toast({ title: "Mood Applied", description: "Video is being regenerated with new mood" });
    },
  });

  // Apply pacing mutation  
  const applyPacingMutation = useMutation({
    mutationFn: async (tempo: number) => {
      const response = await apiRequest("POST", `/api/projects/${projectId}/apply-pacing`, { tempo });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "videos"] });
      toast({ title: "Pacing Applied", description: "Video is being regenerated with new pacing" });
    },
  });

  // Apply refinement mutation
  const applyRefinementMutation = useMutation({
    mutationFn: async (feedbackText: string) => {
      const response = await apiRequest("POST", `/api/projects/${projectId}/apply-refinement`, {
        videoId: currentVideo?.id,
        feedback: [feedbackText],
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "videos"] });
      setFeedback("");
      toast({ title: "Refinement Applied", description: "AI is processing your feedback" });
    },
  });

  // Apply branding mutation
  const applyBrandingMutation = useMutation({
    mutationFn: async (config: { subtitles: boolean; watermark: string }) => {
      const response = await apiRequest("POST", `/api/projects/${projectId}/finalize`, {
        subtitles: { enabled: config.subtitles },
        branding: { enabled: !!config.watermark, watermarkText: config.watermark },
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "videos"] });
      toast({ title: "Branding Applied", description: "Processing subtitles and watermark..." });
    },
    onError: () => {
      toast({ title: "Failed", description: "Could not apply branding", variant: "destructive" });
    },
  });

  // Change category mutation
  const changeCategoryMutation = useMutation({
    mutationFn: async (newCategory: string) => {
      const response = await apiRequest("POST", `/api/projects/${projectId}/change-category`, {
        category: newCategory,
        regenerate: true,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "videos"] });
      toast({ 
        title: "Category Updated", 
        description: data.regenerating 
          ? "Videos are being regenerated with the new strategy" 
          : "Category updated successfully"
      });
    },
    onError: () => {
      toast({ title: "Failed", description: "Could not change category", variant: "destructive" });
    },
  });

  // Get current category info
  const currentCategory = videoCategories.find(c => c.id === currentProject?.videoCategory) // Use currentProject
    || videoCategories.find(c => c.id === "generic")!;

  // Video controls
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (value: number[]) => {
    if (videoRef.current) {
      videoRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const skipPrev = () => {
    if (selectedClipIndex > 0) {
      setSelectedClipIndex(selectedClipIndex - 1);
    }
  };

  const skipNext = () => {
    if (selectedClipIndex < videoList.length - 1) {
      setSelectedClipIndex(selectedClipIndex + 1);
    }
  };

  // Handle export
  const handleExport = () => {
    if (videoPath) {
      window.open(videoPath, "_blank");
    }
  };

  // AI B-Roll Suggestions (only shown in editor, not auto-applied)
  const [brollSuggestions, setBrollSuggestions] = useState<Array<{
    timestamp: number;
    searchQuery: string;
    reason: string;
  }>>([]);

  // Analyze video for B-roll opportunities when in refine mode
  useEffect(() => {
    if (activeTool === "refine" && slices.length > 0 && !brollSuggestions.length) {
      // Generate smart B-roll suggestions based on transcriptions
      const suggestions = slices
        .filter(s => s.transcription && s.transcription.length > 10)
        .slice(0, 3) // Limit to 3 suggestions
        .map(s => ({
          timestamp: s.startTime,
          searchQuery: s.transcription?.split(' ').slice(0, 3).join(' ') || 'nature',
          reason: `Enhance "${s.transcription?.substring(0, 30)}..." with visual context`
        }));
      
      if (suggestions.length > 0) {
        setBrollSuggestions(suggestions);
      }
    }
  }, [activeTool, slices]);

  if (!projectId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">No project selected</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Top Bar - Sleek dark design */}
      <header className="h-14 border-b border-border/50 bg-card/50 backdrop-blur-sm flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back" className="hover:bg-purple-500/10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="h-6 w-px bg-border/50" />
          <h1 className="font-medium truncate max-w-[200px] text-sm">{currentProject?.name || "Editor"}</h1>

          {/* Category Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-1"
                disabled={changeCategoryMutation.isPending}
                data-testid="button-category-selector"
              >
                {changeCategoryMutation.isPending ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : null}
                {currentCategory.label}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              {videoCategories.map((cat) => (
                <DropdownMenuItem
                  key={cat.id}
                  onClick={() => {
                    if (cat.id !== currentProject?.videoCategory) { // Use currentProject
                      changeCategoryMutation.mutate(cat.id);
                    }
                  }}
                  className="flex flex-col items-start gap-0.5"
                  data-testid={`menu-category-${cat.id}`}
                >
                  <span className={cat.id === currentProject?.videoCategory ? "font-medium" : ""}> {/* Use currentProject */}
                    {cat.label}
                    {cat.id === currentProject?.videoCategory && " ✓"} {/* Use currentProject */}
                  </span>
                  <span className="text-xs text-muted-foreground">{cat.description}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-2">
          <BrandReferencePicker 
            projectId={projectId} 
            currentCategory={currentProject?.videoCategory || undefined}
            onStyleApplied={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
            }}
          />
          <ThemeToggle />
          <Button onClick={handleExport} disabled={!videoPath} data-testid="button-export" className="bg-purple-600 hover:bg-purple-700">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </header>

      {/* Category Suggestion Banner */}
      {suggestedCategory && !changeCategoryMutation.isPending && !suggestionDismissed && (
        <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>
              <strong>Better match detected:</strong> {suggestedCategory.reason}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSuggestionDismissed(true)}
              data-testid="button-dismiss-suggestion"
            >
              Dismiss
            </Button>
            <Button
              size="sm"
              onClick={() => {
                changeCategoryMutation.mutate(suggestedCategory.id);
                setSuggestionDismissed(true);
              }}
              data-testid="button-apply-suggested-category"
            >
              Switch to {suggestedCategory.label}
            </Button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Tools with sleek styling */}
        <aside className="w-16 border-r border-border/50 bg-card/30 flex flex-col items-center py-4 gap-2 shrink-0">
          <Button
            variant={activeTool === "mood" ? "default" : "ghost"}
            size="icon"
            onClick={() => setActiveTool("mood")}
            title="Color & Mood"
            data-testid="button-tool-mood"
            className={activeTool === "mood" ? "bg-purple-600 hover:bg-purple-700" : "hover:bg-purple-500/10"}
          >
            <Palette className="h-5 w-5" />
          </Button>
          <Button
            variant={activeTool === "pacing" ? "default" : "ghost"}
            size="icon"
            onClick={() => setActiveTool("pacing")}
            title="Pacing"
            data-testid="button-tool-pacing"
            className={activeTool === "pacing" ? "bg-purple-600 hover:bg-purple-700" : "hover:bg-purple-500/10"}
          >
            <Gauge className="h-5 w-5" />
          </Button>
          <Button
            variant={activeTool === "refine" ? "default" : "ghost"}
            size="icon"
            onClick={() => setActiveTool("refine")}
            title="Refine with AI"
            data-testid="button-tool-refine"
            className={activeTool === "refine" ? "bg-purple-600 hover:bg-purple-700" : "hover:bg-purple-500/10"}
          >
            <Wand2 className="h-5 w-5" />
          </Button>
          <Separator className="my-2 w-8 bg-border/50" />
          <Button
            variant={activeTool === "branding" ? "default" : "ghost"}
            size="icon"
            onClick={() => setActiveTool("branding")}
            title="Branding & Subtitles"
            data-testid="button-tool-branding"
            className={activeTool === "branding" ? "bg-purple-600 hover:bg-purple-700" : "hover:bg-purple-500/10"}
          >
            <Type className="h-5 w-5" />
          </Button>
          <Button
            variant={activeTool === "media" ? "default" : "ghost"}
            size="icon"
            onClick={() => setActiveTool("media")}
            title="Stock Media"
            data-testid="button-tool-media"
            className={activeTool === "media" ? "bg-purple-600 hover:bg-purple-700" : "hover:bg-purple-500/10"}
          >
            <ImageIcon className="h-5 w-5" />
          </Button>
        </aside>

        {/* Tool Panel - Sleek styling */}
        <aside className="w-64 border-r border-border/50 bg-card/20 p-4 overflow-y-auto shrink-0">
          {activeTool === "mood" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-2 gradient-text-purple-blue">Color Mood</h3>
                <p className="text-xs text-muted-foreground mb-4">Set the visual tone of your video</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {moodPresets.map((mood) => (
                  <button
                    key={mood.id}
                    onClick={() => {
                      setSelectedMood(mood.id);
                      applyMoodMutation.mutate(mood.id);
                    }}
                    className={`flex items-center gap-2 p-3 rounded-lg border transition-all ${
                      selectedMood === mood.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                    data-testid={`button-mood-${mood.id}`}
                  >
                    <div className={`w-3 h-3 rounded-full ${mood.color}`} />
                    <span className="text-sm">{mood.label}</span>
                  </button>
                ))}
              </div>
              {applyMoodMutation.isPending && (
                <p className="text-xs text-muted-foreground animate-pulse">Applying mood...</p>
              )}
            </div>
          )}

          {activeTool === "pacing" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium mb-3">Video Pacing</h3>
                <p className="text-xs text-muted-foreground mb-4">Control the tempo and cut frequency</p>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Slow</span>
                  <span>Fast</span>
                </div>
                <Slider
                  value={[pacing]}
                  onValueChange={(v) => setPacing(v[0])}
                  max={100}
                  step={1}
                  className="w-full"
                  data-testid="slider-pacing"
                />
                <div className="text-center">
                  <Badge variant="secondary">{pacing}%</Badge>
                </div>
                <Button
                  onClick={() => applyPacingMutation.mutate(pacing)}
                  disabled={applyPacingMutation.isPending}
                  className="w-full"
                  data-testid="button-apply-pacing"
                >
                  {applyPacingMutation.isPending ? "Applying..." : "Apply Pacing"}
                </Button>
              </div>
            </div>
          )}

          {activeTool === "refine" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-3">Refine with AI</h3>
                <p className="text-xs text-muted-foreground mb-4">Describe changes in plain English</p>
              </div>

              {/* AI Suggestions from Quality Analysis */}
              {aiSuggestions.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-amber-500" />
                    <p className="text-xs font-medium text-amber-600 dark:text-amber-400">AI Recommendations</p>
                  </div>
                  <div className="space-y-1">
                    {aiSuggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => setFeedback(suggestion.text)}
                        className={`w-full text-left text-xs p-2 rounded border transition-all hover:border-primary/50 ${
                          suggestion.priority === "high" 
                            ? "border-amber-500/50 bg-amber-500/10" 
                            : "border-border bg-muted/50"
                        }`}
                        data-testid={`button-ai-suggestion-${idx}`}
                      >
                        <div className="flex items-start gap-2">
                          <suggestion.icon className={`h-3 w-3 mt-0.5 shrink-0 ${
                            suggestion.priority === "high" ? "text-amber-500" : "text-muted-foreground"
                          }`} />
                          <span>{suggestion.text}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => {
                      const allSuggestions = aiSuggestions.map(s => s.text).join(". ");
                      setFeedback(allSuggestions);
                    }}
                    data-testid="button-apply-all-suggestions"
                  >
                    <Sparkles className="mr-1 h-3 w-3" />
                    Apply All Suggestions
                  </Button>
                  <Separator className="my-2" />
                </div>
              )}

              {/* Smart B-Roll Suggestions */}
              {brollSuggestions.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Film className="h-4 w-4 text-blue-500" />
                    <p className="text-xs font-medium text-blue-600 dark:text-blue-400">B-Roll Suggestions</p>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">Add stock footage to enhance your video</p>
                  <div className="space-y-1">
                    {brollSuggestions.map((suggestion, idx) => (
                      <div key={idx} className="text-xs p-2 rounded border border-blue-500/30 bg-blue-500/5">
                        <div className="flex items-start gap-2 mb-1">
                          <ImageIcon className="h-3 w-3 mt-0.5 shrink-0 text-blue-500" />
                          <div className="flex-1">
                            <p className="font-medium">{suggestion.searchQuery}</p>
                            <p className="text-muted-foreground text-[10px]">{suggestion.reason}</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs mt-1 h-6"
                          onClick={() => {
                            setActiveTool("media");
                            // Auto-search in stock media library
                          }}
                        >
                          Browse Stock Media →
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Separator className="my-2" />
                </div>
              )}

              <Textarea
                placeholder="e.g., Make the intro more punchy, add more energy to the middle section..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="min-h-[100px] resize-none"
                data-testid="textarea-feedback"
              />
              <Button
                onClick={() => applyRefinementMutation.mutate(feedback)}
                disabled={!feedback.trim() || applyRefinementMutation.isPending}
                className="w-full"
                data-testid="button-apply-refine"
              >
                <Send className="mr-2 h-4 w-4" />
                {applyRefinementMutation.isPending ? "Processing..." : "Apply Changes"}
              </Button>
              <div className="pt-2">
                <p className="text-xs text-muted-foreground">Quick actions:</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {["15 seconds", "30 seconds", "Smoother transitions", "More energy", "Better hook"].map((s) => (
                    <button
                      key={s}
                      onClick={() => setFeedback(prev => prev ? `${prev}, ${s.toLowerCase()}` : s)}
                      className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTool === "branding" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium mb-3">Branding & Subtitles</h3>
                <p className="text-xs text-muted-foreground mb-4">Add your finishing touches</p>
              </div>

              {/* Subtitles Toggle */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="subtitles" className="text-sm">Auto Subtitles</Label>
                  <Switch
                    id="subtitles"
                    checked={subtitlesEnabled}
                    onCheckedChange={setSubtitlesEnabled}
                    data-testid="switch-subtitles"
                  />
                </div>
                {subtitlesEnabled && (
                  <p className="text-xs text-muted-foreground">
                    AI will transcribe and add animated captions
                  </p>
                )}
              </div>

              <Separator />

              {/* Watermark */}
              <div className="space-y-3">
                <Label htmlFor="watermark" className="text-sm">Watermark Text</Label>
                <Input
                  id="watermark"
                  placeholder="@yourhandle"
                  value={watermarkText}
                  onChange={(e) => setWatermarkText(e.target.value)}
                  data-testid="input-watermark"
                />
                <p className="text-xs text-muted-foreground">
                  Appears in corner of video
                </p>
              </div>

              <Separator />

              <Button
                className="w-full"
                disabled={(!subtitlesEnabled && !watermarkText) || applyBrandingMutation.isPending}
                onClick={() => {
                  applyBrandingMutation.mutate({
                    subtitles: subtitlesEnabled,
                    watermark: watermarkText,
                  });
                }}
                data-testid="button-apply-branding"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {applyBrandingMutation.isPending ? "Applying..." : "Apply Branding"}
              </Button>
            </div>
          )}

          {/* Stock Media Library Panel */}
          {activeTool === "media" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium">Stock Media</h3>
                <Badge variant="secondary" className="text-xs">Post-Production Only</Badge>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                Browse and add stock footage to enhance your edited video. B-roll is added manually in the editor.
              </p>
              <StockMediaLibrary 
                projectId={projectId}
                onMediaSelect={(url, type) => {
                  toast({
                    title: "Media Selected",
                    description: "Stock media ready to insert. Use timeline to place it.",
                  });
                }}
              />
            </div>
          )}
        </aside>

        {/* Preview Area */}
        <main className="flex-1 flex flex-col bg-black/50 overflow-hidden">
          {/* Video Preview */}
          <div className="flex-1 flex items-center justify-center p-4">
            {videoPath ? (
              <video
                ref={videoRef}
                src={videoPath}
                className="max-h-full max-w-full rounded-lg shadow-2xl"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => setIsPlaying(false)}
                playsInline
                data-testid="video-preview"
              />
            ) : (
              <div className="text-center text-muted-foreground">
                <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No video available</p>
              </div>
            )}
          </div>

          {/* Playback Controls */}
          <div className="h-16 border-t border-white/10 flex items-center justify-center gap-4 px-4 shrink-0">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={skipPrev} 
              disabled={selectedClipIndex === 0 || videoList.length <= 1}
            >
              <SkipBack className="h-5 w-5" />
            </Button>
            <Button variant="default" size="icon" onClick={togglePlay} disabled={!videoPath} data-testid="button-play">
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={skipNext} 
              disabled={selectedClipIndex >= videoList.length - 1 || videoList.length <= 1}
            >
              <SkipForward className="h-5 w-5" />
            </Button>
            <div className="flex-1 max-w-md flex items-center gap-3">
              <span className="text-xs text-white/70 w-10">{formatTime(currentTime)}</span>
              <Slider
                value={[currentTime]}
                onValueChange={handleSeek}
                max={duration || 100}
                step={0.1}
                className="flex-1"
                data-testid="slider-seek"
              />
              <span className="text-xs text-white/70 w-10">{formatTime(duration)}</span>
            </div>
          </div>
        </main>
      </div>

      {/* Timeline */}
      <div className="h-28 border-t bg-muted/30 shrink-0">
        <div className="h-full flex items-center px-4 gap-2 overflow-x-auto" ref={timelineRef}>
          {videoList.length > 0 ? (
            videoList.map((video, index) => (
              <button
                key={video?.id || index}
                onClick={() => setSelectedClipIndex(index)}
                className={`shrink-0 h-20 w-32 rounded-lg overflow-hidden border-2 transition-all ${
                  selectedClipIndex === index
                    ? "border-primary ring-2 ring-primary/30"
                    : "border-transparent hover:border-primary/50"
                }`}
                data-testid={`button-clip-${index}`}
              >
                <div className="h-full w-full bg-muted flex items-center justify-center relative">
                  <Play className="h-6 w-6 text-muted-foreground" />
                  <div className="absolute bottom-1 right-1">
                    <Badge variant="secondary" className="text-[10px] px-1 py-0">
                      {formatDuration((video as any)?.duration || 0)}
                    </Badge>
                  </div>
                  <div className="absolute top-1 left-1">
                    <Badge variant="outline" className="text-[10px] px-1 py-0 bg-background/80">
                      {index + 1}
                    </Badge>
                  </div>
                </div>
              </button>
            ))
          ) : slices.length > 0 ? (
            // Visual Timeline - Interactive clip editing
            currentProject && ( // Ensure currentProject exists before rendering timeline
              <Card className="p-6 border-2 border-blue-200 dark:border-blue-800">
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                      <Film className="h-5 w-5 text-blue-600" />
                      Visual Timeline
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Drag clips to reorder, click to preview
                    </p>
                  </div>
                  <SmartSlicesTimeline
                    slices={slices}
                    currentVideo={videos?.short || videos?.standard || videos?.comprehensive || null}
                    onSliceSelect={(sliceId) => {
                      console.log("Selected slice:", sliceId);
                    }}
                  />
                </div>
              </Card>
            )
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              No clips available
            </div>
          )}
        </div>
      </div>
    </div>
  );
}