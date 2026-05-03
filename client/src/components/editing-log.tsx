import { useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Wand2,
  Zap,
  Scissors,
  Sparkles,
  Volume2,
  Palette,
  Check,
  Loader2,
} from "lucide-react";

interface EditingLogEntry {
  timestamp: number;
  stage: string;
  message: string;
  icon: string;
  progress: number;
}

interface EditingLogProps {
  projectId: string;
  isActive: boolean;
  onComplete?: () => void;
}

// Map stage names to icons and colors
const stageConfig = {
  analyzing: {
    icon: Wand2,
    label: "Analyzing Video",
    color: "text-blue-400",
  },
  slicing: {
    icon: Scissors,
    label: "Intelligent Slicing",
    color: "text-purple-400",
  },
  engagement: {
    icon: Zap,
    label: "Scoring Engagement",
    color: "text-yellow-400",
  },
  transitions: {
    icon: Sparkles,
    label: "Applying Transitions",
    color: "text-cyan-400",
  },
  audio: {
    icon: Volume2,
    label: "Processing Audio",
    color: "text-green-400",
  },
  grading: {
    icon: Palette,
    label: "Color Grading",
    color: "text-pink-400",
  },
  finalizing: {
    icon: Check,
    label: "Finalizing Video",
    color: "text-emerald-400",
  },
};

export function EditingLog({
  projectId,
  isActive,
  onComplete,
}: EditingLogProps) {
  const logsRef = useRef<EditingLogEntry[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentProgressRef = useRef<number>(0);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!isActive || !projectId) return;

    logsRef.current = [];
    currentProgressRef.current = 0;

    // Connect to server-sent events for real-time updates
    const eventSource = new EventSource(
      `/api/projects/${projectId}/editing-progress`
    );
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("progress", (event) => {
      try {
        const data = JSON.parse(event.data);
        const entry: EditingLogEntry = {
          timestamp: Date.now(),
          stage: data.stage || "processing",
          message: data.message || "Processing...",
          icon: data.stage || "processing",
          progress: data.progress || 0,
        };

        logsRef.current.push(entry);
        currentProgressRef.current = data.progress || 0;

        // Auto-scroll to bottom
        if (containerRef.current) {
          setTimeout(() => {
            containerRef.current?.scrollTo({
              top: containerRef.current.scrollHeight,
              behavior: "smooth",
            });
          }, 0);
        }
      } catch (err) {
        console.error("[EditingLog] Parse error:", err);
      }
    });

    eventSource.addEventListener("complete", () => {
      console.log("[EditingLog] Editing complete");
      eventSource.close();
      eventSourceRef.current = null;
      onComplete?.();
    });

    eventSource.addEventListener("error", (event) => {
      console.error("[EditingLog] SSE error:", event);
      eventSource.close();
      eventSourceRef.current = null;
    });

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [isActive, projectId, onComplete]);

  if (!isActive) return null;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            AI Video Editing in Progress
          </h3>
          <span className="text-sm text-muted-foreground">
            {Math.round(currentProgressRef.current)}%
          </span>
        </div>
        <Progress
          value={currentProgressRef.current}
          className="h-2"
          data-testid="editing-progress-bar"
        />
      </div>

      <Card className="bg-slate-950 border-slate-700 overflow-hidden">
        {/* Log Display Area */}
        <div
          ref={containerRef}
          className="h-96 overflow-y-auto p-4 space-y-2 font-mono text-sm"
          data-testid="editing-log-container"
        >
          {logsRef.current.length === 0 ? (
            <div className="text-muted-foreground text-center py-8">
              Initializing AI editing engine...
            </div>
          ) : (
            logsRef.current.map((entry, idx) => {
              const config =
                stageConfig[entry.stage as keyof typeof stageConfig];
              const IconComponent = config?.icon || Loader2;

              return (
                <div key={idx} className="flex gap-3 text-xs">
                  <div className="text-muted-foreground flex-shrink-0">
                    {new Date(entry.timestamp).toLocaleTimeString("en-US", {
                      hour12: false,
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </div>
                  <IconComponent
                    className={`w-4 h-4 flex-shrink-0 ${config?.color || "text-slate-400"}`}
                  />
                  <div className="flex-1">
                    <span className="font-semibold">{config?.label}</span>
                    <span className="text-muted-foreground ml-2">
                      {entry.message}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      <div className="text-xs text-muted-foreground text-center">
        AI is processing your video • Do not close this window
      </div>
    </div>
  );
}
