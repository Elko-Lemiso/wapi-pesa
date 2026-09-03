"use client";

import { useToast } from "@/lib/toast/context";

interface ExportBarProps {
  sessionId: string;
}

export function ExportBar({ sessionId }: ExportBarProps) {
  const { toast } = useToast();
  const handleDownload = (type: "pdf" | "csv") => {
    window.open(`/api/download?sessionId=${sessionId}&type=${type}`, "_blank");
    toast.info(
      type === "pdf" ? "Generating PDF" : "Generating CSV",
      "Your download will start in a moment."
    );
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => handleDownload("pdf")}
        className="inline-flex items-center gap-1.5 bg-white/5 text-text-secondary border border-white/10 px-4 py-2.5 rounded-full text-xs font-medium hover:border-coral/40 hover:text-coral hover:bg-coral/5 transition-all min-h-[40px]"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        PDF
      </button>
      <button
        onClick={() => handleDownload("csv")}
        className="inline-flex items-center gap-1.5 bg-white/5 text-text-secondary border border-white/10 px-4 py-2.5 rounded-full text-xs font-medium hover:border-green/40 hover:text-green hover:bg-green/5 transition-all min-h-[40px]"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        CSV
      </button>
    </div>
  );
}
