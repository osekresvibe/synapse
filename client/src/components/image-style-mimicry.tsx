
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Loader2, Palette, CheckCircle2, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";

interface ImageStyleAnalysis {
  colorPalette: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  fontStyle: {
    family: string;
    weight: string;
    alignment: string;
    casing: string;
  };
  composition: {
    layout: string;
    textPosition: string;
    imageStyle: string;
  };
  vibe: string;
  reasoning: string;
}

interface ImageStyleMimicryProps {
  onStyleAnalyzed?: (style: ImageStyleAnalysis) => void;
}

export function ImageStyleMimicry({ onStyleAnalyzed }: ImageStyleMimicryProps) {
  const [imageUrl, setImageUrl] = useState("");
  const [analyzedStyle, setAnalyzedStyle] = useState<ImageStyleAnalysis | null>(null);
  const { toast } = useToast();

  const analyzeStyleMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await fetch("/api/analyze-image-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: url }),
      });

      if (!response.ok) {
        throw new Error("Failed to analyze image style");
      }

      return response.json();
    },
    onSuccess: (data) => {
      setAnalyzedStyle(data.styleAnalysis);
      onStyleAnalyzed?.(data.styleAnalysis);
      toast({
        title: "✨ Style Extracted Successfully",
        description: `${data.styleAnalysis.vibe} aesthetic identified - Ready to replicate!`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAnalyze = () => {
    if (imageUrl.trim()) {
      analyzeStyleMutation.mutate(imageUrl);
    }
  };

  return (
    <Card className="p-6 space-y-4 border-purple-500/20 hover:border-purple-500/40 transition-colors">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <ImageIcon className="h-5 w-5 text-purple-500" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Image Style Mimicry</h3>
              {analyzedStyle ? (
                <Badge className="bg-purple-500 text-white text-xs">ACTIVE</Badge>
              ) : (
                <Badge variant="outline" className="text-xs">Optional</Badge>
              )}
            </div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Paste any viral image URL - AI will extract its style DNA and apply it to <span className="font-semibold text-foreground">AI-generated slides & carousels</span> (not video editing)
        </p>
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="image-url">Reference Image URL</Label>
          <div className="flex gap-2">
            <Input
              id="image-url"
              placeholder="https://example.com/viral-image.jpg"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              disabled={analyzeStyleMutation.isPending}
            />
            <Button
              onClick={handleAnalyze}
              disabled={!imageUrl.trim() || analyzeStyleMutation.isPending}
              className="shrink-0"
            >
              {analyzeStyleMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Palette className="h-4 w-4 mr-2" />
                  Analyze Style
                </>
              )}
            </Button>
          </div>
        </div>

        {analyzedStyle && (
          <div className="p-4 bg-purple-500/5 border border-purple-500/20 rounded-lg space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-semibold">Style DNA Extracted</span>
            </div>

            {/* Color Palette */}
            <div className="space-y-2">
              <span className="text-xs text-muted-foreground font-medium">Color Palette</span>
              <div className="flex gap-2">
                {Object.entries(analyzedStyle.colorPalette).map(([name, color]) => (
                  <div key={name} className="flex flex-col items-center gap-1">
                    <div
                      className="w-10 h-10 rounded border border-border"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs text-muted-foreground capitalize">{name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Typography */}
            <div className="space-y-2 pb-2 border-b border-purple-500/10">
              <span className="text-xs text-purple-500 font-semibold">Typography (for text slides)</span>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="space-y-1">
                  <span className="text-muted-foreground text-xs">Font Family</span>
                  <div className="font-medium text-purple-500 capitalize">{analyzedStyle.fontStyle.family}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground text-xs">Font Weight</span>
                  <div className="font-medium text-purple-500 capitalize">{analyzedStyle.fontStyle.weight}</div>
                </div>
              </div>
            </div>

            {/* Composition */}
            <div className="space-y-2">
              <span className="text-xs text-purple-500 font-semibold">Layout & Vibe (for AI images)</span>
              <div className="flex gap-1 flex-wrap">
                <Badge variant="outline" className="text-xs capitalize">{analyzedStyle.composition.layout}</Badge>
                <Badge variant="outline" className="text-xs capitalize">{analyzedStyle.composition.imageStyle}</Badge>
                <Badge variant="outline" className="text-xs capitalize">{analyzedStyle.vibe}</Badge>
              </div>
            </div>

            <p className="text-xs text-muted-foreground italic border-t border-purple-500/10 pt-2">
              {analyzedStyle.reasoning}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
