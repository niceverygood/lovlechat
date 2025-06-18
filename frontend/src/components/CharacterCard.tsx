// src/components/CharacterCard.tsx
import React from "react";

interface Character {
  id: string;
  name: string;
  imageUrl: string;
  tags: string[];
}

interface Props {
  character: Character;
  onClick: (id: string) => void;
}

export default function CharacterCard({ character, onClick }: Props) {
  return (
    <div
      className="w-40 bg-white rounded-xl shadow p-4 cursor-pointer hover:shadow-md transition"
      onClick={() => onClick(character.id)}
    >
      <img
        src={character.imageUrl}
        alt={character.name}
        className="w-full h-32 object-cover rounded-lg mb-3"
      />
      <h3 className="text-lg font-semibold">{character.name}</h3>
      <div className="flex flex-wrap gap-1 mt-1">
        {character.tags.map((t) => (
          <span key={t} className="text-xs bg-pink-100 text-pink-500 px-2 py-0.5 rounded-full">
            #{t}
          </span>
        ))}
      </div>
    </div>
  );
}
