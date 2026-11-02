"use client";

import React, { useRef, useState } from "react";
import { Upload } from "lucide-react";

export default function FileDropZone({
  accept,
  label,
  fileName,
  onFile,
}: {
  accept: string;
  label: string;
  fileName?: string;
  onFile: (file: File) => void;
}) {
  const input = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) onFile(file);
      }}
      className={`p-10 text-center rounded-xl border-2 border-dashed transition-colors ${
        dragging ? "border-[#287FC1] bg-blue-50" : "border-gray-300 bg-white"
      }`}
    >
      <div className="w-14 h-14 mx-auto rounded-full bg-blue-50 flex items-center justify-center text-[#287FC1] mb-3">
        <Upload className="w-6 h-6" />
      </div>
      <p className="text-base font-semibold text-gray-900">{fileName || `Drop your ${label} file here`}</p>
      <p className="text-sm text-gray-500 mt-0.5">{fileName ? "Choose a different file below" : "or click to browse"}</p>
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="mt-4 px-4 py-2 text-sm font-semibold text-white bg-[#287FC1] hover:bg-[#1a5f94] rounded-lg cursor-pointer"
      >
        Choose File
      </button>
      <input
        ref={input}
        type="file"
        accept={accept}
        aria-label={`Choose a ${label} file`}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
