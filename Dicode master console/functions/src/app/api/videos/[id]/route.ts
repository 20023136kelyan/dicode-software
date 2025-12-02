import OpenAI from "openai";
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
import { getFirestore } from "firebase-admin/firestore";
import { getApps, initializeApp } from "firebase-admin/app";

if (getApps().length === 0) {
    initializeApp();
}

const db = getFirestore();

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
        console.error("❌ OPENAI_API_KEY not configured");
        return Response.json({ error: { message: "OPENAI_API_KEY is not configured" } }, { status: 500 });
    }

    const client = new OpenAI({ apiKey });

    try {
        const { id } = await params;
        const videoId = typeof id === "string" ? id.trim() : "";

        if (!videoId) {
            return Response.json({ error: { message: "Video ID is required" } }, { status: 400 });
        }

        console.log(`🔍 Polling OpenAI for video status: ${videoId}`);
        
        try {
            console.log(`📡 Calling OpenAI API: GET /videos/${videoId}`);
            const video = await client.get(`/videos/${videoId}`);
            console.log(`✅ OpenAI response:`, JSON.stringify(video).substring(0, 200));
            const videoRecord = isRecord(video) ? video : {};

            const prompt = typeof videoRecord.prompt === "string" && videoRecord.prompt.trim()
                ? videoRecord.prompt.trim()
                : "";

            const fallback: VideoRequestPayload = {
                prompt,
                model: coerceVideoModel(typeof videoRecord.model === "string" ? videoRecord.model : null),
                size: coerceVideoSize(typeof videoRecord.size === "string" ? videoRecord.size : null),
                seconds: coerceVideoSeconds(
                    videoRecord.seconds !== undefined && videoRecord.seconds !== null
                        ? String(videoRecord.seconds)
                        : null
                ),
            };

            const normalized = normalizeVideoResponse(video, fallback);
            console.log(`📦 Normalized response status: ${normalized.status}`);
            return Response.json(normalized);
        } catch (error) {
            console.error(`❌ OpenAI API error for ${videoId}:`, error);
            const message = describeError(error, "Failed to fetch video from OpenAI");
            const status = resolveErrorStatus(error);
            return Response.json({ error: { message } }, { status });
        }
    } catch (error) {
        console.error("get-video error", error);
        return Response.json({ error: { message: "Failed to fetch video" } }, { status: 500 });
    }
}
