import {
  Asset,
  AssetPromptMetadata,
  AssetType,
  CameraAssetPromptDetails,
  CharacterAssetPromptDetails,
  EnvironmentAssetPromptDetails,
  LightingAssetPromptDetails,
} from "@/lib/types";

export interface AssetTypeConfig {
  label: string;
  description: string;
  accentClass: string;
  badgeClass: string;
  chipClass: string;
  chipTextClass: string;
  borderClass: string;
  schemaLabel: string;
  searchPlaceholder: string;
  promptGuardrails: string[];
}

export const ASSET_TYPE_CONFIGS: Record<AssetType, AssetTypeConfig> = {
  character: {
    label: "Character",
    description: "Consistent hero, talent, or mascot performances.",
    accentClass: "text-purple-600",
    badgeClass: "bg-purple-50 text-purple-700 border border-purple-200",
    chipClass: "bg-purple-100 border border-purple-200",
    chipTextClass: "text-purple-700",
    borderClass: "border-purple-200",
    schemaLabel: "character.blueprint",
    searchPlaceholder: "Search hero characters…",
    promptGuardrails: [
      "Preserve identical physique, wardrobe, and silhouette.",
      "Keep facial structure, hair, and accessories locked.",
      "Do not improvise props unless explicitly listed.",
      "Maintain the stated mood, energy, and acting style.",
    ],
  },
  environment: {
    label: "Environment",
    description: "Locations, sets, or rooms with consistent layout.",
    accentClass: "text-emerald-600",
    badgeClass: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    chipClass: "bg-emerald-100 border border-emerald-200",
    chipTextClass: "text-emerald-700",
    borderClass: "border-emerald-200",
    schemaLabel: "environment.blueprint",
    searchPlaceholder: "Search environments…",
    promptGuardrails: [
      "Lock the floorplan, prop placement, and scale.",
      "Time of day and weather must stay fixed.",
      "Preserve architectural materials and color palette.",
      "Camera should honor the described composition beats.",
    ],
  },
  lighting: {
    label: "Lighting",
    description: "Repeatable lighting rigs and exposure setups.",
    accentClass: "text-amber-600",
    badgeClass: "bg-amber-50 text-amber-700 border border-amber-200",
    chipClass: "bg-amber-100 border border-amber-200",
    chipTextClass: "text-amber-700",
    borderClass: "border-amber-200",
    schemaLabel: "lighting.blueprint",
    searchPlaceholder: "Search lighting setups…",
    promptGuardrails: [
      "Match key/fill/rim balance precisely.",
      "Color temperature and gel selection cannot drift.",
      "Exposure, contrast, and falloff must remain identical.",
      "No additional lights beyond the described rig.",
    ],
  },
  camera: {
    label: "Camera",
    description: "Repeatable lenses, framing, and moves.",
    accentClass: "text-sky-600",
    badgeClass: "bg-sky-50 text-sky-700 border border-sky-200",
    chipClass: "bg-sky-100 border border-sky-200",
    chipTextClass: "text-sky-700",
    borderClass: "border-sky-200",
    schemaLabel: "camera.blueprint",
    searchPlaceholder: "Search camera moves…",
    promptGuardrails: [
      "Lock lens focal length and sensor crop.",
      "Maintain camera height, tilt, and dutch angle.",
      "Movement speed and path must be exact.",
      "Keep framing ratio and headroom identical.",
    ],
  },
};

const CHARACTER_FIELD_ORDER: (keyof CharacterAssetPromptDetails)[] = [
  "archetype",
  "physicalTraits",
  "wardrobe",
  "expression",
  "emotion",
  "pose",
  "motion",
  "cameraNotes",
  "lighting",
  "colorPalette",
  "signatureProps",
  "reference",
  "additionalNotes",
];

