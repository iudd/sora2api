// API routes for Deno - OpenAI compatible endpoints
import { Router, Middleware } from "oak";
import { verifyApiKeyHeader } from "../core/auth.ts";
import { ChatCompletionRequest, ChatCompletionResponse, ModelsResponse, ModelInfo } from "../core/models.ts";
import { GenerationHandler, MODEL_CONFIG } from "../services/generation_handler.ts";

const router = new Router();

// Dependency injection will be set up in main.ts
let generationHandler: GenerationHandler | null = null;

export function setGenerationHandler(handler: GenerationHandler): void {
  generationHandler = handler;
}

export const apiRoutes = {
  router,
  setGenerationHandler
};

// Helper function to extract remix ID
function _extractRemixId(text: string): string {
  if (!text) return "";

  // Match Sora share link format: s_[a-f0-9]{32}
  const match = text.match(/s_[a-f0-9]{32}/);
  return match ? match[0] : "";
}

// List available models
router.get("/v1/models", verifyApiKeyHeader, async (ctx) => {
  const models: ModelInfo[] = [];

  for (const modelId of Object.keys(MODEL_CONFIG)) {
    models.push({
      id: modelId,
      object: "model",
      created: Date.now(),
      owned_by: "openai"
    });
  }

  const response: ModelsResponse = {
    object: "list",
    data: models
  };

  ctx.response.body = response;
});

// Chat completions endpoint
router.post("/v1/chat/completions", verifyApiKeyHeader, async (ctx) => {
  if (!generationHandler) {
    ctx.response.status = 500;
    ctx.response.body = {
      error: {
        message: "Internal server error: generation handler not initialized",
        type: "internal_error"
      }
    };
    return;
  }

  const body = ctx.request.body({ type: "json" });
  let request: ChatCompletionRequest;

  try {
    request = await body.value;
  } catch (error) {
    ctx.response.status = 400;
    ctx.response.body = {
      error: {
        message: "Invalid JSON in request body",
        type: "invalid_request_error"
      }
    };
    return;
  }

  // Generate a unique request ID
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // Check if streaming is requested
  const stream = request.stream !== false; // Default to true if not specified

  if (stream) {
    // Stream the response
    ctx.response.type = "text/event-stream";
    ctx.response.headers.set("Cache-Control", "no-cache");
    ctx.response.headers.set("Connection", "keep-alive");

    const generator = generationHandler.handleChatCompletion(request, requestId);

    // Set up server-sent events
    const encoder = new TextEncoder();
    const writer = ctx.response.body.getWriter();

    try {
      for await (const chunk of generator) {
        // Format as SSE
        const data = `data: ${JSON.stringify(chunk)}\n\n`;
        await writer.write(encoder.encode(data));
      }

      // Send final message
      await writer.write(encoder.encode("data: [DONE]\n\n"));
      await writer.close();
    } catch (error) {
      console.error("Error in streaming response:", error);
      
      // Send error as SSE
      const errorData = {
        error: {
          message: error.message,
          type: "internal_error"
        }
      };
      
      await writer.write(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`));
      await writer.close();
    }
  } else {
    // Non-streaming response
    ctx.response.type = "application/json";
    
    try {
      const generator = generationHandler.handleChatCompletion(request, requestId);
      
      // Collect all chunks
      const chunks: ChatCompletionResponse[] = [];
      let finalContent = "";
      
      for await (const chunk of generator) {
        chunks.push(chunk);
        
        // Extract content from the last chunk
        const lastChoice = chunk.choices[chunk.choices.length - 1];
        if (lastChoice.delta?.content) {
          finalContent += lastChoice.delta.content;
        }
      }
      
      // Create the final response
      const finalChunk = chunks[chunks.length - 1];
      const response: ChatCompletionResponse = {
        id: finalChunk.id,
        object: "chat.completion",
        created: finalChunk.created,
        model: request.model,
        choices: [{
          index: 0,
          message: {
            role: "assistant",
            content: finalContent
          },
          finish_reason: finalChunk.choices[0].finish_reason || "stop"
        }],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0
        }
      };
      
      ctx.response.body = response;
    } catch (error) {
      ctx.response.status = 500;
      ctx.response.body = {
        error: {
          message: error.message,
          type: "internal_error"
        }
      };
    }
  }
});