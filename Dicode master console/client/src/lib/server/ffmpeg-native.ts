import { Buffer } from "node:buffer";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { writeFile, readFile, unlink } from "node:fs/promises";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

const BUILTIN_CANDIDATES = [
  join(process.cwd(), "bin", "ffmpeg"),
  join(process.cwd(), "..", "bin", "ffmpeg"),
  "/usr/local/bin/ffmpeg",
  "/usr/bin/ffmpeg",
];

export const resolveFfmpegBinaryPath = () => {
  const explicit =
    process.env.FFMPEG_PATH
    || process.env.FUNCTIONS_FFMPEG_PATH
    || process.env.VIDEO_GEN_FFMPEG_PATH;
  if (explicit) {
    return explicit;
  }
  for (const candidate of BUILTIN_CANDIDATES) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return "ffmpeg";
};

const ensureFile = async (name: string, data: Uint8Array | ArrayBuffer | Buffer) => {
  const payload =
    data instanceof Uint8Array
      ? Buffer.from(data)
      : data instanceof ArrayBuffer
        ? Buffer.from(new Uint8Array(data))
        : Buffer.from(data);
  await writeFile(name, payload);
};

type VideoSource =
  | { data: Uint8Array | ArrayBuffer | Buffer; extension?: string }
  | { path: string };

const ensureInputPath = async (input: VideoSource, defaultExtension: string) => {
  if ("path" in input) {
    return {
      path: input.path,
      cleanup: async () => {},
    };
  }

  const extension = input.extension ?? defaultExtension;
  const tempPath = join(tmpdir(), `${randomUUID()}.${extension}`);
  await ensureFile(tempPath, input.data);

  return {
    path: tempPath,
    cleanup: async () => {
      await unlink(tempPath).catch(() => undefined);
    },
  };
};

export const captureLastFrameNative = async (input: VideoSource, extension = "mp4") => {
  const { path: inputPath, cleanup } = await ensureInputPath(input, extension);
  const outputName = join(tmpdir(), `${randomUUID()}.png`);
  console.log(`[ffmpeg] Extracting frame from ${inputPath} to ${outputName}`);
  try {
    const ffmpegPath = resolveFfmpegBinaryPath();
    console.log(`[ffmpeg] Using ffmpeg binary at: ${ffmpegPath}`);
    console.log(`[ffmpeg] Input path exists: ${existsSync(inputPath)}`);

    // Extract the last frame using reverse filter
    // This reads all frames, reverses them, and takes the first (which was the last)
    const { stdout, stderr } = await execFileAsync(ffmpegPath, [
      "-i",
      inputPath,
      "-vf",
      "reverse,select=eq(n\\,0)",
      "-vframes",
      "1",
      "-q:v",
      "2",
      "-y",  // Overwrite output file
      outputName,
    ]);

    console.log(`[ffmpeg] FFmpeg stdout:`, stdout);
    if (stderr) console.log(`[ffmpeg] FFmpeg stderr:`, stderr);
    console.log(`[ffmpeg] Output file exists: ${existsSync(outputName)}`);

    const frame = await readFile(outputName);
    console.log(`[ffmpeg] Successfully read frame, size: ${frame.length} bytes`);
    return new Uint8Array(frame);
  } catch (error) {
    console.error(`[ffmpeg] Error extracting frame:`, error);
    throw error;
  } finally {
    await Promise.allSettled([cleanup(), unlink(outputName)]);
  }
};

export const concatVideosNative = async (
  inputs: VideoSource[],
  outputExtension = "mp4",
) => {
  const ffmpegPath = resolveFfmpegBinaryPath();
  const prepared = await Promise.all(inputs.map((entry) => ensureInputPath(entry, "mp4")));
  const tempFiles = prepared.map((entry) => entry.path);

  const listFile = join(tmpdir(), `${randomUUID()}.txt`);
  const outputFile = join(tmpdir(), `${randomUUID()}.${outputExtension}`);
  try {
    const listContent = tempFiles.map((file) => `file '${file}'`).join("\n");
    await writeFile(listFile, listContent);

    await execFileAsync(ffmpegPath, [
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listFile,
      "-c",
      "copy",
      outputFile,
    ]);

    const output = await readFile(outputFile);
    return new Uint8Array(output);
  } finally {
    await Promise.allSettled([
      unlink(listFile),
      unlink(outputFile),
      ...prepared.map((entry) => entry.cleanup()),
    ]);
  }
};

