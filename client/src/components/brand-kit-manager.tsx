
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Upload, Palette, Type, Image as ImageIcon } from "lucide-react";

interface BrandKit {
  id: string;
  name: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  watermarkText?: string;
}

export function BrandKitManager() {
  const { toast } = useToast();
  const [brandKit, setBrandKit] = useState<BrandKit>({
    id: "default",
    name: "My Brand",
    primaryColor: "#000000",
    secondaryColor: "#FFFFFF",
    fontFamily: "Arial"
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('logo', file);

    try {
      const response = await fetch('/api/brand-kit/upload-logo', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const { url } = await response.json();
        setBrandKit({ ...brandKit, logoUrl: url });
        toast({
          title: "Logo uploaded",
          description: "Your brand logo has been saved"
        });
      }
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Could not upload logo",
        variant: "destructive"
      });
    }
  };

  return (
    <Card className="p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Brand Kit Settings
        </h3>
      </div>

      {/* Logo Upload */}
      <div className="space-y-2">
        <Label htmlFor="logo-upload" className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4" />
          Brand Logo
        </Label>
        <div className="flex items-center gap-4">
          {brandKit.logoUrl && (
            <img 
              src={brandKit.logoUrl} 
              alt="Brand logo" 
              className="h-12 w-12 object-contain border rounded"
            />
          )}
          <Input
            id="logo-upload"
            type="file"
            accept="image/*"
            onChange={handleLogoUpload}
          />
        </div>
      </div>

      {/* Colors */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="primary-color">Primary Color</Label>
          <div className="flex items-center gap-2">
            <Input
              id="primary-color"
              type="color"
              value={brandKit.primaryColor}
              onChange={(e) => setBrandKit({ ...brandKit, primaryColor: e.target.value })}
              className="w-16 h-10"
            />
            <Input
              value={brandKit.primaryColor}
              onChange={(e) => setBrandKit({ ...brandKit, primaryColor: e.target.value })}
              className="flex-1"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="secondary-color">Secondary Color</Label>
          <div className="flex items-center gap-2">
            <Input
              id="secondary-color"
              type="color"
              value={brandKit.secondaryColor}
              onChange={(e) => setBrandKit({ ...brandKit, secondaryColor: e.target.value })}
              className="w-16 h-10"
            />
            <Input
              value={brandKit.secondaryColor}
              onChange={(e) => setBrandKit({ ...brandKit, secondaryColor: e.target.value })}
              className="flex-1"
            />
          </div>
        </div>
      </div>

      {/* Font */}
      <div className="space-y-2">
        <Label htmlFor="font-family" className="flex items-center gap-2">
          <Type className="h-4 w-4" />
          Brand Font
        </Label>
        <Input
          id="font-family"
          value={brandKit.fontFamily}
          onChange={(e) => setBrandKit({ ...brandKit, fontFamily: e.target.value })}
          placeholder="e.g., Arial, Helvetica, Roboto"
        />
      </div>

      {/* Watermark */}
      <div className="space-y-2">
        <Label htmlFor="watermark">Watermark Text (Optional)</Label>
        <Input
          id="watermark"
          value={brandKit.watermarkText || ""}
          onChange={(e) => setBrandKit({ ...brandKit, watermarkText: e.target.value })}
          placeholder="e.g., @yourbrand or yourbrand.com"
        />
      </div>

      <Button 
        onClick={() => {
          // Save to backend
          fetch('/api/brand-kit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(brandKit)
          });
          toast({
            title: "Brand kit saved",
            description: "Your branding will be applied to future videos"
          });
        }}
        className="w-full"
      >
        Save Brand Kit
      </Button>
    </Card>
  );
}
