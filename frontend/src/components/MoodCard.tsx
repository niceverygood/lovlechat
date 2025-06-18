// src/components/MoodCard.tsx
import React from "react";

interface Props {
  label: string;
  selected: boolean;
  onClick: (label: string) => void;
}

export default function MoodCard({ label, selected, onClick }: Props) {
  return (
    <button
      onClick={() => onClick(label)}
      className={`px-6 py-3 rounded-full border transition ${
        selected
          ? "bg-pink-500 text-white border-transparent"
          : "bg-white text-pink-500 border-pink-300 hover:bg-pink-100"
      }`}
    >
      {label}
    </button>
  );
}
