import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GripVertical, Clock, RefreshCw, Plus, Play, Trash2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sparkles, Zap, TrendingUp, MessageSquare } from "lucide-react";
import type { SmartSlice, GeneratedVideo } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Helper function to convert filesystem path to public URL
function getPublicVideoPath(path: string | null): string | null {
  if (!path) return null;

  // Handle paths with /uploads/ (POSIX)
  const uploadsIndex = path.indexOf("/uploads/");
  if (uploadsIndex >= 0) {
    return path.substring(uploadsIndex);
  }

  // Handle Windows paths with \uploads\
  const uploadsIndexWin = path.indexOf("\\uploads\\");
  if (uploadsIndexWin >= 0) {
    return path.substring(uploadsIndexWin).replace(/\\/g, "/");
  }

  // If it's already a relative public path
  if (path.startsWith("uploads/")) {
    return "/" + path;
  }

  // If it's already a public path
  if (path.startsWith("/uploads/")) {
    return path;
  }

  // Unable to normalize - return null to indicate error
  console.error("Unable to normalize video path:", path);
  return null;
}

// Helper function to get icon for clip type
function getClipTypeIcon(clipType: string) {
  switch (clipType) {
    case "intro":
      return <Sparkles className="h-3 w-3" />;
    case "hook":
      return <Zap className="h-3 w-3" />;
    case "key-moment":
      return <TrendingUp className="h-3 w-3" />;
    case "outro":
      return <MessageSquare className="h-3 w-3" />;
    default:
      return <Clock className="h-3 w-3" />;
  }
}

interface ClipPickerProps {
  projectId: string;
  slices: SmartSlice[];
  videos: {
    short: GeneratedVideo | null;
    standard: GeneratedVideo | null;
    comprehensive: GeneratedVideo | null;
    multipleClips?: GeneratedVideo[]; // Added for the new multiple clips feature
  };
  sourceVideoPath: string | null;
}

interface DragData {
  sliceId: string;
  sourceVideoId?: string;
  sourceIndex?: number;
}

