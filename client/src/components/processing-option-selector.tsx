import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle,
  Info,
  Zap,
  FileVideo,
  Minimize2,
  RefreshCw,
  Check,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProcessingOptionSelectorProps {
  file: File;
  onSelect: (choice: {
    operation: 'original' | 'compress' | 'convert' | 'both';
    quality?: 'low' | 'medium' | 'high';
    targetFormat?: string;
  }) => void;
  onCancel: () => void;
}

export function ProcessingOptionSelector({ file, onSelect, onCancel }: ProcessingOptionSelectorProps) {
  const [selectedOperation, setSelectedOperation] = useState<'original' | 'compress' | 'convert' | 'both' | null>(null);
  const [quality, setQuality] = useState<'low' | 'medium' | 'high'>('medium');
  const [targetFormat, setTargetFormat] = useState<string>('mp4');

  const fileSizeMB = file.size / (1024 * 1024);
  const fileSizeGB = fileSizeMB / 1024;
  const fileFormat = file.name.split('.').pop()?.toLowerCase();
  const isLarge = fileSizeMB > 100;
  const isNonOptimal = fileFormat && !['mp4', 'webm'].includes(fileFormat);

  // Estimate processing time cost (simplified)
  const timeCostMinutes = Math.ceil(fileSizeGB * 15); // ~15 min per GB for compression

  // Estimate upload time (assuming 5MB/s average upload speed)
  const uploadTime = Math.ceil((file.size / (1024 * 1024)) / (5 * 60)); // minutes

  // Mock credit calculations (these should come from API in production)
  const calculateCredits = (operation: string, quality: string = 'medium') => {
    let minutes = 0;

    if (operation === 'compress' || operation === 'both') {
      const baseCost = fileSizeGB * 15; // 15 minutes per GB
      const multipliers = { low: 0.5, medium: 1.0, high: 1.5 };
      minutes += baseCost * multipliers[quality as keyof typeof multipliers];
    }

    if (operation === 'convert' || operation === 'both') {
      // Assume 5 minutes of video duration for estimation
      minutes += 5 * 0.5; // 0.5 minutes per minute of video
    }

    if (operation === 'both') {
      minutes *= 1.3; // 30% penalty for combined operations
    }

    return Math.ceil(minutes);
  };

  const formatCreditCost = (minutes: number) => {
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const mins = minutes % 60;

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (mins > 0) parts.push(`${mins}m`);

    return parts.join(' ') || '0m';
  };

  const handleConfirm = () => {
    if (!selectedOperation) return;

    onSelect({
      operation: selectedOperation,
      quality: selectedOperation === 'compress' || selectedOperation === 'both' ? quality : undefined,
      targetFormat: selectedOperation === 'convert' || selectedOperation === 'both' ? targetFormat : undefined,
    });
  };

  return (
    <Card className="p-6 space-y-4 border-2 border-blue-200 bg-blue-50/50">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 text-base">
              Optimize Your Upload
            </h3>
            <div className="space-y-1 text-sm">
              <p className="text-blue-800 dark:text-blue-200">
                <strong className="font-medium">File size:</strong> {fileSizeMB.toFixed(0)}MB ({fileFormat?.toUpperCase()})
              </p>
              <p className="text-blue-700 dark:text-blue-300">
                {isLarge && isNonOptimal
                  ? "Large file + non-optimal format detected. We recommend compression + conversion for fastest uploads."
                  : isLarge
                  ? "Large file detected. Compression can reduce upload time by 60-80%."
                  : "File format could be optimized for faster processing."}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        {/* Upload Original */}
        <div
          onClick={() => setSelectedOperation('original')}
          className={`p-4 rounded-lg border-2 text-left transition-all cursor-pointer ${
            selectedOperation === 'original'
              ? 'border-gray-500 bg-gray-100/50 shadow-sm'
              : 'border-gray-200 hover:border-gray-300 bg-white hover:shadow-sm'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                <FileVideo className="w-4 h-4 text-gray-600" />
              </div>
              <div className="flex-1">
                <div className="font-semibold flex items-center gap-2 mb-1">
                  Upload Original
                  {selectedOperation === 'original' && (
                    <Check className="w-4 h-4 text-gray-600" />
                  )}
                  <Badge variant="secondary" className="text-xs">Free</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  No optimization • Fastest to start • Longer upload time
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Compress Only */}
        {isLarge && (
          <div
            onClick={() => setSelectedOperation('compress')}
            className={`p-4 rounded-lg border-2 text-left transition-all cursor-pointer ${
              selectedOperation === 'compress'
                ? 'border-orange-500 bg-orange-100/50 shadow-sm'
                : 'border-gray-200 hover:border-gray-300 bg-white hover:shadow-sm'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1">
                <div className="w-8 h-8 rounded bg-orange-100 flex items-center justify-center flex-shrink-0">
                  <Minimize2 className="w-4 h-4 text-orange-600" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold flex items-center gap-2 mb-1">
                    Compress Video
                    {selectedOperation === 'compress' && (
                      <Check className="w-4 h-4 text-orange-600" />
                    )}
                    <Badge className="bg-orange-600 text-white text-xs">~{timeCostMinutes}min credit</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">
                    60-80% smaller • {Math.round((1 - (fileSizeGB * 0.3) / fileSizeGB) * 100)}% faster upload
                  </p>
                  <p className="text-xs text-orange-700 dark:text-orange-400">
                    ⚡ Saves ~{(uploadTime * 0.7).toFixed(0)} minutes of upload time
                  </p>
                  {selectedOperation === 'compress' && (
                    <div className="mt-2 flex gap-2" onClick={(e) => e.stopPropagation()}>
                      {(['low', 'medium', 'high'] as const).map((q) => (
                        <button
                          key={q}
                          onClick={(e) => {
                            e.stopPropagation();
                            setQuality(q);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.stopPropagation();
                              e.preventDefault();
                              setQuality(q);
                            }
                          }}
                          className={`px-3 py-1 text-xs rounded capitalize ${
                            quality === q
                              ? 'bg-orange-600 text-white'
                              : 'bg-orange-200 text-orange-900 hover:bg-orange-300'
                          }`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <Badge className="bg-orange-600 text-white flex items-center gap-1">
                <Zap className="w-3 h-3" />
                {formatCreditCost(calculateCredits('compress', quality))}
              </Badge>
            </div>
          </div>
        )}

        {/* Convert Format */}
        {isNonOptimal && (
          <div
            onClick={() => setSelectedOperation('convert')}
            className={`p-4 rounded-lg border-2 text-left transition-all cursor-pointer ${
              selectedOperation === 'convert'
                ? 'border-purple-500 bg-purple-100/50 shadow-sm'
                : 'border-gray-200 hover:border-gray-300 bg-white hover:shadow-sm'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1">
                <div className="w-8 h-8 rounded bg-purple-100 flex items-center justify-center flex-shrink-0">
                  <RefreshCw className="w-4 h-4 text-purple-600" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold flex items-center gap-2 mb-1">
                    Convert to MP4
                    {selectedOperation === 'convert' && (
                      <Check className="w-4 h-4 text-purple-600" />
                    )}
                    <Badge className="bg-purple-600 text-white text-xs">~{timeCostMinutes}min credit</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Optimize for web playback & compatibility
                  </p>
                </div>
              </div>
              <Badge className="bg-purple-600 text-white flex items-center gap-1">
                <Zap className="w-3 h-3" />
                {formatCreditCost(calculateCredits('convert'))}
              </Badge>
            </div>
          </div>
        )}

        {/* Both - Compress + Convert */}
        {isLarge && isNonOptimal && (
          <div
            onClick={() => setSelectedOperation('both')}
            className={`p-4 rounded-lg border-2 text-left transition-all cursor-pointer ${
              selectedOperation === 'both'
                ? 'border-indigo-500 bg-indigo-100/50 shadow-sm'
                : 'border-gray-200 hover:border-gray-300 bg-white hover:shadow-sm'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1">
                <div className="flex gap-1">
                  <div className="w-8 h-8 rounded bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <Minimize2 className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="w-8 h-8 rounded bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <RefreshCw className="w-4 h-4 text-indigo-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="font-semibold flex items-center gap-2 mb-1">
                    Compress + Convert
                    {selectedOperation === 'both' && (
                      <Check className="w-4 h-4 text-indigo-600" />
                    )}
                    <Badge variant="secondary" className="text-xs">Best Value</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Maximum optimization (recommended)
                  </p>
                  {selectedOperation === 'both' && (
                    <div className="mt-2 flex gap-2" onClick={(e) => e.stopPropagation()}>
                      {(['low', 'medium', 'high'] as const).map((q) => (
                        <button
                          key={q}
                          onClick={(e) => {
                            e.stopPropagation();
                            setQuality(q);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.stopPropagation();
                              e.preventDefault();
                              setQuality(q);
                            }
                          }}
                          className={`px-3 py-1 text-xs rounded capitalize ${
                            quality === q
                              ? 'bg-indigo-600 text-white'
                              : 'bg-indigo-200 text-indigo-900 hover:bg-indigo-300'
                          }`}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <Badge className="bg-indigo-600 text-white flex items-center gap-1">
                <Zap className="w-3 h-3" />
                {formatCreditCost(calculateCredits('both', quality))}
              </Badge>
            </div>
          </div>
        )}
      </div>

      {selectedOperation && selectedOperation !== 'original' && (
        <Alert className="border-blue-200 bg-blue-50">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-900 text-sm">
            This will consume <strong>{formatCreditCost(calculateCredits(selectedOperation, quality))}</strong> from
            your subscription period. Your renewal date will move earlier by this amount.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-3 pt-2">
        <Button
          variant="outline"
          onClick={onCancel}
          className="flex-1"
        >
          Upload Original (Free)
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={!selectedOperation}
          className="flex-1"
        >
          {selectedOperation === 'original' ? 'Continue' : 'Accept & Continue'}
        </Button>
      </div>
    </Card>
  );
}