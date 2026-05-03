import { Card } from "@/components/ui/card";
import {
  MessageSquare,
  Palette,
  Smartphone,
  Scissors,
  TrendingUp,
} from "lucide-react";

interface Feature {
  id: string;
  title: string;
  description: string;
  icon: typeof MessageSquare;
}

const features: Feature[] = [
  {
    id: "intent-driven",
    title: "Intent Driven",
    description: "Don't micromanage clips. Tell Synapse 'Make it high energy' or 'Focus on the product', and watch it assemble.",
    icon: MessageSquare,
  },
  {
    id: "style-matching",
    title: "Style Matching",
    description: "Upload a reference video. Synapse analyzes the pacing, color grading, and transitions to mimic the vibe.",
    icon: Palette,
  },
  {
    id: "one-click-formats",
    title: "One-Click Formats",
    description: "Instantly reframe and re-edit your main timeline for TikTok, Reels, and YouTube Shorts.",
    icon: Smartphone,
  },
  {
    id: "smart-clip-selection",
    title: "Smart Clip Selection",
    description: "AI identifies the best moments from your footage - high energy intros, key features, emotional peaks.",
    icon: Scissors,
  },
  {
    id: "distribution-intelligence",
    title: "Distribution Intelligence",
    description: "Predict virality, optimize for each platform, and get AI-powered captions and hashtags.",
    icon: TrendingUp,
  },
];

export function FeatureHighlights() {
  return (
    <section className="py-20">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.slice(0, 3).map((feature) => (
            <FeatureCard key={feature.id} feature={feature} />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 max-w-4xl mx-auto">
          {features.slice(3).map((feature) => (
            <FeatureCard key={feature.id} feature={feature} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ feature }: { feature: Feature }) {
  const Icon = feature.icon;
  
  return (
    <Card 
      className="p-6 bg-card/50 border-border/50 hover-elevate transition-all duration-200"
      data-testid={`feature-card-${feature.id}`}
    >
      <div className="space-y-4">
        <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">{feature.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {feature.description}
          </p>
        </div>
      </div>
    </Card>
  );
}
