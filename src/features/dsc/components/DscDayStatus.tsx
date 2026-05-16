interface Props {
  status: 'open' | 'closed';
}

export function DscDayStatus({ status }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
        status === 'open'
          ? 'bg-green-100 text-green-700'
          : 'bg-red-100 text-red-700'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'open' ? 'bg-green-500' : 'bg-red-500'}`} />
      {status}
    </span>
  );
}