const CHARACTER_FIELD_LABELS: Record<keyof CharacterAssetPromptDetails, string> = {
  archetype: "Archetype & role",
  physicalTraits: "Physique & facial structure",
  wardrobe: "Wardrobe & accessories",
  expression: "Facial expression",
  emotion: "Emotional tone",
  pose: "Pose / stance",
  motion: "Movement & performance beats",
  cameraNotes: "Camera blocking",
  lighting: "Lighting intent",
  colorPalette: "Color palette",
  signatureProps: "Signature props",
  reference: "Reference cues",
  additionalNotes: "Additional notes",
};

const ENVIRONMENT_FIELD_ORDER: (keyof EnvironmentAssetPromptDetails)[] = [
  "setting",
  "scale",
  "architecture",
  "foliage",
  "weather",
  "timeOfDay",
  "mood",
  "activity",
  "keyProps",
  "depth",
  "colorPalette",
  "cameraNotes",
  "reference",
  "additionalNotes",
];

const ENVIRONMENT_FIELD_LABELS: Record<keyof EnvironmentAssetPromptDetails, string> = {
  setting: "Setting & location",
  scale: "Scale & proportions",
  architecture: "Architecture / structural motifs",
  foliage: "Vegetation / set dressing",
  weather: "Weather",
  timeOfDay: "Time of day",
  mood: "Mood & ambience",
  activity: "Ambient activity",
  keyProps: "Key props & layout",
  depth: "Depth cues / perspective",
  colorPalette: "Color palette",
  cameraNotes: "Camera placement",
  reference: "Reference cues",
  additionalNotes: "Additional notes",
};

const LIGHTING_FIELD_ORDER: (keyof LightingAssetPromptDetails)[] = [
  "style",
  "quality",
  "direction",
  "colorTemperature",
  "intensity",
  "modifiers",
  "contrast",
  "atmosphere",
  "reference",
  "additionalNotes",
];

const LIGHTING_FIELD_LABELS: Record<keyof LightingAssetPromptDetails, string> = {
  style: "Lighting style",
  quality: "Light quality",
  direction: "Directionality",
  colorTemperature: "Color temperature",
  intensity: "Intensity / exposure",
  modifiers: "Modifiers & diffusion",
  contrast: "Contrast & ratios",
  atmosphere: "Atmosphere / haze",
  reference: "Reference cues",
  additionalNotes: "Additional notes",
};

const CAMERA_FIELD_ORDER: (keyof CameraAssetPromptDetails)[] = [
  "lens",
  "framing",
  "movement",
  "height",
  "speed",
  "focus",
  "composition",
  "reference",
  "additionalNotes",
];

const CAMERA_FIELD_LABELS: Record<keyof CameraAssetPromptDetails, string> = {
  lens: "Lens & sensor crop",
  framing: "Framing & coverage",
  movement: "Movement path",
  height: "Camera height / tilt",
  speed: "Movement speed",
  focus: "Focus behavior",
  composition: "Composition notes",
  reference: "Reference cues",
  additionalNotes: "Additional notes",
};

type SectionFormatter<T> = {
  order: (keyof T)[];
  labels: Record<keyof T, string>;
};

const CHARACTER_SECTION_SPEC: SectionFormatter<CharacterAssetPromptDetails> = {
  order: CHARACTER_FIELD_ORDER,
  labels: CHARACTER_FIELD_LABELS,
};

const ENVIRONMENT_SECTION_SPEC: SectionFormatter<EnvironmentAssetPromptDetails> = {
  order: ENVIRONMENT_FIELD_ORDER,
  labels: ENVIRONMENT_FIELD_LABELS,
};

const LIGHTING_SECTION_SPEC: SectionFormatter<LightingAssetPromptDetails> = {
  order: LIGHTING_FIELD_ORDER,
  labels: LIGHTING_FIELD_LABELS,
};

const CAMERA_SECTION_SPEC: SectionFormatter<CameraAssetPromptDetails> = {
  order: CAMERA_FIELD_ORDER,
  labels: CAMERA_FIELD_LABELS,
};

function sanitizePromptValue(value?: string | string[] | null): string | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    const normalized = value.map((entry) => entry?.trim()).filter(Boolean) as string[];
    if (!normalized.length) {
      return null;
    }
    return normalized.join("; ");
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.replace(/\s+/g, " ");
}

