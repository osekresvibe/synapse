import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Loader2, Package } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useState } from "react";

interface ExportControlsProps {
  onExport: (type: "short" | "standard" | "comprehensive", format?: string, quality?: string) => void;
  onExportAll?: (format?: string, quality?: string) => void;
  isExporting: boolean;
}

export function ExportControls({ onExport, onExportAll, isExporting }: ExportControlsProps) {
  const [format, setFormat] = useState<string>("mp4");
  const [quality, setQuality] = useState<string>("high");

  return (
    <Card className="p-6 space-y-4">
      <div className="space-y-2">
        <h3 className="font-semibold">Export Options</h3>
        <p className="text-sm text-muted-foreground">
          Download your edited videos
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="format-select">Format</Label>
          <Select value={format} onValueChange={setFormat} disabled={isExporting}>
            <SelectTrigger id="format-select" data-testid="select-export-format">
              <SelectValue placeholder="Select format" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mp4">MP4 (H.264)</SelectItem>
              <SelectItem value="webm">WebM (VP9)</SelectItem>
              <SelectItem value="mov">MOV (ProRes)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="quality-select">Quality</Label>
          <Select value={quality} onValueChange={setQuality} disabled={isExporting}>
            <SelectTrigger id="quality-select" data-testid="select-export-quality">
              <SelectValue placeholder="Select quality" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high">High (1080p)</SelectItem>
              <SelectItem value="medium">Medium (720p)</SelectItem>
              <SelectItem value="low">Low (480p)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        {onExportAll && (
          <Button
            onClick={() => onExportAll(format, quality)}
            disabled={isExporting}
            className="w-full"
            size="lg"
            data-testid="button-export-all"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Package className="h-4 w-4 mr-2" />
            )}
            Export All Videos (ZIP)
          </Button>
        )}

        <Button
          onClick={() => onExport("short", format, quality)}
          disabled={isExporting}
          className="w-full"
          variant="outline"
          data-testid="button-export-short"
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Export Short
        </Button>

        <Button
          onClick={() => onExport("standard", format, quality)}
          disabled={isExporting}
          className="w-full"
          variant="outline"
          data-testid="button-export-standard"
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Export Standard
        </Button>

        <Button
          onClick={() => onExport("comprehensive", format, quality)}
          disabled={isExporting}
          className="w-full"
          variant="outline"
          data-testid="button-export-comprehensive"
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Export Comprehensive
        </Button>
      </div>
    </Card>
  );
}