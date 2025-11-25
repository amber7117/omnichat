import OpenAI from "openai";
import { logger } from "../../utils/logger";
import fs from "fs";
import path from "path";
import os from "os";

export class TranscriptionService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL,
    });
  }

  async transcribeAudio(audioBuffer: Buffer, filename: string = "audio.mp3"): Promise<string> {
    const tempFilePath = path.join(os.tmpdir(), `transcribe-${Date.now()}-${filename}`);
    try {
      fs.writeFileSync(tempFilePath, audioBuffer);
      
      const response = await this.openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: "whisper-1",
      });

      return response.text;
    } catch (error) {
      logger.error({ error }, "Transcription failed");
      return "";
    } finally {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
  }

  async summarizeVideo(transcription: string): Promise<string> {
    if (!transcription) return "";
    
    try {
      const response = await this.openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant. Summarize the following video transcription concisely.",
          },
          {
            role: "user",
            content: transcription,
          },
        ],
      });

      return response.choices[0]?.message?.content || "";
    } catch (error) {
      logger.error({ error }, "Video summarization failed");
      return "";
    }
  }
}

export const transcriptionService = new TranscriptionService();
