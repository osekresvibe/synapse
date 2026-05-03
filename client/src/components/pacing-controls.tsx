
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Zap, Clock, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PacingControlsProps {
  currentTempo: number;
  onTempoChange: (tempo: number) => void;
}

export function PacingControls({ currentTempo, onTempoChange }: PacingControlsProps) {
  const getTempoLabel = (tempo: number) => {
    if (tempo < 800) return "Very Fast";
    if (tempo < 1200) return "Fast";
    if (tempo < 1800) return "Medium";
    if (tempo < 2500) return "Slow";
    return "Very Slow";
  };

  const getTempoColor = (tempo: number) => {
    if (tempo < 800) return "text-red-500";
    if (tempo < 1200) return "text-orange-500";
    if (tempo < 1800) return "text-yellow-500";
    if (tempo < 2500) return "text-green-500";
    return "text-blue-500";
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            <h3 className="font-semibold">Video Pacing</h3>
          </div>
          <Badge variant="secondary" className={getTempoColor(currentTempo)}>
            {getTempoLabel(currentTempo)}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Adjust the cut tempo (milliseconds per cut)
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label className="text-sm">Cut Tempo</Label>
            <span className="text-sm text-muted-foreground">{currentTempo}ms</span>
          </div>
          <Slider
            value={[currentTempo]}
            onValueChange={(value) => onTempoChange(value[0])}
            min={500}
            max={3000}
            step={100}
          />
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            <span>Fast: 500-1000ms</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>Medium: 1000-2000ms</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>Slow: 2000-3000ms</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
