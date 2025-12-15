// Generation handler service for Deno
import { SoraClient } from "./sora_client.ts";
import { TokenManager } from "./token_manager.ts";
import { LoadBalancer } from "./load_balancer.ts";
import { FileCache } from "./file_cache.ts";
import { ConcurrencyManager } from "./concurrency_manager.ts";
import { Database, Task, RequestLog } from "../core/database.ts";
import { config } from "../core/config.ts";
import { ChatCompletionRequest, ChatCompletionResponse, GenerationRequest } from "../core/models.ts";
import { join } from "https://deno.land/std@0.208.0/path/join.ts";
import { ensureDir } from "https://deno.land/std@0.208.0/fs/ensure_dir.ts";

export interface ModelConfig {
  type: "image" | "video";
  width?: number;
  height?: number;
  orientation?: "landscape" | "portrait";
  nFrames?: number;
}

// Model configuration
export const MODEL_CONFIG: Record<string, ModelConfig> = {
  "sora-image": {
    type: "image",
    width: 360,
    height: 360
  },
  "sora-image-landscape": {
    type: "image",
    width: 540,
    height: 360
  },
  "sora-image-portrait": {
    type: "image",
    width: 360,
    height: 540
  },
  "sora-video-10s": {
    type: "video",
    orientation: "landscape",
    nFrames: 300
  },
  "sora-video-15s": {
    type: "video",
    orientation: "landscape",
    nFrames: 450
  },
  "sora-video-landscape-10s": {
    type: "video",
    orientation: "landscape",
    nFrames: 300
  },
  "sora-video-landscape-15s": {
    type: "video",
    orientation: "landscape",
    nFrames: 450
  },
  "sora-video-portrait-10s": {
    type: "video",
    orientation: "portrait",
    nFrames: 300
  },
  "sora-video-portrait-15s": {
    type: "video",
    orientation: "portrait",
    nFrames: 450
  }
};

export class GenerationHandler {
  private soraClient: SoraClient;
  private tokenManager: TokenManager;
  private loadBalancer: LoadBalancer;
  private db: Database;
  private proxyManager: any;
  private concurrencyManager: ConcurrencyManager;
  public fileCache: FileCache;

  constructor(
    soraClient: SoraClient,
    tokenManager: TokenManager,
    loadBalancer: LoadBalancer,
    db: Database,
    proxyManager: any,
    concurrencyManager: ConcurrencyManager
  ) {
    this.soraClient = soraClient;
    this.tokenManager = tokenManager;
    this.loadBalancer = loadBalancer;
    this.db = db;
    this.proxyManager = proxyManager;
    this.concurrencyManager = concurrencyManager;
    this.fileCache = new FileCache();
  }

  async init(): Promise<void> {
    await this.fileCache.init();
    await this.fileCache.startCleanupTask();
  }

  async *handleChatCompletion(
    request: ChatCompletionRequest,
    requestId: string
  ): AsyncGenerator<ChatCompletionResponse> {
    const startTime = Date.now();
    let tokenUsed: string | null = null;
    let resultUrl: string | null = null;
    let error: string | null = null;
    let processingTime: number | null = null;

    try {
      // Get a token for this request
      tokenUsed = await this.loadBalancer.getToken();
      if (!tokenUsed) {
        throw new Error("No available tokens");
      }

      // Parse the request to extract the actual prompt and media
      const { prompt, imageData, videoData } = this.parseRequest(request);

      // Get the model configuration
      const modelConfig = MODEL_CONFIG[request.model];
      if (!modelConfig) {
        throw new Error(`Unknown model: ${request.model}`);
      }

      // Create task in database
      const taskId = await this.db.addTask({
        type: modelConfig.type,
        status: "pending",
        requestId,
        model: request.model,
        prompt,
        imageData,
        resultUrl: null,
        error: null,
        tokenUsed,
        processingTime: null
      });

      // Update task status to processing
      await this.db.updateTaskStatus(taskId, "processing");

      // Send initial response
      yield {
        id: taskId,
        object: "chat.completion.chunk",
        created: Date.now(),
        model: request.model,
        choices: [{
          index: 0,
          delta: {
            role: "assistant",
            content: "Processing your request..."
          },
          finish_reason: null
        }]
      };

      // Process the request
      let generationResult: string;

      if (modelConfig.type === "image") {
        if (imageData) {
          generationResult = await this.soraClient.generateImageFromImage(
            prompt,
            imageData,
            tokenUsed,
            modelConfig.width,
            modelConfig.height
          );
        } else {
          generationResult = await this.soraClient.generateImage(
            prompt,
            tokenUsed,
            modelConfig.width,
            modelConfig.height
          );
        }
      } else { // video
        if (imageData) {
          generationResult = await this.soraClient.generateVideoFromImage(
            prompt,
            imageData,
            tokenUsed,
            modelConfig
          );
        } else {
          generationResult = await this.soraClient.generateVideo(
            prompt,
            tokenUsed,
            modelConfig
          );
        }
      }

      resultUrl = generationResult;

      // Update task with result
      await this.db.updateTaskStatus(taskId, "completed", resultUrl);

      // Send final response
      yield {
        id: taskId,
        object: "chat.completion.chunk",
        created: Date.now(),
        model: request.model,
        choices: [{
          index: 0,
          delta: {
            content: `✅ Generation complete! [View result](${resultUrl})`
          },
          finish_reason: "stop"
        }]
      };
    } catch (e) {
      error = e.message;
      
      // Send error response
      yield {
        id: requestId,
        object: "chat.completion.chunk",
        created: Date.now(),
        model: request.model,
        choices: [{
          index: 0,
          delta: {
            content: `❌ Error: ${error}`
          },
          finish_reason: "stop"
        }]
      };
    } finally {
      // Release the token
      if (tokenUsed) {
        await this.loadBalancer.releaseToken(tokenUsed);
      }

      // Calculate processing time
      processingTime = Date.now() - startTime;

      // Log the request
      await this.db.addLog({
        timestamp: new Date().toISOString(),
        requestId,
        model: request.model,
        status: error ? "failed" : "completed",
        tokenUsed,
        processingTime,
        requestSize: JSON.stringify(request).length,
        responseSize: resultUrl ? resultUrl.length : 0,
        error
      });
    }
  }

  private parseRequest(request: ChatCompletionRequest): {
    prompt: string;
    imageData?: string;
    videoData?: string;
  } {
    const message = request.messages[request.messages.length - 1];
    let prompt = "";
    let imageData: string | undefined;
    let videoData: string | undefined;

    if (typeof message.content === "string") {
      prompt = message.content;
    } else if (Array.isArray(message.content)) {
      for (const part of message.content) {
        if (part.type === "text") {
          prompt += part.text || "";
        } else if (part.type === "image_url" && part.image_url?.url) {
          imageData = part.image_url.url;
        } else if (part.type === "video_url" && part.video_url?.url) {
          videoData = part.video_url.url;
        }
      }
    }

    return { prompt, imageData, videoData };
  }

  async getTasks(limit: number = 100, offset: number = 0): Promise<Task[]> {
    return await this.db.getTasks(limit, offset);
  }

  async getLogs(limit: number = 100, offset: number = 0): Promise<RequestLog[]> {
    return await this.db.getLogs(limit, offset);
  }

  async getStats(): Promise<Record<string, any>> {
    const stats = await this.db.getStats();
    return {
      ...stats,
      cacheStats: this.fileCache.getCacheStats(),
      tokenStats: {
        total: this.tokenManager.getTokensCount(),
        available: await this.loadBalancer.getAvailableTokensCount()
      }
    };
  }
}