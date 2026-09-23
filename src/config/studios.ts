import type { StudioId } from "@/lib/catalog/types";

export interface StudioConfig {
  id: StudioId;
  path: `/${string}`;
  title: string;
  tagline: string;
  promptPlaceholder: string;
  defaultModelId: string;
  /** Parameters shown as a dedicated panel instead of under "More". */
  featured?: { title: string; keys: string[] };
}

export const STUDIOS: Record<StudioId, StudioConfig> = {
  image: {
    id: "image",
    path: "/image",
    title: "Image",
    tagline: "Generate and edit images",
    promptPlaceholder: "Describe the image you want to create…",
    defaultModelId: "marketing-studio-image/sunburst",
  },
  video: {
    id: "video",
    path: "/video",
    title: "Video",
    tagline: "Text, image and reference to video, edit and extend",
    promptPlaceholder: "Describe the shot…",
    defaultModelId: "seedance-2-5/text-to-video",
  },
  cinema: {
    id: "cinema",
    path: "/cinema",
    title: "Cinema",
    tagline: "Direct a shot with camera, lens, light and grade",
    promptPlaceholder: "Describe the scene. Leave any camera setting on Auto to let the director choose…",
    defaultModelId: "cinema-studio-4/generate",
    featured: {
      title: "Director controls",
      keys: ["camera_model", "camera_lens", "camera_aperture", "camera_movement", "genre", "era", "light", "pacing", "color_palette"],
    },
  },
  motion: {
    id: "motion",
    path: "/motion",
    title: "Motion",
    tagline: "Transfer motion from a video onto your characters",
    promptPlaceholder: "Optional: describe the performance or the swap…",
    defaultModelId: "kling-3-motion-control/pro",
  },
};

export const STUDIO_ORDER: StudioId[] = ["image", "video", "cinema", "motion"];
