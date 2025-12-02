import { NextResponse } from "next/server";
import OpenAI from "openai";
import { describeError, resolveErrorStatus } from "@/lib/sora";

const MODEL = process.env.OPENAI_QUESTION_MODEL?.trim() || "gpt-4.1-mini";

type QuestionToolMode = "generate" | "validate";
type QuestionRole = "perception" | "intent" | "qualitative";

type QuestionToolRequest = {
  mode?: unknown;
  role?: unknown;
  competency?: unknown;
  skillName?: unknown;
  videoTitle?: unknown;
  scenarioDescription?: unknown;
  currentQuestion?: unknown;
};

type GenerateQuestionResponse = {
  question: string;
  explanation?: string;
};

type ValidateQuestionResponse = {
  isValid: boolean;
  issues: string[];
  severity: "ok" | "warning" | "error";
  suggestedRewrite: string | null;
};

const isQuestionRole = (value: string): value is QuestionRole =>
  value === "perception" || value === "intent" || value === "qualitative";

const isQuestionMode = (value: string): value is QuestionToolMode =>
  value === "generate" || value === "validate";

const readString = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  return undefined;
};

const gatherText = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map(gatherText).filter(Boolean).join(" ");
  }
  if (typeof value === "object") {
    const node = value as { text?: unknown; content?: unknown; value?: unknown };
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

const parseJsonFromText = <T>(text: string): T => {
  const attempt = (input: string) => {
    try {
      return JSON.parse(input) as T;
    } catch {
      return null;
    }
  };

  const trimmed = text.trim();
  const direct = attempt(trimmed);
  if (direct) return direct;

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const snippet = trimmed.slice(firstBrace, lastBrace + 1);
    const parsed = attempt(snippet);
    if (parsed) return parsed;
  }

  throw new Error("Model response was not valid JSON");
};

const GENERATE_SYSTEM_PROMPT = `
You write DI Code Framework assessment questions for short workplace videos.

Each scenario is tagged with a competency and a skill. We always ask exactly three questions:
• Q1: Behavioral PERCEPTION (Likert 1–7 about what the leader did in the video)
• Q2: Behavioral INTENT (Likert 1–7 about what the respondent would do in a similar situation)
• Q3: Qualitative reflection (open text about one concrete action)

GLOBAL RULES (apply to every role):
• Focus on observable leader behavior (things you could literally see/hear).
• Use concrete verbs: ask, invite, acknowledge, check for bias, follow up, etc.
• One behavior per question. No double-barreled wording (“do X and Y”).
• Do NOT use moral/evaluative labels (“good leader”, “effective”, “ideal”, “right thing”).
• Avoid vague environment words (“warm/positive atmosphere”, “inclusive climate”, “engaging environment”, “build trust”, “create psychological safety”) unless tied to a single concrete action.
• Questions should be ~12–30 words and in plain English.
• Higher numbers on Likert scales must always mean “more of the desired behavior”.
• Output MUST be a single JSON object: { "question": string, "explanation": string } (no markdown/backticks).

ROLE = “perception” (Q1):
• Anchor in the scenario: start with “In the video,”.
• Structure MUST be “In the video, how much did the leader [single concrete action]?” or “In the video, to what extent did the leader [single concrete action]?”
• The action must be observable (e.g., “invite quieter members to speak”, “acknowledge their own mistake”, “check for possible bias”).
• Never talk about “atmosphere”, “climate”, “warmth”, or general feelings.

ROLE = “intent” (Q2):
• Anchor in the scenario: “If you were in a situation like this,”.
• Structure MUST be “If you were in a situation like this, how likely is it that you would [same type of concrete action]?”
• Wording should naturally fit a 1–7 likelihood scale and should not imply there is a “correct” answer.

ROLE = “qualitative” (Q3):
• Ask for ONE concrete action the respondent might take in a similar situation.
• Example frames: “In a situation like this, what is one concrete thing you could do to [behavior phrase]?”

Below are EXAMPLES. Do not describe them or refer to them. Just imitate the JSON structure and style. Always respond with a single JSON object only.

Example 1 – GENERATE, role = perception
User payload:
{
  "mode": "generate",
  "role": "perception",
  "competency": "Foster Psychological Safety",
  "skillName": "Encourage speaking up",
  "videoTitle": "Weekly stand-up: junior dev hesitates to share concern",
  "scenarioDescription": "In the video, a junior developer looks like they want to speak up about a risk, but the leader drives the meeting quickly and only calls on the same two vocal team members."
}

Assistant JSON response:
{
  "question": "In the video, how much did the leader invite quieter team members to share their views before moving on?",
  "explanation": "Perception question anchored in the video and focused on one observable behavior (inviting quieter members to speak) that fits a 1–7 degree scale."
}

Example 2 – GENERATE, role = intent
User payload:
{
  "mode": "generate",
  "role": "intent",
  "competency": "Foster Psychological Safety",
  "skillName": "Encourage speaking up",
  "videoTitle": "Weekly stand-up: junior dev hesitates to share concern",
  "scenarioDescription": "In the video, a junior developer looks like they want to speak up about a risk, but the leader drives the meeting quickly and only calls on the same two vocal team members."
}

Assistant JSON response:
{
  "question": "If you were leading a meeting like this, how likely is it that you would actively invite input from quieter team members about potential risks?",
  "explanation": "This is an intent question. It asks what the respondent would do in a similar situation, uses a 1–7 likelihood scale naturally, and focuses on a specific behavior related to encouraging speaking up."
}

Example 3 – GENERATE, role = qualitative
User payload:
{
  "mode": "generate",
  "role": "qualitative",
  "competency": "Foster Psychological Safety",
  "skillName": "Encourage speaking up",
  "videoTitle": "Weekly stand-up: junior dev hesitates to share concern",
  "scenarioDescription": "In the video, a junior developer looks like they want to speak up about a risk, but the leader drives the meeting quickly and only calls on the same two vocal team members."
}

Assistant JSON response:
{
  "question": "In a situation like the one in the video, what is one concrete thing you could do to make it easier for quieter team members to share their concerns?",
  "explanation": "This is an open-ended reflection question. It is short, focuses on a single concrete behavior, and invites the respondent to think about a specific action they could take in similar situations."
}
`.trim();

