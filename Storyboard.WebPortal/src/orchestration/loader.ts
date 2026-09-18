import type {
  ExperienceStateCompositions,
  ExperienceStateFeatureMap,
  FeatureCatalog,
  FormFactorFeatureImplementations,
  OrchestrationContracts,
  SkeletonLayouts,
  TemplateSlotGridPlacement,
  ThemeContract,
  UiSlots
} from "./types";
import { validateOrchestrationContracts } from "./validation";

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

function extractTemplateSlots(templateHtml: string): string[] {
  const seen = new Set<string>();
  const slotRegex = /data-slot\s*=\s*"([^"]+)"/g;
  let match = slotRegex.exec(templateHtml);

  while (match) {
    const slot = match[1]?.trim();
    if (slot) {
      seen.add(slot);
    }

    match = slotRegex.exec(templateHtml);
  }

  return Array.from(seen).sort();
}

function extractTemplateStyleText(templateHtml: string): string {
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  const styles: string[] = [];
  let match = styleRegex.exec(templateHtml);

  while (match) {
    const styleText = match[1]?.trim();
    if (styleText) {
      styles.push(styleText);
    }

    match = styleRegex.exec(templateHtml);
  }

  return styles.join("\n\n");
}

function extractTagAttribute(attributes: string, attributeName: string): string | undefined {
  const escapedAttribute = attributeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`${escapedAttribute}\\s*=\\s*"([^"]+)"`, "i");
  const match = regex.exec(attributes);
  return match?.[1]?.trim() || undefined;
}

function extractTemplateRootMetadata(templateHtml: string): { className?: string; dataSkeleton?: string } {
  const mainTagMatch = /<main\b([^>]*)>/i.exec(templateHtml);
  if (!mainTagMatch) {
    return {};
  }

  const mainAttributes = mainTagMatch[1] ?? "";
  return {
    className: extractTagAttribute(mainAttributes, "class"),
    dataSkeleton: extractTagAttribute(mainAttributes, "data-skeleton")
  };
}

function parseGridCell(value: string): { rowStart: number; colStart: number } | undefined {
  const match = /^r(\d+)\s*c(\d+)$/i.exec(value.trim());
  if (!match) {
    return undefined;
  }

  return {
    rowStart: Number.parseInt(match[1], 10),
    colStart: Number.parseInt(match[2], 10)
  };
}

function parseGridSpan(value: string): { rowSpan: number; colSpan: number } | undefined {
  const match = /^r(\d+)\s+c(\d+)$/i.exec(value.trim());
  if (!match) {
    return undefined;
  }

  return {
    rowSpan: Number.parseInt(match[1], 10),
    colSpan: Number.parseInt(match[2], 10)
  };
}

function extractTemplateSlotGridPlacements(templateHtml: string): Record<string, TemplateSlotGridPlacement> {
  const placements: Record<string, TemplateSlotGridPlacement> = {};
  const tagRegex = /<([a-z0-9-]+)\b([^>]*)>/gi;
  let match = tagRegex.exec(templateHtml);

  while (match) {
    const attributes = match[2] ?? "";
    const slotKey = extractTagAttribute(attributes, "data-slot");
    const gridCell =
      extractTagAttribute(attributes, "data-storyboard-grid-cell")
      ?? extractTagAttribute(attributes, "data-grid-cell");
    const gridSpan =
      extractTagAttribute(attributes, "data-storyboard-grid-span")
      ?? extractTagAttribute(attributes, "data-grid-span");

    if (slotKey && gridCell) {
      const cell = parseGridCell(gridCell);
      const span = gridSpan ? parseGridSpan(gridSpan) : { rowSpan: 1, colSpan: 1 };
      if (cell && span) {
        placements[slotKey] = {
          rowStart: cell.rowStart,
          colStart: cell.colStart,
          rowSpan: span.rowSpan,
          colSpan: span.colSpan
        };
      }
    }

    match = tagRegex.exec(templateHtml);
  }

  return placements;
}

function extractTemplateSlotClassNames(templateHtml: string): Record<string, string> {
  const classNames: Record<string, string> = {};
  const tagRegex = /<([a-z0-9-]+)\b([^>]*)>/gi;
  let match = tagRegex.exec(templateHtml);

  while (match) {
    const attributes = match[2] ?? "";
    const slotKey = extractTagAttribute(attributes, "data-slot");
    const className = extractTagAttribute(attributes, "class");

    if (slotKey && className) {
      classNames[slotKey] = className;
    }

    match = tagRegex.exec(templateHtml);
  }

  return classNames;
}

function resolveTemplateUrl(basePath: string, templatePath: string): string {
  if (/^https?:\/\//i.test(templatePath) || templatePath.startsWith("/")) {
    return templatePath;
  }

  return `${basePath}/${templatePath}`;
}

async function hydrateSkeletonTemplateSlots(basePath: string, layouts: SkeletonLayouts): Promise<void> {
  const loads: Array<Promise<void>> = [];

  for (const layout of Object.values(layouts.skeletonLayouts)) {
    if (!layout.templatePath) {
      continue;
    }

    const url = resolveTemplateUrl(basePath, layout.templatePath);
    loads.push(
      fetchText(url).then((html) => {
        layout.templateSlots = extractTemplateSlots(html);
        layout.templateStyleText = extractTemplateStyleText(html) || undefined;
        const rootMetadata = extractTemplateRootMetadata(html);
        layout.templateRootClassName = rootMetadata.className;
        layout.templateRootDataSkeleton = rootMetadata.dataSkeleton;
        const slotGridPlacements = extractTemplateSlotGridPlacements(html);
        layout.templateSlotGridPlacements = Object.keys(slotGridPlacements).length > 0 ? slotGridPlacements : undefined;
        const slotClassNames = extractTemplateSlotClassNames(html);
        layout.templateSlotClassNames = Object.keys(slotClassNames).length > 0 ? slotClassNames : undefined;
      })
    );
  }

  await Promise.all(loads);
}

function resolveDefaultBasePath(): string {
  const baseUrl = import.meta.env.BASE_URL || "/";
  return `${baseUrl.replace(/\/?$/, "/")}orchestration`;
}

export async function loadOrchestrationContracts(basePath = resolveDefaultBasePath()): Promise<OrchestrationContracts> {
  const [featureMap, stateCompositions, skeletonLayouts, implementations, featureCatalog, uiSlots, themeContract] = await Promise.all([
    fetchJson<ExperienceStateFeatureMap>(`${basePath}/experience-state-featuremap.v1.json`),
    fetchJson<ExperienceStateCompositions>(`${basePath}/experience-state-compositions.v1.json`),
    fetchJson<SkeletonLayouts>(`${basePath}/skeleton-layouts.v1.json`),
    fetchJson<FormFactorFeatureImplementations>(`${basePath}/form-factor-feature-implementations.v1.json`),
    fetchJson<FeatureCatalog>(`${basePath}/feature-catalog.v1.json`),
    fetchJson<UiSlots>(`${basePath}/ui-slots.v1.json`),
    fetchJson<ThemeContract>(`${basePath}/theme-contract.v1.json`)
  ]);

  await hydrateSkeletonTemplateSlots(basePath, skeletonLayouts);

  const contracts = {
    featureMap,
    stateCompositions,
    skeletonLayouts,
    implementations,
    featureCatalog,
    uiSlots,
    themeContract
  };

  validateOrchestrationContracts(contracts);

  return contracts;
}
