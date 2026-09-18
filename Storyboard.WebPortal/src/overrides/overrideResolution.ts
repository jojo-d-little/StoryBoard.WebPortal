export type OverrideSource = "query" | "selection" | "default";

export interface ResolvedOverride {
  value: string;
  source: OverrideSource;
}

export interface EffectiveOverrides {
  formFactor: ResolvedOverride;
  composition: ResolvedOverride;
  skeleton: ResolvedOverride;
}

export interface QueryOverrides {
  ff: string;
  cp: string;
  sk: string;
}

export function resolveOverride(queryValue: string, selectedValue: string): ResolvedOverride {
  if (queryValue) {
    return { value: queryValue, source: "query" };
  }

  if (selectedValue) {
    return { value: selectedValue, source: "selection" };
  }

  return { value: "", source: "default" };
}

export function resolveEffectiveOverrides(query: QueryOverrides, selected: QueryOverrides): EffectiveOverrides {
  return {
    formFactor: resolveOverride(query.ff, selected.ff),
    composition: resolveOverride(query.cp, selected.cp),
    skeleton: resolveOverride(query.sk, selected.sk)
  };
}

export function buildShareUrl(currentHref: string, effective: EffectiveOverrides): string {
  const url = new URL(currentHref);
  const params = url.searchParams;

  params.delete("ff");
  params.delete("cp");
  params.delete("sk");

  if (effective.formFactor.value) {
    params.set("ff", effective.formFactor.value);
  }

  if (effective.composition.value) {
    params.set("cp", effective.composition.value);
  }

  if (effective.skeleton.value) {
    params.set("sk", effective.skeleton.value);
  }

  url.search = params.toString();
  return url.toString();
}

export function clearOverrideParams(currentHref: string): string {
  const url = new URL(currentHref);
  url.searchParams.delete("ff");
  url.searchParams.delete("cp");
  url.searchParams.delete("sk");
  return url.toString();
}
