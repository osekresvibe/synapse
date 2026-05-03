import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  Palmtree, 
  Briefcase, 
  Film, 
  Instagram, 
  Video, 
  Youtube, 
  Moon, 
  Sparkles, 
  Zap, 
  Camera, 
  Clapperboard, 
  Sunrise, 
  Sunset, 
  Contrast 
} from "lucide-react";

interface MoodPresetsProps {
  selectedMood?: string;
  onMoodSelect: (mood: string) => void;
}

const moods = [
  {
    id: "vibrant",
    label: "Vibrant Travel",
    description: "Bold colors, high energy",
    icon: Palmtree,
    gradient: "from-orange-500 to-pink-500",
  },
  {
    id: "corporate",
    label: "Classic Corporate",
    description: "Professional, clean tones",
    icon: Briefcase,
    gradient: "from-blue-600 to-indigo-600",
  },
  {
    id: "cinematic",
    label: "Soft Cinematic",
    description: "Warm, film-like quality",
    icon: Film,
    gradient: "from-purple-600 to-pink-600",
  },
  {
    id: "instagram",
    label: "Instagram Boost",
    description: "Saturated & sharp for IG",
    icon: Instagram,
    gradient: "from-pink-500 via-purple-500 to-yellow-500",
  },
  {
    id: "tiktok",
    label: "TikTok Pop",
    description: "High contrast, punchy colors",
    icon: Video,
    gradient: "from-cyan-500 to-pink-500",
  },
  {
    id: "youtube",
    label: "YouTube Clean",
    description: "Bright, clear, natural look",
    icon: Youtube,
    gradient: "from-red-500 to-white",
  },
  {
    id: "dramatic",
    label: "Dramatic Dark",
    description: "Deep shadows, moody tones",
    icon: Moon,
    gradient: "from-gray-900 to-purple-900",
  },
  {
    id: "pastel",
    label: "Pastel Dream",
    description: "Soft, muted, dreamy colors",
    icon: Sparkles,
    gradient: "from-pink-200 via-purple-200 to-blue-200",
  },
  {
    id: "neon",
    label: "Neon Night",
    description: "Electric, vibrant nightlife",
    icon: Zap,
    gradient: "from-purple-600 via-pink-500 to-cyan-400",
  },
  {
    id: "vintage",
    label: "Vintage Film",
    description: "Faded, warm, retro vibe",
    icon: Camera,
    gradient: "from-yellow-700 to-orange-800",
  },
  {
    id: "noir",
    label: "Film Noir",
    description: "Black & white, high contrast",
    icon: Clapperboard,
    gradient: "from-gray-900 to-gray-300",
  },
  {
    id: "golden",
    label: "Golden Hour",
    description: "Warm, glowing sunset tones",
    icon: Sunrise,
    gradient: "from-yellow-500 to-orange-600",
  },
  {
    id: "sunset",
    label: "Sunset Warm",
    description: "Rich oranges and purples",
    icon: Sunset,
    gradient: "from-orange-600 via-pink-500 to-purple-600",
  },
  {
    id: "highcontrast",
    label: "High Contrast",
    description: "Bold blacks & whites",
    icon: Contrast,
    gradient: "from-black to-white",
  },
];

export function MoodPresets({ selectedMood, onMoodSelect }: MoodPresetsProps) {
  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold mb-1">Color Mood</h3>
          <p className="text-sm text-muted-foreground">
            Apply a preset color grade to your videos
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {moods.map((mood) => {
            const Icon = mood.icon;
            const isSelected = selectedMood === mood.id;

            return (
              <Button
                key={mood.id}
                variant={isSelected ? "default" : "outline"}
                className={`h-auto p-4 justify-start hover-elevate ${
                  isSelected ? "" : ""
                }`}
                onClick={() => onMoodSelect(mood.id)}
                data-testid={`button-mood-${mood.id}`}
              >
                <div className="flex items-center gap-3 w-full">
                  <div
                    className={`w-10 h-10 rounded-md bg-gradient-to-br ${mood.gradient} flex items-center justify-center flex-shrink-0`}
                  >
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-medium">{mood.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {mood.description}
                    </div>
                  </div>
                </div>
              </Button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
