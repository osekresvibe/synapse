
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Wand2, Loader2, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FeedbackRefinementProps {
  projectId: string;
  videoType: "short" | "standard" | "comprehensive";
  onRefineVideo: (feedback: string, interpretedParams: any) => void;
  isRefining?: boolean;
}

export function FeedbackRefinement({
  projectId,
  videoType,
  onRefineVideo,
  isRefining = false,
}: FeedbackRefinementProps) {
  const { toast } = useToast();
  const [feedback, setFeedback] = useState("");
  const [interpreting, setInterpreting] = useState(false);
  const [interpretedParams, setInterpretedParams] = useState<any>(null);

  // Categorized suggestion templates for different editing facets
  const suggestionCategories = {
    pace: {
      label: "⚡ Pace & Speed",
      suggestions: [
        "Make it faster and more energetic",
        "Slower pace, let moments breathe",
        "Quick cuts between scenes",
        "Smooth and flowing transitions",
      ],
    },
    duration: {
      label: "⏱️ Scene Length",
      suggestions: [
        "Shorter scenes for social media",
        "Longer clips to show detail",
        "Balance between quick and slow",
        "More time on important parts",
      ],
    },
    focus: {
      label: "🎯 Content Focus",
      suggestions: [
        "Focus on the first half",
        "Focus on the second half",
        "Emphasize the middle section",
        "Remove repetitive parts",
      ],
    },
    color: {
      label: "🎨 Color & Mood",
      suggestions: [
        "More vibrant and saturated colors",
        "Cinematic and moody look",
        "Bright and clean aesthetic",
        "Warm and inviting tones",
      ],
    },
    energy: {
      label: "🔥 Energy Level",
      suggestions: [
        "High energy and dynamic",
        "Calm and professional",
        "Dramatic and intense",
        "Fun and playful vibe",
      ],
    },
  };

  const [selectedCategory, setSelectedCategory] = useState<keyof typeof suggestionCategories | null>(null);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);

  const handleInterpretFeedback = async () => {
    if (!feedback.trim()) {
      toast({
        title: "Feedback Required",
        description: "Please describe how you'd like to adjust the video",
        variant: "destructive",
      });
      return;
    }

    setInterpreting(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/interpret-feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedback: feedback.trim(),
          videoType,
          // Include current parameters for context-aware refinement
          currentParameters: interpretedParams,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to interpret feedback");
      }

      const result = await response.json();
      
      // Handle both parameter-only and prompt+parameter responses
      const params = result.extractedParameters || result;
      setInterpretedParams(params);

      toast({
        title: "✨ Feedback Interpreted",
        description: result.refinedPrompt 
          ? "Prompt refined and parameters extracted"
          : "Parameters extracted - review and regenerate",
      });
    } catch (error: any) {
      toast({
        title: "❌ Interpretation Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setInterpreting(false);
    }
  };

  const handleApplyRefinement = () => {
    if (!feedback.trim()) {
      return;
    }
    // Pass the raw feedback text - the backend will handle interpretation
    onRefineVideo(feedback, interpretedParams || {});
  };

  return (
    <Card className="p-6 space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Refine Your Edit</h3>
          <Badge variant="secondary">Beta</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Describe how you'd like to adjust the video in plain English
        </p>
      </div>

      <div className="space-y-3">
        <Textarea
          placeholder="Describe how you'd like to adjust the video in plain English..."
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={4}
          className="resize-none"
          disabled={interpreting || isRefining}
        />

        {/* Category Pills */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">💡 Need help? Pick a category:</span>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-auto py-1"
              onClick={() => setShowAllSuggestions(!showAllSuggestions)}
            >
              {showAllSuggestions ? "Show less" : "Show all"}
            </Button>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {Object.entries(suggestionCategories).map(([key, { label }]) => (
              <Button
                key={key}
                variant={selectedCategory === key ? "default" : "outline"}
                size="sm"
                className="text-xs"
                onClick={() => setSelectedCategory(selectedCategory === key ? null : key as keyof typeof suggestionCategories)}
                disabled={interpreting || isRefining}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {/* Category-Specific Suggestions */}
        {selectedCategory && (
          <div className="space-y-2 p-3 bg-accent/5 rounded-lg border border-accent/20">
            <p className="text-xs font-medium">
              {suggestionCategories[selectedCategory].label} suggestions:
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestionCategories[selectedCategory].suggestions.map((suggestion, i) => (
                <Button
                  key={i}
                  variant="secondary"
                  size="sm"
                  className="text-xs"
                  onClick={() => setFeedback(suggestion)}
                  disabled={interpreting || isRefining}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* All Suggestions (Expanded View) */}
        {showAllSuggestions && !selectedCategory && (
          <div className="space-y-3 p-3 bg-accent/5 rounded-lg border border-accent/20 max-h-64 overflow-y-auto">
            {Object.entries(suggestionCategories).map(([key, { label, suggestions }]) => (
              <div key={key} className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((suggestion, i) => (
                    <Button
                      key={i}
                      variant="ghost"
                      size="sm"
                      className="text-xs h-auto py-1 px-2"
                      onClick={() => setFeedback(suggestion)}
                      disabled={interpreting || isRefining}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!interpretedParams ? (
        <Button
          onClick={handleInterpretFeedback}
          disabled={interpreting || !feedback.trim()}
          className="w-full"
        >
          {interpreting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Interpreting Feedback...
            </>
          ) : (
            <>
              <Wand2 className="mr-2 h-4 w-4" />
              Interpret Feedback
            </>
          )}
        </Button>
      ) : (
        <div className="space-y-3">
          <Card className="p-4 bg-accent/10 border-accent">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">AI Interpretation:</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setInterpretedParams(null)}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {interpretedParams.cutTempo && (
                  <div>
                    <span className="text-muted-foreground">Cut Tempo:</span>
                    <span className="ml-2 font-medium">{interpretedParams.cutTempo}ms</span>
                  </div>
                )}
                {interpretedParams.clipDurationMultiplier && (
                  <div>
                    <span className="text-muted-foreground">Clip Length:</span>
                    <span className="ml-2 font-medium">
                      {interpretedParams.clipDurationMultiplier > 1 ? "+" : ""}
                      {((interpretedParams.clipDurationMultiplier - 1) * 100).toFixed(0)}%
                    </span>
                  </div>
                )}
                {interpretedParams.engagementThreshold && (
                  <div>
                    <span className="text-muted-foreground">Min Engagement:</span>
                    <span className="ml-2 font-medium">{interpretedParams.engagementThreshold}</span>
                  </div>
                )}
                {interpretedParams.colorGrade && (
                  <div>
                    <span className="text-muted-foreground">Color Grade:</span>
                    <span className="ml-2 font-medium">{interpretedParams.colorGrade}</span>
                  </div>
                )}
                {interpretedParams.focusRegion && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Focus:</span>
                    <span className="ml-2 font-medium">{interpretedParams.focusRegion}</span>
                  </div>
                )}
              </div>
            </div>
          </Card>

          <Button
            onClick={handleApplyRefinement}
            disabled={isRefining}
            className="w-full"
          >
            {isRefining ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Regenerating Video...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Regenerate with Adjustments
              </>
            )}
          </Button>
        </div>
      )}

      <div className="text-xs text-muted-foreground space-y-1">
        <p>💡 <strong>Tip:</strong> Use the category buttons above to find the right words, or combine multiple suggestions like:</p>
        <ul className="list-disc list-inside pl-2 space-y-0.5 text-xs">
          <li>"Make it faster and more vibrant"</li>
          <li>"Shorter scenes with warm tones"</li>
          <li>"High energy focus on first half"</li>
        </ul>
      </div>
    </Card>
  );
}
