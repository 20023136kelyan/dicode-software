import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { join } from "path";
import { writeFile, unlink } from "fs/promises";
import { v4 as uuidv4 } from "uuid";
import { describeError, resolveErrorStatus } from "@/lib/sora";

const execAsync = promisify(exec);

interface MergeVideosPayload {
  videoPaths: string[];
}

export async function POST(request: Request) {
  // Note: In a real serverless environment like Firebase Functions,
  // we cannot easily write to disk or run ffmpeg binaries unless they are
  // explicitly bundled and we use the /tmp directory.
  // This implementation assumes a local environment or a container where ffmpeg is available.

  let payload: MergeVideosPayload;
  try {
    payload = (await request.json()) as MergeVideosPayload;
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON payload" } }, { status: 400 });
  }

  const { videoPaths } = payload;
  if (!videoPaths || !Array.isArray(videoPaths) || videoPaths.length < 2) {
    return NextResponse.json(
      { error: { message: "At least two video paths are required for merging" } },
      { status: 400 }
    );
  }

  const sequenceId = uuidv4();
  const outputFilename = `merged-${sequenceId}.mp4`;
  const tempListPath = join("/tmp", `list-${sequenceId}.txt`);
  const outputPath = join("/tmp", outputFilename);

  try {
    // create ffmpeg list file
    // file '/path/to/video1.mp4'
    // file '/path/to/video2.mp4'
    const fileContent = videoPaths.map((path) => `file '${path}'`).join("\n");
    await writeFile(tempListPath, fileContent);

    // run ffmpeg concat
    // ffmpeg -f concat -safe 0 -i list.txt -c copy output.mp4
    await execAsync(`ffmpeg -f concat -safe 0 -i "${tempListPath}" -c copy "${outputPath}"`);

    // Clean up list file
    await unlink(tempListPath);

    // In a real app, you would upload the result to cloud storage (S3/GCS/Firebase Storage)
    // and return the signed URL.
    // For this example, we'll just return the path or assume it's served statically.

    return NextResponse.json({
      sequence_id: sequenceId,
      url: `/api/download/${sequenceId}/0`, // Placeholder URL
      path: outputPath,
    });
  } catch (error) {
    const message = describeError(error, "Failed to merge videos");
    const status = resolveErrorStatus(error);
    return NextResponse.json({ error: { message } }, { status });
  }
}

