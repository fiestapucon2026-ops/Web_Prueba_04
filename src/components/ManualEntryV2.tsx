'use client';

import { useState } from 'react';

interface ManualEntryV2Props {
  onSubmit: (code: string) => void;
}

export default function ManualEntryV2({ onSubmit }: ManualEntryV2Props) {
  const [code, setCode] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length > 5) onSubmit(code.trim());
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 bg-white rounded-lg border border-gray-200 mt-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-2">Alternativa Manual</h3>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Pegar UUID o usar lector USB"
          className="flex-1 p-3 border rounded font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          autoFocus
        />
        <button
          type="submit"
          className="bg-gray-900 text-white px-4 py-2 rounded hover:bg-black font-medium text-sm"
        >
          Validar
        </button>
      </form>
    </div>
  );
}
