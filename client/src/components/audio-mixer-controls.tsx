import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Music,
  Mic,
  Volume2,
  VolumeX,
  Plus,
  Trash2,
  Upload,
  Play,
  Pause,
  Loader2
} from "lucide-react";
import type { AudioTrack, AudioDuckingConfig } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AudioMixerControlsProps {
  tracks?: AudioTrack[];
  ducking?: AudioDuckingConfig;
  masterVolume?: number;
  onTracksChange: (tracks: AudioTrack[]) => void;
  onDuckingChange: (ducking: AudioDuckingConfig) => void;
  onMasterVolumeChange: (volume: number) => void;
}

export function AudioMixerControls({
  tracks = [],
  ducking = { enabled: false, threshold: -24, ratio: 50, attack: 0.1, release: 0.5 },
  masterVolume = 100,
  onTracksChange,
  onDuckingChange,
  onMasterVolumeChange,
}: AudioMixerControlsProps) {
  const { toast } = useToast();

  const uploadAudioMutation = useMutation({
    // ... mutation config ...
  });

  const [activeTrack, setActiveTrack] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingType, setUploadingType] = useState<"background" | "voiceover" | null>(null);

  const handleAddTrack = (type: "background" | "voiceover") => {
    setUploadingType(type);
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingType) return;

    const formData = new FormData();
    formData.append("audio", file);

    try {
      const response = await fetch("/api/upload-audio", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");

      const { url } = await response.json();

      const newTrack: AudioTrack = {
        id: crypto.randomUUID(),
        type: uploadingType,
        url,
        volume: 100,
        startTime: 0,
        fadeIn: 0.5,
        fadeOut: 0.5,
      };

      onTracksChange([...tracks, newTrack]);
    } catch (error) {
      console.error("Audio upload failed:", error);
    } finally {
      setUploadingType(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveTrack = (id: string) => {
    onTracksChange(tracks.filter((t) => t.id !== id));
  };

  const handleUpdateTrack = (id: string, updates: Partial<AudioTrack>) => {
    onTracksChange(
      tracks.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  };

  const backgroundTracks = tracks.filter((t) => t.type === "background");
  const voiceoverTracks = tracks.filter((t) => t.type === "voiceover");

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Master Volume */}
      <Card className="p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Master Volume</Label>
            <span className="text-sm text-muted-foreground">{masterVolume}%</span>
          </div>
          <Slider
            value={[masterVolume]}
            onValueChange={([value]) => onMasterVolumeChange(value)}
            max={100}
            step={1}
            className="w-full"
          />
        </div>
      </Card>

      <Tabs defaultValue="background" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="background" className="gap-2">
            <Music className="h-4 w-4" />
            Background ({backgroundTracks.length})
          </TabsTrigger>
          <TabsTrigger value="voiceover" className="gap-2">
            <Mic className="h-4 w-4" />
            Voiceover ({voiceoverTracks.length})
          </TabsTrigger>
          <TabsTrigger value="ducking" className="gap-2">
            <Volume2 className="h-4 w-4" />
            Ducking
          </TabsTrigger>
        </TabsList>

        {/* Background Music */}
        <TabsContent value="background" className="space-y-4">
          <Button
            onClick={() => handleAddTrack("background")}
            variant="outline"
            className="w-full"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Background Music
          </Button>

          {backgroundTracks.map((track) => (
            <Card key={track.id} className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">Background</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveTrack(track.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Volume ({track.volume}%)</Label>
                  <Slider
                    value={[track.volume]}
                    onValueChange={([value]) =>
                      handleUpdateTrack(track.id, { volume: value })
                    }
                    max={100}
                    step={1}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Fade In (s)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={track.fadeIn || 0}
                      onChange={(e) =>
                        handleUpdateTrack(track.id, {
                          fadeIn: parseFloat(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Fade Out (s)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={track.fadeOut || 0}
                      onChange={(e) =>
                        handleUpdateTrack(track.id, {
                          fadeOut: parseFloat(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>

        {/* Voiceover */}
        <TabsContent value="voiceover" className="space-y-4">
          <Button
            onClick={() => handleAddTrack("voiceover")}
            variant="outline"
            className="w-full"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Voiceover
          </Button>

          {voiceoverTracks.map((track) => (
            <Card key={track.id} className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">Voiceover</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveTrack(track.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Volume ({track.volume}%)</Label>
                  <Slider
                    value={[track.volume]}
                    onValueChange={([value]) =>
                      handleUpdateTrack(track.id, { volume: value })
                    }
                    max={100}
                    step={1}
                  />
                </div>
              </div>
            </Card>
          ))}
        </TabsContent>

        {/* Audio Ducking */}
        <TabsContent value="ducking" className="space-y-4">
          <Card className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label>Auto-Ducking</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically lower background music during voiceover
                </p>
              </div>
              <Switch
                checked={!!ducking.enabled}
                onCheckedChange={(enabled) =>
                  onDuckingChange({ ...ducking, enabled })
                }
              />
            </div>

            {(ducking?.enabled || false) && (
              <div className="space-y-3 p-3 rounded-lg bg-muted/30 border">
                <div className="space-y-2">
                  <Label className="text-xs">Threshold (dB)</Label>
                  <Slider
                    value={[ducking?.threshold || -24]}
                    onValueChange={([threshold]) =>
                      onDuckingChange({ ...(ducking || {}), threshold } as any)
                    }
                    min={-60}
                    max={0}
                    step={1}
                  />
                  <span className="text-xs text-muted-foreground">{ducking?.threshold || -24} dB</span>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Ratio (%)</Label>
                  <Slider
                    value={[ducking?.ratio || 50]}
                    onValueChange={([ratio]) =>
                      onDuckingChange({ ...(ducking || {}), ratio } as any)
                    }
                    min={0}
                    max={100}
                    step={5}
                  />
                  <span className="text-xs text-muted-foreground">{ducking?.ratio || 50}%</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Attack (s)</Label>
                    <Slider
                      value={[(ducking?.attack || 0.1) * 10]}
                      onValueChange={([val]) =>
                        onDuckingChange({ ...(ducking || {}), attack: val / 10 } as any)
                      }
                      min={0}
                      max={20}
                      step={1}
                    />
                    <span className="text-xs text-muted-foreground">{ducking?.attack || 0.1}s</span>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Release (s)</Label>
                    <Slider
                      value={[(ducking?.release || 0.5) * 10]}
                      onValueChange={([val]) =>
                        onDuckingChange({ ...(ducking || {}), release: val / 10 } as any)
                      }
                      min={0}
                      max={50}
                      step={1}
                    />
                    <span className="text-xs text-muted-foreground">{ducking?.release || 0.5}s</span>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}