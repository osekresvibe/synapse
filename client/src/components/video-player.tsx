import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { Download, ExternalLink, Copy, Check, Video } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VideoPlayerProps {
  videoPath: string;
  title: string;
  subtitle?: string;
}

export function VideoPlayer({ videoPath, title, subtitle }: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  // Normalize video path to web URL
  const normalizeVideoPath = (path: string) => {
    if (!path) return '';
    if (path.startsWith('/uploads/')) return path;

    const filename = path.split('/').pop();
    if (!filename) return path;

    if (path.includes('/ai-videos/')) {
      return `/uploads/ai-videos/${filename}`;
    }

    return `/uploads/videos/${filename}`;
  };

  const normalizedPath = normalizeVideoPath(videoPath);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (value: number[]) => {
    if (videoRef.current) {
      videoRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const skipTime = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime += seconds;
    }
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = normalizedPath;
    link.download = videoPath.split('/').pop() || 'video.mp4';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Download Started",
      description: "Your video is downloading...",
    });
  };

  const handleCopyLink = async () => {
    const fullUrl = window.location.origin + normalizedPath;
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);

    toast({
      title: "Link Copied",
      description: "Video URL copied to clipboard",
    });

    setTimeout(() => setCopied(false), 2000);
  };

  const copyVideoLink = () => {
    const fullUrl = window.location.origin + videoPath;
    navigator.clipboard.writeText(fullUrl);
    toast({
      title: "Link Copied",
      description: "Video URL copied to clipboard",
    });
  };


  if (!videoPath) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">No video available</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm" data-video-player-section>
      <CardHeader className="border-b border-border/30">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Video className="h-4 w-4 text-purple-400" />
              </div>
              {title}
            </CardTitle>
            {subtitle && (
              <CardDescription className="mt-1">{subtitle}</CardDescription>
            )}
            <p className="text-xs text-muted-foreground mt-2 font-mono bg-muted/30 px-2 py-1 rounded inline-block">
              {videoPath}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={copyVideoLink}
            className="ml-4 border-border/50 hover:border-purple-500/50"
          >
            📋 Copy Link
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {videoPath ? (
          <video
            ref={videoRef}
            key={`${normalizedPath}-${Date.now()}`}
            controls
            autoPlay
            className="w-full aspect-video bg-black"
            preload="metadata"
            poster={normalizedPath.replace('/videos/', '/thumbnails/').replace('.mp4', '.jpg')}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            data-testid="video-player"
            onError={(e) => {
              console.error('Video loading error:', normalizedPath);
              console.error('Original path:', videoPath);
              toast({
                title: "Video Load Error",
                description: "Check console for details. Video may still be processing.",
                variant: "destructive"
              });
            }}
          >
            <source src={`${normalizedPath}?t=${Date.now()}`} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        ) : (
          <div className="w-full aspect-video bg-muted flex items-center justify-center">
            <p className="text-muted-foreground">No video available</p>
          </div>
        )}
      </CardContent>

      <div className="p-6 border-t border-border/30 space-y-4 bg-muted/20">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">{title}</h3>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="gap-2 border-border/50 hover:border-purple-500/50"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open('/uploads/videos', '_blank')}
              className="gap-2 border-border/50 hover:border-blue-500/50"
              title="Open videos folder"
            >
              📁 Folder
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(normalizedPath, '_blank')}
              className="gap-2 border-border/50 hover:border-cyan-500/50"
            >
              <ExternalLink className="h-4 w-4" />
              Open
            </Button>
            <Button
              size="sm"
              onClick={handleDownload}
              className="gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
          </div>
        </div>
        <div className="text-xs text-muted-foreground font-mono bg-muted/50 border border-border/30 p-3 rounded-lg break-all">
          📂 {videoPath}
        </div>
      </div>
    </Card>
  );
}