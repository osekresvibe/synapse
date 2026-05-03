import fs from 'fs';
import path from 'path';

const LUTS_DIR = path.join(process.cwd(), 'server', 'luts');

// Ensure directory exists
if (!fs.existsSync(LUTS_DIR)) {
  fs.mkdirSync(LUTS_DIR, { recursive: true });
}

// Color transform functions that mirror our FFmpeg filter presets
type ColorTransform = (r: number, g: number, b: number) => [number, number, number];

// Clamp values to [0, 1]
const clamp = (v: number) => Math.max(0, Math.min(1, v));

// Apply contrast
const applyContrast = (v: number, contrast: number) => {
  return clamp((v - 0.5) * contrast + 0.5);
};

// Apply brightness
const applyBrightness = (v: number, brightness: number) => {
  return clamp(v + brightness);
};

// Apply saturation
const applySaturation = (rgb: [number, number, number], saturation: number): [number, number, number] => {
  const [r, g, b] = rgb;
  const gray = 0.299 * r + 0.587 * g + 0.114 * b;
  return [
    clamp(gray + saturation * (r - gray)),
    clamp(gray + saturation * (g - gray)),
    clamp(gray + saturation * (b - gray))
  ];
};

// Color transform presets matching our FFmpeg filters
const transforms: Record<string, ColorTransform> = {
  instagram: (r, g, b) => {
    // eq=contrast=1.3:brightness=0.08:saturation=1.6
    r = applyContrast(r, 1.3);
    g = applyContrast(g, 1.3);
    b = applyContrast(b, 1.3);
    r = applyBrightness(r, 0.08);
    g = applyBrightness(g, 0.08);
    b = applyBrightness(b, 0.08);
    [r, g, b] = applySaturation([r, g, b], 1.6);
    return [r, g, b];
  },

  tiktok: (r, g, b) => {
    // eq=contrast=1.4:brightness=0.1:saturation=1.5
    r = applyContrast(r, 1.4);
    g = applyContrast(g, 1.4);
    b = applyContrast(b, 1.4);
    r = applyBrightness(r, 0.1);
    g = applyBrightness(g, 0.1);
    b = applyBrightness(b, 0.1);
    [r, g, b] = applySaturation([r, g, b], 1.5);
    return [r, g, b];
  },

  youtube: (r, g, b) => {
    // eq=contrast=1.15:brightness=0.05:saturation=1.1
    r = applyContrast(r, 1.15);
    g = applyContrast(g, 1.15);
    b = applyContrast(b, 1.15);
    r = applyBrightness(r, 0.05);
    g = applyBrightness(g, 0.05);
    b = applyBrightness(b, 0.05);
    [r, g, b] = applySaturation([r, g, b], 1.1);
    return [r, g, b];
  },

  vibrant: (r, g, b) => {
    // eq=contrast=1.2:brightness=0.05:saturation=1.5
    r = applyContrast(r, 1.2);
    g = applyContrast(g, 1.2);
    b = applyContrast(b, 1.2);
    r = applyBrightness(r, 0.05);
    g = applyBrightness(g, 0.05);
    b = applyBrightness(b, 0.05);
    [r, g, b] = applySaturation([r, g, b], 1.5);
    return [r, g, b];
  },

  corporate: (r, g, b) => {
    // eq=contrast=1.1:brightness=0:saturation=0.9
    r = applyContrast(r, 1.1);
    g = applyContrast(g, 1.1);
    b = applyContrast(b, 1.1);
    [r, g, b] = applySaturation([r, g, b], 0.9);
    return [r, g, b];
  },

  cinematic: (r, g, b) => {
    // eq=contrast=1.15:brightness=-0.02:saturation=0.85
    r = applyContrast(r, 1.15);
    g = applyContrast(g, 1.15);
    b = applyContrast(b, 1.15);
    r = applyBrightness(r, -0.02);
    g = applyBrightness(g, -0.02);
    b = applyBrightness(b, -0.02);
    [r, g, b] = applySaturation([r, g, b], 0.85);
    return [r, g, b];
  },

  dramatic: (r, g, b) => {
    // eq=contrast=1.5:brightness=-0.15:saturation=0.8
    r = applyContrast(r, 1.5);
    g = applyContrast(g, 1.5);
    b = applyContrast(b, 1.5);
    r = applyBrightness(r, -0.15);
    g = applyBrightness(g, -0.15);
    b = applyBrightness(b, -0.15);
    [r, g, b] = applySaturation([r, g, b], 0.8);
    return [r, g, b];
  },

  pastel: (r, g, b) => {
    // eq=contrast=0.9:brightness=0.12:saturation=0.65
    r = applyContrast(r, 0.9);
    g = applyContrast(g, 0.9);
    b = applyContrast(b, 0.9);
    r = applyBrightness(r, 0.12);
    g = applyBrightness(g, 0.12);
    b = applyBrightness(b, 0.12);
    [r, g, b] = applySaturation([r, g, b], 0.65);
    return [r, g, b];
  },

  neon: (r, g, b) => {
    // eq=contrast=1.4:brightness=0.05:saturation=1.8
    r = applyContrast(r, 1.4);
    g = applyContrast(g, 1.4);
    b = applyContrast(b, 1.4);
    r = applyBrightness(r, 0.05);
    g = applyBrightness(g, 0.05);
    b = applyBrightness(b, 0.05);
    [r, g, b] = applySaturation([r, g, b], 1.8);
    return [r, g, b];
  },

  vintage: (r, g, b) => {
    // eq=contrast=0.95:brightness=0.08:saturation=0.7
    r = applyContrast(r, 0.95);
    g = applyContrast(g, 0.95);
    b = applyContrast(b, 0.95);
    r = applyBrightness(r, 0.08);
    g = applyBrightness(g, 0.08);
    b = applyBrightness(b, 0.08);
    [r, g, b] = applySaturation([r, g, b], 0.7);
    return [r, g, b];
  },

  noir: (r, g, b) => {
    // Black and white: eq=contrast=1.5:saturation=0
    r = applyContrast(r, 1.5);
    g = applyContrast(g, 1.5);
    b = applyContrast(b, 1.5);
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    return [gray, gray, gray];
  },

  golden: (r, g, b) => {
    // eq=contrast=1.15:brightness=0.05:saturation=1.2 + warm tint
    r = applyContrast(r, 1.15);
    g = applyContrast(g, 1.15);
    b = applyContrast(b, 1.15);
    r = applyBrightness(r, 0.05);
    g = applyBrightness(g, 0.05);
    b = applyBrightness(b, 0.05);
    [r, g, b] = applySaturation([r, g, b], 1.2);
    // Warm tint: boost red, reduce blue
    r = clamp(r * 1.1);
    b = clamp(b * 0.9);
    return [r, g, b];
  },

  sunset: (r, g, b) => {
    // eq=contrast=1.25:brightness=0.03:saturation=1.3 + warm tint
    r = applyContrast(r, 1.25);
    g = applyContrast(g, 1.25);
    b = applyContrast(b, 1.25);
    r = applyBrightness(r, 0.03);
    g = applyBrightness(g, 0.03);
    b = applyBrightness(b, 0.03);
    [r, g, b] = applySaturation([r, g, b], 1.3);
    // Sunset warm tint
    r = clamp(r * 1.15);
    g = clamp(g * 0.95);
    b = clamp(b * 0.85);
    return [r, g, b];
  },

  highcontrast: (r, g, b) => {
    // eq=contrast=1.4:brightness=0:saturation=1.15
    r = applyContrast(r, 1.4);
    g = applyContrast(g, 1.4);
    b = applyContrast(b, 1.4);
    [r, g, b] = applySaturation([r, g, b], 1.15);
    return [r, g, b];
  },
};

