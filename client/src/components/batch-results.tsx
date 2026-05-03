import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Loader2, AlertCircle, Video, Download } from "lucide-react";
import type { Project } from "@shared/schema";

interface BatchResultsProps {
  batchId: string;
  projects: Project[];
  onProjectSelect: (project: Project) => void;
}

interface BatchProgress {
  batchId: string;
  projectCount: number;
  overallProgress: number;
  projects: Array<{
    projectId: string;
    name: string;
    batchIndex: number;
    status: string;
    progress: {
      stage: string;
      progress: number;
      message: string;
    };
  }>;
}

export function BatchResults({ batchId, projects, onProjectSelect }: BatchResultsProps) {
  const { data: batchProgress } = useQuery<BatchProgress>({
    queryKey: ["/api/projects/batch", batchId, "progress"],
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 1000;
      return data.overallProgress >= 100 ? false : 1000;
    },
  });

  const completedCount = batchProgress?.projects.filter(p => p.status === "ready").length || 0;
  const totalCount = projects.length;
  const allComplete = completedCount === totalCount;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Batch Processing</h2>
          <p className="text-muted-foreground">
            {completedCount} of {totalCount} videos complete
          </p>
        </div>
        {allComplete && (
          <Badge variant="default" className="gap-2">
            <CheckCircle2 className="w-4 h-4" />
            All Complete
          </Badge>
        )}
      </div>

      {batchProgress && batchProgress.overallProgress < 100 && (
        <Card className="p-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Overall Progress</span>
              <span className="text-muted-foreground">{batchProgress.overallProgress}%</span>
            </div>
            <Progress value={batchProgress.overallProgress} className="h-2" />
          </div>
        </Card>
      )}

      <div className="grid gap-4">
        {batchProgress?.projects
          .sort((a, b) => a.batchIndex - b.batchIndex)
          .map((projectProgress, index) => {
            const project = projects.find(p => p.id === projectProgress.projectId);
            if (!project) return null;

            const isComplete = projectProgress.status === "ready";
            const isProcessing = !isComplete && projectProgress.progress.progress > 0;
            const isPending = !isComplete && !isProcessing;

            return (
              <Card
                key={project.id}
                className={`overflow-hidden transition-all cursor-pointer hover-elevate ${
                  // This part is added to make the card clickable for playing videos
                  // and to potentially highlight the selected video.
                  // In a real scenario, you'd manage selectedClipIndex and onVideoSelect state here or pass them down.
                  // For this example, we'll assume these are available for demonstration.
                  // For now, let's simulate based on 'isComplete' if no other selection mechanism is provided.
                  isComplete ? "" : "pointer-events-none opacity-70" // Disable if not complete
                }`}
                onClick={() => {
                  if (isComplete) {
                    onProjectSelect(project); // Assuming onProjectSelect also handles playing the video or navigating to it
                  }
                }}
                data-testid={`card-project-${project.id}`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-16 h-16 bg-muted rounded flex items-center justify-center">
                    {isComplete ? (
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                    ) : isProcessing ? (
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    ) : (
                      <Video className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold truncate" title={project.name}>
                          {project.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Video {index + 1} of {totalCount}
                        </p>
                      </div>
                      {isComplete && (
                        <Button
                          onClick={() => onProjectSelect(project)}
                          size="sm"
                          data-testid={`button-view-project-${project.id}`}
                        >
                          View Results
                        </Button>
                      )}
                    </div>

                    {isProcessing && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {projectProgress.progress.message}
                          </span>
                          <span className="font-medium">
                            {projectProgress.progress.progress}%
                          </span>
                        </div>
                        <Progress value={projectProgress.progress.progress} />
                      </div>
                    )}

                    {isPending && (
                      <p className="text-sm text-muted-foreground">
                        Waiting to start...
                      </p>
                    )}

                    {isComplete && (
                      <Badge variant="secondary" className="mt-2">
                        Ready
                      </Badge>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
      </div>
    </div>
  );
}