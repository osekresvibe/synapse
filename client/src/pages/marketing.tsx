
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, 
  Zap, 
  Film, 
  TrendingUp, 
  Clock, 
  Target,
  ArrowRight,
  CheckCircle2,
  Play
} from "lucide-react";

export default function Marketing() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-blue-500/10" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        
        <div className="container mx-auto px-6 py-32 relative">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20">
              <Sparkles className="h-3 w-3 mr-1" />
              AI-Powered Video Editing
            </Badge>
            
            <h1 className="text-6xl md:text-7xl font-bold leading-tight">
              <span className="text-foreground">What, Not</span>
              <br />
              <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                How to Make It
              </span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Describe your vision. Our AI analyzes your footage, understands your intent, 
              and crafts professional edits in seconds.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link href="/home">
                <Button size="lg" className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 h-14 px-8 text-lg">
                  <Sparkles className="mr-2 h-5 w-5" />
                  Start Creating
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="h-14 px-8 text-lg border-border/50 hover:border-purple-500/50">
                <Play className="mr-2 h-5 w-5" />
                Watch Demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Intent-Driven Editing
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Stop wrestling with timelines. Just tell us what you want.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          <Card className="p-6 border-border/50 bg-card/50 backdrop-blur-sm hover:border-purple-500/30 transition-all">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4">
              <Target className="h-6 w-6 text-purple-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Intent-Driven</h3>
            <p className="text-muted-foreground">
              "Make it punchy" or "cinematic feel" — AI understands natural language and edits accordingly.
            </p>
          </Card>

          <Card className="p-6 border-border/50 bg-card/50 backdrop-blur-sm hover:border-blue-500/30 transition-all">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-4">
              <Zap className="h-6 w-6 text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Instant Results</h3>
            <p className="text-muted-foreground">
              Upload raw footage, get polished edits in under 60 seconds. No timeline required.
            </p>
          </Card>

          <Card className="p-6 border-border/50 bg-card/50 backdrop-blur-sm hover:border-cyan-500/30 transition-all">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4">
              <Film className="h-6 w-6 text-cyan-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Professional Quality</h3>
            <p className="text-muted-foreground">
              AI analyzes engagement patterns, applies color grading, and adds transitions automatically.
            </p>
          </Card>
        </div>
      </section>

      {/* How It Works */}
      <section className="container mx-auto px-6 py-24 bg-muted/30 rounded-3xl">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Three Steps to Professional Videos
            </h2>
            <p className="text-muted-foreground">
              From raw footage to viral-ready content
            </p>
          </div>

          <div className="space-y-8">
            <div className="flex gap-6 items-start">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-lg">1</span>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Upload Your Footage</h3>
                <p className="text-muted-foreground">
                  Drag and drop your raw video. AI instantly analyzes content, identifies key moments, and detects engagement patterns.
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-lg">2</span>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Describe Your Vision</h3>
                <p className="text-muted-foreground">
                  "Make it energetic", "30 second hook", or "tutorial style" — AI understands intent and crafts edits to match.
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-lg">3</span>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Get Professional Results</h3>
                <p className="text-muted-foreground">
                  Download your edited video with transitions, color grading, and pacing — all optimized for maximum engagement.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="container mx-auto px-6 py-24">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold mb-1">10x Faster Than Manual Editing</h3>
                <p className="text-sm text-muted-foreground">
                  What takes hours in traditional editors takes seconds with AI
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold mb-1">No Editing Skills Required</h3>
                <p className="text-sm text-muted-foreground">
                  Just describe what you want in plain English
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold mb-1">Optimized for Engagement</h3>
                <p className="text-sm text-muted-foreground">
                  AI analyzes viral patterns to maximize viewer retention
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold mb-1">Multiple Variations</h3>
                <p className="text-sm text-muted-foreground">
                  Generate short hooks, standard edits, and comprehensive cuts
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold mb-1">Professional Color Grading</h3>
                <p className="text-sm text-muted-foreground">
                  AI applies cinema-quality color correction automatically
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold mb-1">Smart Transitions</h3>
                <p className="text-sm text-muted-foreground">
                  Context-aware transitions that match your video's mood
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-6 py-24">
        <div className="max-w-4xl mx-auto text-center">
          <Card className="p-12 border-2 border-purple-500/20 bg-gradient-to-br from-purple-500/10 via-card to-blue-500/10">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20">
                <Clock className="h-4 w-4 text-purple-400" />
                <span className="text-sm text-purple-300 font-medium">Limited Beta Access</span>
              </div>
              
              <h2 className="text-4xl font-bold">
                Ready to Edit at the Speed of Thought?
              </h2>
              
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Join creators who've saved hundreds of hours with intent-driven AI editing
              </p>
              
              <Link href="/home">
                <Button size="lg" className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 h-14 px-8 text-lg">
                  <Sparkles className="mr-2 h-5 w-5" />
                  Start Creating Free
                </Button>
              </Link>
              
              <p className="text-sm text-muted-foreground">
                No credit card required • Process your first 5 videos free
              </p>
            </div>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-24">
        <div className="container mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="font-semibold">Synapse Edit</span>
            </div>
            
            <div className="flex gap-6 text-sm text-muted-foreground">
              <Link href="/roadmap" className="hover:text-foreground transition-colors">
                Roadmap
              </Link>
              <Link href="/home" className="hover:text-foreground transition-colors">
                Editor
              </Link>
              <Link href="/admin" className="hover:text-foreground transition-colors">
                Admin
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
