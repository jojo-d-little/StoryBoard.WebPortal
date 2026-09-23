export type SlotMode = "visible" | "hidden" | "collapsed" | "disabled" | "readonly";

export interface ExperienceStateDescriptor {
}

export interface ExperienceStateFeatureMap {
  initialExperienceState: string;
  experienceStates: Record<string, ExperienceStateDescriptor>;
  transitions: Array<{ from: string; event: string; to: string; guardRef?: string; actionRef?: string }>;
  resolutionDefaults: {
    defaultSkeletonLayoutKey: string;
    defaultFormFactorKey: string;
    defaultCompositionProfileKey: string;
  };
}

export interface ExperienceStateCompositions {
  stateProfiles: Record<string, {
    defaultProfile?: string;
    profiles: Record<string, {
      slotAssignments: Array<{ slotKey: string; featureKey?: string; mode: SlotMode }>;
      preferredInputFocus?: {
        featureKey: string;
        focusedInputId?: string;
      };
    }>;
  }>;
}

export interface SkeletonLayouts {
  skeletonLayouts: Record<string, {
    family: string;
    formFactorKey: string;
    minWidth?: number;
    maxWidth?: number;
    orientation?: "portrait" | "landscape";
    templatePath?: string;
    templateSlots?: string[];
    templateStyleText?: string;
    templateRootClassName?: string;
    templateRootDataSkeleton?: string;
    templateSlotGridPlacements?: Record<string, TemplateSlotGridPlacement>;
    templateSlotClassNames?: Record<string, string>;
  }>;
}

export interface TemplateSlotGridPlacement {
  rowStart: number;
  colStart: number;
  rowSpan: number;
  colSpan: number;
}

export type FeatureRenderOrientation = "horizontal" | "vertical";
export type FeatureRenderDensity = "regular" | "compact";

export interface FeatureImplementationDescriptor {
  implementationKey: string;
  orientation: FeatureRenderOrientation;
  density: FeatureRenderDensity;
}

export type FeatureImplementationMapping = string | FeatureImplementationDescriptor;

export interface FormFactorFeatureImplementations {
  defaultFormFactorKey: string;
  formFactors: Record<string, { implementationByFeature: Record<string, FeatureImplementationMapping> }>;
}

export interface FeatureCatalog {
  features: Record<string, { category: string; description: string }>;
}

export interface UiSlotBehaviorHints {
  collapseToEdge?: "left" | "right" | "top" | "bottom";
  role?: "dialog-layer" | "toast-layer" | "nonmodal-layer" | "drawer-layer" | "chrome-layer";
  presentation?: "overlay-modal" | "overlay-nonmodal" | "overlay-toast" | "inline";
  backdrop?: "none" | "dim";
  dismissOnEscape?: boolean;
  dismissOnBackdropClick?: boolean;
  stackOrder?: number;
}

export interface UiSlotDefinition {
  kind: string;
  infrastructure: boolean;
  collapsible: boolean;
  hideable: boolean;
  behaviorHints?: UiSlotBehaviorHints;
}

export interface UiSlots {
  slots: Record<string, UiSlotDefinition>;
  allowedSlotModes: SlotMode[];
}

export interface ThemeContract {
  meta: {
    schemaVersion: string;
    configVersion: string;
  };
  tokens: {
    color: {
      chromePrimary: string;
      accentPrimary: string;
      primaryText: string;
      surfaceBackground: string;
      panelBackground: string;
      borderPrimary: string;
      controlBackground: string;
      controlBackgroundActive: string;
      controlText: string;
      surfaceMuted: string;
      collapsedOutlineColor: string;
      collapsedFillColor: string;
      secondaryText: string;
      statusSuccessText: string;
      statusWarningText: string;
      statusErrorText: string;
      echoMessageTextColor: string;
      echoMessageBackgroundColor: string;
      hudOutlineColor: string;
      hudBackgroundColor: string;
      hudTextColor: string;
      hudManualDismissButtonColor: string;
    };
    typography: {
      textFontFamilyPrimary: string;
      textFontFamilyDisplay: string;
      hudFontFamilyHeader: string;
      hudFontFamilyBody: string;
    };
    shape: {
      borderRadiusBase: number;
      borderThickness: number;
      collapsedComponentThickness: number;
    };
    spacing: {
      baseUnit: number;
    };
  };
  fallbackPolicy: {
    missingToken: "use-default";
    invalidToken: "warn-and-use-default";
    unsupportedFont: "use-approved-safe-stack";
    blockStartupOnThemeError: boolean;
  };
}

export interface PortalModes {
  defaultModeKey: string;
  modes: Record<string, {
    formFactorKey: string;
    skeletonLayoutKey: string;
    compositionProfileKey: string;
  }>;
}

export interface OrchestrationContracts {
  featureMap: ExperienceStateFeatureMap;
  stateCompositions: ExperienceStateCompositions;
  skeletonLayouts: SkeletonLayouts;
  implementations: FormFactorFeatureImplementations;
  featureCatalog: FeatureCatalog;
  uiSlots: UiSlots;
  portalModes: PortalModes;
  themeContract?: ThemeContract;
}

export interface ResolutionInput {
  experienceState: string;
  modeKey?: string;
  formFactorOverride?: string;
  compositionProfileOverride?: string;
  skeletonLayoutOverride?: string;
}

export interface ResolvedSlot {
  slotKey: string;
  mode: SlotMode;
  featureKey?: string;
  implementationKey?: string;
  implementationOrientation?: FeatureRenderOrientation;
  implementationDensity?: FeatureRenderDensity;
  regionKey?: string;
}

export interface ResolvedPlan {
  modeKey?: string;
  experienceState: string;
  formFactorKey: string;
  compositionProfileKey: string;
  compositionProfileName: string;
  skeletonLayoutKey: string;
  slots: ResolvedSlot[];
  preferredInputFocus?: {
    featureKey: string;
    inputElementId?: string;
  };
}
