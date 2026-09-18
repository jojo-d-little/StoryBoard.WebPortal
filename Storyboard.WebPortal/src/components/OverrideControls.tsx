interface OverrideControlsProps {
  state: string;
  states: string[];
  formFactorOverride: string;
  formFactors: string[];
  compositionOverride: string;
  compositionProfiles: string[];
  skeletonOverride: string;
  skeletonLayouts: string[];
  onStateChange: (value: string) => void;
  onFormFactorChange: (value: string) => void;
  onCompositionChange: (value: string) => void;
  onSkeletonChange: (value: string) => void;
  onResetOverrides: () => void;
  onCopyShareUrl: () => void;
  onClearQueryOverrides: () => void;
  hasQueryOverrides: boolean;
}

export function OverrideControls(props: OverrideControlsProps): JSX.Element {
  return (
    <>
      <div className="grid">
        <label>
          Experience State
          <select value={props.state} onChange={(e) => props.onStateChange(e.target.value)}>
            {props.states.map((x) => (
              <option value={x} key={x}>{x}</option>
            ))}
          </select>
        </label>

        <label>
          Form Factor Override
          <select value={props.formFactorOverride} onChange={(e) => props.onFormFactorChange(e.target.value)}>
            <option value="">(default)</option>
            {props.formFactors.map((x) => (
              <option value={x} key={x}>{x}</option>
            ))}
          </select>
        </label>

        <label>
          Composition Override
          <select value={props.compositionOverride} onChange={(e) => props.onCompositionChange(e.target.value)}>
            <option value="">(default)</option>
            {props.compositionProfiles.map((x) => (
              <option value={x} key={x}>{x}</option>
            ))}
          </select>
        </label>

        <label>
          Skeleton Override
          <select value={props.skeletonOverride} onChange={(e) => props.onSkeletonChange(e.target.value)}>
            <option value="">(default)</option>
            {props.skeletonLayouts.map((x) => (
              <option value={x} key={x}>{x}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="events">
        <button type="button" onClick={props.onResetOverrides}>Reset Overrides</button>
        <button type="button" onClick={props.onCopyShareUrl}>Copy Share URL</button>
        {props.hasQueryOverrides ? (
          <button type="button" onClick={props.onClearQueryOverrides}>Clear URL Overrides</button>
        ) : null}
      </div>
    </>
  );
}
