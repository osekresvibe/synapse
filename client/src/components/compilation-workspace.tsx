import { useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Film, Download, Play, GripVertical, Plus, X } from "lucide-react";
import type { Project, SmartSlice, GeneratedVideo } from "@shared/schema";

interface CompilationWorkspaceProps {
  projects: Project[];
  onExport: (compilationPath: string) => void;
}

interface ClipItem {
  id: string;
  projectId: string;
  sliceId: string;
  slice: SmartSlice;
  projectName: string;
  order: number;
}

export function CompilationWorkspace({ projects, onExport }: CompilationWorkspaceProps) {
  const { toast } = useToast();
  const [compilationClips, setCompilationClips] = useState<ClipItem[]>([]);
  const [draggedClip, setDraggedClip] = useState<ClipItem | null>(null);
  const [compiledVideo, setCompiledVideo] = useState<string | null>(null); // State to hold the compiled video URL

  // Fetch slices for all projects
  const projectSlices = projects.map(project => {
    const { data: slices = [] } = useQuery<SmartSlice[]>({
      queryKey: ["/api/projects", project.id, "slices"],
      enabled: !!project && project.status === "ready",
    });
    return { projectId: project.id, projectName: project.name, slices };
  });

  // Compile all clips into one video
  const compileVideoMutation = useMutation({
    mutationFn: async () => {
      const clipSequence = compilationClips.map(c => ({
        projectId: c.projectId,
        sliceId: c.sliceId,
      }));

      const response = await apiRequest("POST", "/api/projects/compile-multi-video", {
        clipSequence,
      });
      return response;
    },
    onSuccess: (data: GeneratedVideo) => {
      toast({
        title: "✅ Compilation Complete",
        description: "Your multi-video compilation is ready to download!",
      });
      setCompiledVideo(data.videoPath); // Set the compiled video URL
      onExport(data.videoPath); // Keep the original onExport call if needed elsewhere
    },
    onError: (error: any) => {
      toast({
        title: "❌ Compilation Failed",
        description: error.message || "An error occurred during compilation.",
        variant: "destructive",
      });
    }
  });

  const handleDragStart = (clip: ClipItem) => {
    setDraggedClip(clip);
  };

  const handleDragEnd = () => {
    setDraggedClip(null);
  };

  const handleDrop = (targetIndex: number) => {
    if (!draggedClip) return;

    // Check if clip is already in compilation
    const existingIndex = compilationClips.findIndex(c => c.id === draggedClip.id);

    if (existingIndex >= 0) {
      // Reorder existing clip
      const newClips = [...compilationClips];
      const [movedClip] = newClips.splice(existingIndex, 1);
      newClips.splice(targetIndex, 0, movedClip);
      setCompilationClips(newClips.map((c, i) => ({ ...c, order: i })));
    } else {
      // Add new clip to compilation
      const newClips = [...compilationClips];
      newClips.splice(targetIndex, 0, { ...draggedClip, order: targetIndex });
      setCompilationClips(newClips.map((c, i) => ({ ...c, order: i })));
    }

    setDraggedClip(null);
  };

  const removeClip = (clipId: string) => {
    setCompilationClips(prev => 
      prev.filter(c => c.id !== clipId).map((c, i) => ({ ...c, order: i }))
    );
    // If the removed clip was the one being compiled, clear the compiled video state
    if (compiledVideo && compilationClips.some(c => c.id === clipId)) {
        setCompiledVideo(null);
    }
  };

  const totalDuration = compilationClips.reduce((sum, c) => 
    sum + (c.slice.endTime - c.slice.startTime), 0
  );

  return (
    <div className="space-y-6">
      {/* Compiled Video Preview and Download */}
      {compiledVideo && (
        <Card className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border-green-200">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-green-500 flex items-center justify-center">
                <Film className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Compilation Ready! 🎉</h3>
                <p className="text-sm text-muted-foreground">
                  Your multi-video compilation is ready
                </p>
              </div>
            </div>

            {/* Video Preview (assuming VideoPlayer component exists and accepts src prop) */}
            <div className="rounded-lg overflow-hidden border">
               {/* Placeholder for VideoPlayer component - ensure it's correctly imported and implemented */}
               <p>Video Player would go here</p>
            </div>

            <div className="flex gap-2">
              <a
                href={compiledVideo}
                download="compilation.mp4"
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-green-600 text-white hover:bg-green-700 h-10 px-4 py-2"
              >
                <Download className="h-4 w-4" />
                Download Compilation
              </a>
              <Button
                variant="outline"
                onClick={() => window.open(compiledVideo, '_blank')}
                className="gap-2"
              >
                <Play className="h-4 w-4" />
                Open in New Tab
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <Film className="h-6 w-6 text-primary" />
              Multi-Video Compilation
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Drag clips from your videos to create a continuous compilation
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary">
              {compilationClips.length} clips • {totalDuration.toFixed(1)}s
            </Badge>
            <Button
              onClick={() => compileVideoMutation.mutate()}
              disabled={compilationClips.length === 0 || compileVideoMutation.isPending || !!compiledVideo}
              data-testid="button-export-compilation"
            >
              <Download className="mr-2 h-4 w-4" />
              {compileVideoMutation.isPending ? "Compiling..." : "Export Compilation"}
            </Button>
          </div>
        </div>

        {/* Compilation Timeline */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Compilation Timeline</h3>
          <div
            className="min-h-[120px] p-4 rounded-lg border-2 border-dashed border-primary/30 bg-muted/30"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(compilationClips.length)}
          >
            {compilationClips.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <Plus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Drag clips here to build your compilation</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {compilationClips.map((clip, index) => (
                  <div
                    key={clip.id}
                    className="relative group"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(index)}
                  >
                    <Card className="w-32 overflow-hidden hover:ring-2 hover:ring-primary transition-all">
                      <div className="relative aspect-video bg-black">
                        {clip.slice.thumbnailPath && (
                          <img
                            src={clip.slice.thumbnailPath}
                            alt={`Clip ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        )}
                        <div className="absolute top-1 left-1 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
                          #{index + 1}
                        </div>
                        <div className="absolute top-1 right-1">
                          <Button
                            variant="destructive"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removeClip(clip.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="p-2">
                        <p className="text-xs font-medium truncate">{clip.projectName}</p>
                        <p className="text-xs text-muted-foreground">
                          {(clip.slice.endTime - clip.slice.startTime).toFixed(1)}s
                        </p>
                      </div>
                    </Card>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Source Videos */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Source Videos ({projects.length})</h3>
        {projectSlices.map(({ projectId, projectName, slices }) => (
          <Card key={projectId} className="p-4">
            <div className="space-y-3">
              <h4 className="font-medium">{projectName}</h4>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {slices.map((slice, index) => (
                  <div
                    key={slice.id}
                    draggable
                    onDragStart={() => handleDragStart({
                      id: `${projectId}-${slice.id}`,
                      projectId,
                      sliceId: slice.id,
                      slice,
                      projectName,
                      order: compilationClips.length, // Initial order when adding
                    })}
                    onDragEnd={handleDragEnd}
                    className="flex-shrink-0 w-32 cursor-move hover:scale-105 transition-transform"
                  >
                    <Card className="overflow-hidden">
                      <div className="relative aspect-video bg-black">
                        {slice.thumbnailPath && (
                          <img
                            src={slice.thumbnailPath}
                            alt={`Clip ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        )}
                        <GripVertical className="absolute top-1 left-1 h-4 w-4 text-white/80" />
                      </div>
                      <div className="p-2">
                        <p className="text-xs line-clamp-1">{slice.transcription || `Clip ${index + 1}`}</p>
                        <p className="text-xs text-muted-foreground">
                          {(slice.endTime - slice.startTime).toFixed(1)}s
                        </p>
                      </div>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}