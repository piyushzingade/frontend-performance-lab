export function ModeSwitcher<T extends string>({
  modes,
  value,
  onChange,
}: {
  modes: { id: T; label: string; hint?: string }[];
  value: T;
  onChange: (m: T) => void;
}) {
  return (
    <div className="mode-row" role="tablist" aria-label="Experiment mode">
      {modes.map((m) => (
        <button
          key={m.id}
          role="tab"
          aria-selected={value === m.id}
          className={value === m.id ? 'active' : ''}
          title={m.hint}
          onClick={() => onChange(m.id)}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
