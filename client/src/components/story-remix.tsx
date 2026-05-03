
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Wand2, RefreshCw, Play } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface StoryRemixProps {
  projectId: string;
  onStorySelected: (storyId: string) => void;
}

interface RemixedStory {
  title: string;
  narrative: string;
  mood: string;
  targetAudience: string;
  scenes: Array<{
    sliceId: string;
    order: number;
    newContext: string;
    voiceoverText: string;
    duration: number;
  }>;
}

export function StoryRemix({ projectId, onStorySelected }: StoryRemixProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [storyStyle, setStoryStyle] = useState<string>("dramatic");
  const [stories, setStories] = useState<RemixedStory[]>([]);
  const [selectedStory, setSelectedStory] = useState<number>(0);

  const handleGenerateSingle = async () => {
    setIsGenerating(true);
    try {
      const response = await apiRequest("POST", `/api/projects/${projectId}/remix-story`, {
        storyStyle,
        preserveOrder: false,
      });
      const data = await response.json();
      setStories([data.story]);
      setSelectedStory(0);

      toast({
        title: "✨ Story Remixed!",
        description: `Created: "${data.story.title}"`,
      });
    } catch (error: any) {
      toast({
        title: "Remix Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateVariations = async () => {
    setIsGenerating(true);
    try {
      const response = await apiRequest("POST", `/api/projects/${projectId}/remix-variations`, {
        count: 3,
      });
      const data = await response.json();
      setStories(data.stories);
      setSelectedStory(0);

      toast({
        title: "✨ 3 Story Variations Created!",
        description: "Compare different narrative approaches",
      });
    } catch (error: any) {
      toast({
        title: "Remix Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const currentStory = stories[selectedStory];

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold flex items-center justify-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          Story Remix
        </h2>
        <p className="text-muted-foreground">
          AI transforms your footage into completely new narratives
        </p>
      </div>

      {!stories.length ? (
        <Card className="p-6 space-y-4">
          <div className="space-y-2">
            <Label>Story Style</Label>
            <Select value={storyStyle} onValueChange={setStoryStyle}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="documentary">Documentary</SelectItem>
                <SelectItem value="dramatic">Dramatic</SelectItem>
                <SelectItem value="educational">Educational</SelectItem>
                <SelectItem value="promotional">Promotional</SelectItem>
                <SelectItem value="inspirational">Inspirational</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={handleGenerateSingle}
              disabled={isGenerating}
              className="w-full"
            >
              <Wand2 className="mr-2 h-4 w-4" />
              {isGenerating ? "Remixing..." : "Generate Story"}
            </Button>
            <Button
              onClick={handleGenerateVariations}
              disabled={isGenerating}
              variant="outline"
              className="w-full"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {isGenerating ? "Generating..." : "3 Variations"}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {stories.length > 1 && (
            <Tabs value={selectedStory.toString()} onValueChange={(v) => setSelectedStory(parseInt(v))}>
              <TabsList className="grid w-full grid-cols-3">
                {stories.map((story, idx) => (
                  <TabsTrigger key={idx} value={idx.toString()}>
                    {story.mood}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}

          {currentStory && (
            <Card className="p-6 space-y-4">
              <div>
                <h3 className="text-xl font-bold">{currentStory.title}</h3>
                <p className="text-muted-foreground mt-2">{currentStory.narrative}</p>
                <div className="flex gap-2 mt-3">
                  <Badge variant="secondary">{currentStory.mood}</Badge>
                  <Badge variant="outline">{currentStory.targetAudience}</Badge>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Story Arc ({currentStory.scenes.length} scenes)</Label>
                {currentStory.scenes.map((scene, idx) => (
                  <Card key={idx} className="p-4 bg-muted/50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">Scene {idx + 1}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {scene.duration}s
                          </span>
                        </div>
                        <p className="text-sm font-medium">{scene.newContext}</p>
                        <p className="text-sm text-muted-foreground mt-2 italic">
                          "{scene.voiceoverText}"
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => onStorySelected(projectId)}
                  className="flex-1"
                >
                  <Play className="mr-2 h-4 w-4" />
                  Use This Story
                </Button>
                <Button
                  onClick={handleGenerateVariations}
                  variant="outline"
                  disabled={isGenerating}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
