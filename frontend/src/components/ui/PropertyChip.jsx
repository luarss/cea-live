import { propertyType } from '../../lib/format';

export default function PropertyChip({ value, size = 'sm' }) {
  const type = propertyType(value);
  const sizing = size === 'lg' ? 'h-6 px-2.5 text-[13px]' : 'h-5 px-2 text-[11px]';

  return (
    <span
      className={`inline-flex items-center rounded-full font-bold tracking-wide text-white whitespace-nowrap ${sizing}`}
      style={{ backgroundColor: type.color }}
      title={type.label}
    >
      {type.code}
    </span>
  );
}
