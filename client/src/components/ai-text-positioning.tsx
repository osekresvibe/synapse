
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AITextPositioningProps {
  projectId: string;
  videoDuration: number;
  onPositionRecommended?: (position: "top" | "center" | "bottom", timestamp: number) => void;
}

export function AITextPositioning({ projectId, videoDuration, onPositionRecommended }: AITextPositioningProps) {
  const [timestamp, setTimestamp] = useState<number>(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<{
    recommendedPosition: "top" | "center" | "bottom";
    hasFaces: boolean;
    hasObjects: boolean;
    reasoning: string;
  } | null>(null);
  const { toast } = useToast();

  const analyzeFrame = async () => {
    if (timestamp < 0 || timestamp > videoDuration) {
      toast({
        title: "Invalid timestamp",
        description: `Please enter a timestamp between 0 and ${videoDuration} seconds`,
        variant: "destructive",
      });
      return;
    }

    setAnalyzing(true);
    setResult(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/analyze-text-position`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timestamp }),
      });

      if (!response.ok) {
        throw new Error("Failed to analyze frame");
      }

      const data = await response.json();
      setResult(data);

      toast({
        title: "Analysis complete",
        description: `Recommended position: ${data.recommendedPosition}`,
      });

      if (onPositionRecommended) {
        onPositionRecommended(data.recommendedPosition, timestamp);
      }
    } catch (error: any) {
      toast({
        title: "Analysis failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <Card className="border-purple-200 dark:border-purple-800">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-purple-600" />
          <CardTitle>AI Text Positioning</CardTitle>
        </div>
        <CardDescription>
          Analyze video frames to find the best position for text overlays
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <Label htmlFor="timestamp">Timestamp (seconds)</Label>
            <Input
              id="timestamp"
              type="number"
              min={0}
              max={videoDuration}
              step={0.1}
              value={timestamp}
              onChange={(e) => setTimestamp(parseFloat(e.target.value) || 0)}
              placeholder="Enter timestamp to analyze"
            />
          </div>
          <Button
            onClick={analyzeFrame}
            disabled={analyzing}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {analyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Analyze Frame
              </>
            )}
          </Button>
        </div>

        {result && (
          <div className="mt-4 p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Recommended Position:</span>
              <Badge className="bg-purple-600 text-white">
                {result.recommendedPosition.toUpperCase()}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Faces detected:</span>
                <Badge variant={result.hasFaces ? "default" : "secondary"}>
                  {result.hasFaces ? "Yes" : "No"}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Objects detected:</span>
                <Badge variant={result.hasObjects ? "default" : "secondary"}>
                  {result.hasObjects ? "Yes" : "No"}
                </Badge>
              </div>
            </div>

            <div className="text-sm">
              <span className="font-semibold">AI Reasoning:</span>
              <p className="text-muted-foreground mt-1">{result.reasoning}</p>
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground mt-4">
          <p>💡 <strong>Tip:</strong> The AI analyzes faces, objects, and composition to recommend where text won't cover important content.</p>
        </div>
      </CardContent>
    </Card>
  );
}