function buildSectionText<T>(
  details: T | undefined,
  asset: Asset,
  formatter: SectionFormatter<T>,
): string[] {
  if (!details) {
    return [];
  }

  const lines: string[] = [];
  formatter.order.forEach((key) => {
    const rawValue = (details as Record<string, string | string[] | undefined>)[key as string];
    const value = sanitizePromptValue(rawValue);
    if (!value) {
      return;
    }
    const label = formatter.labels[key];
    lines.push(`- ${label}: ${value}`);
  });

  if (!lines.length) {
    return [];
  }

  return lines;
}

function guardrailsToLines(rules: string[]): string[] {
  return rules.map((rule) => `- ${rule}`);
}

function getMatchedMetadata(asset: Asset): AssetPromptMetadata | null {
  if (!asset.promptMetadata) {
    return null;
  }
  if (asset.promptMetadata.type !== asset.type) {
    return null;
  }
  return asset.promptMetadata;
}

export function getAssetTypeConfig(type: AssetType): AssetTypeConfig {
  return ASSET_TYPE_CONFIGS[type];
}

export function formatAssetPrompt(asset: Asset): string {
  const baseConfig = getAssetTypeConfig(asset.type);
  const metadata = getMatchedMetadata(asset);
  const schemaVersion = metadata?.schemaVersion ?? 1;
  const baseDescription = sanitizePromptValue(asset.description) ?? "Creator did not supply a description.";

  let sections: string[] = [];

  switch (asset.type) {
    case "character": {
      const details = metadata?.details as CharacterAssetPromptDetails | undefined;
      sections = buildSectionText(details, asset, CHARACTER_SECTION_SPEC);
      break;
    }
    case "environment": {
      const details = metadata?.details as EnvironmentAssetPromptDetails | undefined;
      sections = buildSectionText(details, asset, ENVIRONMENT_SECTION_SPEC);
      break;
    }
    case "lighting": {
      const details = metadata?.details as LightingAssetPromptDetails | undefined;
      sections = buildSectionText(details, asset, LIGHTING_SECTION_SPEC);
      break;
    }
    case "camera": {
      const details = metadata?.details as CameraAssetPromptDetails | undefined;
      sections = buildSectionText(details, asset, CAMERA_SECTION_SPEC);
      break;
    }
    default:
      sections = [];
  }

  if (!sections.length) {
    sections.push(`- Canonical description: ${baseDescription}`);
  }

  const guardrails = guardrailsToLines(baseConfig.promptGuardrails);

  const lines = [
    `### Asset Blueprint // ${baseConfig.label}`,
    `Asset Name: ${asset.name}`,
    `Schema: ${baseConfig.schemaLabel}@v${schemaVersion}`,
    "",
    "Key Traits:",
    ...sections,
    "",
    "Creator Notes:",
    `- ${baseDescription}`,
    "",
    "Guardrails:",
    ...guardrails,
  ];

  return lines.join("\n").trim();
}

export function composePromptWithAssets(basePrompt: string, assets: Asset[]): string {
  const trimmedPrompt = basePrompt?.trim() ?? "";
  if (!assets.length) {
    return trimmedPrompt;
  }

  const assetBlocks = assets.map((asset) => formatAssetPrompt(asset));
  return [trimmedPrompt, ...assetBlocks].filter(Boolean).join("\n\n").trim();
}

export function getAssetSearchText(asset: Asset): string {
  const metadata = getMatchedMetadata(asset);
  const detailStrings: string[] = [];
  if (metadata) {
    detailStrings.push(JSON.stringify(metadata.details ?? {}));
  }
  const tags = asset.metadata.tags?.join(" ") ?? "";
  return [asset.name, asset.description, tags, detailStrings.join(" ")].join(" ").toLowerCase();
}

export function getAssetUsageScore(asset: Asset): number {
  const usage = asset.metadata.usageCount ?? 0;
  const updatedAt = asset.metadata.updatedAt?.getTime?.() ?? 0;
  return usage * 1000 + updatedAt;
}

