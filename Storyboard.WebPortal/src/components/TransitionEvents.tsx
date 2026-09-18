interface TransitionEventsProps {
  events: string[];
  onTriggerEvent: (eventName: string) => void;
}

export function TransitionEvents(props: TransitionEventsProps): JSX.Element {
  return (
    <div className="events">
      <span>Transition Events:</span>
      {props.events.length === 0 ? <span>None</span> : null}
      {props.events.map((evt) => (
        <button
          type="button"
          key={evt}
          onClick={() => props.onTriggerEvent(evt)}
        >
          {evt}
        </button>
      ))}
    </div>
  );
}
