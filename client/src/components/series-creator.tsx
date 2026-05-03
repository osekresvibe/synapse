
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Users, Film } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Character {
  name: string;
  visualDescription: string;
  voiceId: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  gender: 'male' | 'female' | 'neutral';
}

export function SeriesCreator() {
  const [seriesTitle, setSeriesTitle] = useState("");
  const [characters, setCharacters] = useState<Character[]>([
    { name: "", visualDescription: "", voiceId: "alloy", gender: "neutral" }
  ]);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const addCharacter = () => {
    setCharacters([...characters, { name: "", visualDescription: "", voiceId: "alloy", gender: "neutral" }]);
  };

  const removeCharacter = (index: number) => {
    setCharacters(characters.filter((_, i) => i !== index));
  };

  const updateCharacter = (index: number, field: keyof Character, value: string) => {
    const updated = [...characters];
    updated[index] = { ...updated[index], [field]: value };
    setCharacters(updated);
  };

  const createSeries = async () => {
    if (!seriesTitle.trim()) {
      toast({
        title: "Error",
        description: "Please enter a series title",
        variant: "destructive",
      });
      return;
    }

    const validCharacters = characters.filter(c => c.name.trim() && c.visualDescription.trim());
    if (validCharacters.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one character with name and description",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch('/api/series/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: seriesTitle,
          characters: validCharacters,
        }),
      });

      if (!response.ok) throw new Error('Failed to create series');

      const series = await response.json();
      toast({
        title: "Series Created! 🎬",
        description: `"${seriesTitle}" with ${validCharacters.length} characters is ready for episodes`,
      });

      // Reset form
      setSeriesTitle("");
      setCharacters([{ name: "", visualDescription: "", voiceId: "alloy", gender: "neutral" }]);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Card className="border-2 border-purple-500/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Film className="h-6 w-6 text-purple-500" />
          <CardTitle>Multi-Episode Series Creator</CardTitle>
        </div>
        <CardDescription>
          Create a series with consistent AI characters across multiple episodes
          (like "History of Rome" with Caesar, Brutus, etc.)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Series Title */}
        <div className="space-y-2">
          <Label>Series Title</Label>
          <Input
            placeholder="e.g., The History of Rome"
            value={seriesTitle}
            onChange={(e) => setSeriesTitle(e.target.value)}
          />
        </div>

        {/* Character Definitions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Characters
            </Label>
            <Button size="sm" variant="outline" onClick={addCharacter}>
              <Plus className="h-4 w-4 mr-1" />
              Add Character
            </Button>
          </div>

          {characters.map((char, index) => (
            <Card key={index} className="p-4 space-y-3 bg-muted/50">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Character {index + 1}</span>
                {characters.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeCharacter(index)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>

              <div className="grid gap-3">
                <div>
                  <Label className="text-xs">Character Name</Label>
                  <Input
                    placeholder="e.g., Julius Caesar"
                    value={char.name}
                    onChange={(e) => updateCharacter(index, 'name', e.target.value)}
                  />
                </div>

                <div>
                  <Label className="text-xs">Visual Description (for AI consistency)</Label>
                  <Textarea
                    placeholder="e.g., 50-year-old Roman emperor in purple toga with laurel crown, stern expression, commanding presence"
                    value={char.visualDescription}
                    onChange={(e) => updateCharacter(index, 'visualDescription', e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Voice (TTS)</Label>
                    <Select
                      value={char.voiceId}
                      onValueChange={(value) => updateCharacter(index, 'voiceId', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="alloy">Alloy (Neutral)</SelectItem>
                        <SelectItem value="echo">Echo (Male)</SelectItem>
                        <SelectItem value="fable">Fable (British Male)</SelectItem>
                        <SelectItem value="onyx">Onyx (Deep Male)</SelectItem>
                        <SelectItem value="nova">Nova (Female)</SelectItem>
                        <SelectItem value="shimmer">Shimmer (Soft Female)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs">Gender</Label>
                    <Select
                      value={char.gender}
                      onValueChange={(value) => updateCharacter(index, 'gender', value as any)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="neutral">Neutral</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Button
          onClick={createSeries}
          disabled={isCreating}
          className="w-full"
        >
          {isCreating ? "Creating Series..." : "Create Series 🎬"}
        </Button>

        <div className="text-xs text-muted-foreground bg-purple-500/5 p-3 rounded-md">
          <strong>How it works:</strong> Define your characters once, then write episodes with character tags like
          <code className="mx-1 px-1 py-0.5 bg-background rounded">[CAESAR]: "The die is cast!"</code>
          The AI will automatically generate consistent visuals and voices for each character across all episodes.
        </div>
      </CardContent>
    </Card>
  );
}