// Generate a 17-point 3D LUT for a given preset
export function generate3DLUT(preset: string): string {
  const transform = transforms[preset];
  if (!transform) {
    throw new Error(`Unknown preset: ${preset}`);
  }

  const size = 17;
  const lines: string[] = [];

  // Header
  lines.push(`TITLE "${preset.charAt(0).toUpperCase() + preset.slice(1)}"`);
  lines.push(`LUT_3D_SIZE ${size}`);

  // Generate all 17³ = 4913 color entries
  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        // Normalize to [0, 1]
        const rNorm = r / (size - 1);
        const gNorm = g / (size - 1);
        const bNorm = b / (size - 1);

        // Apply transform
        const [rOut, gOut, bOut] = transform(rNorm, gNorm, bNorm);

        // Write entry
        lines.push(`${rOut.toFixed(6)} ${gOut.toFixed(6)} ${bOut.toFixed(6)}`);
      }
    }
  }

  return lines.join('\n');
}

// Export list of all available LUT presets
export function getLUTPresets(): string[] {
  return Object.keys(transforms);
}

// Generate all LUT files
export function generateAllLUTs(): void {
  console.log('[LUT Generator] Generating complete 3D LUTs...');

  const presets = getLUTPresets();
  let generated = 0;

  for (const preset of presets) {
    const lutPath = path.join(LUTS_DIR, `${preset}.cube`);
    const content = generate3DLUT(preset);
    
    fs.writeFileSync(lutPath, content);
    
    // Verify entry count
    const lines = content.split('\n');
    const entries = lines.length - 2; // Minus TITLE and LUT_3D_SIZE
    
    if (entries === 4913) {
      console.log(`[LUT Generator] ✅ ${preset}.cube (${entries} entries)`);
      generated++;
    } else {
      console.error(`[LUT Generator] ❌ ${preset}.cube has ${entries} entries, expected 4913`);
    }
  }

  console.log(`[LUT Generator] Generated ${generated}/${presets.length} LUTs`);
  
  if (generated !== presets.length) {
    throw new Error(`LUT generation failed: only ${generated}/${presets.length} LUTs generated successfully`);
  }
}
