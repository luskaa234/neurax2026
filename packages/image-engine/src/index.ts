export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_MAX_COUNT = 5;
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

export interface ImageComponent {
  name: string;
  type: string;
  bounds?: { x: number; y: number; width: number; height: number };
}

export interface ImageAnalysisResult {
  summary: string;
  layout: string[];
  components: ImageComponent[];
}

export function validateImages(files: File[]): void {
  if (files.length === 0) throw new Error("At least one image is required");
  if (files.length > IMAGE_MAX_COUNT) throw new Error("Maximum 5 images allowed");

  for (const file of files) {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      throw new Error(`Unsupported image type: ${file.type}`);
    }
    if (file.size > IMAGE_MAX_BYTES) {
      throw new Error(`Image exceeds 5MB limit: ${file.name}`);
    }
  }
}

export async function analyzeImages(files: File[]): Promise<ImageAnalysisResult> {
  validateImages(files);

  return {
    summary: "Visual input processed",
    layout: ["header", "content", "footer"],
    components: files.map((file, index) => ({
      name: `image-${index + 1}-${file.name}`,
      type: "visual-reference",
    })),
  };
}
