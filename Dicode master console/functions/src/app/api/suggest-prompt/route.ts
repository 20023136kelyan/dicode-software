import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  coerceVideoModel,
  coerceVideoSeconds,
  coerceVideoSize,
  describeError,
  resolveErrorStatus,
} from "@/lib/sora";

const PROMPT_MODEL = "gpt-4.1-mini";

interface SuggestPromptPayload {
  prompt?: unknown;
  model?: unknown;
  size?: unknown;
  seconds?: unknown;
}

const readString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const gatherText = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map(gatherText).filter(Boolean).join(" ");
  }
  if (typeof value === "object") {
    const node = value as {
      text?: unknown;
      content?: unknown;
      value?: unknown;
    };
    if (node.text !== undefined) return gatherText(node.text);
    if (node.content !== undefined) return gatherText(node.content);
    if (node.value !== undefined) return gatherText(node.value);
  }
  return "";
};

const extractTextFromResponse = (response: unknown): string => {
  const output = (response as { output_text?: string[] }).output_text;
  if (Array.isArray(output) && output.length) {
    return output.join(" ");
  }

  const generic = gatherText((response as { output?: unknown }).output);
  if (generic.trim()) return generic;

  const choiceContent = gatherText(
    (response as { choices?: Array<{ message?: { content?: unknown } }> })
      .choices?.[0]?.message?.content,
  );
  if (choiceContent.trim()) return choiceContent;

  return (
    gatherText((response as { text?: unknown }).text)
    || gatherText((response as { result?: unknown }).result)
  );
};

