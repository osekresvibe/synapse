import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Wand2, Film, Zap, Music, Palette, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface ImmersiveProcessingProps {
  stage: string;
  progress: number;
  message: string;
  onCancel?: () => void;
}

const processingInsights = [
  { icon: Sparkles, text: "Analyzing visual engagement patterns..." },
  { icon: Film, text: "Detecting the most captivating moments..." },
  { icon: Zap, text: "Optimizing clip transitions for flow..." },
  { icon: Music, text: "Syncing cuts to audio rhythm..." },
  { icon: Palette, text: "Applying cinematic color grading..." },
  { icon: Wand2, text: "Adding professional polish..." },
];

const calmingQuotes = [
  "Great edits come to those who wait...",
  "Your story is taking shape...",
  "Every frame matters...",
  "Magic in progress...",
  "Crafting something special...",
  "Almost there, stay with us...",
  "Making your content irresistible...",
  "Removing the boring parts automatically...",
  "Teaching pixels to dance...",
  "Convincing frames to be friends...",
  "Turning chaos into cinema...",
  "Sprinkling some ✨ algorithm ✨ on it...",
  "Doing in seconds what editors charge hours for...",
  "Finding the moments that slap...",
  "Your future viral video is loading...",
  "AI is taking notes from Spielberg...",
  "Trimming the meh, keeping the magic...",
  "Plot twist: your content was fire all along...",
  "Professional editor energy, instant ramen speed...",
  "Making your B-roll look like A-roll...",
  "The AI is in the zone right now...",
  "Cuts so smooth they need a warning label...",
  "Extracting pure serotonin from your footage...",
  "Less filler, more thriller...",
  "Your clips are having a glow-up moment...",
  "Turning raw footage into chef's kiss...",
  "The algorithm is feeling creative today...",
  "Finding the hook that hooks...",
  "Making your content scroll-stopping...",
  "Adding that main character energy...",
];

function FloatingOrb({ delay, size, color, duration }: { delay: number; size: number; color: string; duration: number }) {
  return (
    <motion.div
      className={cn("absolute rounded-full blur-3xl opacity-30", color)}
      style={{ width: size, height: size }}
      initial={{ x: Math.random() * 100 - 50, y: Math.random() * 100 - 50 }}
      animate={{
        x: [Math.random() * 200 - 100, Math.random() * 200 - 100, Math.random() * 200 - 100],
        y: [Math.random() * 200 - 100, Math.random() * 200 - 100, Math.random() * 200 - 100],
        scale: [1, 1.2, 0.9, 1.1, 1],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  );
}

function PulsingRing({ progress }: { progress: number }) {
  return (
    <div className="relative w-48 h-48 mx-auto">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute inset-0 rounded-full border-2 border-purple-500/30"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{
            scale: [0.8, 1.4, 0.8],
            opacity: [0.6, 0, 0.6],
          }}
          transition={{
            duration: 3,
            delay: i * 1,
            repeat: Infinity,
            ease: "easeOut",
          }}
        />
      ))}

      <svg className="absolute inset-0 w-full h-full -rotate-90">
        <circle
          cx="96"
          cy="96"
          r="88"
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className="text-muted/20"
        />
        <motion.circle
          cx="96"
          cy="96"
          r="88"
          fill="none"
          stroke="url(#gradient)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={553}
          initial={{ strokeDashoffset: 553 }}
          animate={{ strokeDashoffset: 553 - (553 * progress) / 100 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#60a5fa" />
          </linearGradient>
        </defs>
      </svg>

      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          className="text-4xl font-bold bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent"
          key={progress}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {progress}%
        </motion.div>
      </div>
    </div>
  );
}

