/**
 * Image compression and optimization utilities for mobile & desktop.
 * Compresses camera photos (10MB+) down to web-friendly sizes (40-120KB)
 * to avoid mobile browser memory crashes and localStorage QuotaExceededError.
 */

export interface ResizeOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: "image/jpeg" | "image/webp" | "image/png";
}

/**
 * Resizes and compresses an image File using an offscreen canvas.
 * Returns a base64 Data URL.
 */
export async function resizeImageFile(
  file: File,
  options: ResizeOptions = {}
): Promise<string> {
  const {
    maxWidth = 1400,
    maxHeight = 1000,
    quality = 0.82,
    mimeType = "image/jpeg"
  } = options;

  return new Promise((resolve, reject) => {
    // If SVG, read directly as data URL without rasterizing
    if (file.type === "image/svg+xml") {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Falha ao carregar imagem para compressão."));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate aspect-ratio preserved dimensions
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        // Fill background white for JPEGs with transparent areas
        if (mimeType === "image/jpeg") {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        try {
          const dataUrl = canvas.toDataURL(mimeType, quality);
          resolve(dataUrl);
        } catch (err) {
          // Fallback to original if canvas fails
          resolve(e.target?.result as string);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Curated, ultra-fast loading, lightweight presets for backgrounds and logos.
 */
export const PRESET_BACKGROUNDS = [
  {
    id: "mesh-indigo",
    name: "Índigo Moderno",
    url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1400&auto=format&fit=crop",
    previewColor: "#4f46e5"
  },
  {
    id: "soft-gradient",
    name: "Gradiente Pastel",
    url: "https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=1400&auto=format&fit=crop",
    previewColor: "#0ea5e9"
  },
  {
    id: "clean-minimal",
    name: "Minimalista Claro",
    url: "https://images.unsplash.com/photo-1497215728101-856f4ea42174?q=80&w=1400&auto=format&fit=crop",
    previewColor: "#64748b"
  },
  {
    id: "corporate-blue",
    name: "Corporativo Elegante",
    url: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=1400&auto=format&fit=crop",
    previewColor: "#1e3a8a"
  },
  {
    id: "dark-mesh",
    name: "Executivo Dark",
    url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1400&auto=format&fit=crop",
    previewColor: "#0f172a"
  }
];

export const PRESET_LOGOS = [
  {
    id: "btg-style",
    name: "BTG Pactual / Finance",
    // Clean SVG Data URI that works 100% offline and cross-origin
    url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 50' width='160' height='50'%3E%3Crect width='160' height='50' rx='8' fill='%230B1736'/%3E%3Ctext x='20' y='32' fill='%23FFFFFF' font-family='Arial,sans-serif' font-weight='900' font-size='22' letter-spacing='2'%3EBTG%3C/text%3E%3Cpath d='M100 15 L125 15 L125 35 L100 35 Z' fill='none' stroke='%2338BDF8' stroke-width='3'/%3E%3Cpath d='M110 20 L135 20 L135 40 L110 40 Z' fill='%2338BDF8' opacity='0.7'/%3E%3C/svg%3E"
  },
  {
    id: "tech-flow",
    name: "Tecnologia & Inovação",
    url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 50' width='160' height='50'%3E%3Crect width='160' height='50' rx='8' fill='%234F46E5'/%3E%3Ccircle cx='28' cy='25' r='12' fill='%23FFFFFF'/%3E%3Cpath d='M23 25 L27 29 L33 21' stroke='%234F46E5' stroke-width='3' fill='none' stroke-linecap='round'/%3E%3Ctext x='48' y='31' fill='%23FFFFFF' font-family='Arial,sans-serif' font-weight='800' font-size='18'%3EKoyo Tech%3C/text%3E%3C/svg%3E"
  },
  {
    id: "health-plus",
    name: "Saúde & Diagnóstico",
    url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 50' width='160' height='50'%3E%3Crect width='160' height='50' rx='8' fill='%23059669'/%3E%3Cpath d='M28 17 L28 33 M20 25 L36 25' stroke='%23FFFFFF' stroke-width='4' stroke-linecap='round'/%3E%3Ctext x='48' y='31' fill='%23FFFFFF' font-family='Arial,sans-serif' font-weight='800' font-size='18'%3EClínica Viva%3C/text%3E%3C/svg%3E"
  },
  {
    id: "consulting-shield",
    name: "Consultoria Estratégica",
    url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 50' width='160' height='50'%3E%3Crect width='160' height='50' rx='8' fill='%231E293B'/%3E%3Cpolygon points='28,15 38,20 38,30 28,36 18,30 18,20' fill='%23E2E8F0'/%3E%3Ctext x='48' y='31' fill='%23FFFFFF' font-family='Arial,sans-serif' font-weight='800' font-size='17'%3EEstratégia%3C/text%3E%3C/svg%3E"
  }
];
