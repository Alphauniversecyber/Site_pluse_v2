type AdminPaginationProps = {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
};

export function AdminPagination({ page, totalPages, buildHref }: AdminPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#1F1F1F] pt-4 text-sm text-zinc-400">
      <span>
        Page {page} of {totalPages}
      </span>

      <div className="flex items-center gap-2">
        <a
          href={page > 1 ? buildHref(page - 1) : "#"}
          className={`rounded-full border px-3 py-1.5 ${
            page > 1
              ? "border-[#2A2A2A] bg-[#151515] text-zinc-200 hover:border-[#22C55E]"
              : "cursor-not-allowed border-[#1C1C1C] bg-[#101010] text-zinc-600"
          }`}
        >
          Previous
        </a>
        <a
          href={page < totalPages ? buildHref(page + 1) : "#"}
          className={`rounded-full border px-3 py-1.5 ${
            page < totalPages
              ? "border-[#2A2A2A] bg-[#151515] text-zinc-200 hover:border-[#22C55E]"
              : "cursor-not-allowed border-[#1C1C1C] bg-[#101010] text-zinc-600"
          }`}
        >
          Next
        </a>
      </div>
    </div>
  );
}
