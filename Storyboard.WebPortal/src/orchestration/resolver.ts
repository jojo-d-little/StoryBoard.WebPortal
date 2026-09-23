import type {
  FeatureImplementationMapping,
  OrchestrationContracts,
  ResolutionInput,
  ResolvedPlan,
  ResolvedSlot
} from "./types";

function resolveImplementationMapping(mapping: FeatureImplementationMapping | undefined): {
  implementationKey: string;
  orientation: "horizontal" | "vertical" | undefined;
  density: "regular" | "compact" | undefined;
} {
  if (!mapping) {
    return { implementationKey: "", orientation: undefined, density: undefined };
  }

  if (typeof mapping === "string") {
    return { implementationKey: mapping, orientation: undefined, density: undefined };
  }

  return {
    implementationKey: mapping.implementationKey,
    orientation: mapping.orientation,
    density: mapping.density
  };
}

function resolveCompositionProfileKey(
  contracts: OrchestrationContracts,
  experienceState: string,
  modeCompositionProfileKey: string,
  compositionProfileOverride?: string
): string {
  const stateProfiles = contracts.stateCompositions.stateProfiles[experienceState];
  if (!stateProfiles) {
    throw new Error(`No composition profiles configured for state '${experienceState}'.`);
  }

  const defaultProfileKey = stateProfiles.defaultProfile
    || modeCompositionProfileKey
    || contracts.featureMap.resolutionDefaults.defaultCompositionProfileKey;

  if (!compositionProfileOverride) {
    if (!stateProfiles.profiles[defaultProfileKey]) {
      throw new Error(`Default composition profile '${defaultProfileKey}' is not defined for state '${experienceState}'.`);
    }

    return defaultProfileKey;
  }

  if (!stateProfiles.profiles[compositionProfileOverride]) {
    throw new Error(`Unknown composition override '${compositionProfileOverride}' for state '${experienceState}'.`);
  }

  return compositionProfileOverride;
}

function resolveSkeletonLayoutKey(
  contracts: OrchestrationContracts,
  formFactorKey: string,
  modeSkeletonLayoutKey: string,
  skeletonLayoutOverride?: string
): string {
  if (skeletonLayoutOverride) {
    const overrideLayout = contracts.skeletonLayouts.skeletonLayouts[skeletonLayoutOverride];
    if (!overrideLayout) {
      throw new Error(`Unknown skeleton layout '${skeletonLayoutOverride}'.`);
    }

    if (overrideLayout.formFactorKey !== formFactorKey) {
      throw new Error(`Skeleton layout '${skeletonLayoutOverride}' is not compatible with form factor '${formFactorKey}'.`);
    }

    return skeletonLayoutOverride;
  }

  const defaultLayoutKey = modeSkeletonLayoutKey || contracts.featureMap.resolutionDefaults.defaultSkeletonLayoutKey;
  const defaultLayout = contracts.skeletonLayouts.skeletonLayouts[defaultLayoutKey];
  if (!defaultLayout) {
    throw new Error(`Unknown default skeleton layout '${defaultLayoutKey}'.`);
  }

  if (defaultLayout.formFactorKey === formFactorKey) {
    return defaultLayoutKey;
  }

  const compatible = Object.entries(contracts.skeletonLayouts.skeletonLayouts)
    .find(([, layout]) => layout.formFactorKey === formFactorKey);

  return compatible?.[0] ?? defaultLayoutKey;
}

