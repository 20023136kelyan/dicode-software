import { Buffer } from "node:buffer";
import {
  coerceVideoModel,
  coerceVideoSeconds,
  coerceVideoSize,
  describeError,
  isRecord,
  normalizeVideoResponse,
  resolveErrorStatus,
  VideoRequestPayload,
} from "@/lib/sora";

type VideoCreateParams = {
  prompt: string;
  model: string;
  size: string;
  seconds: string;
};

export async function POST(request: Request) {
  console.log("🎬 generate-video POST called");
  
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    const message = "OPENAI_API_KEY is not configured";
    console.error("❌ OPENAI_API_KEY missing");
    return Response.json({ error: { message } }, { status: 500 });
  }
  
  console.log("✅ OPENAI_API_KEY found");

  let rawPayload: unknown;
  try {
    rawPayload = await request.json();
    console.log("✅ Request JSON parsed successfully");
  } catch (error) {
    console.error("❌ Failed to parse JSON:", error);
    return Response.json(
      { error: { message: "Invalid JSON payload" } },
      { status: 400 }
    );
  }

  const payload = isRecord(rawPayload) ? rawPayload : {};
  console.log("📦 Payload keys:", Object.keys(payload));

  const prompt =
    typeof payload.prompt === "string" ? payload.prompt.trim() : "";
  if (!prompt) {
    console.error("❌ Prompt missing or empty");
    return Response.json(
      { error: { message: "Prompt is required" } },
      { status: 400 }
    );
  }
  console.log("✅ Prompt validated:", prompt.substring(0, 50));

  const model = coerceVideoModel(
    typeof payload.model === "string" ? payload.model : null
  );
  const size = coerceVideoSize(
    typeof payload.size === "string" ? payload.size : null
  );
  const seconds = coerceVideoSeconds(
    payload.seconds != null ? String(payload.seconds) : null
  );
  console.log(`✅ Video params: model=${model}, size=${size}, seconds=${seconds}`);

  const imageData = isRecord(payload.image) ? payload.image : null;
  if (imageData) {
    console.log("🖼️ Image data found in payload");
  }

  const videoPayload: VideoRequestPayload = {
    prompt,
    model,
    size,
    seconds,
  };

  try {
    console.log("🚀 Starting OpenAI API call...");
    const endpointBase =
      process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1";
    const endpoint = `${endpointBase.replace(/\/$/, "")}/videos`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
    };

    const organization = process.env.OPENAI_ORG_ID?.trim();
    if (organization) {
      headers["OpenAI-Organization"] = organization;
    }
    const project = process.env.OPENAI_PROJECT_ID?.trim();
    if (project) {
      headers["OpenAI-Project"] = project;
    }

    let response: Response;
    if (imageData?.data != null) {
      console.log("🖼️ Using FormData (with image)");
      const formData = new FormData();
      formData.set("prompt", prompt);
      formData.set("model", model);
      formData.set("size", size);
      formData.set("seconds", seconds);

      const buffer = Buffer.from(String(imageData.data), "base64");
      const mimeType =
        typeof imageData.mimeType === "string" && imageData.mimeType.trim()
          ? imageData.mimeType
          : "image/png";
      const filename =
        typeof imageData.name === "string" && imageData.name.trim()
          ? imageData.name.trim()
          : "input-reference";
      const blob = new Blob([buffer], { type: mimeType });
      formData.append("input_reference", blob, filename);

      console.log(`📡 Sending FormData request to ${endpoint}`);
      response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: formData,
      });
      console.log("✅ FormData request completed");
    } else {
      console.log("📝 Using JSON payload (no image)");
      headers["Content-Type"] = "application/json";
      const payload: VideoCreateParams = {
        prompt,
        model,
        size,
        seconds,
      };
      console.log(`📡 Sending JSON request to ${endpoint}`);
      console.log("📦 Request payload:", JSON.stringify(payload));
      response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      console.log("✅ JSON request completed");
    }

    console.log(`📡 OpenAI response status: ${response.status}`);
    
    const result = await response.json().catch((err) => {
      console.error("❌ Failed to parse OpenAI response as JSON:", err);
      return null;
    });
    
    if (!response.ok || !result) {
      console.error(`❌ OpenAI API error. Status: ${response.status}, Result:`, result);
      const message = describeError(result, "Failed to create video");
      const derivedStatus = result ? resolveErrorStatus(result) : undefined;
      const status =
        typeof derivedStatus === "number" && derivedStatus > 0
          ? derivedStatus
          : response.status || 500;
      console.error(`❌ Returning error with status ${status}: ${message}`);
      return Response.json({ error: { message } }, { status });
    }

    console.log("✅ Video creation successful");
    const normalized = normalizeVideoResponse(result, videoPayload);
    return Response.json(normalized);
  } catch (error) {
    console.error("❌ CATCH BLOCK - generate-video error:", error);
    console.error("❌ Error type:", error instanceof Error ? error.constructor.name : typeof error);
    console.error("❌ Error message:", error instanceof Error ? error.message : String(error));
    const message = describeError(error, "Failed to create video");
    const status = resolveErrorStatus(error);
    console.error(`❌ Returning error response: status=${status}, message=${message}`);
    return Response.json({ error: { message } }, { status });
  }
}

