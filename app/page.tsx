'use client';

import { useState } from 'react';
import Game from '@/components/Game';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-8 text-gray-800">Lexicon</h1>
      <Game />
    </main>
  );
} 