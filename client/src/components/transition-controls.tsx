
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

interface TransitionControlsProps {
  enabled: boolean;
  type: string;
  duration: number;
  onEnabledChange: (enabled: boolean) => void;
  onTypeChange: (type: string) => void;
  onDurationChange: (duration: number) => void;
}

const transitionGroups = {
  "Basic Fades": ["fade", "fadeblack", "fadewhite", "dissolve"],
  "Wipes": ["wipeleft", "wiperight", "wipeup", "wipedown"],
  "Slides": ["slideleft", "slideright", "slideup", "slidedown"],
  "Smooth": ["smoothleft", "smoothright", "smoothup", "smoothdown"],
  "Creative": ["circlecrop", "circleopen", "circleclose"],
};

const transitionLabels: Record<string, string> = {
  fade: "Fade",
  fadeblack: "Fade to Black",
  fadewhite: "Fade to White",
  dissolve: "Dissolve",
  wipeleft: "Wipe Left",
  wiperight: "Wipe Right",
  wipeup: "Wipe Up",
  wipedown: "Wipe Down",
  slideleft: "Slide Left",
  slideright: "Slide Right",
  slideup: "Slide Up",
  slidedown: "Slide Down",
  circlecrop: "Circle Crop",
  circleopen: "Circle Open",
  circleclose: "Circle Close",
  smoothleft: "Smooth Left",
  smoothright: "Smooth Right",
  smoothup: "Smooth Up",
  smoothdown: "Smooth Down",
};

export function TransitionControls({
  enabled,
  type,
  duration,
  onEnabledChange,
  onTypeChange,
  onDurationChange,
}: TransitionControlsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Advanced Transitions
          <Badge variant="secondary" className="ml-auto">Phase 2</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between">
          <Label htmlFor="transitions-enabled" className="text-base">
            Apply Transitions Between Clips
          </Label>
          <Switch
            id="transitions-enabled"
            checked={enabled}
            onCheckedChange={onEnabledChange}
          />
        </div>

        {enabled && (
          <>
            {/* Transition Type Selector */}
            <div className="space-y-2">
              <Label htmlFor="transition-type">Transition Effect</Label>
              <Select value={type} onValueChange={onTypeChange}>
                <SelectTrigger id="transition-type">
                  <SelectValue placeholder="Select transition" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(transitionGroups).map(([group, transitions]) => (
                    <div key={group}>
                      <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                        {group}
                      </div>
                      {transitions.map((t) => (
                        <SelectItem key={t} value={t}>
                          {transitionLabels[t]}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Transition Duration Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="transition-duration">Transition Duration</Label>
                <span className="text-sm text-muted-foreground">{duration.toFixed(1)}s</span>
              </div>
              <Slider
                id="transition-duration"
                min={0.1}
                max={3}
                step={0.1}
                value={[duration]}
                onValueChange={(values) => onDurationChange(values[0])}
              />
              <p className="text-xs text-muted-foreground">
                Shorter transitions (0.3-0.5s) feel snappy. Longer ones (1-2s) are more dramatic.
              </p>
            </div>

            {/* Preview Info */}
            <div className="rounded-lg bg-muted/50 p-4 text-sm">
              <p className="font-medium mb-1">Current Selection:</p>
              <p className="text-muted-foreground">
                <strong>{transitionLabels[type]}</strong> transition for <strong>{duration.toFixed(1)}s</strong> between each clip
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
