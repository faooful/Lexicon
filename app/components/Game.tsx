'use client';

import { useState, useEffect } from 'react';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Dictionary API endpoint - using Free Dictionary API
const DICTIONARY_API = 'https://api.dictionaryapi.dev/api/v2/entries/en/';

export default function Game() {
  const [letters, setLetters] = useState<string[]>([]);
  const [words, setWords] = useState<string[]>([]);
  const [currentWord, setCurrentWord] = useState('');
  const [gameState, setGameState] = useState<'playing' | 'won' | 'lost'>('playing');
  const [usedLetters, setUsedLetters] = useState<boolean[]>([]);
  const [error, setError] = useState<string>('');

  // Initialize game with 10 random letters
  useEffect(() => {
    startNewGame();
  }, []);

  const startNewGame = () => {
    const initialLetters = Array.from({ length: 10 }, () => 
      LETTERS[Math.floor(Math.random() * LETTERS.length)]
    );
    setLetters(initialLetters);
    setWords([]);
    setCurrentWord('');
    setGameState('playing');
    setUsedLetters(new Array(10).fill(false));
    setError('');
  };

  const addMoreLetters = () => {
    const newLetters = Array.from({ length: 5 }, () => 
      LETTERS[Math.floor(Math.random() * LETTERS.length)]
    );
    setLetters([...letters, ...newLetters]);
    setUsedLetters([...usedLetters, ...new Array(5).fill(false)]);
  };

  const handleLetterClick = (letter: string, index: number) => {
    if (usedLetters[index]) return;
    
    setCurrentWord(prev => prev + letter);
    setUsedLetters(prev => {
      const newUsed = [...prev];
      newUsed[index] = true;
      return newUsed;
    });
  };

  const checkWordValidity = async (word: string) => {
    try {
      const response = await fetch(`${DICTIONARY_API}${word.toLowerCase()}`);
      const data = await response.json();
      return Array.isArray(data) && data.length > 0;
    } catch (error) {
      console.error('Error checking word:', error);
      return false;
    }
  };

  const handleSubmitWord = async () => {
    if (currentWord.length < 2) {
      setError('Word must be at least 2 letters long');
      return;
    }

    const isValid = await checkWordValidity(currentWord);
    if (!isValid) {
      setError('Not a valid word');
      return;
    }

    setError('');
    const newWords = [...words, currentWord];
    setWords(newWords);
    setCurrentWord('');
    setUsedLetters(new Array(letters.length).fill(false));

    // Check if we need to add more letters
    if (newWords.length === 3 || newWords.length === 6 || newWords.length === 9) {
      addMoreLetters();
    }

    // Check if game is complete
    if (newWords.length === 13) {
      setGameState('won');
    }
  };

  const handleClearWord = () => {
    setCurrentWord('');
    setUsedLetters(new Array(letters.length).fill(false));
    setError('');
  };

  return (
    <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Current Letters</h2>
        <div className="flex flex-wrap gap-2">
          {letters.map((letter, index) => (
            <button
              key={index}
              onClick={() => handleLetterClick(letter, index)}
              disabled={usedLetters[index]}
              className={`w-10 h-10 rounded-md flex items-center justify-center text-xl font-bold ${
                usedLetters[index]
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {letter}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Current Word</h2>
        <div className="flex items-center gap-2">
          <div className="flex-1 p-2 border rounded-md min-h-[40px]">
            {currentWord}
          </div>
          <button
            onClick={handleClearWord}
            className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
          >
            Clear
          </button>
        </div>
        {error && (
          <p className="text-red-500 text-sm mt-2">{error}</p>
        )}
      </div>

      <button
        onClick={handleSubmitWord}
        disabled={currentWord.length < 2}
        className="w-full py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-300"
      >
        Submit Word
      </button>

      <div className="mt-6">
        <h2 className="text-xl font-semibold mb-2">Words Made</h2>
        <div className="space-y-2">
          {words.map((word, index) => (
            <div key={index} className="p-2 bg-gray-100 rounded-md">
              {word}
            </div>
          ))}
        </div>
      </div>

      {gameState !== 'playing' && (
        <div className="mt-6 p-4 bg-blue-100 rounded-md">
          <p className="text-center font-semibold">
            {gameState === 'won' ? 'Congratulations! You won!' : 'Game Over!'}
          </p>
          <button
            onClick={startNewGame}
            className="w-full mt-2 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Play Again
          </button>
        </div>
      )}
    </div>
  );
} 