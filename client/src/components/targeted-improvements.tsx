import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Wand2, 
  Zap, 
  TrendingUp, 
  Clock, 
  Sparkles,
  Target,
  Film,
  Volume2,
  Loader2,
  Undo2
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface QualityScores {
  overall: number;
  hookScore: number;
  dynamism: number;
  usability: number;
  buildupScore: number;
  payoffScore: number;
  closerScore: number;
}

interface ImprovementOption {
  id: string;
  category: "hook" | "dynamism" | "structure" | "pacing" | "engagement";
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  scoreAffected: keyof QualityScores;
  currentScore: number;
  icon: typeof Zap;
  action: string;
}

interface TargetedImprovementsProps {
  projectId: string;
  videoId: string;
  qualityScores: QualityScores;
  hasPreviousVersion?: boolean;
  onImprovementComplete?: () => void;
  onRevertComplete?: () => void;
}

const SCORE_THRESHOLD = 80;

function analyzeWeaknesses(scores: QualityScores): ImprovementOption[] {
  const improvements: ImprovementOption[] = [];

  if (scores.hookScore < SCORE_THRESHOLD) {
    improvements.push({
      id: "improve-hook",
      category: "hook",
      title: "Strengthen Opening Hook",
      description: "Replace first clip with highest-engagement moment to grab attention immediately",
      impact: scores.hookScore < 60 ? "high" : scores.hookScore < 75 ? "medium" : "low",
      scoreAffected: "hookScore",
      currentScore: scores.hookScore,
      icon: Zap,
      action: "swap_hook_with_best_moment"
    });
  }

  if (scores.dynamism < SCORE_THRESHOLD) {
    improvements.push({
      id: "improve-dynamism",
      category: "dynamism",
      title: "Increase Visual Variety",
      description: "Add more action clips and vary shot types for better visual flow",
      impact: scores.dynamism < 60 ? "high" : scores.dynamism < 75 ? "medium" : "low",
      scoreAffected: "dynamism",
      currentScore: scores.dynamism,
      icon: TrendingUp,
      action: "increase_clip_variety"
    });

    if (scores.dynamism < 70) {
      improvements.push({
        id: "faster-pacing",
        category: "pacing",
        title: "Speed Up Cut Tempo",
        description: "Reduce average clip length for a more energetic, engaging rhythm",
        impact: "medium",
        scoreAffected: "dynamism",
        currentScore: scores.dynamism,
        icon: Clock,
        action: "increase_cut_tempo"
      });
    }
  }

  if (scores.buildupScore < SCORE_THRESHOLD) {
    improvements.push({
      id: "improve-buildup",
      category: "structure",
      title: "Strengthen Buildup",
      description: "Reorder middle section to create better tension and progression",
      impact: scores.buildupScore < 65 ? "high" : "medium",
      scoreAffected: "buildupScore",
      currentScore: scores.buildupScore,
      icon: Target,
      action: "restructure_buildup"
    });
  }

  if (scores.payoffScore < SCORE_THRESHOLD) {
    improvements.push({
      id: "improve-payoff",
      category: "structure",
      title: "Enhance Payoff Moment",
      description: "Ensure the climax/key moment has maximum impact with proper setup",
      impact: scores.payoffScore < 65 ? "high" : "medium",
      scoreAffected: "payoffScore",
      currentScore: scores.payoffScore,
      icon: Sparkles,
      action: "enhance_payoff"
    });
  }

  if (scores.closerScore < SCORE_THRESHOLD) {
    improvements.push({
      id: "improve-closer",
      category: "structure",
      title: "Create Memorable Ending",
      description: "Replace closing with a stronger call-to-action or memorable final moment",
      impact: scores.closerScore < 65 ? "high" : "medium",
      scoreAffected: "closerScore",
      currentScore: scores.closerScore,
      icon: Film,
      action: "improve_closing"
    });
  }

  if (scores.usability < SCORE_THRESHOLD && scores.usability < scores.overall) {
    improvements.push({
      id: "improve-audio",
      category: "engagement",
      title: "Optimize Audio Balance",
      description: "Ensure speech is clear and audio levels are consistent throughout",
      impact: "medium",
      scoreAffected: "usability",
      currentScore: scores.usability,
      icon: Volume2,
      action: "balance_audio"
    });
  }

  return improvements.sort((a, b) => {
    const impactOrder = { high: 0, medium: 1, low: 2 };
    return impactOrder[a.impact] - impactOrder[b.impact];
  });
}

function getImpactColor(impact: "high" | "medium" | "low") {
  switch (impact) {
    case "high": return "bg-destructive/10 text-destructive border-destructive/30";
    case "medium": return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30";
    case "low": return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30";
  }
}

