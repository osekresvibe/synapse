import { Progress } from "@/components/ui/progress";
import { VideoAnalysisProgress } from "@shared/schema";
import { Download, Sparkles, Scissors, Video, Brain, Zap, TrendingUp, AlertCircle, Clock, Loader2, CheckCircle, Clapperboard } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ProgressIndicatorProps {
  progress: VideoAnalysisProgress;
}

const stageIcons: Record<string, typeof Clock> = {
  pending: Clock,
  downloading: Download,
  analyzing: Sparkles,
  slicing: Scissors,
  generating: Video,
  complete: Video,
  error: AlertCircle,
  loading: Sparkles,
  audio: Sparkles,
  engagement: TrendingUp,
  grading: Zap,
};

export function ProgressIndicator({ progress }: ProgressIndicatorProps) {
  const startTime = React.useRef(Date.now());
  const [elapsedTime, setElapsedTime] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime((Date.now() - startTime.current) / 1000);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const getStageInfo = (stage: VideoAnalysisProgress['stage']) => {
    switch (stage) {
      case 'analyzing':
        return {
          icon: Brain,
          label: 'AI Analysis',
          color: 'text-blue-500',
          gradient: 'from-blue-500/20 via-purple-500/20 to-pink-500/20',
        };
      case 'generating':
        return {
          icon: Clapperboard,
          label: 'Generating',
          color: 'text-purple-500',
          gradient: 'from-purple-500/20 via-pink-500/20 to-orange-500/20',
        };
      case 'complete':
        return {
          icon: CheckCircle,
          label: 'Complete',
          color: 'text-green-500',
          gradient: 'from-green-500/20 to-emerald-500/20',
        };
      case 'error':
        return {
          icon: AlertCircle,
          label: 'Error',
          color: 'text-red-500',
          gradient: 'from-red-500/20 to-orange-500/20',
        };
      default:
        return {
          icon: Loader2,
          label: 'Processing',
          color: 'text-gray-500',
          gradient: 'from-gray-500/20 to-slate-500/20',
        };
    }
  };

  const stageInfo = getStageInfo(progress.stage);
  const Icon = stageInfo.icon;

  // Clamp progress to 100% to fix stuck-at-80 issue
  const displayProgress = Math.min(progress.progress, 100);
  const isActive = progress.stage !== 'complete' && progress.stage !== 'error';

  return (
    <Card className={`p-8 max-w-4xl mx-auto relative overflow-hidden ${isActive ? 'animate-pulse-slow' : ''}`}>
      {/* Animated gradient background */}
      {isActive && (
        <div className={`absolute inset-0 bg-gradient-to-br ${stageInfo.gradient} animate-gradient-shift opacity-50`} />
      )}

      <div className="space-y-6 relative z-10">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4 ${isActive ? 'animate-pulse-ring' : ''}`}>
            <Icon className={`h-10 w-10 ${stageInfo.color} ${isActive ? 'animate-spin-slow' : ''}`} />
          </div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            AI is Crafting Your Video
          </h2>
          <p className="text-muted-foreground animate-fade-in">Sit back and relax - this usually takes 30-60 seconds</p>
        </div>

        {/* Main Progress */}
        <div className="flex items-center gap-4">
          <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${isActive ? `bg-primary/20 ${stageInfo.color}` : 'bg-muted'}`}>
            <Icon className={`h-6 w-6 ${isActive ? 'text-primary animate-pulse' : 'text-muted-foreground'}`} />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">{progress.message}</h3>
              <span className="text-sm font-mono text-muted-foreground">
                {displayProgress}%
              </span>
            </div>
            <div className="relative">
              <Progress value={displayProgress} className="h-2" />
              {isActive && (
                <div className="absolute inset-0 h-2 rounded-full overflow-hidden">
                  <div className="h-full w-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* AI Reasoning Card */}
        {progress.stage !== "complete" && (
          <Card className="p-4 bg-primary/5 border-primary/20">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Brain className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-primary/10 border-primary/30">
                    AI Thinking
                  </Badge>
                  <p className="text-sm font-medium">AI is analyzing your video to find the best moments.</p>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  We're looking for high-energy segments, clear dialogue, and viewer engagement potential.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Fun Fact */}
        {progress.stage !== "complete" && (
          <Card className="p-4 bg-secondary/10 border-secondary/30">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-secondary" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                AI analyzes thousands of data points per second to find your best moments.
              </p>
            </div>
          </Card>
        )}

        {/* Success State with Video Links */}
        {progress.stage === "complete" && displayProgress === 100 && (
          <Card className="p-6 bg-primary/5 border-primary/20">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Video className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="text-lg font-medium">Videos Generated Successfully! 🎉</p>
                <p className="text-sm text-muted-foreground mt-1">Scroll down to view and download your videos</p>
              </div>
              <Button
                variant="outline"
                onClick={() => window.open('/uploads/videos', '_blank')}
                className="gap-2"
              >
                📁 Open Videos Folder
              </Button>
            </div>
          </Card>
        )}

        {/* Error State */}
        {progress.stage === "complete" && displayProgress === 0 && (
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <p className="text-lg font-medium text-destructive">Processing Failed</p>
            <p className="text-sm text-muted-foreground">{progress.message}</p>
            <p className="text-xs text-muted-foreground mt-2">Try uploading a different video or check the file format</p>
          </div>
        )}

        <div className="grid grid-cols-4 gap-4 text-center">
          {(["downloading", "analyzing", "slicing", "generating"] as const).map((stage, index) => {
            const StageIcon = stageIcons[stage];
            const isActiveStage = progress.stage === stage;
            const isPastStage = ["downloading", "analyzing", "slicing", "generating"].indexOf(progress.stage) > index;
            const isCompleteStage = ["downloading", "analyzing", "slicing", "generating"].indexOf(progress.stage) === index && displayProgress === 100;

            return (
              <div
                key={stage}
                className={`space-y-2 ${
                  isActiveStage
                    ? "text-foreground"
                    : isPastStage || isCompleteStage
                    ? "text-muted-foreground"
                    : "text-muted-foreground/50"
                }`}
              >
                <div
                  className={`mx-auto w-10 h-10 rounded-full flex items-center justify-center ${
                    isActiveStage || isCompleteStage
                      ? "bg-primary text-primary-foreground"
                      : isPastStage
                      ? "bg-primary/20 text-primary"
                      : "bg-muted"
                  }`}
                >
                  <StageIcon className="h-5 w-5" />
                </div>
                <p className="text-xs capitalize">{stage}</p>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}