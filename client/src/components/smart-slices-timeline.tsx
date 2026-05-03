import { Card } from "@/components/ui/card";
import { SmartSlice } from "@shared/schema";
import { GripVertical } from "lucide-react";

interface SmartSlicesTimelineProps {
  slices: SmartSlice[];
  onSliceClick?: (slice: SmartSlice) => void;
  selectedSliceId?: string;
}

export function SmartSlicesTimeline({
  slices,
  onSliceClick,
  selectedSliceId,
}: SmartSlicesTimelineProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Smart Slices</h3>
        <p className="text-sm text-muted-foreground">{slices.length} clips analyzed</p>
      </div>

      <div className="relative">
        <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory">
          {slices.map((slice, index) => {
            const duration = slice.endTime - slice.startTime;
            const isSelected = selectedSliceId === slice.id;

            return (
              <Card
                key={slice.id}
                className={`flex-shrink-0 w-32 cursor-move snap-start hover-elevate ${
                  isSelected ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => onSliceClick?.(slice)}
                data-testid={`clip-${slice.id}`}
              >
                <div className="relative aspect-video bg-black rounded-t-md overflow-hidden">
                  {slice.thumbnailPath ? (
                    <img
                      src={slice.thumbnailPath}
                      alt={`Clip ${index + 1}`}
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
                  <p className="text-xs font-medium line-clamp-2">
                    {slice.transcription || `Clip ${index + 1}`}
                  </p>
                  {slice.engagementScore !== null && (
                    <div className="flex items-center gap-1">
                      <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${slice.engagementScore}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {slice.engagementScore}
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
