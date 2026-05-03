
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Download, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { TriptychVideos } from "@shared/schema";

interface TriptychPreviewProps {
  videos: TriptychVideos;
  onVideoSelect: (type: "short" | "standard" | "comprehensive", index?: number) => void;
  selectedType: "short" | "standard" | "comprehensive" | null;
  projectId?: number;
  onImproveClip?: (
    clipIndex: number,
    videoId: string,
    feedback: string[],
    onSuccess: () => void
  ) => void;
}

export function TriptychPreview({
  videos,
  onVideoSelect,
  selectedType,
  projectId,
  onImproveClip,
}: TriptychPreviewProps) {
  const [currentClipIndex, setCurrentClipIndex] = useState(0);

  // Check if we're in multiple-clips mode
  const isMultipleClipsMode = videos.multipleClips && videos.multipleClips.length > 0;
  const totalClips = isMultipleClipsMode ? videos.multipleClips!.length : 0;

  if (isMultipleClipsMode) {
    const currentClip = videos.multipleClips![currentClipIndex];
    
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">
            Your Clips ({totalClips} clips ready)
          </h2>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentClipIndex(Math.max(0, currentClipIndex - 1))}
              disabled={currentClipIndex === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {currentClipIndex + 1} / {totalClips}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentClipIndex(Math.min(totalClips - 1, currentClipIndex + 1))}
              disabled={currentClipIndex === totalClips - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Card className="p-6">
          <div className="space-y-4">
            <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
              <video
                src={currentClip.videoPath}
                controls
                className="w-full h-full"
                key={currentClip.id}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Clip {currentClipIndex + 1}</h3>
                <p className="text-sm text-muted-foreground">
                  {currentClip.duration}s • {currentClip.slices.length} segments
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onVideoSelect("short", currentClipIndex)}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Preview
                </Button>
                {onImproveClip && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const feedback = [
                        "Strengthen the closing moment with a memorable ending",
                        "Increase visual variety - add more action or emotional moments"
                      ];
                      onImproveClip(currentClipIndex, currentClip.id, feedback, () => {
                        console.log("Clip improved successfully");
                      });
                    }}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Improve
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Count how many videos actually exist
  const availableVideos = [
    videos.short ? { key: "short" as const, video: videos.short, label: "Short Hook", description: "15-30s hook for maximum engagement" } : null,
    videos.standard ? { key: "standard" as const, video: videos.standard, label: "Standard Edit", description: "AI-optimized balanced content" } : null,
    videos.comprehensive ? { key: "comprehensive" as const, video: videos.comprehensive, label: "Comprehensive", description: "Full-length detailed edit" } : null,
  ].filter(Boolean) as Array<{ key: "short" | "standard" | "comprehensive"; video: any; label: string; description: string }>;

  const videoCount = availableVideos.length;
  const isSingleVideo = videoCount === 1;

  // Single video mode - show centered single card
  if (isSingleVideo) {
    const { key, video, label, description } = availableVideos[0];
    const isSelected = selectedType === key;

    return (
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Your Video is Ready</h2>
        <p className="text-muted-foreground">
          Your AI-edited video is ready to download
        </p>

        <div className="max-w-2xl mx-auto">
          <Card
            className={`overflow-hidden transition-all ${
              isSelected ? "ring-2 ring-primary" : ""
            }`}
          >
            <div className="aspect-video bg-black relative">
              <video
                src={video.videoPath}
                className="w-full h-full object-cover"
                controls
                playsInline
              />
              <Badge className="absolute top-2 right-2">
                {video.duration}s
              </Badge>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <h3 className="font-semibold">{label}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1"
                  onClick={() => onVideoSelect(key)}
                  data-testid="button-preview-single"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Preview
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(video.videoPath, '_blank')}
                  data-testid="button-download-single"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </section>
    );
  }

  // Multiple videos mode - show grid (only show available videos)
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">
        Your {videoCount} {videoCount === 1 ? 'Video' : 'Videos'} {videoCount === 1 ? 'is' : 'Are'} Ready
      </h2>
      <p className="text-muted-foreground">
        Review and compare your {videoCount} professionally edited {videoCount === 1 ? 'video' : 'videos'}
      </p>

      <div className={`grid grid-cols-1 ${videoCount >= 3 ? 'md:grid-cols-3' : videoCount === 2 ? 'md:grid-cols-2' : ''} gap-6`}>
        {availableVideos.map(({ key, video, label, description }) => {
          const isSelected = selectedType === key;

          return (
            <Card
              key={key}
              className={`overflow-hidden transition-all ${
                isSelected ? "ring-2 ring-primary" : ""
              }`}
            >
              <div className="aspect-video bg-black relative">
                <video
                  src={video.videoPath}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                />
                <Badge className="absolute top-2 right-2">
                  {video.duration}s
                </Badge>
              </div>

              <div className="p-4 space-y-3">
                <div>
                  <h3 className="font-semibold">{label}</h3>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => onVideoSelect(key)}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Preview
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
