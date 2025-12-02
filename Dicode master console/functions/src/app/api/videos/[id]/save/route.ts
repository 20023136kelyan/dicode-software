import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getApps, initializeApp } from "firebase-admin/app";

if (getApps().length === 0) {
    initializeApp();
}

const db = getFirestore();

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        if (!id) {
            return Response.json({ error: { message: "Video ID is required" } }, { status: 400 });
        }

        const payload = await request.json();
        const { title, description, prompt, model, size, seconds, tags } = payload;

        // Verify the video exists in generated_videos or videos
        // Actually, usually we are saving a generated video to the permanent library

        // Create new document in 'videos' collection
        const videoData = {
            title: title || "Untitled Video",
            description: description || "",
            prompt: prompt || "",
            model: model || "",
            size: size || "",
            seconds: seconds || "",
            tags: Array.isArray(tags) ? tags : [],
            originalVideoId: id,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            // We assume the client handles the file storage movement or we just reference the same URL
            // For now, let's assume we just create the metadata record
        };

        // If the source video has a downloadUrl, we should copy it. 
        // But here we might just be creating the record.
        // Let's check if we need to fetch the source video first to get its URL.

        const sourceDoc = await db.collection("generated_videos").doc(id).get();
        if (sourceDoc.exists) {
            const sourceData = sourceDoc.data();
            Object.assign(videoData, {
                downloadUrl: sourceData?.downloadUrl || sourceData?.url || "",
                thumbnailUrl: sourceData?.thumbnailUrl || "",
                duration: sourceData?.duration || sourceData?.seconds || 0,
            });
        }

        const docRef = await db.collection("videos").add(videoData);

        return Response.json({
            documentId: docRef.id,
            downloadUrl: (videoData as any).downloadUrl
        });
    } catch (error) {
        console.error("save-video error", error);
        return Response.json({ error: { message: "Failed to save video" } }, { status: 500 });
    }
}
