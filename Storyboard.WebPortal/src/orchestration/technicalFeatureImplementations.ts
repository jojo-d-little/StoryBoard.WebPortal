import type { ComponentType } from "react";
import { DiagnosticsConsole } from "../components/DiagnosticsConsole";
import { DevToolsPanel } from "../components/DevToolsPanel";
import type { FeatureImplementationMapping, OrchestrationContracts } from "./types";

type TechnicalFeatureKey = "diagnosticsConsole" | "devToolsPanel";
type TechnicalFeatureComponentName = "DiagnosticsConsole" | "DevToolsPanel";

const technicalFeatureRegistry: Record<TechnicalFeatureComponentName, ComponentType<any>> = {
  DiagnosticsConsole,
  DevToolsPanel
};

function resolveImplementationKey(mapping: FeatureImplementationMapping | undefined): string {
  if (!mapping) {
    return "";
  }

  return typeof mapping === "string" ? mapping : mapping.implementationKey;
}

function getImplementationName(
  contracts: OrchestrationContracts,
  featureKey: TechnicalFeatureKey,
  formFactorKey: string
): TechnicalFeatureComponentName | "" {
  const currentFormFactor = contracts.implementations.formFactors[formFactorKey];
  const fallbackFormFactor = contracts.implementations.formFactors[contracts.implementations.defaultFormFactorKey];
  const implementationName =
    resolveImplementationKey(currentFormFactor?.implementationByFeature[featureKey])
    || resolveImplementationKey(fallbackFormFactor?.implementationByFeature[featureKey])
    || "";

  if (implementationName === "DiagnosticsConsole" || implementationName === "DevToolsPanel") {
    return implementationName;
  }

  return "";
}

export function resolveTechnicalFeatureComponent(
  contracts: OrchestrationContracts,
  featureKey: TechnicalFeatureKey,
  formFactorKey: string,
  fallbackComponent: ComponentType<any>
): ComponentType<any> {
  const implementationName = getImplementationName(contracts, featureKey, formFactorKey);

  if (!implementationName) {
    return fallbackComponent;
  }

  return technicalFeatureRegistry[implementationName] || fallbackComponent;
}
