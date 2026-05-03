import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Video, CheckCircle2, Scissors, Palette, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ReferenceVideoInputProps {
  onAnalyze: (url: string, options: { mimicEditing: boolean; mimicColorGrading: boolean }) => void;
  onStyleAnalyzed?: (referenceVideoId: string, style?: any) => void;
  isAnalyzing: boolean;
  analyzedStyle?: {
    cutTempo: number;
    colorProfile: string[];
    transitionTypes: string[];
  };
}

export function ReferenceVideoInput({
  onAnalyze,
  onStyleAnalyzed,
  isAnalyzing,
  analyzedStyle,
}: ReferenceVideoInputProps) {
  const [videoUrl, setVideoUrl] = useState("");
  const [mimicEditing, setMimicEditing] = useState(true);
  const [mimicColorGrading, setMimicColorGrading] = useState(true);
  const { toast } = useToast();

  const handleAnalyze = () => {
    if (videoUrl.trim()) {
      if (!mimicEditing && !mimicColorGrading) {
        toast({
          title: "Select What to Mimic",
          description: "Please select at least one aspect (editing or color grading) to analyze",
          variant: "destructive",
        });
        return;
      }
      onAnalyze(videoUrl, { mimicEditing, mimicColorGrading });
    } else {
      toast({
        title: "URL Required",
        description: "Please enter a video URL to analyze",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="p-6 space-y-4 border-blue-500/20 hover:border-blue-500/40 transition-colors">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <Video className="h-5 w-5 text-blue-500" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">Reference Video Analysis</h3>
              {analyzedStyle ? (
                <Badge className="bg-blue-500 text-white text-xs">ACTIVE</Badge>
              ) : (
                <Badge variant="outline" className="text-xs">Optional</Badge>
              )}
            </div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Paste any video URL - AI will extract the patterns you select below
        </p>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium">What to Mimic:</Label>
        <div className="flex flex-col gap-3 pl-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="mimic-editing"
              checked={mimicEditing}
              onCheckedChange={(checked) => setMimicEditing(checked as boolean)}
            />
            <div className="flex items-center gap-2">
              <Scissors className="h-4 w-4 text-blue-500" />
              <Label htmlFor="mimic-editing" className="cursor-pointer font-normal">
                <span className="font-semibold">Editing Style</span>
                <span className="text-xs text-muted-foreground ml-2">(cut tempo, transitions, pacing)</span>
              </Label>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="mimic-color"
              checked={mimicColorGrading}
              onCheckedChange={(checked) => setMimicColorGrading(checked as boolean)}
            />
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-blue-500" />
              <Label htmlFor="mimic-color" className="cursor-pointer font-normal">
                <span className="font-semibold">Color Grading</span>
                <span className="text-xs text-muted-foreground ml-2">(color palette, mood, vibe)</span>
              </Label>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Input
          placeholder="https://youtube.com/watch?v=..."
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          disabled={isAnalyzing}
        />
        <Button
          onClick={handleAnalyze}
          disabled={!videoUrl.trim() || isAnalyzing}
          className="w-full"
          variant={analyzedStyle ? "secondary" : "default"}
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing Style...
            </>
          ) : analyzedStyle ? (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Analyze New Style
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Analyze & Apply Style
            </>
          )}
        </Button>
      </div>

      {analyzedStyle && (
        <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-semibold">Style Analyzed & Applied</span>
          </div>

          {mimicEditing && (
            <div className="space-y-2 pb-2 border-b border-blue-500/10">
              <div className="flex items-center gap-2 text-xs text-blue-500">
                <Scissors className="h-3 w-3" />
                <span className="font-semibold">Editing Style Active</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm pl-5">
                <div className="space-y-1">
                  <span className="text-muted-foreground text-xs">Cut Tempo</span>
                  <div className="font-medium text-blue-500">{analyzedStyle.cutTempo.toFixed(1)}s per cut</div>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground text-xs">Transitions</span>
                  <div className="font-medium text-blue-500 capitalize">
                    {analyzedStyle.transitionTypes.join(", ")}
                  </div>
                </div>
              </div>
            </div>
          )}

          {mimicColorGrading && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-blue-500">
                <Palette className="h-3 w-3" />
                <span className="font-semibold">Color Grading Active</span>
              </div>
              <div className="space-y-1 pl-5">
                <span className="text-muted-foreground text-xs">Color Profile</span>
                <div className="flex gap-1 flex-wrap">
                  {analyzedStyle.colorProfile.map((color, i) => (
                    <Badge key={i} variant="outline" className="text-xs capitalize">
                      {color}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground italic">
            ✨ Selected aspects will be applied to your generated videos
          </p>
        </div>
      )}
    </Card>
  );
}