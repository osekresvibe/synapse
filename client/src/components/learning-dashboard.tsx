import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Brain, TrendingUp, TrendingDown, Minus, Activity } from "lucide-react";

interface LearningMetrics {
  totalFeedback: number;
  byCategory: Record<string, { count: number; acceptanceRate: number; avgRating: number | null }>;
  improvementTrend: "improving" | "stable" | "declining" | "insufficient_data";
}

export function LearningDashboard() {
  const { data: metrics, isLoading } = useQuery<LearningMetrics>({
    queryKey: ["/api/feedback/metrics"],
  });

  if (isLoading) {
    return (
      <Card data-testid="learning-dashboard-loading">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Brain className="h-5 w-5 animate-pulse" />
            <span>Loading learning metrics...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metrics || metrics.totalFeedback === 0) {
    return (
      <Card data-testid="learning-dashboard-empty">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5" />
            Learning System
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No feedback collected yet. Rate your videos to help the AI learn your preferences.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getTrendIcon = () => {
    switch (metrics.improvementTrend) {
      case "improving":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "declining":
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      case "stable":
        return <Minus className="h-4 w-4 text-yellow-500" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTrendLabel = () => {
    switch (metrics.improvementTrend) {
      case "improving":
        return "Getting better!";
      case "declining":
        return "Needs attention";
      case "stable":
        return "Stable performance";
      default:
        return "Collecting data...";
    }
  };

  return (
    <Card data-testid="learning-dashboard">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Learning System
          </div>
          <Badge variant="outline" className="flex items-center gap-1">
            {getTrendIcon()}
            {getTrendLabel()}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          {metrics.totalFeedback} feedback samples collected
        </div>

        <div className="space-y-3" data-testid="category-list">
          {Object.entries(metrics.byCategory).map(([category, data]) => (
            <div key={category} className="space-y-1" data-testid={`category-${category}`}>
              <div className="flex items-center justify-between text-sm">
                <span className="capitalize" data-testid={`text-category-name-${category}`}>
                  {category.replace(/_/g, " ")}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground" data-testid={`text-acceptance-rate-${category}`}>
                    {(data.acceptanceRate * 100).toFixed(0)}% accepted
                  </span>
                  {data.avgRating && (
                    <Badge variant="secondary" className="text-xs" data-testid={`badge-rating-${category}`}>
                      {data.avgRating.toFixed(1)} avg
                    </Badge>
                  )}
                </div>
              </div>
              <Progress 
                value={data.acceptanceRate * 100} 
                className="h-2"
                data-testid={`progress-${category}`}
              />
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground pt-2 border-t">
          The AI uses this data to improve clip selection, pacing, and hook choices for each video category.
        </p>
      </CardContent>
    </Card>
  );
}
