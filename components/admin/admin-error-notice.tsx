export function AdminErrorNotice({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }

  return (
    <div className="mb-6 rounded-2xl border border-[#7F1D1D] bg-[#2A1010] px-4 py-3 text-sm text-[#FCA5A5]">
      {message}
    </div>
  );
}