const VALIDATE_SYSTEM_PROMPT = `
You validate DI Code assessment questions. Check whether the provided text fits its role (perception, intent, qualitative) and follows DI Code guidance:
• Perception: statement about what the leader did; Likert-friendly; no question mark.
• Intent: statement about what the respondent would do; Likert-friendly; includes the “Different people would respond…” preface before the statement if missing suggest adding; no question mark.
• Qualitative: open-ended question inviting reflection (should end with a question mark).

Also check for: scenario anchoring, concrete behavior, avoiding double-barreled or moralizing language. Flag issues if the question:
• Uses vague environment/feeling words (“warm/engaging atmosphere”, “positive climate”, “build trust”) instead of a single observable action.
• Uses moral/evaluative labels (“good leader”, “effective”, “ideal response”).
• Combines multiple behaviors/outcomes in one sentence (“participation and connection and trust”).
• For perception/intent, fails to describe a specific action taken by the leader/respondent.

Return ONLY JSON: {
  "isValid": boolean,
  "issues": string[],
  "severity": "ok" | "warning" | "error",
  "suggestedRewrite": string | null
}

Below are EXAMPLES. Do not describe them or refer to them. Just imitate the JSON structure and style. Always respond with a single JSON object only.

Example 1 – VALIDATE, perception question with issues
User payload:
{
  "mode": "validate",
  "role": "perception",
  "competency": "Foster Psychological Safety",
  "skillName": "Mitigate Bias",
  "question": "How well did the leader behave like a good, unbiased leader and make everyone feel safe and included?"
}

Assistant JSON response:
{
  "isValid": false,
  "issues": [
    "The question is double-barreled (good leader, unbiased, safe, included) instead of focusing on a single behavior.",
    "The phrase 'good, unbiased leader' is moralizing and likely to push respondents toward socially desirable answers.",
    "The wording is vague ('how well') and not clearly about what happened specifically in the video.",
    "It does not explicitly anchor the behavior in the video scenario."
  ],
  "severity": "error",
  "suggestedRewrite": "In the video, to what extent did the leader actively check for and address possible bias in how people were being treated or heard?"
}

Example 2 – VALIDATE, intent question that is acceptable
User payload:
{
  "mode": "validate",
  "role": "intent",
  "competency": "Foster Psychological Safety",
  "skillName": "Encourage speaking up",
  "question": "If you were leading a meeting like this, how likely is it that you would invite quieter team members to share their views before closing the discussion?"
}

Assistant JSON response:
{
  "isValid": true,
  "issues": [],
  "severity": "ok",
  "suggestedRewrite": null
}

Example 3 – VALIDATE, qualitative question that needs a small tweak
User payload:
{
  "mode": "validate",
  "role": "qualitative",
  "competency": "Encourage Collaboration",
  "skillName": "Share decision-making",
  "question": "Explain how you would be a better collaborative leader in this situation?"
}

Assistant JSON response:
{
  "isValid": false,
  "issues": [
    "The question uses vague language ('better collaborative leader') instead of focusing on a specific behavior.",
    "It could be clearer and more concrete about the action the respondent might take."
  ],
  "severity": "warning",
  "suggestedRewrite": "In a situation like this, what is one concrete way you would involve others in the decision instead of deciding alone?"
}
`.trim();

