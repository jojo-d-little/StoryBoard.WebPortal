import type { ResolvedPlan } from "../orchestration/types";

interface ResolvedPlanViewProps {
  plan: ResolvedPlan;
}

export function ResolvedPlanView(props: ResolvedPlanViewProps): JSX.Element {
  return (
    <section className="results">
      <h2>Resolved Plan</h2>
      <div className="meta">
        <span>state={props.plan.experienceState}</span>
        <span>formFactor={props.plan.formFactorKey}</span>
        <span>compositionKey={props.plan.compositionProfileKey}</span>
        <span>composition={props.plan.compositionProfileName}</span>
        <span>skeleton={props.plan.skeletonLayoutKey}</span>
      </div>

      <div className="slots">
        {props.plan.slots.map((slot) => (
          <article className="slot" key={slot.slotKey}>
            <h3>{slot.slotKey}</h3>
            <p>mode: {slot.mode}</p>
            <p>feature: {slot.featureKey ?? "(none)"}</p>
            <p>implementation: {slot.implementationKey ?? "(none)"}</p>
            <p>region: {slot.regionKey ?? "(unmapped)"}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
