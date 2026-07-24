import type { ThelmaFormat } from './types';

interface FormatControlsProps {
  format: ThelmaFormat;
  onChange: (format: ThelmaFormat) => void;
}

const OPTIONS: { value: ThelmaFormat; label: string }[] = [
  { value: '16:9', label: '16:9 · Horizontal' },
  { value: '9:16', label: '9:16 · Vertical' },
];

export function FormatControls({ format, onChange }: FormatControlsProps) {
  return (
    <div className="thelma-format-controls">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`thelma-format-btn${format === opt.value ? ' active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
