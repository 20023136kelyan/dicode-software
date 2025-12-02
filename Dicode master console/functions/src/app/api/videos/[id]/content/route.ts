const asVariant = (value: string | null): "video" | "thumbnail" | "spritesheet" | undefined => {
    if (!value) return undefined;
    if (value === "video" || value === "thumbnail" || value === "spritesheet") {
        return value;
    }
    return undefined;
};

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
        console.error("❌ OPENAI_API_KEY not configured");
        return Response.json({ error: { message: "OPENAI_API_KEY is not configured" } }, { status: 500 });
    }

    try {
        const { id } = await params;
        const videoId = typeof id === "string" ? id.trim() : "";
        
        if (!videoId) {
            return Response.json({ error: { message: "Video ID is required" } }, { status: 400 });
        }

        const url = new URL(request.url);
        const variant = asVariant(url.searchParams.get("variant"));

        console.log(`🎥 Fetching video content for ${videoId}, variant: ${variant || "video"}`);

        // Always try to fetch from OpenAI first
        const OpenAI = (await import("openai")).default;
        const client = new OpenAI({ apiKey });

        try {
            const request = client.get(`/videos/${videoId}/content`, {
                query: variant ? { variant } : undefined,
                headers: { Accept: "application/binary" },
                __binaryResponse: true,
            } as any);

            const apiResponse = await request.asResponse();
            const arrayBuffer = await apiResponse.arrayBuffer();
            const contentType = apiResponse.headers.get("content-type")
                || (variant === "thumbnail" ? "image/png" : "video/mp4");

            console.log(`✅ Successfully fetched ${contentType} from OpenAI`);

            return new Response(arrayBuffer, {
                status: 200,
                headers: {
                    "Content-Type": contentType,
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Credentials": "true",
                },
            });
        } catch (error) {
            console.error(`❌ Failed to fetch video content from OpenAI for ${videoId}:`, error);
            return Response.json({ error: { message: "Failed to fetch video content" } }, { status: 404 });
        }
    } catch (error) {
        console.error("get-video-content error", error);
        return Response.json({ error: { message: "Failed to fetch video content" } }, { status: 500 });
    }
}