const buildGenerateUserPrompt = (params: {
  role: QuestionRole;
  competency?: string;
  skillName?: string;
  videoTitle?: string;
  scenarioDescription?: string;
}): string => {
  const lines = [
    `ROLE: ${params.role}`,
    params.competency ? `Competency: ${params.competency}` : null,
    params.skillName ? `Skill: ${params.skillName}` : null,
    params.videoTitle ? `Video title: ${params.videoTitle}` : null,
    params.scenarioDescription ? `Scenario details: ${params.scenarioDescription}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const instructions = `
Write exactly ONE question for the specified ROLE:
- If ROLE = "perception": follow the perception rules in the system prompt (start with "In the video," + single observable action).
- If ROLE = "intent": ask how likely the respondent would be to take the same kind of action in a similar situation.
- If ROLE = "qualitative": ask for one concrete action the respondent might take in a similar situation.
Return ONLY a JSON object { "question": string, "explanation": string }.
`.trim();

  return `${lines}\n${instructions}`;
};

const buildValidateUserPrompt = (params: {
  role: QuestionRole;
  competency?: string;
  skillName?: string;
  question: string;
}): string => {
  const lines = [
    `Role: ${params.role}`,
    params.competency ? `Competency: ${params.competency}` : null,
    params.skillName ? `Skill: ${params.skillName}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `Assess the following DI Code question for alignment with its role.\n${lines}\nQuestion:\n"""\n${params.question}\n"""\nReturn JSON only.`;
};

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    const message = "OPENAI_API_KEY is not configured";
    return NextResponse.json({ error: { message } }, { status: 500 });
  }

  let payload: QuestionToolRequest;
  try {
    payload = (await request.json()) as QuestionToolRequest;
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON payload" } }, { status: 400 });
  }

  const modeValue = readString(payload.mode)?.toLowerCase();
  if (!modeValue || !isQuestionMode(modeValue)) {
    return NextResponse.json({ error: { message: "mode must be 'generate' or 'validate'" } }, { status: 400 });
  }

  const roleValue = readString(payload.role)?.toLowerCase();
  if (!roleValue || !isQuestionRole(roleValue)) {
    return NextResponse.json({ error: { message: "role must be 'perception', 'intent', or 'qualitative'" } }, { status: 400 });
  }

  const competency = readString(payload.competency);
  const skillName = readString(payload.skillName);
  const videoTitle = readString(payload.videoTitle);
  const scenarioDescription = readString(payload.scenarioDescription);
  const currentQuestion = readString(payload.currentQuestion);

  if (modeValue === "validate" && !currentQuestion) {
    return NextResponse.json({ error: { message: "currentQuestion is required for validation" } }, { status: 400 });
  }

  const client = new OpenAI({ apiKey });

  try {
    const systemPrompt = modeValue === "generate" ? GENERATE_SYSTEM_PROMPT : VALIDATE_SYSTEM_PROMPT;
    const userPrompt =
      modeValue === "generate"
        ? buildGenerateUserPrompt({ role: roleValue, competency, skillName, videoTitle, scenarioDescription })
        : buildValidateUserPrompt({ role: roleValue, competency, skillName, question: currentQuestion! });

    const response = await client.responses.create({
      model: MODEL,
      temperature: modeValue === "generate" ? 0.4 : 0,
      max_output_tokens: 400,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: systemPrompt }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: userPrompt }],
        },
      ],
    });

    const text = extractTextFromResponse(response);

    if (modeValue === "generate") {
      const parsed = parseJsonFromText<GenerateQuestionResponse>(text);
      if (!parsed.question || typeof parsed.question !== "string") {
        throw new Error("Generated response missing question field");
      }
      return NextResponse.json(parsed);
    }

    const parsed = parseJsonFromText<ValidateQuestionResponse>(text);
    if (typeof parsed.isValid !== "boolean" || !Array.isArray(parsed.issues) || !parsed.severity) {
      throw new Error("Validation response missing required fields");
    }
    return NextResponse.json({
      ...parsed,
      issues: parsed.issues.map((issue) => issue?.toString?.() ?? "").filter(Boolean),
      suggestedRewrite: parsed.suggestedRewrite ?? null,
    });
  } catch (error) {
    const message = describeError(error, "Failed to process question request");
    const status = resolveErrorStatus(error);
    if (error instanceof Error && error.message.includes("valid JSON")) {
      return NextResponse.json({ error: { message: error.message } }, { status: 502 });
    }
    return NextResponse.json({ error: { message } }, { status });
  }
}

