export const AUDIO_MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_AUDIO_TYPES = new Set(["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/x-m4a", "audio/m4a"]);

export interface AudioTranscriptionResult {
  transcript: string;
  language?: string;
}

export function validateAudio(file: File): void {
  if (!ALLOWED_AUDIO_TYPES.has(file.type)) {
    throw new Error("Unsupported audio format. Use mp3, wav or m4a.");
  }
  if (file.size > AUDIO_MAX_BYTES) {
    throw new Error("Audio file exceeds 10MB limit.");
  }
}

export async function transcribeAudio(file: File): Promise<AudioTranscriptionResult> {
  validateAudio(file);

  if (process.env.OPENAI_API_KEY) {
    const body = new FormData();
    body.append("file", file);
    body.append("model", process.env.OPENAI_WHISPER_MODEL || "gpt-4o-mini-transcribe");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body,
    });

    if (!response.ok) throw new Error(`Whisper transcription failed (${response.status})`);
    const data = (await response.json()) as { text?: string; language?: string };
    return { transcript: data.text || "", language: data.language };
  }

  throw new Error("No transcription provider configured");
}
