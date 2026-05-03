import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Type, Image, Sparkles, Download, Wand2, Volume2 } from "lucide-react";
import type { FinalizationConfig } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { AITextPositioning } from "./ai-text-positioning";
import { Separator } from "@/components/ui/separator";
import { TransitionControls } from "./transition-controls";
import { AudioMixerControls } from "@/components/audio-mixer-controls";
import { Checkbox } from "@/components/ui/checkbox";


interface VideoFinalizeProps {
  projectId: string;
  videoType: "short" | "standard" | "comprehensive";
  onApplyFinalization: (config: FinalizationConfig) => void;
  onSkipFinalization: () => void;
  isProcessing?: boolean;
  videoDuration: number; // Added videoDuration prop
}

export function VideoFinalize({
  projectId,
  videoType,
  onApplyFinalization,
  onSkipFinalization,
  isProcessing = false,
  videoDuration, // Destructure videoDuration
}: VideoFinalizeProps) {
  const { toast } = useToast();
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const musicFileRef = useRef<HTMLInputElement>(null);
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [musicVolume, setMusicVolume] = useState(60); // Default 60% for background music
  const [enableBeatSync, setEnableBeatSync] = useState(false);
  const [enableAutoDuck, setEnableAutoDuck] = useState(true); // Auto-duck by default

  // V2 QUALITY DEFAULTS - Professional settings out of the box
  const [config, setConfig] = useState<any>({
    transitions: {
      enabled: false,
      type: "fade",
      duration: 0.5,
      applyBetweenClips: true,
    },
    audio: {
      tracks: [],
      ducking: {
        enabled: false,
        threshold: -24,
        ratio: 60,
        attack: 0.1,
        release: 0.5,
      },
      normalization: {
        enabled: false,
        targetLevel: -14,
        compressionRatio: 3,
      },
      masterVolume: 100,
    },
    motionGraphics: {
      zoomEnabled: false,
      zoomIntensity: "subtle",
      kenBurnsEnabled: false,
      lowerThirdsEnabled: false,
      lowerThirdsText: "",
      lowerThirdsStyle: "slide",
    },
    subtitles: {
      enabled: false,
      position: "bottom",
      fontSize: 48, // LARGER for mobile readability (was 32)
      fontColor: "#FFFFFF",
      backgroundColor: "#000000",
      backgroundOpacity: 85,
      preset: "tiktok",
      outlineWidth: 4, // THICKER outline for impact (was 3)
      shadowStrength: 2,
      enableKinetics: true, // ENABLE word zoom/bounce by default
      kineticIntensity: "normal",
      autoTrimFillers: false,
    },
    textOverlays: [],
    branding: {
      enabled: false,
      logoPosition: "bottom-right",
      logoOpacity: 80,
      logoScale: 20,
      watermarkText: "",
      watermarkPosition: "bottom-right",
      watermarkFontSize: 24,
      watermarkFontColor: "#FFFFFF",
      watermarkBgColor: "#000000",
      watermarkOpacity: 50,
      watermarkFont: "Arial",
    },
  });

  const [subtitleAnalytics, setSubtitleAnalytics] = useState<{
    avgWords: number;
    keywordCount: number;
    keywords: string[];
  } | null>(null);

  const handleTranscribe = async () => {
    setIsTranscribing(true);
    try {
      const response = await apiRequest("POST", `/api/projects/${projectId}/transcribe`, {});
      const data = await response.json();
      const { segments, keywords, analytics } = data as {
        segments: Array<{ start: number; end: number; text: string; keywords?: string[] }>;
        keywords?: string[];
        analytics?: {
          totalSegments: number;
          avgWordsPerSegment: string;
          detectedKeywords: number;
        };
      };

      setConfig({
        ...config,
        subtitles: {
          ...config.subtitles,
          enabled: true,
          segments,
        },
      });

      // Store analytics if available
      if (keywords && analytics) {
        setSubtitleAnalytics({
          avgWords: parseFloat(analytics.avgWordsPerSegment),
          keywordCount: analytics.detectedKeywords,
          keywords: keywords,
        });
      }

      toast({
        title: "✅ Smart Subtitles Generated",
        description: `${segments.length} segments with natural pause detection & keyword analysis`,
      });
    } catch (error: any) {
      toast({
        title: "❌ Transcription Failed",
        description: error.message || "Failed to transcribe audio",
        variant: "destructive",
      });
    } finally {
      setIsTranscribing(false);
    }
  };

  const [newOverlay, setNewOverlay] = useState({
    text: "",
    timestamp: 0,
    duration: 3,
    fontSize: 32,
    fontColor: "#FFFFFF",
    position: "center" as "top" | "center" | "bottom",
  });

  // State for current text overlays
  const [textOverlays, setTextOverlays] = useState<any[]>([]);


  const handleAddOverlay = () => {
    if (newOverlay.text.trim()) {
      setConfig({
        ...config,
        textOverlays: [
          ...config.textOverlays,
          {
            text: newOverlay.text,
            timestamp: newOverlay.timestamp,
            duration: newOverlay.duration,
            position: newOverlay.position,
            fontSize: newOverlay.fontSize,
            fontColor: newOverlay.fontColor,
          },
        ],
      });
      setNewOverlay({
        text: "",
        timestamp: 0,
        duration: 3,
        fontSize: 32,
        fontColor: "#FFFFFF",
        position: "center",
      });
    }
  };

  const handleApply = async () => {
    try {
      setIsApplying(true);

      // Upload music file first if present
      let musicFileUrl = null;
      if (musicFile) {
        const formData = new FormData();
        formData.append('audio', musicFile);

        try {
          const uploadResponse = await fetch('/api/upload-audio', {
            method: 'POST',
            body: formData,
          });

          if (uploadResponse.ok) {
            const { url } = await uploadResponse.json();
            musicFileUrl = url;
            console.log('[finalize] Music uploaded:', url);
          }
        } catch (uploadError) {
          console.error('[finalize] Music upload failed:', uploadError);
          toast({
            title: "Music Upload Failed",
            description: "Continuing without background music",
            variant: "destructive",
          });
        }
      }

      const finalizationConfig: FinalizationConfig = {
        ...config,
        // Pass other config options as before
        brandingConfig: config.branding.enabled ? {
          watermarkPosition: config.branding.logoPosition as any,
          watermarkOpacity: config.branding.logoOpacity / 100,
          watermarkText: config.branding.watermarkText,
        } : undefined,
        musicConfig: musicFileUrl ? {
          musicUrl: musicFileUrl,
          volume: musicVolume,
          enableBeatSync,
          enableAutoDuck,
        } : undefined,
        // Include audio finishing options
        audioFinishing: audioFinishing,
      };

      await onApplyFinalization(finalizationConfig);
    } catch (error: any) {
      toast({
        title: "❌ Finalization Failed",
        description: error.message || "Failed to apply finalization settings",
        variant: "destructive",
      });
    } finally {
      setIsApplying(false);
    }
  };

  // Dummy state for applying, assuming it's handled elsewhere or will be added
  const [isApplying, setIsApplying] = useState(false);

  const handleMusicFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setMusicFile(event.target.files[0]);
    }
  };

  const handleRemoveMusic = () => {
    setMusicFile(null);
    if (musicFileRef.current) {
      musicFileRef.current.value = "";
    }
  };

  // State for audio finishing controls
  const [audioFinishing, setAudioFinishing] = useState({
    noiseGate: true,
    speechEQ: true,
    deEsser: true,
    compression: true,
    limiter: true,
    normalization: true,
  });


  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold flex items-center justify-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          Finalize Your Video
        </h2>
        <p className="text-muted-foreground">
          Add professional finishing touches or download as-is
        </p>
      </div>

      <Card className="p-6">
        <Tabs defaultValue="transitions" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="transitions">Transitions</TabsTrigger>
            <TabsTrigger value="audio">Audio</TabsTrigger>
            <TabsTrigger value="subtitles">
              <Type className="h-4 w-4 mr-2" />
              Captions
            </TabsTrigger>


                <div className="space-y-2">
                  <Label>Kinetic Animation Type</Label>
                  <Select
                    value={config.subtitles.kineticType || "bounce"}
                    onValueChange={(value: any) =>
                      setConfig({
                        ...config,
                        subtitles: { ...config.subtitles, kineticType: value },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bounce">Bounce (Up/Down Spring)</SelectItem>
                      <SelectItem value="scale">Scale (Zoom with Overshoot)</SelectItem>
                      <SelectItem value="wave">Wave (Rotate + Scale)</SelectItem>
                      <SelectItem value="pop">Pop (Instant + Ease Out)</SelectItem>
                      <SelectItem value="spring">Spring (Realistic Physics)</SelectItem>
                      <SelectItem value="karaoke">Karaoke (Sequential Highlight)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Choose how words animate when emphasized
                  </p>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label className="font-semibold">Quick CTA Overlays</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Add popular call-to-action overlays instantly
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { text: "SUBSCRIBE! 👇", position: "bottom" as const },
                      { text: "LINK IN BIO ⬆️", position: "top" as const },
                      { text: "FOLLOW FOR MORE", position: "bottom" as const },
                      { text: "TAP TO LEARN MORE", position: "center" as const },
                    ].map((cta, i) => (
                      <Button
                        key={i}
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setNewOverlay({
                            ...newOverlay,
                            text: cta.text,
                            position: cta.position,
                            fontSize: 40,
                            fontColor: "#FFFF00",
                            timestamp: videoDuration - 3, // Last 3 seconds
                            duration: 2.5,
                          });
                        }}
                      >
                        {cta.text}
                      </Button>
                    ))}
                  </div>
                </div>

            <TabsTrigger value="overlays">Overlays</TabsTrigger>
            <TabsTrigger value="motion">Motion</TabsTrigger>
            <TabsTrigger value="music">Music</TabsTrigger>
          </TabsList>

          {/* Audio Finishing Section */}
          <TabsContent value="audio" className="space-y-4 mt-4">
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Volume2 className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Audio Finishing</h3>
                <Badge variant="secondary" className="ml-auto">Professional</Badge>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Noise Gate (Highpass/Lowpass)</Label>
                    <p className="text-xs text-muted-foreground">Remove background noise and rumble</p>
                  </div>
                  <Checkbox
                    checked={audioFinishing.noiseGate}
                    onCheckedChange={(checked) =>
                      setAudioFinishing({ ...audioFinishing, noiseGate: checked as boolean })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Speech EQ (2-4kHz Boost)</Label>
                    <p className="text-xs text-muted-foreground">Enhance vocal clarity and presence</p>
                  </div>
                  <Checkbox
                    checked={audioFinishing.speechEQ}
                    onCheckedChange={(checked) =>
                      setAudioFinishing({ ...audioFinishing, speechEQ: checked as boolean })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>De-esser</Label>
                    <p className="text-xs text-muted-foreground">Reduce harsh sibilance (5-8kHz)</p>
                  </div>
                  <Checkbox
                    checked={audioFinishing.deEsser}
                    onCheckedChange={(checked) =>
                      setAudioFinishing({ ...audioFinishing, deEsser: checked as boolean })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Compression</Label>
                    <p className="text-xs text-muted-foreground">Even out dynamic range (3:1 ratio)</p>
                  </div>
                  <Checkbox
                    checked={audioFinishing.compression}
                    onCheckedChange={(checked) =>
                      setAudioFinishing({ ...audioFinishing, compression: checked as boolean })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Limiter (-1.5 TP)</Label>
                    <p className="text-xs text-muted-foreground">Prevent audio clipping</p>
                  </div>
                  <Checkbox
                    checked={audioFinishing.limiter}
                    onCheckedChange={(checked) =>
                      setAudioFinishing({ ...audioFinishing, limiter: checked as boolean })
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Normalization to -14 LUFS</Label>
                    <p className="text-xs text-muted-foreground">Optimal loudness for social media</p>
                  </div>
                  <Checkbox
                    checked={audioFinishing.normalization}
                    onCheckedChange={(checked) =>
                      setAudioFinishing({ ...audioFinishing, normalization: checked as boolean })
                    }
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    const allEnabled = Object.values(audioFinishing).every(v => v);
                    const newState = !allEnabled;
                    setAudioFinishing({
                      noiseGate: newState,
                      speechEQ: newState,
                      deEsser: newState,
                      compression: newState,
                      limiter: newState,
                      normalization: newState,
                    });
                  }}
                >
                  {Object.values(audioFinishing).every(v => v) ? "Disable All" : "Enable All"}
                </Button>
              </div>
            </Card>

            {/* Existing Audio Mixer */}
            <AudioMixerControls
              tracks={config.audio.tracks}
              ducking={config.audio.ducking}
              masterVolume={config.audio.masterVolume}
              onTracksChange={(tracks) =>
                setConfig((prev) => ({
                  ...prev,
                  audio: { ...prev.audio, tracks },
                }))
              }
              onDuckingChange={(ducking) =>
                setConfig((prev) => ({
                  ...prev,
                  audio: { ...prev.audio, ducking },
                }))
              }
              onMasterVolumeChange={(masterVolume) =>
                setConfig((prev) => ({
                  ...prev,
                  audio: { ...prev.audio, masterVolume },
                }))
              }
            />
          </TabsContent>

          {/* Transitions Tab */}
          <TabsContent value="transitions" className="space-y-4 mt-4">
            <TransitionControls
              enabled={config.transitions?.enabled || false}
              type={config.transitions?.type || "fade"}
              duration={config.transitions?.duration || 0.5}
              onEnabledChange={(enabled) =>
                setConfig({
                  ...config,
                  transitions: { ...config.transitions!, enabled },
                })
              }
              onTypeChange={(type: any) =>
                setConfig({
                  ...config,
                  transitions: { ...config.transitions!, type },
                })
              }
              onDurationChange={(duration) =>
                setConfig({
                  ...config,
                  transitions: { ...config.transitions!, duration },
                })
              }
            />
          </TabsContent>

          {/* Subtitles Tab */}
          <TabsContent value="subtitles" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-Generate Subtitles</Label>
                <p className="text-sm text-muted-foreground">
                  AI-generated captions from video audio
                </p>
              </div>
              <Switch
                checked={config.subtitles.enabled}
                onCheckedChange={(enabled) =>
                  setConfig({
                    ...config,
                    subtitles: { ...config.subtitles, enabled },
                  })
                }
                data-testid="switch-subtitles-enabled"
              />
            </div>

            {config.subtitles.enabled && (
              <>
                {/* Visual Caption Style Picker */}
                <div className="space-y-3">
                  <Label className="font-semibold">Caption Style Preset</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: "tiktok", label: "TikTok", colors: ["#000", "#FFF", "#FFD700"] },
                      { value: "instagram", label: "Instagram", colors: ["#FFF", "#000", "#E1306C"] },
                      { value: "youtube", label: "YouTube", colors: ["#FFF", "#000", "#FF0000"] },
                      { value: "mr-beast", label: "Mr. Beast", colors: ["#000", "#FFF", "#00FF00"] },
                      { value: "alex-hormozi", label: "Hormozi", colors: ["#000", "#FFD700", "#FF0000"] },
                      { value: "karaoke", label: "Karaoke", colors: ["#FFF", "#FFD700", "#000"] },
                      { value: "bold-impact", label: "Bold", colors: ["#000", "#FFF", "#FFF"] },
                      { value: "neon-glow", label: "Neon", colors: ["#000", "#00FFFF", "#FF00FF"] },
                      { value: "minimal", label: "Minimal", colors: ["#FFF", "#000", "#888"] },
                    ].map((preset) => (
                      <button
                        key={preset.value}
                        onClick={() =>
                          setConfig({
                            ...config,
                            subtitles: { ...config.subtitles, preset: preset.value as any },
                          })
                        }
                        className={`p-3 rounded-lg border-2 transition-all ${
                          config.subtitles.preset === preset.value
                            ? "border-primary bg-primary/10"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex gap-1 justify-center">
                            {preset.colors.map((color, i) => (
                              <div
                                key={i}
                                className="w-6 h-6 rounded"
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                          <p className="text-xs font-medium">{preset.label}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Popular creator styles with optimized settings
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Kinetic Typography Intensity</Label>
                  <Select
                    value={config.subtitles.kineticIntensity || "normal"}
                    onValueChange={(value: any) =>
                      setConfig({
                        ...config,
                        subtitles: { ...config.subtitles, kineticIntensity: value },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="subtle">Subtle (110% zoom - Professional)</SelectItem>
                      <SelectItem value="normal">Normal (150% zoom - Balanced)</SelectItem>
                      <SelectItem value="extreme">Extreme (200% zoom - Explosive)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Control word emphasis animation strength
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-Trim Filler Words</Label>
                    <p className="text-xs text-muted-foreground">
                      Remove "um", "uh", "like", "you know"
                    </p>
                  </div>
                  <Switch
                    checked={config.subtitles.autoTrimFillers || false}
                    onCheckedChange={(enabled) =>
                      setConfig({
                        ...config,
                        subtitles: { ...config.subtitles, autoTrimFillers: enabled },
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Button
                    onClick={handleTranscribe}
                    disabled={isTranscribing}
                    variant="outline"
                    className="w-full"
                    data-testid="button-generate-subtitles"
                  >
                    <Wand2 className="mr-2 h-4 w-4" />
                    {isTranscribing ? "Transcribing Audio..." : "AI Generate Smart Subtitles"}
                  </Button>
                  {config.subtitles.segments && config.subtitles.segments.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        ✅ {config.subtitles.segments.length} subtitle segments ready
                      </p>
                      {subtitleAnalytics && (
                        <Card className="p-3 bg-accent/10 border-accent" data-testid="card-subtitle-analytics">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Sparkles className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">AI Subtitle Analytics</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div data-testid="text-avg-words">
                                <span className="text-muted-foreground">Avg Words:</span>
                                <span className="ml-1 font-medium">{subtitleAnalytics.avgWords}</span>
                              </div>
                              <div data-testid="text-keyword-count">
                                <span className="text-muted-foreground">Keywords:</span>
                                <span className="ml-1 font-medium">{subtitleAnalytics.keywordCount}</span>
                              </div>
                            </div>
                            {subtitleAnalytics.keywords.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {subtitleAnalytics.keywords.slice(0, 5).map((keyword, i) => (
                                  <Badge
                                    key={i}
                                    variant="secondary"
                                    className="text-xs"
                                    data-testid={`badge-keyword-${i}`}
                                  >
                                    {keyword}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </Card>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Position</Label>
                  <Select
                    value={config.subtitles.position}
                    onValueChange={(value: any) =>
                      setConfig({
                        ...config,
                        subtitles: { ...config.subtitles, position: value },
                      })
                    }
                  >
                    <SelectTrigger data-testid="select-subtitle-position">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="top">Top</SelectItem>
                      <SelectItem value="center">Center</SelectItem>
                      <SelectItem value="bottom">Bottom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Font Size: {config.subtitles.fontSize}px</Label>
                  <Slider
                    value={[config.subtitles.fontSize]}
                    onValueChange={(value) =>
                      setConfig({
                        ...config,
                        subtitles: { ...config.subtitles, fontSize: value[0] },
                      })
                    }
                    min={12}
                    max={72}
                    step={2}
                    data-testid="slider-subtitle-font-size"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Text Color</Label>
                    <Input
                      type="color"
                      value={config.subtitles.fontColor}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          subtitles: {
                            ...config.subtitles,
                            fontColor: e.target.value,
                          },
                        })
                      }
                      data-testid="input-subtitle-text-color"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Background Color</Label>
                    <Input
                      type="color"
                      value={config.subtitles.backgroundColor}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          subtitles: {
                            ...config.subtitles,
                            backgroundColor: e.target.value,
                          },
                        })
                      }
                      data-testid="input-subtitle-bg-color"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Background Opacity: {config.subtitles.backgroundOpacity}%</Label>
                  <Slider
                    value={[config.subtitles.backgroundOpacity]}
                    onValueChange={(value) =>
                      setConfig({
                        ...config,
                        subtitles: {
                          ...config.subtitles,
                          backgroundOpacity: value[0],
                        },
                      })
                    }
                    min={0}
                    max={100}
                    step={5}
                    data-testid="slider-subtitle-bg-opacity"
                  />
                </div>

                <div className="p-4 bg-muted rounded-md space-y-2">
                  <p className="text-sm text-muted-foreground">
                    <strong>Note:</strong> Subtitle text will be auto-generated from video audio.
                    This feature uses placeholder text for testing until AI transcription is implemented.
                  </p>
                </div>
              </>
            )}
          </TabsContent>

          {/* Text Overlays Tab */}
          <TabsContent value="overlays" className="space-y-4 mt-4">
            {/* Text Overlays Preview */}
            {config.textOverlays.length > 0 && (
              <Card className="p-4 bg-muted/50">
                <Label className="mb-3 block">Active Text Overlays ({config.textOverlays.length})</Label>
                <div className="space-y-2">
                  {config.textOverlays.map((overlay, index) => (
                    <div
                      key={index}
                      className="p-3 rounded-lg border bg-background"
                      style={{
                        borderLeft: `4px solid ${overlay.fontColor}`,
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p
                            className="font-medium truncate"
                            style={{
                              fontSize: `${Math.max(12, overlay.fontSize / 4)}px`,
                              color: overlay.fontColor,
                            }}
                          >
                            "{overlay.text}"
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {overlay.position} • {overlay.timestamp}s - {overlay.timestamp + overlay.duration}s • Size: {overlay.fontSize}px
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setConfig({
                              ...config,
                              textOverlays: config.textOverlays.filter((_, i) => i !== index),
                            });
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <div className="space-y-3">
              <Label>Add Text Overlay</Label>
              <Input
                placeholder="Enter text (e.g., 'Subscribe!' or 'Learn More')"
                value={newOverlay.text}
                onChange={(e) =>
                  setNewOverlay({ ...newOverlay, text: e.target.value })
                }
                data-testid="input-overlay-text"
              />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time (seconds)</Label>
                  <Input
                    type="number"
                    value={newOverlay.timestamp}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (isNaN(value)) return;
                      setNewOverlay({
                        ...newOverlay,
                        timestamp: Math.max(0, value),
                      });
                    }}
                    onBlur={(e) => {
                      const value = parseInt(e.target.value);
                      if (isNaN(value) || value < 0) {
                        setNewOverlay({ ...newOverlay, timestamp: 0 });
                      }
                    }}
                    min={0}
                    data-testid="input-overlay-timestamp"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Duration (seconds)</Label>
                  <Input
                    type="number"
                    value={newOverlay.duration}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      if (isNaN(value)) return;
                      setNewOverlay({
                        ...newOverlay,
                        duration: Math.min(60, Math.max(0.5, value)),
                      });
                    }}
                    onBlur={(e) => {
                      const value = parseFloat(e.target.value);
                      if (isNaN(value) || value < 0.5) {
                        setNewOverlay({ ...newOverlay, duration: 0.5 });
                      } else if (value > 60) {
                        setNewOverlay({ ...newOverlay, duration: 60 });
                      }
                    }}
                    min={0.5}
                    max={60}
                    step={0.5}
                    data-testid="input-overlay-duration"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Position</Label>
                  <Select
                    value={newOverlay.position}
                    onValueChange={(value: any) =>
                      setNewOverlay({ ...newOverlay, position: value })
                    }
                  >
                    <SelectTrigger data-testid="select-overlay-position">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="top">Top</SelectItem>
                      <SelectItem value="center">Center</SelectItem>
                      <SelectItem value="bottom">Bottom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Font Size</Label>
                  <Input
                    type="number"
                    value={newOverlay.fontSize}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (isNaN(value)) return;
                      setNewOverlay({
                        ...newOverlay,
                        fontSize: Math.min(96, Math.max(12, value)),
                      });
                    }}
                    onBlur={(e) => {
                      const value = parseInt(e.target.value);
                      if (isNaN(value) || value < 12) {
                        setNewOverlay({ ...newOverlay, fontSize: 12 });
                      } else if (value > 96) {
                        setNewOverlay({ ...newOverlay, fontSize: 96 });
                      }
                    }}
                    min={12}
                    max={96}
                    data-testid="input-overlay-font-size"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Color</Label>
                  <Input
                    type="color"
                    value={newOverlay.fontColor}
                    onChange={(e) =>
                      setNewOverlay({ ...newOverlay, fontColor: e.target.value })
                    }
                    data-testid="input-overlay-font-color"
                  />
                </div>
              </div>

              <Button onClick={handleAddOverlay} className="w-full" data-testid="button-add-overlay">
                Add Overlay
              </Button>
            </div>

            {/* AI Text Positioning Helper */}
            <AITextPositioning
              projectId={projectId}
              videoDuration={videoDuration}
              onPositionRecommended={(position, timestamp) => {
                // Pre-fill a new text overlay with AI-recommended position
                setTextOverlays([
                  ...textOverlays,
                  {
                    text: "",
                    timestamp,
                    duration: 3,
                    position,
                    fontSize: 36,
                    fontColor: "#FFFFFF",
                  },
                ]);
                toast({
                  title: "Text overlay added",
                  description: `Position set to ${position} at ${timestamp.toFixed(1)}s`,
                });
              }}
            />
            <Separator />

            {config.textOverlays.length > 0 && (
              <div className="space-y-2">
                <Label>Current Overlays ({config.textOverlays.length})</Label>
                <div className="space-y-2">
                  {config.textOverlays.map((overlay, index) => (
                    <Card key={index} className="p-3 flex justify-between items-center">
                      <div className="text-sm">
                        <p className="font-medium">{overlay.text}</p>
                        <p className="text-muted-foreground">
                          {overlay.timestamp}s - {overlay.timestamp + overlay.duration}s
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setConfig({
                            ...config,
                            textOverlays: config.textOverlays.filter(
                              (_, i) => i !== index
                            ),
                          })
                        }
                        data-testid={`button-remove-overlay-${index}`}
                      >
                        Remove
                      </Button>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Music Tab */}
          <TabsContent value="music" className="space-y-4 mt-4">
            <div className="space-y-4">
              <Label>Upload Your Music</Label>
              <div className="flex items-center gap-4">
                <Input
                  type="file"
                  accept="audio/*"
                  onChange={handleMusicFileChange}
                  ref={musicFileRef}
                  data-testid="input-music-upload"
                  className="max-w-lg"
                />
                {musicFile && (
                  <Button onClick={handleRemoveMusic} variant="destructive" size="sm">
                    Remove Music
                  </Button>
                )}
              </div>
              {musicFile && (
                <p className="text-sm text-muted-foreground">
                  Selected: {musicFile.name}
                </p>
              )}
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Music Volume</Label>
              <Slider
                value={[musicVolume]}
                onValueChange={(value) => setMusicVolume(value[0])}
                min={0}
                max={100}
                step={5}
                data-testid="slider-music-volume"
              />
              <p className="text-sm text-muted-foreground">Adjust background music volume</p>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label>Sync Cuts to Beats</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically align video cuts with the music's beat
                </p>
              </div>
              <Switch
                checked={enableBeatSync}
                onCheckedChange={setEnableBeatSync}
                data-testid="switch-enable-beat-sync"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-Duck Music</Label>
                <p className="text-sm text-muted-foreground">
                  Lower music volume during speech segments
                </p>
              </div>
              <Switch
                checked={enableAutoDuck}
                onCheckedChange={setEnableAutoDuck}
                data-testid="switch-enable-auto-duck"
              />
            </div>
          </TabsContent>

          {/* Motion Graphics Tab */}
          <TabsContent value="motion" className="space-y-4 mt-4">
            <div className="space-y-4">
              {/* Zoom Effects */}
              <Card className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-semibold">Dynamic Zoom</Label>
                      <p className="text-sm text-muted-foreground">
                        Subtle zoom animations on clips
                      </p>
                    </div>
                    <Switch
                      checked={config.motionGraphics?.zoomEnabled || false}
                      onCheckedChange={(enabled) =>
                        setConfig({
                          ...config,
                          motionGraphics: { ...config.motionGraphics, zoomEnabled: enabled },
                        })
                      }
                    />
                  </div>

                  {config.motionGraphics?.zoomEnabled && (
                    <div className="space-y-2 pt-2 border-t">
                      <Label className="text-sm">Zoom Intensity</Label>
                      <Select
                        value={config.motionGraphics?.zoomIntensity || "subtle"}
                        onValueChange={(value: any) =>
                          setConfig({
                            ...config,
                            motionGraphics: { ...config.motionGraphics, zoomIntensity: value },
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="subtle">Subtle (105%)</SelectItem>
                          <SelectItem value="moderate">Moderate (110%)</SelectItem>
                          <SelectItem value="dramatic">Dramatic (120%)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </Card>

              {/* Pan & Scan */}
              <Card className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-semibold">Ken Burns Effect</Label>
                      <p className="text-sm text-muted-foreground">
                        Slow pan and zoom on static shots
                      </p>
                    </div>
                    <Switch
                      checked={config.motionGraphics?.kenBurnsEnabled || false}
                      onCheckedChange={(enabled) =>
                        setConfig({
                          ...config,
                          motionGraphics: { ...config.motionGraphics, kenBurnsEnabled: enabled },
                        })
                      }
                    />
                  </div>
                </div>
              </Card>

              {/* Animated Lower Thirds */}
              <Card className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="font-semibold">Animated Lower Thirds</Label>
                      <p className="text-sm text-muted-foreground">
                        Professional name/title animations
                      </p>
                    </div>
                    <Switch
                      checked={config.motionGraphics?.lowerThirdsEnabled || false}
                      onCheckedChange={(enabled) =>
                        setConfig({
                          ...config,
                          motionGraphics: { ...config.motionGraphics, lowerThirdsEnabled: enabled },
                        })
                      }
                    />
                  </div>

                  {config.motionGraphics?.lowerThirdsEnabled && (
                    <div className="space-y-3 pt-2 border-t">
                      <Input
                        placeholder="Name/Title text"
                        value={config.motionGraphics?.lowerThirdsText || ""}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            motionGraphics: { ...config.motionGraphics, lowerThirdsText: e.target.value },
                          })
                        }
                      />

                      <div className="space-y-2">
                        <Label className="text-sm">Animation Style</Label>
                        <Select
                          value={config.motionGraphics?.lowerThirdsStyle || "slide"}
                          onValueChange={(value: any) =>
                            setConfig({
                              ...config,
                              motionGraphics: { ...config.motionGraphics, lowerThirdsStyle: value },
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="slide">Slide In</SelectItem>
                            <SelectItem value="fade">Fade In</SelectItem>
                            <SelectItem value="typewriter">Typewriter</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Branding Tab - Custom Watermark with Full Styling */}
          <TabsContent value="branding" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-semibold">Custom Watermark</Label>
                <p className="text-sm text-muted-foreground">
                  Professional branding with full style control
                </p>
              </div>
              <Switch
                checked={config.branding.enabled}
                onCheckedChange={(enabled) =>
                  setConfig({
                    ...config,
                    branding: { ...config.branding, enabled },
                  })
                }
                data-testid="switch-branding-enabled"
              />
            </div>

            {config.branding.enabled && (
              <div className="space-y-4">
                {/* Live Preview */}
                <Card className="p-4 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950">
                  <Label className="mb-3 block">Live Preview</Label>
                  <div className="relative aspect-video bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg overflow-hidden border-2 border-white/10">
                    <div
                      className="absolute px-3 py-1.5 rounded-md font-semibold shadow-lg"
                      style={{
                        opacity: config.branding.logoOpacity / 100,
                        color: config.branding.watermarkFontColor || '#FFFFFF',
                        backgroundColor: config.branding.watermarkBgColor || 'transparent',
                        fontSize: `${(config.branding.watermarkFontSize || 24) / 4}px`,
                        fontFamily: config.branding.watermarkFont || 'Arial',
                        ...(config.branding.logoPosition === 'top-left' && { top: '16px', left: '16px' }),
                        ...(config.branding.logoPosition === 'top-right' && { top: '16px', right: '16px' }),
                        ...(config.branding.logoPosition === 'bottom-left' && { bottom: '16px', left: '16px' }),
                        ...(config.branding.logoPosition === 'bottom-right' && { bottom: '16px', right: '16px' }),
                      }}
                    >
                      {config.branding.watermarkText || '@YourBrand'}
                    </div>
                  </div>
                </Card>

                {/* Watermark Text */}
                <div className="space-y-2">
                  <Label>Watermark Text</Label>
                  <Input
                    placeholder="@yourbrand or YourCompany.com"
                    value={config.branding.watermarkText || ""}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        branding: { ...config.branding, watermarkText: e.target.value },
                      })
                    }
                    data-testid="input-watermark-text"
                  />
                </div>

                {/* Position Grid */}
                <div className="space-y-2">
                  <Label>Position</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: "top-left", label: "Top Left" },
                      { value: "top-right", label: "Top Right" },
                      { value: "bottom-left", label: "Bottom Left" },
                      { value: "bottom-right", label: "Bottom Right" },
                    ].map((pos) => (
                      <button
                        key={pos.value}
                        onClick={() =>
                          setConfig({
                            ...config,
                            branding: { ...config.branding, logoPosition: pos.value as any },
                          })
                        }
                        className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                          config.branding.logoPosition === pos.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Styling Options */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Text Color</Label>
                    <Input
                      type="color"
                      value={config.branding.watermarkFontColor || "#FFFFFF"}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          branding: { ...config.branding, watermarkFontColor: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Background</Label>
                    <Input
                      type="color"
                      value={config.branding.watermarkBgColor || "#000000"}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          branding: { ...config.branding, watermarkBgColor: e.target.value },
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Font Family</Label>
                  <Select
                    value={config.branding.watermarkFont || "Arial"}
                    onValueChange={(value: any) =>
                      setConfig({
                        ...config,
                        branding: { ...config.branding, watermarkFont: value },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Arial">Arial</SelectItem>
                      <SelectItem value="Helvetica">Helvetica</SelectItem>
                      <SelectItem value="Impact">Impact</SelectItem>
                      <SelectItem value="Montserrat">Montserrat</SelectItem>
                      <SelectItem value="Roboto">Roboto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Font Size: {config.branding.watermarkFontSize || 24}px</Label>
                  <Slider
                    value={[config.branding.watermarkFontSize || 24]}
                    onValueChange={(value) =>
                      setConfig({
                        ...config,
                        branding: { ...config.branding, watermarkFontSize: value[0] },
                      })
                    }
                    min={12}
                    max={48}
                    step={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Opacity: {config.branding.logoOpacity}%</Label>
                  <Slider
                    value={[config.branding.logoOpacity]}
                    onValueChange={(value) =>
                      setConfig({
                        ...config,
                        branding: { ...config.branding, logoOpacity: value[0] },
                      })
                    }
                    min={10}
                    max={100}
                    step={5}
                    data-testid="slider-branding-opacity"
                  />
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </Card>

      {/* Preview Summary */}
      {(config.subtitles.enabled || (config.textOverlays && config.textOverlays.length > 0) || (config.branding && config.branding.enabled) || config.audio.tracks.length > 0 || musicFile || Object.values(audioFinishing).some(v => v)) && (
        <Card className="p-4 bg-muted/50">
          <h3 className="font-semibold mb-2">Preview Configuration:</h3>
          <ul className="text-sm space-y-1 text-muted-foreground">
            {config.subtitles.enabled && (
              <li>✅ Subtitles: {config.subtitles.segments?.length || 0} segments, {config.subtitles.position} position</li>
            )}
            {config.textOverlays && config.textOverlays.length > 0 && (
              <li>✅ Text Overlays: {config.textOverlays.length} custom text{config.textOverlays.length > 1 ? 's' : ''}</li>
            )}
            {config.branding && config.branding.enabled && (
              <li>✅ Branding: {config.branding.watermarkText || 'Watermark'} at {config.branding.logoPosition}</li>
            )}
            {config.audio.tracks.length > 0 && (
              <li>✅ Audio Tracks: {config.audio.tracks.length} active tracks</li>
            )}
            {musicFile && (
              <li>✅ Background Music: {musicFile.name} ({musicVolume}%)</li>
            )}
            {Object.values(audioFinishing).some(v => v) && (
              <li>✅ Audio Finishing: Enabled</li>
            )}
          </ul>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button
          onClick={onSkipFinalization}
          variant="outline"
          className="flex-1"
          disabled={isProcessing || isApplying}
          data-testid="button-download-as-is"
        >
          <Download className="mr-2 h-4 w-4" />
          Download As-Is
        </Button>
        <Button
          onClick={handleApply}
          className="flex-1"
          disabled={isProcessing || isApplying}
          data-testid="button-apply-finalization"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          {isApplying ? "Processing..." : "Apply & Download"}
        </Button>
      </div>
    </div>
  );
}