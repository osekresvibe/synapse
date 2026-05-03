import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { RoadmapSection } from "@/components/roadmap-section";
import { ThemeToggle } from "@/components/theme-toggle";

export default function RoadmapPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 sticky top-0 bg-card/50 backdrop-blur-sm z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" data-testid="button-back-home" className="hover:bg-purple-500/10">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Editor
              </Button>
            </Link>
            <h1 className="text-xl font-semibold gradient-text-purple-blue">Development Roadmap</h1>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-6 py-12">
        <RoadmapSection onOpenScriptGenerator={() => {}} />
      </main>

      <footer className="border-t border-border/50 mt-24">
        <div className="container mx-auto px-6 py-8">
          <p className="text-center text-sm text-muted-foreground">
            Built with <span className="gradient-text-purple-blue font-medium">Synapse Edit</span> • Analysis-Driven Video Editing
          </p>
        </div>
      </footer>
    </div>
  );
}