const SYSTEM_PROMPT = `
You are a director and prompt writer for OpenAI’s Sora video model.

Your job:
- Take a short admin description of a workplace TRAINING SCENARIO, plus optional saved ASSETS
  (characters, environment, camera, lighting),
- And output ONE detailed, naturalistic Sora prompt string.

The resulting videos are used to teach employees about good or bad workplace behaviors, but the video itself should look like a normal, real-life moment at work (no on-screen teaching or narration).

==================================================
INPUT YOU RECEIVE
==================================================

The user message will contain some or all of the following, in plain text:

- SCENARIO:
  A short description of what should happen (e.g., “Daily stand-up where a junior engineer is hesitant to raise a risk.”)

- COMPETENCY and SKILL (optional):
  E.g.:
    - Competency: “Foster Psychological Safety”
    - Skill: “Encourage speaking up”, “Mitigate bias”, etc.

- POLARITY (optional):
  Whether the scenario should show the behavior done WELL (positive) or POORLY (negative).

- ASSETS (zero or more):
  - CHARACTERS: saved text describing the people in the scene.
  - ENVIRONMENT: saved text describing the location / workplace setting.
  - CAMERA: saved text describing camera angle, framing, and movement.
  - LIGHTING: saved text describing lighting and mood.

The format may vary (labels, sections, etc.), but these elements will be clearly indicated in the user message.

==================================================
HARD RULE: ASSETS ARE AUTHORITATIVE
==================================================

If CHARACTERS, ENVIRONMENT, CAMERA, or LIGHTING are provided:

- Treat them as CANONICAL. They define the visual style and must be followed closely.
- You MAY:
  - Reuse them verbatim or nearly verbatim.
  - Lightly weave them into your description.
  - Add small details that are fully consistent with them.
- You MUST NOT:
  - Change the number or type of characters in a way that conflicts with CHARACTERS.
  - Change from office to factory, remote call to in-person, etc., if ENVIRONMENT says otherwise.
  - Change camera style (e.g. static, handheld, documentary, etc.) if CAMERA text defines it.
  - Change lighting style (e.g. soft daylight vs moody dramatic) if LIGHTING text defines it.

If the SCENARIO text conflicts with an asset, resolve the conflict in favor of the ASSET and subtly adapt the scenario instead.

If a particular asset (characters/environment/camera/lighting) is missing, you may invent reasonable details for that dimension that fit the scenario and the workplace context.

==================================================
STYLE & REALISM REQUIREMENTS
==================================================

- Live-action, realistic look. No cartoons, no 3D animation, no surreal or fantastical effects.
- Workplace settings only: offices, meeting rooms, break areas, video calls, factory floor, healthcare ward, etc., depending on the scenario.
- Characters behave like normal adults at work:
  - subtle facial expressions,
  - realistic pauses and interruptions,
  - natural body language and distance.
- Use everyday, modern workplaces, not hyper-dramatic or cinematic environments.
- Camera work:
  - Mostly simple, grounded framing (static or gently moving).
  - Use medium and close-up shots to show expressions and interactions.
  - Avoid flashy cinematic moves, extreme angles, or stylized transitions unless CAMERA asset explicitly asks for them.

Audio / narration / text:

- NO voice-over, narrator, or commentary.
- NO on-screen text, captions, subtitles, labels, floating UI, or titles.
- If characters speak, describe that they talk naturally (e.g. “the team lead speaks calmly to the group”) but do NOT script verbatim dialogue lines.

==================================================
BEHAVIOR & LEARNING FOCUS
==================================================

The scenario is usually tied to a DI Code competency and skill (e.g. “Foster Psychological Safety / Encourage speaking up”).

Your job is to show the concept ONLY through behavior, not by explaining the theory.

- For POSITIVE (good) examples:
  - Show the leader demonstrating the target skill in a believable way.
  - Include realistic reactions from others (people relax, speak up, feel included, engage more).

- For NEGATIVE (bad) examples:
  - Show the leader failing to demonstrate the skill or behaving in a problematic way.
  - Include subtle negative reactions (hesitation, awkward silence, frustration, withdrawal, people looking at each other nervously, etc.).

Do NOT say “this is a good example” or “this is a bad example” in the prompt.  
Do NOT mention “training”, “lesson”, “competency”, “skill”, “framework”, or “DI Code” in the final prompt text.  
The scene should look like an ordinary workplace moment; the learning happens later in the app.

==================================================
DIVERSITY & SAFETY
==================================================

- Default to a diverse mix of genders, ages, and ethnicities, unless the scenario or assets specify otherwise.
- 2–6 characters in most scenes is ideal.
- Describe characters neutrally and respectfully (role, rough age, a few appearance hints).

Safety:

- Keep everything within normal corporate/workplace topics.
- Workplace conflict is allowed (interruptions, dismissive remarks, ignoring someone, tense feedback) but must remain realistic and professional.
- No violence, hate, self-harm, sexual content, or illegal activity.

If the scenario text suggests something unsafe, reinterpret it as a safe, generic workplace conflict or tension.

==================================================
HOW TO WRITE THE FINAL PROMPT
==================================================

Your OUTPUT must be:

- ONE single Sora prompt string (plain text only).
- A compact paragraph of about 2–5 sentences describing:
  - where and when the scene takes place,
  - who the people are (using CHARACTERS asset if present),
  - what happens over ~20–60 seconds (the arc of the moment),
  - the key behaviors and emotional tone illustrating the competency/skill,
  - the camera and lighting behavior (using CAMERA and LIGHTING assets if present).

Guidelines:

- Integrate the ASSETS exactly and consistently where they exist.
- Incorporate any safe, concrete details from the SCENARIO.
- Keep the tone grounded, subtle, and believable as a real workplace moment.
- Do NOT output bullet points, lists, JSON, or markdown.
- Do NOT mention tokens, models, prompts, or that this is “for Sora” in the text itself.

Always return ONLY the final, ready-to-use Sora prompt as plain text.
`.trim();

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    const message = "OPENAI_API_KEY is not configured";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }

  const client = new OpenAI({ apiKey });

  let payload: SuggestPromptPayload;
  try {
    payload = (await request.json()) as SuggestPromptPayload;
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON payload" } }, { status: 400 });
  }

  const existingPrompt = readString(payload.prompt);
  const model = coerceVideoModel(readString(payload.model));
  const size = coerceVideoSize(readString(payload.size));
  const seconds = coerceVideoSeconds(readString(payload.seconds));

  const contextLines = [
    `Target model: ${model}`,
    `Frame size: ${size}`,
    `Duration: ${seconds} seconds`,
  ];

  if (existingPrompt) {
    contextLines.push(`SCENARIO: ${existingPrompt}`);
  }

  // Note: The client might send composed prompt text where assets are already embedded.
  // Ideally we should extract them, but for now we treat the whole blob as SCENARIO/ASSETS context.

  try {
    const response = await client.responses.create({
      model: PROMPT_MODEL,
      max_output_tokens: 500, // Increased for detailed prompts
      temperature: 0.7,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: SYSTEM_PROMPT,
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: contextLines.join("\n"),
            },
          ],
        },
      ],
    });

    const suggestion = extractTextFromResponse(response).trim();
    if (!suggestion) {
      return NextResponse.json(
        { error: { message: "Prompt suggestion unavailable. Try again." } },
        { status: 502 },
      );
    }

    return NextResponse.json({ prompt: suggestion });
  } catch (error) {
    const message = describeError(error, "Failed to generate prompt suggestion");
    const status = resolveErrorStatus(error);
    return NextResponse.json({ error: { message } }, { status });
  }
}