function StageIndicator({ stage, progress }: { stage: string; progress: number }) {
  const stages = [
    { key: "uploading", label: "Upload", threshold: 10 },
    { key: "analyzing", label: "Analyze", threshold: 30 },
    { key: "slicing", label: "Slice", threshold: 50 },
    { key: "generating", label: "Generate", threshold: 80 },
    { key: "complete", label: "Done", threshold: 100 },
  ];

  return (
    <div className="flex items-center justify-center gap-2 mt-8">
      {stages.map((s, i) => {
        const isActive = s.key === stage || progress >= s.threshold;
        const isCurrent = s.key === stage;

        return (
          <div key={s.key} className="flex items-center gap-2">
            <motion.div
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-500",
                isActive ? "bg-purple-500" : "bg-muted",
                isCurrent && "w-3 h-3 ring-4 ring-purple-500/20"
              )}
              animate={isCurrent ? { scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <span className={cn(
              "text-xs font-medium transition-colors",
              isActive ? "text-foreground" : "text-muted-foreground"
            )}>
              {s.label}
            </span>
            {i < stages.length - 1 && (
              <div className={cn(
                "w-8 h-0.5 transition-colors duration-500",
                progress >= stages[i + 1].threshold ? "bg-purple-500" : "bg-muted"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ImmersiveProcessing({ stage, progress, message, onCancel }: ImmersiveProcessingProps) {
  const [currentInsightIndex, setCurrentInsightIndex] = useState(0);
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);

  useEffect(() => {
    const insightInterval = setInterval(() => {
      setCurrentInsightIndex((prev) => (prev + 1) % processingInsights.length);
    }, 4000);

    const quoteInterval = setInterval(() => {
      setCurrentQuoteIndex((prev) => (prev + 1) % calmingQuotes.length);
    }, 8000);

    return () => {
      clearInterval(insightInterval);
      clearInterval(quoteInterval);
    };
  }, []);

  const orbs = useMemo(() => [
    { delay: 0, size: 300, color: "bg-primary", duration: 20 },
    { delay: 2, size: 250, color: "bg-purple-500", duration: 25 },
    { delay: 4, size: 200, color: "bg-pink-500", duration: 18 },
    { delay: 6, size: 280, color: "bg-blue-500", duration: 22 },
  ], []);

  const CurrentIcon = processingInsights[currentInsightIndex].icon;

  return (
    <div className="relative min-h-[600px] overflow-hidden rounded-2xl bg-gradient-to-br from-background via-card/50 to-muted/10 border border-border/30">
      <div className="absolute inset-0 overflow-hidden">
        {orbs.map((orb, i) => (
          <FloatingOrb key={i} {...orb} />
        ))}
      </div>

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,hsl(var(--background))_70%)]" />

      <div className="relative z-10 flex flex-col items-center justify-center min-h-[600px] p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center space-y-8"
        >
          <div className="space-y-2">
            <motion.h2
              className="text-3xl md:text-4xl font-display font-bold bg-gradient-to-r from-purple-400 via-blue-400 to-purple-400 bg-clip-text text-transparent bg-[length:200%_100%]"
              animate={{ backgroundPosition: ["0%", "100%", "0%"] }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            >
              Creating Your Edit
            </motion.h2>
            <AnimatePresence mode="wait">
              <motion.p
                key={currentQuoteIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.5 }}
                className="text-muted-foreground text-lg italic"
              >
                {calmingQuotes[currentQuoteIndex]}
              </motion.p>
            </AnimatePresence>
          </div>

          <PulsingRing progress={progress} />

          <div className="space-y-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentInsightIndex}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.4 }}
                className="flex items-center justify-center gap-3 text-foreground"
              >
                <CurrentIcon className="h-5 w-5 text-primary" />
                <span className="font-medium">{processingInsights[currentInsightIndex].text}</span>
              </motion.div>
            </AnimatePresence>

            <motion.p
              className="text-sm text-muted-foreground max-w-md mx-auto"
              key={message}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {message}
            </motion.p>
          </div>

          <StageIndicator stage={stage} progress={progress} />

          {progress > 0 && progress < 100 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2 }}
              className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-4"
            >
              <Clock className="h-3 w-3" />
              <span>~{Math.max(1, Math.ceil((100 - progress) / 15))} min remaining</span>
            </motion.div>
          )}

          {onCancel && (
            <motion.button
              onClick={onCancel}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Cancel and Upload New Video
            </motion.button>
          )}
        </motion.div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent pointer-events-none" />
    </div>
  );
}