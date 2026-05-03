
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, Zap, TrendingUp, Clock, Film } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SmartSlice, GeneratedVideo } from "@shared/schema";

interface SmartRefinementProps {
  projectId: string;
  video: GeneratedVideo & { slices: SmartSlice[] };
  onRefine: (refinementType: string, params: any) => void;
}

interface RefinementSuggestion {
  id: string;
  type: "pacing" | "hook" | "structure" | "content";
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  estimatedChange: string;
  icon: any;
}

export function SmartRefinement({ projectId, video, onRefine }: SmartRefinementProps) {
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState<RefinementSuggestion[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [variations, setVariations] = useState<any[]>([]);

  useEffect(() => {
    if (video?.id) {
      analyzeVideo();
    }
  }, [video?.id]);

  const analyzeVideo = async () => {
    setIsAnalyzing(true);
    try {
      // Analyze current video structure
      const totalDuration = video.duration;
      const clipCount = video.slices.length;
      const avgClipDuration = totalDuration / clipCount;
      
      const suggestions: RefinementSuggestion[] = [];

      // Hook Analysis
      const firstClipDuration = video.slices[0]?.endTime - video.slices[0]?.startTime || 0;
      if (firstClipDuration > 5) {
        suggestions.push({
          id: "faster-hook",
          type: "hook",
          title: "Faster Hook",
          description: `First clip is ${firstClipDuration}s. Move high-engagement content earlier.`,
          impact: "high",
          estimatedChange: "-3s opening",
          icon: Zap,
        });
      }

      // Pacing Analysis
      if (avgClipDuration > 8) {
        suggestions.push({
          id: "speed-up-pacing",
          type: "pacing",
          title: "Speed Up Pacing",
          description: "Average clip length is slow. Increase cut frequency.",
          impact: "medium",
          estimatedChange: "40% faster cuts",
          icon: TrendingUp,
        });
      }

      // Content Analysis - check for engagement scores
      const lowEngagementClips = video.slices.filter(s => (s.engagementScore || 50) < 60);
      if (lowEngagementClips.length > clipCount * 0.3) {
        suggestions.push({
          id: "remove-low-engagement",
          type: "content",
          title: "Cut Low-Value Segments",
          description: `${lowEngagementClips.length} clips have low engagement scores`,
          impact: "high",
          estimatedChange: `-${Math.round(totalDuration * 0.2)}s duration`,
          icon: Film,
        });
      }

      // Duration Analysis
      if (totalDuration > 90 && video.type !== "comprehensive") {
        suggestions.push({
          id: "trim-to-60s",
          type: "structure",
          title: "Optimize for 60s",
          description: "Current length may reduce retention on social media",
          impact: "medium",
          estimatedChange: "-30s",
          icon: Clock,
        });
      }

      setSuggestions(suggestions);
    } catch (error) {
      console.error("Analysis error:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleApplyRefinements = async () => {
    if (selectedSuggestions.size === 0) {
      toast({
        title: "No refinements selected",
        description: "Select at least one suggestion to apply",
        variant: "destructive",
      });
      return;
    }

    const refinementParams = {
      suggestions: Array.from(selectedSuggestions),
      videoId: video.id,
    };

    onRefine("batch-refinement", refinementParams);
  };

  const handleGenerateVariations = async () => {
    setIsAnalyzing(true);
    try {
      // Use interpret-feedback endpoint to generate multiple refinement suggestions
      const response = await apiRequest("POST", `/api/projects/${projectId}/interpret-feedback`, {
        feedback: "Generate multiple variations of this video with different pacing and styles",
        videoType: video.type,
      });
      const data = await response.json();
      
      // The response now contains { suggestions: [...] }
      if (data.suggestions && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
        setVariations(data.suggestions.map((s: any) => ({
          title: s.reasoning || "Variation",
          description: `Tempo: ${s.cutTempo || 1500}ms, Engagement: ${s.engagementThreshold || 60}%`,
          duration: video.duration,
          params: s, // Store full params for later use
        })));

        toast({
          title: `✨ ${data.suggestions.length} Smart Variations Generated`,
          description: "Each optimized for different narrative styles",
        });
      } else {
        throw new Error("No suggestions generated. Try providing more specific feedback.");
      }
    } catch (error: any) {
      toast({
        title: "Generation failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleSuggestion = (id: string) => {
    const newSelected = new Set(selectedSuggestions);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedSuggestions(newSelected);
  };

  if (isAnalyzing && suggestions.length === 0) {
    return (
      <Card className="p-6 text-center">
        <Sparkles className="h-8 w-8 mx-auto mb-2 animate-pulse text-primary" />
        <p className="text-sm text-muted-foreground">Analyzing video structure...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold flex items-center justify-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          Smart Refinement
        </h2>
        <p className="text-muted-foreground">
          AI-detected improvements for your generated video
        </p>
      </div>

      {suggestions.length > 0 ? (
        <Card className="p-6 space-y-4">
          <div className="space-y-3">
            <h3 className="font-semibold">Suggested Improvements</h3>
            {suggestions.map((suggestion) => {
              const Icon = suggestion.icon;
              return (
                <div
                  key={suggestion.id}
                  className="flex items-start gap-3 p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => toggleSuggestion(suggestion.id)}
                >
                  <Checkbox
                    checked={selectedSuggestions.has(suggestion.id)}
                    onCheckedChange={() => toggleSuggestion(suggestion.id)}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="h-4 w-4 text-primary" />
                      <span className="font-medium">{suggestion.title}</span>
                      <Badge
                        variant={
                          suggestion.impact === "high"
                            ? "default"
                            : suggestion.impact === "medium"
                            ? "secondary"
                            : "outline"
                        }
                        className="text-xs"
                      >
                        {suggestion.impact} impact
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{suggestion.description}</p>
                    <p className="text-xs text-primary mt-1">{suggestion.estimatedChange}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <Button
            onClick={handleApplyRefinements}
            disabled={selectedSuggestions.size === 0}
            className="w-full"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Apply {selectedSuggestions.size} Refinement{selectedSuggestions.size !== 1 ? "s" : ""}
          </Button>
        </Card>
      ) : (
        <Card className="p-6 text-center">
          <p className="text-sm text-muted-foreground">
            ✅ No major issues detected - video is well-structured
          </p>
        </Card>
      )}

      <Card className="p-6 space-y-4">
        <h3 className="font-semibold">Try Different Story Angles</h3>
        <p className="text-sm text-muted-foreground">
          Same content, different narrative structures optimized for engagement
        </p>
        <Button
          onClick={handleGenerateVariations}
          disabled={isAnalyzing}
          variant="outline"
          className="w-full"
        >
          <Film className="mr-2 h-4 w-4" />
          {isAnalyzing ? "Generating..." : "Generate 3 Smart Variations"}
        </Button>

        {variations.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mt-4">
            {variations.map((variant, idx) => (
              <Card key={idx} className="p-4 text-center hover:border-primary cursor-pointer transition-colors">
                <h4 className="font-medium text-sm mb-1">{variant.title}</h4>
                <p className="text-xs text-muted-foreground mb-2">{variant.description}</p>
                <Badge variant="secondary" className="text-xs">
                  {variant.duration}s
                </Badge>
              </Card>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