export function ClipPicker({ projectId, slices, videos, sourceVideoPath }: ClipPickerProps) {
  const [dragData, setDragData] = useState<DragData | null>(null);
  const [previewSlice, setPreviewSlice] = useState<SmartSlice | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  // Mutation to refit video when clips change
  const refitMutation = useMutation({
    mutationFn: async ({
      videoId,
      newClipSequence,
    }: {
      videoId: string;
      newClipSequence: string[];
    }) => {
      const response = await apiRequest(
        "POST",
        `/api/projects/${projectId}/videos/${videoId}/refit`,
        { clipSequence: newClipSequence }
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "videos"] });
      toast({
        title: "Video Refitted",
        description: "AI automatically adjusted the video to maintain target duration",
      });
    },
  });

  const handleDragStart = (
    e: React.DragEvent,
    sliceId: string,
    sourceVideoId?: string,
    sourceIndex?: number
  ) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", sliceId); // Required for Firefox
    setDragData({ sliceId, sourceVideoId, sourceIndex });
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setDragData(null);
    // Delay clearing isDragging to prevent click from firing
    setTimeout(() => setIsDragging(false), 100);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (targetVideoId: string, targetIndex: number) => {
    if (!dragData) return;

    // Find target video across all types (including arrays)
    const allVideos = [videos.short, videos.standard, videos.comprehensive, ...(videos.multipleClips || [])].filter(v => v !== null);
    const targetVideo = allVideos.find((v) => v?.id === targetVideoId);
    if (!targetVideo || Array.isArray(targetVideo)) return;

    let newSequence = [...(targetVideo.clipSequence as string[])];

    // If moving from another video, remove from source
    if (dragData.sourceVideoId && dragData.sourceIndex !== undefined) {
      const sourceVideo = allVideos.find(
        (v) => v && !Array.isArray(v) && v.id === dragData.sourceVideoId
      );
      if (sourceVideo && !Array.isArray(sourceVideo)) {
        const sourceSequence = [...(sourceVideo.clipSequence as string[])];
        sourceSequence.splice(dragData.sourceIndex, 1);

        // Update source video
        await refitMutation.mutateAsync({
          videoId: dragData.sourceVideoId,
          newClipSequence: sourceSequence,
        });
      }
    }

    // Add to target video at the specified index
    newSequence.splice(targetIndex, 0, dragData.sliceId);

    // Trigger AI refit for target video
    await refitMutation.mutateAsync({
      videoId: targetVideoId,
      newClipSequence: newSequence,
    });

    setDragData(null);
    toast({
      title: "Clip Moved",
      description: "AI is automatically refitting the video to maintain target duration...",
    });
  };

  const getSliceById = (id: string) => slices.find((s) => s.id === id);

  const getUnusedSlices = () => {
    const usedIds = new Set<string>();
    const allVideos = [videos.short, videos.standard, videos.comprehensive, ...(videos.multipleClips || [])];
    allVideos.forEach((video) => {
      if (video && !Array.isArray(video) && video.clipSequence) {
        (video.clipSequence as string[]).forEach((id) => usedIds.add(id));
      }
    });
    return slices.filter((s) => !usedIds.has(s.id));
  };

  const unusedSlices = getUnusedSlices();

  // Check if we're in multiple clips mode
  const hasMultipleClips = videos.multipleClips && videos.multipleClips?.length > 0;
  const traditionalVideos = [videos.short, videos.standard, videos.comprehensive].filter(v => v !== null);

  if (hasMultipleClips) {
    // For multiple clips intent, show a simpler timeline view
    return (
      <div className="space-y-8" data-testid="clip-picker">
        <div className="text-center space-y-2 pb-4 border-b">
          <h3 className="text-lg font-semibold">Smart Slices Timeline</h3>
          <p className="text-sm text-muted-foreground">
            AI analyzed your video and created {videos.multipleClips?.length || 0} optimized clips
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold">All Clips</h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {slices.map((slice) => (
              <ClipCard
                key={slice.id}
                slice={slice}
                onDragStart={(e) => handleDragStart(e, slice.id)}
                onDragEnd={handleDragEnd}
                isDragging={dragData?.sliceId === slice.id}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Function to handle previewing a clip
  const handlePreviewClip = (clip: SmartSlice) => {
    setPreviewSlice(clip);
  };

  // Function to handle removing a clip from a video
  const handleRemoveClip = (videoType: string, clipId: string) => {
    const video = videos[videoType as keyof typeof videos];
    if (!video) return;

    const updatedSequence = video.clipSequence.filter(id => id !== clipId);

    // Invalidate video queries to refetch the updated list
    queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "videos"] });

    setVideos(prev => ({
      ...prev,
      [videoType]: {
        ...video,
        clipSequence: updatedSequence
      }
    }));
  };

  // Function to handle updating per-clip transition
  const handleUpdateClipTransition = (videoType: string, clipId: string, transition: string) => {
    // Store per-clip transition preference (will be used during regeneration)
    setVideos(prev => {
      const video = prev[videoType as keyof typeof prev];
      if (!video) return prev;

      return {
        ...prev,
        [videoType]: {
          ...video,
          clipTransitions: {
            ...video.clipTransitions,
            [clipId]: transition
          }
        }
      };
    });
  };

  return (
    <div className="space-y-8" data-testid="clip-picker">
      {/* Instructional Header */}
      <div className="text-center space-y-2 pb-4 border-b">
        <h3 className="text-lg font-semibold">Customize Your Videos</h3>
        <p className="text-sm text-muted-foreground">
          Not satisfied with the AI's choices? Drag clips between videos or from the pool below. The AI will automatically adjust durations to keep your videos on target.
        </p>
      </div>

      {/* Available Clips Pool */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Available Clips</h3>
          <Badge variant="secondary" data-testid="badge-unused-count">
            {unusedSlices.length} unused
          </Badge>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2">
          {unusedSlices.map((slice) => (
            <ClipCard
              key={slice.id}
              slice={slice}
              onDragStart={(e) => handleDragStart(e, slice.id)}
              onDragEnd={handleDragEnd}
              isDragging={dragData?.sliceId === slice.id}
              showRemove={false}
              onClick={() => !isDragging && setPreviewSlice(slice)}
            />
          ))}
          {unusedSlices.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">
              All clips are being used in your videos
            </p>
          )}
        </div>
      </div>

      {/* Video Timelines */}
      <div className="space-y-6">
        {(["short", "standard", "comprehensive"] as const).map((type) => {
          const video = videos[type];
          if (!video) return null;

          const clipSequence = (video.clipSequence as string[]) || [];
          const targetDuration = video.duration;
          const actualDuration = clipSequence.reduce((sum, id) => {
            const slice = getSliceById(id);
            return sum + (slice ? slice.endTime - slice.startTime : 0);
          }, 0);

          return (
            <Card key={type} className="p-6 space-y-4" data-testid={`timeline-${type}`}>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold capitalize">{type} Video</h3>
                    <Badge variant="outline" data-testid={`badge-clip-count-${type}`}>
                      {clipSequence.length} clips
                    </Badge>
                    {video.status === "pending" && (
                      <Badge variant="secondary" className="gap-1">
                        <RefreshCw className="h-3 w-3 animate-spin" />
                        Regenerating
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      Target: {targetDuration}s
                    </span>
                    <span
                      className={
                        actualDuration === targetDuration
                          ? "text-green-600 dark:text-green-400"
                          : "text-orange-600 dark:text-orange-400"
                      }
                    >
                      Actual: {actualDuration}s
                    </span>
                  </div>
                </div>
                {refitMutation.isPending && (
                  <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Drag clips to rearrange or remove. AI will automatically adjust duration.
                </p>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {/* Drop zones before each clip */}
                  {clipSequence.map((sliceId, index) => {
                  const slice = getSliceById(sliceId);
                  if (!slice) return null;

                  return (
                    <div key={sliceId} className="flex gap-3">
                      <DropZone
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(video.id, index)}
                        isActive={dragData !== null}
                      />
                      <ClipCard
                        slice={slice}
                        onDragStart={(e) => handleDragStart(e, sliceId, video.id, index)}
                        onDragEnd={handleDragEnd}
                        isDragging={dragData?.sliceId === sliceId}
                        showRemove
                        onClick={() => !isDragging && setPreviewSlice(slice)}
                      />
                    </div>
                  );
                })}
                  {/* Final drop zone */}
                  <DropZone
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(video.id, clipSequence.length)}
                    isActive={dragData !== null}
                  />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Clip Preview Modal */}
      <Dialog open={!!previewSlice} onOpenChange={(open) => !open && setPreviewSlice(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Clip Preview</DialogTitle>
          </DialogHeader>
          {previewSlice && (
            <div className="space-y-4">
              {(() => {
                const publicPath = getPublicVideoPath(sourceVideoPath);
                if (!publicPath) {
                  return (
                    <div className="p-4 bg-muted rounded-lg text-center">
                      <p className="text-sm text-muted-foreground">
                        Video preview not available - source video not accessible
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Path: {sourceVideoPath || "Not set"}
                      </p>
                    </div>
                  );
                }
                return (
                  <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
                    <video
                      src={`${publicPath}#t=${previewSlice.startTime},${previewSlice.endTime}`}
                      controls
                      autoPlay
                      playsInline
                      className="w-full h-full object-contain"
                      data-testid="video-preview-player"
                      key={previewSlice.id}
                      onError={(e) => {
                        console.error("Video preview failed to load:", publicPath);
                        const target = e.currentTarget;
                        target.style.display = "none";
                        const errorDiv = document.createElement("div");
                        errorDiv.className = "absolute inset-0 flex items-center justify-center text-center p-4";
                        errorDiv.innerHTML = `
                          <div>
                            <p class="text-muted-foreground text-sm">Unable to load video preview</p>
                            <p class="text-muted-foreground/60 text-xs mt-1">The source video may still be processing</p>
                          </div>
                        `;
                        target.parentElement?.appendChild(errorDiv);
                      }}
                    />
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Duration:</span>{" "}
                  <span className="font-medium">{(previewSlice.endTime - previewSlice.startTime).toFixed(1)}s</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Engagement:</span>{" "}
                  <Badge variant={
                    (previewSlice.engagementScore ?? 0) >= 90 ? "default" :
                    (previewSlice.engagementScore ?? 0) >= 75 ? "secondary" : "outline"
                  }>
                    {previewSlice.engagementScore}%
                  </Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Time Range:</span>{" "}
                  <span className="font-medium">{previewSlice.startTime.toFixed(1)}s - {previewSlice.endTime.toFixed(1)}s</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Type:</span>{" "}
                  <Badge variant="outline">{previewSlice.clipType}</Badge>
                </div>
              </div>
              {previewSlice.transcription && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm">{previewSlice.transcription}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface ClipCardProps {
  slice: SmartSlice;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  isDragging: boolean;
  showRemove?: boolean;
  onClick?: () => void;
}

function ClipCard({ slice, onDragStart, isDragging, showRemove, onDragEnd, onClick }: ClipCardProps) {
  const duration = slice.endTime - slice.startTime;

  const handleClick = (e: React.MouseEvent) => {
    // Only trigger onClick if not dragging
    if (onClick) {
      e.stopPropagation();
      onClick();
    }
  };

  return (
    <div
      draggable={true}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={handleClick}
      className={`flex-shrink-0 w-32 ${onClick ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'} transition-all ${
        isDragging ? "opacity-30 scale-95" : "hover:scale-105"
      }`}
      data-testid={`clip-card-${slice.id}`}
    >
      <Card className="overflow-hidden hover-elevate relative">
        {onClick && (
          <div className="absolute top-1 left-1 bg-black/80 text-white rounded-full p-1 z-10">
            <Play className="h-3 w-3" />
          </div>
        )}
        <div className="relative aspect-video bg-black">
          {slice.thumbnailPath ? (
            <img
              src={slice.thumbnailPath}
              alt={`Clip`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/50">
              <GripVertical className="h-6 w-6" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded font-mono">
            {duration}s
          </div>
        </div>

        <div className="p-2 space-y-1">
          <p className="text-xs font-medium line-clamp-1">
            {slice.transcription || `Clip`}
          </p>
          <div className="flex items-center justify-between mt-1 text-xs">
              <span className="text-muted-foreground">
                {slice.startTime.toFixed(1)}s - {slice.endTime.toFixed(1)}s
              </span>
              <div className="flex items-center gap-1">
                {slice.clipType && (
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    slice.clipType === 'hook' ? 'bg-chart-1/20 text-chart-1' :
                    slice.clipType === 'talking_head' ? 'bg-chart-2/20 text-chart-2' :
                    slice.clipType === 'broll' ? 'bg-chart-3/20 text-chart-3' :
                    slice.clipType === 'action' ? 'bg-chart-4/20 text-chart-4' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {slice.clipType}
                  </span>
                )}
                {slice.engagementScore !== null && (
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    slice.engagementScore >= 90 ? 'bg-green-500/20 text-green-700' :
                    slice.engagementScore >= 75 ? 'bg-blue-500/20 text-blue-700' :
                    slice.engagementScore >= 60 ? 'bg-yellow-500/20 text-yellow-700' :
                    'bg-gray-500/20 text-gray-700'
                  }`}>
                    {slice.engagementScore}
                  </span>
                )}
              </div>
            </div>
        </div>
      </Card>
    </div>
  );
}

interface DropZoneProps {
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  isActive: boolean;
}

function DropZone({ onDragOver, onDrop, isActive }: DropZoneProps) {
  const [isOver, setIsOver] = useState(false);

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        setIsOver(true);
      }}
      onDragOver={(e) => {
        onDragOver(e);
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
        setIsOver(false);
      }}
      className={`flex-shrink-0 transition-all rounded-md ${
        isOver
          ? "w-24 bg-primary/20 border-2 border-dashed border-primary"
          : isActive
            ? "w-8 bg-muted/50 border border-dashed border-muted-foreground/30"
            : "w-2 bg-muted/20"
      }`}
      data-testid="drop-zone"
    >
      {isOver && (
        <div className="h-full flex items-center justify-center">
          <Plus className="h-6 w-6 text-primary" />
        </div>
      )}
      {!isOver && isActive && (
        <div className="h-full flex items-center justify-center">
          <div className="h-8 w-1 bg-muted-foreground/30 rounded-full" />
        </div>
      )}
    </div>
  );
}