function getScoreColor(score: number) {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 70) return "text-yellow-600 dark:text-yellow-400";
  return "text-destructive";
}

export function TargetedImprovements({ 
  projectId, 
  videoId, 
  qualityScores,
  hasPreviousVersion = false,
  onImprovementComplete,
  onRevertComplete
}: TargetedImprovementsProps) {
  const [selectedImprovements, setSelectedImprovements] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const improvements = analyzeWeaknesses(qualityScores);

  const applyImprovementsMutation = useMutation({
    mutationFn: async (actions: string[]) => {
      const response = await apiRequest("POST", `/api/projects/${projectId}/apply-improvements`, {
        videoId,
        improvements: actions
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Improvements Applied",
        description: "Your video is being regenerated with the selected improvements.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      onImprovementComplete?.();
    },
    onError: (error: any) => {
      // Check if it's a file not found error
      const errorMsg = error?.message || "";
      const isFileError = errorMsg.includes("file") || errorMsg.includes("cleaned up") || errorMsg.includes("not found") || errorMsg.includes("not available");
      
      toast({
        title: isFileError ? "Source Video Unavailable" : "Failed to Apply Improvements",
        description: isFileError 
          ? "The original video was cleaned up. Please re-upload to make changes."
          : (errorMsg || "Please try again."),
        variant: "destructive",
      });
    }
  });

  const revertMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/projects/${projectId}/videos/${videoId}/revert`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Reverted to Previous",
        description: "Your video has been restored to its previous version.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
      onRevertComplete?.();
    },
    onError: (error) => {
      toast({
        title: "Failed to Revert",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    }
  });

  const toggleImprovement = (id: string) => {
    const newSelected = new Set(selectedImprovements);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedImprovements(newSelected);
  };

  const selectAll = () => {
    setSelectedImprovements(new Set(improvements.map(i => i.id)));
  };

  const handleApply = () => {
    const selectedActions = improvements
      .filter(i => selectedImprovements.has(i.id))
      .map(i => i.action);
    
    if (selectedActions.length > 0) {
      applyImprovementsMutation.mutate(selectedActions);
    }
  };

  if (improvements.length === 0) {
    return (
      <Card className="p-6 text-center border-green-500/30 bg-green-500/5">
        <div className="space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/10">
            <Sparkles className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="font-semibold text-green-600 dark:text-green-400">
            Excellent Quality!
          </h3>
          <p className="text-sm text-muted-foreground">
            Your video scores are above {SCORE_THRESHOLD} across all metrics. No improvements needed!
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Targeted Improvements
          </h3>
          <p className="text-sm text-muted-foreground">
            Based on your scores, here's what can be improved. Select the fixes you want.
          </p>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={selectAll}
          disabled={selectedImprovements.size === improvements.length}
        >
          Select All
        </Button>
      </div>

      <div className="space-y-3">
        {improvements.map((improvement) => {
          const Icon = improvement.icon;
          const isSelected = selectedImprovements.has(improvement.id);
          
          return (
            <div
              key={improvement.id}
              className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                isSelected 
                  ? "border-primary bg-primary/5" 
                  : "border-border hover:border-primary/50"
              }`}
              onClick={() => toggleImprovement(improvement.id)}
              data-testid={`improvement-option-${improvement.id}`}
            >
              <div className="flex items-start gap-4">
                <Checkbox 
                  checked={isSelected}
                  onCheckedChange={() => toggleImprovement(improvement.id)}
                  className="mt-1"
                  data-testid={`checkbox-${improvement.id}`}
                />
                
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />
                      <span className="font-medium">{improvement.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className={getImpactColor(improvement.impact)}
                      >
                        {improvement.impact} impact
                      </Badge>
                      <span className={`text-sm font-mono ${getScoreColor(improvement.currentScore)}`}>
                        {improvement.currentScore}/100
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-sm text-muted-foreground">
                    {improvement.description}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-4 border-t">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            {selectedImprovements.size} of {improvements.length} improvements selected
          </p>
          {hasPreviousVersion && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => revertMutation.mutate()}
              disabled={revertMutation.isPending}
              data-testid="button-revert-video"
            >
              {revertMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reverting...
                </>
              ) : (
                <>
                  <Undo2 className="mr-2 h-4 w-4" />
                  Revert to Previous
                </>
              )}
            </Button>
          )}
        </div>
        <Button
          onClick={handleApply}
          disabled={selectedImprovements.size === 0 || applyImprovementsMutation.isPending}
          data-testid="button-apply-improvements"
        >
          {applyImprovementsMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Applying...
            </>
          ) : (
            <>
              <Wand2 className="mr-2 h-4 w-4" />
              Apply {selectedImprovements.size} Improvement{selectedImprovements.size !== 1 ? 's' : ''}
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
