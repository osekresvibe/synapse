
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, 
  Sparkles, 
  Wand2, 
  Download, 
  X,
  ChevronRight,
  ChevronLeft,
  Play
} from "lucide-react";

interface OnboardingStep {
  title: string;
  description: string;
  icon: typeof Upload;
  target?: string;
  action?: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    title: "Welcome to Synapse Edit",
    description: "Transform your videos with AI-powered editing in 3 simple steps. Let's get started!",
    icon: Sparkles,
  },
  {
    title: "Upload Your Video",
    description: "Drag & drop or paste a YouTube link. We support resumable uploads for large files.",
    icon: Upload,
    target: "dropzone-resumable-upload",
  },
  {
    title: "Choose Your Output",
    description: "Tell us what you want: a single polished video, multiple clips, or let AI decide the best format.",
    icon: Wand2,
    target: "button-one-click-best",
  },
  {
    title: "AI Does the Magic",
    description: "Our AI analyzes engagement, applies color grading, and generates professional edits in ~60 seconds.",
    icon: Play,
  },
  {
    title: "Download & Share",
    description: "Export your videos with subtitles, branding, and optimized for social media platforms.",
    icon: Download,
  },
];

export function OnboardingTour() {
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem("onboarding_completed");
    if (!completed) {
      setIsVisible(true);
    } else {
      setHasCompletedOnboarding(true);
    }
  }, []);

  const handleComplete = () => {
    localStorage.setItem("onboarding_completed", "true");
    setIsVisible(false);
    setHasCompletedOnboarding(true);
  };

  const handleSkip = () => {
    handleComplete();
  };

  const nextStep = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (!isVisible) {
    return hasCompletedOnboarding ? (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 z-50"
      >
        <Sparkles className="h-4 w-4 mr-2" />
        Show Tutorial
      </Button>
    ) : null;
  }

  const step = ONBOARDING_STEPS[currentStep];
  const Icon = step.icon;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg border-2 border-primary/20 shadow-2xl">
        <CardContent className="p-8">
          <div className="flex items-center justify-between mb-6">
            <Badge variant="outline" className="text-sm">
              Step {currentStep + 1} of {ONBOARDING_STEPS.length}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSkip}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
              <Icon className="h-10 w-10 text-primary" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold">{step.title}</h2>
              <p className="text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </div>

            {step.action && (
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                <p className="text-sm text-muted-foreground">
                  💡 <strong>Pro Tip:</strong> {step.action}
                </p>
              </div>
            )}

            <div className="flex items-center justify-center gap-2 pt-4">
              {ONBOARDING_STEPS.map((_, index) => (
                <div
                  key={index}
                  className={`h-2 rounded-full transition-all ${
                    index === currentStep
                      ? "w-8 bg-primary"
                      : index < currentStep
                      ? "w-2 bg-primary/50"
                      : "w-2 bg-muted"
                  }`}
                />
              ))}
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 0}
                className="flex-1"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={nextStep}
                className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                {currentStep === ONBOARDING_STEPS.length - 1 ? (
                  <>
                    Get Started
                    <Sparkles className="h-4 w-4 ml-2" />
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="text-muted-foreground"
            >
              Skip Tutorial
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
