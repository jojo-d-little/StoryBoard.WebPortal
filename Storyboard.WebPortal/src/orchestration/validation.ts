import type { OrchestrationContracts } from "./types";

function toSortedCsv(values: Iterable<string>): string {
  return Array.from(values).sort().join(", ");
}

export function validateOrchestrationContracts(contracts: OrchestrationContracts): void {
  const states = new Set(Object.keys(contracts.featureMap.experienceStates));
  const features = new Set(Object.keys(contracts.featureCatalog.features));
  const slots = new Set(Object.keys(contracts.uiSlots.slots));
  const allowedModes = new Set(contracts.uiSlots.allowedSlotModes);
  const stateProfileKeys = new Set(Object.keys(contracts.stateCompositions.stateProfiles));
  const skeletonLayoutKeys = new Set(Object.keys(contracts.skeletonLayouts.skeletonLayouts));
  const formFactorKeys = new Set(Object.keys(contracts.implementations.formFactors));
  const modeKeys = new Set(Object.keys(contracts.portalModes.modes));

  if (modeKeys.size === 0) {
    throw new Error("Contracts must define at least one Portal mode.");
  }

  if (!modeKeys.has(contracts.portalModes.defaultModeKey)) {
    throw new Error(`defaultModeKey '${contracts.portalModes.defaultModeKey}' is not a known Portal mode.`);
  }

  if (!states.has(contracts.featureMap.initialExperienceState)) {
    throw new Error(`initialExperienceState '${contracts.featureMap.initialExperienceState}' is not a known experience state.`);
  }

  if (!skeletonLayoutKeys.has(contracts.featureMap.resolutionDefaults.defaultSkeletonLayoutKey)) {
    throw new Error(`defaultSkeletonLayoutKey '${contracts.featureMap.resolutionDefaults.defaultSkeletonLayoutKey}' is not a known skeleton layout.`);
  }

  if (!formFactorKeys.has(contracts.featureMap.resolutionDefaults.defaultFormFactorKey)) {
    throw new Error(`defaultFormFactorKey '${contracts.featureMap.resolutionDefaults.defaultFormFactorKey}' is not a known form factor.`);
  }

  for (const [modeKey, mode] of Object.entries(contracts.portalModes.modes)) {
    if (!formFactorKeys.has(mode.formFactorKey)) {
      throw new Error(`Portal mode '${modeKey}' references unknown form factor '${mode.formFactorKey}'.`);
    }

    const layout = contracts.skeletonLayouts.skeletonLayouts[mode.skeletonLayoutKey];
    if (!layout) {
      throw new Error(`Portal mode '${modeKey}' references unknown skeleton layout '${mode.skeletonLayoutKey}'.`);
    }

    if (layout.formFactorKey !== mode.formFactorKey) {
      throw new Error(`Portal mode '${modeKey}' skeleton layout '${mode.skeletonLayoutKey}' is incompatible with form factor '${mode.formFactorKey}'.`);
    }

    for (const [stateKey, stateProfiles] of Object.entries(contracts.stateCompositions.stateProfiles)) {
      const profileKey = stateProfiles.defaultProfile ?? mode.compositionProfileKey ?? contracts.featureMap.resolutionDefaults.defaultCompositionProfileKey;
      if (!stateProfiles.profiles[profileKey]) {
        throw new Error(`Portal mode '${modeKey}' cannot resolve composition profile '${profileKey}' for state '${stateKey}'.`);
      }
    }
  }

  for (const [slotKey, slotDefinition] of Object.entries(contracts.uiSlots.slots)) {
    const hints = slotDefinition.behaviorHints;
    if (!hints) {
      continue;
    }

    if (
      hints.collapseToEdge !== undefined
      && hints.collapseToEdge !== "left"
      && hints.collapseToEdge !== "right"
      && hints.collapseToEdge !== "top"
      && hints.collapseToEdge !== "bottom"
    ) {
      throw new Error(`Slot '${slotKey}' behaviorHints.collapseToEdge must be one of left, right, top, bottom.`);
    }

    if (hints.collapseToEdge !== undefined && !slotDefinition.collapsible) {
      throw new Error(`Slot '${slotKey}' defines behaviorHints.collapseToEdge but slot is not collapsible.`);
    }

    if (hints.stackOrder !== undefined && (!Number.isInteger(hints.stackOrder) || hints.stackOrder < 0)) {
      throw new Error(`Slot '${slotKey}' behaviorHints.stackOrder must be a non-negative integer.`);
    }

    if (slotDefinition.kind.startsWith("overlay-") && !hints.presentation) {
      throw new Error(`Overlay slot '${slotKey}' must define behaviorHints.presentation in ui-slots.`);
    }
  }

  for (const stateKey of stateProfileKeys) {
    if (!states.has(stateKey)) {
      throw new Error(`stateProfiles contains unknown state '${stateKey}'.`);
    }
  }

  for (const stateKey of states) {
    const stateProfiles = contracts.stateCompositions.stateProfiles[stateKey];
    if (!stateProfiles) {
      throw new Error(`State '${stateKey}' has no stateProfiles composition mapping.`);
    }

    const profileKeys = Object.keys(stateProfiles.profiles);
    if (profileKeys.length === 0) {
      throw new Error(`State '${stateKey}' must define at least one composition profile.`);
    }

    const defaultProfileKey = stateProfiles.defaultProfile ?? contracts.featureMap.resolutionDefaults.defaultCompositionProfileKey;
    if (!stateProfiles.profiles[defaultProfileKey]) {
      throw new Error(`State '${stateKey}' default profile '${defaultProfileKey}' is not defined.`);
    }
  }

  for (const [stateKey, stateProfiles] of Object.entries(contracts.stateCompositions.stateProfiles)) {
    for (const [profileKey, profile] of Object.entries(stateProfiles.profiles)) {
      if (profile.preferredInputFocus) {
        const preferredFeatureKey = profile.preferredInputFocus.featureKey?.trim();
        if (!preferredFeatureKey) {
          throw new Error(`Composition '${stateKey}.${profileKey}' preferredInputFocus.featureKey must be non-empty.`);
        }

        if (!features.has(preferredFeatureKey)) {
          throw new Error(`Composition '${stateKey}.${profileKey}' preferredInputFocus references unknown feature '${preferredFeatureKey}'.`);
        }

        if (profile.preferredInputFocus.focusedInputId !== undefined && !profile.preferredInputFocus.focusedInputId.trim()) {
          throw new Error(`Composition '${stateKey}.${profileKey}' preferredInputFocus.focusedInputId must be non-empty when provided.`);
        }

        const assignedPreferredFeature = profile.slotAssignments.some((assignment) => {
          return assignment.featureKey === preferredFeatureKey && assignment.mode !== "hidden";
        });
        if (!assignedPreferredFeature) {
          throw new Error(`Composition '${stateKey}.${profileKey}' preferredInputFocus.featureKey '${preferredFeatureKey}' must be assigned to a non-hidden slot in the profile.`);
        }
      }

      for (const assignment of profile.slotAssignments) {
        if (!slots.has(assignment.slotKey)) {
          throw new Error(`Composition '${stateKey}.${profileKey}' references unknown slot '${assignment.slotKey}'.`);
        }

        if (!allowedModes.has(assignment.mode)) {
          throw new Error(`Composition '${stateKey}.${profileKey}' references unsupported slot mode '${assignment.mode}'.`);
        }

        if (assignment.featureKey && !features.has(assignment.featureKey)) {
          throw new Error(`Composition '${stateKey}.${profileKey}' references unknown feature '${assignment.featureKey}'.`);
        }
      }
    }
  }

  for (const [layoutKey, layout] of Object.entries(contracts.skeletonLayouts.skeletonLayouts)) {
    if (!formFactorKeys.has(layout.formFactorKey)) {
      throw new Error(`Skeleton layout '${layoutKey}' references unknown formFactorKey '${layout.formFactorKey}'.`);
    }

    if (!layout.templatePath) {
      throw new Error(`Skeleton layout '${layoutKey}' must define templatePath.`);
    }

    const mappedSlots = new Set(layout.templateSlots ?? []);
    if (mappedSlots.size === 0) {
      throw new Error(`Skeleton layout '${layoutKey}' templatePath resolved no slots.`);
    }

    for (const slotKey of mappedSlots) {
      if (!slots.has(slotKey)) {
        throw new Error(`Skeleton layout '${layoutKey}' maps unknown slot '${slotKey}'.`);
      }
    }
  }

  for (const [formFactorKey, formFactor] of Object.entries(contracts.implementations.formFactors)) {
    const mappedFeatures = new Set(Object.keys(formFactor.implementationByFeature));

    for (const featureKey of mappedFeatures) {
      if (!features.has(featureKey)) {
        throw new Error(`Form factor '${formFactorKey}' maps unknown feature '${featureKey}'.`);
      }

      const mapping = formFactor.implementationByFeature[featureKey];
      if (typeof mapping === "string") {
        if (!mapping.trim()) {
          throw new Error(`Form factor '${formFactorKey}' feature '${featureKey}' must map to a non-empty implementation key.`);
        }

        continue;
      }

      if (!mapping.implementationKey || !mapping.implementationKey.trim()) {
        throw new Error(`Form factor '${formFactorKey}' feature '${featureKey}' must define implementationKey.`);
      }

      if (mapping.orientation !== "horizontal" && mapping.orientation !== "vertical") {
        throw new Error(`Form factor '${formFactorKey}' feature '${featureKey}' has invalid orientation '${String(mapping.orientation)}'.`);
      }

      if (mapping.density !== "regular" && mapping.density !== "compact") {
        throw new Error(`Form factor '${formFactorKey}' feature '${featureKey}' has invalid density '${String(mapping.density)}'.`);
      }
    }

    for (const featureKey of features) {
      if (!mappedFeatures.has(featureKey)) {
        throw new Error(`Form factor '${formFactorKey}' is missing implementation for feature '${featureKey}'.`);
      }
    }
  }

  if (states.size === 0 || features.size === 0 || slots.size === 0) {
    throw new Error("Contracts must define at least one state, feature, and slot.");
  }

  if (contracts.featureMap.transitions.length === 0) {
    throw new Error("Contracts must define at least one state transition.");
  }

  for (const transition of contracts.featureMap.transitions) {
    if (!states.has(transition.from)) {
      throw new Error(`Transition references unknown from state '${transition.from}'. Known states: ${toSortedCsv(states)}.`);
    }

    if (!states.has(transition.to)) {
      throw new Error(`Transition references unknown to state '${transition.to}'. Known states: ${toSortedCsv(states)}.`);
    }
  }
}