export function resolveShellPlan(contracts: OrchestrationContracts, input: ResolutionInput): ResolvedPlan {
  const state = contracts.featureMap.experienceStates[input.experienceState];
  if (!state) {
    throw new Error(`Unknown experience state '${input.experienceState}'.`);
  }

  const modeKey = input.modeKey ?? contracts.portalModes.defaultModeKey;
  const mode = contracts.portalModes.modes[modeKey];
  if (!mode) {
    throw new Error(`Unknown Portal mode '${modeKey}'.`);
  }

  const formFactorKey = input.formFactorOverride ?? mode.formFactorKey ?? contracts.featureMap.resolutionDefaults.defaultFormFactorKey;
  const formFactor = contracts.implementations.formFactors[formFactorKey];
  if (!formFactor) {
    throw new Error(`Unknown form factor '${formFactorKey}'.`);
  }

  const compositionProfileKey = resolveCompositionProfileKey(
    contracts,
    input.experienceState,
    mode.compositionProfileKey,
    input.compositionProfileOverride
  );
  const compositionProfile = contracts.stateCompositions.stateProfiles[input.experienceState]?.profiles[compositionProfileKey];
  if (!compositionProfile) {
    throw new Error(`Unknown composition profile '${compositionProfileKey}' for state '${input.experienceState}'.`);
  }

  const skeletonLayoutKey = resolveSkeletonLayoutKey(contracts, formFactorKey, mode.skeletonLayoutKey, input.skeletonLayoutOverride);
  const skeletonLayout = contracts.skeletonLayouts.skeletonLayouts[skeletonLayoutKey];
  if (skeletonLayout.formFactorKey !== formFactorKey) {
    throw new Error(`Layout '${skeletonLayoutKey}' is not compatible with form factor '${formFactorKey}'.`);
  }

  const knownFeatures = new Set(Object.keys(contracts.featureCatalog.features));
  const knownSlots = new Set(Object.keys(contracts.uiSlots.slots));
  const knownModes = new Set(contracts.uiSlots.allowedSlotModes);
  const mappedSlots = new Set(skeletonLayout.templateSlots ?? []);

  const slots: ResolvedSlot[] = compositionProfile.slotAssignments.map((assignment) => {
    if (!knownSlots.has(assignment.slotKey)) {
      throw new Error(`Unknown slot key '${assignment.slotKey}'.`);
    }

    if (!knownModes.has(assignment.mode)) {
      throw new Error(`Unknown slot mode '${assignment.mode}'.`);
    }

    if (!mappedSlots.has(assignment.slotKey)) {
      throw new Error(`Skeleton layout '${skeletonLayoutKey}' has no placement for slot '${assignment.slotKey}'.`);
    }

    let implementationKey: string | undefined;
    let implementationOrientation: "horizontal" | "vertical" | undefined;
    let implementationDensity: "regular" | "compact" | undefined;
    if (assignment.featureKey) {
      if (!knownFeatures.has(assignment.featureKey)) {
        throw new Error(`Unknown feature key '${assignment.featureKey}'.`);
      }

      const mapping = resolveImplementationMapping(formFactor.implementationByFeature[assignment.featureKey]);
      implementationKey = mapping.implementationKey;
      implementationOrientation = mapping.orientation;
      implementationDensity = mapping.density;
      if (!implementationKey) {
        throw new Error(`No implementation mapping for feature '${assignment.featureKey}' in form factor '${formFactorKey}'.`);
      }
    }

    return {
      slotKey: assignment.slotKey,
      mode: assignment.mode,
      featureKey: assignment.featureKey,
      implementationKey,
      implementationOrientation,
      implementationDensity,
      regionKey: `template-slot:${assignment.slotKey}`
    };
  });

  const preferredInputFocus = compositionProfile.preferredInputFocus
    ? {
      featureKey: compositionProfile.preferredInputFocus.featureKey,
      inputElementId: compositionProfile.preferredInputFocus.focusedInputId?.trim() || undefined
    }
    : undefined;

  return {
    modeKey,
    experienceState: input.experienceState,
    formFactorKey,
    compositionProfileKey,
    compositionProfileName: compositionProfileKey,
    skeletonLayoutKey,
    slots,
    preferredInputFocus
  };
}

export function tryTransition(
  contracts: OrchestrationContracts,
  currentState: string,
  eventName: string
): string | undefined {
  const hit = contracts.featureMap.transitions.find((x) => x.from === currentState && x.event === eventName);
  return hit?.to;
}

export function listEventsFromState(contracts: OrchestrationContracts, currentState: string): string[] {
  return contracts.featureMap.transitions
    .filter((x) => x.from === currentState)
    .map((x) => x.event)
    .sort();
}
