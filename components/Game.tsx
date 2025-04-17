'use client';

import { useState, useEffect, useCallback } from 'react';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const VOWELS = 'AEIOU';
const CONSONANTS = 'BCDFGHJKLMNPQRSTVWXYZ';

// Dictionary API endpoint - using Free Dictionary API
const DICTIONARY_API = 'https://api.dictionaryapi.dev/api/v2/entries/en/';

// Common 3-letter words to ensure level progression
const COMMON_WORDS = ['CAT', 'DOG', 'BAT', 'RAT', 'HAT', 'MAT', 'SIT', 'RUN', 'BIG', 'RED'];

// Point system based on word length
const POINTS = {
  2: 1,
  3: 2,
  4: 3,
  5: 5,
  6: 8,
  7: 13,
  8: 21,
  9: 34,
  10: 55
};

export default function Game() {
  const [letters, setLetters] = useState<string[]>([]);
  const [words, setWords] = useState<string[]>([]);
  const [currentWord, setCurrentWord] = useState('');
  const [gameState, setGameState] = useState<'start' | 'playing' | 'won' | 'lost'>('start');
  const [usedLetters, setUsedLetters] = useState<boolean[]>([]);
  const [error, setError] = useState<string>('');
  const [points, setPoints] = useState(0);
  const [level, setLevel] = useState(1);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [timerActive, setTimerActive] = useState(false);
  const [timeBonus, setTimeBonus] = useState<number | null>(null);
  const [demoState, setDemoState] = useState({
    selectedLetter: 0,
    points: 0,
    time: 30,
    showBonus: false,
    bonus: 2,
    usedLetters: [false, false, false]
  });

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'playing') return;
      
      const key = e.key.toUpperCase();
      if (key === 'BACKSPACE') {
        handleBackspace();
      } else if (key === 'ENTER') {
        handleSubmitWord();
      } else if (LETTERS.includes(key)) {
        // Find all available instances of the letter
        const availableIndices = letters
          .map((letter, index) => ({ letter, index }))
          .filter(({ letter, index }) => letter === key && !usedLetters[index]);

        if (availableIndices.length > 0) {
          // Use the first available instance
          const index = availableIndices[0].index;
          setSelectedLetter(index);
          setTimeout(() => setSelectedLetter(null), 500);
          handleLetterClick(key, index);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [letters, usedLetters, currentWord, gameState]);

  // Timer effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (timerActive && timeLeft > 0 && gameState === 'playing') {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setGameState('lost');
            setTimerActive(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [timerActive, timeLeft, gameState]);

  // Time bonus effect
  useEffect(() => {
    if (timeBonus !== null) {
      const timer = setTimeout(() => {
        setTimeBonus(null);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [timeBonus]);

  useEffect(() => {
    if (gameState === 'start') {
      const demoInterval = setInterval(() => {
        setDemoState(prev => {
          // Cycle through letter selection
          const nextLetter = (prev.selectedLetter + 1) % 3;
          
          // Show bonus every 3 seconds
          const showBonus = nextLetter === 0;
          
          // Update time
          const newTime = showBonus ? prev.time + 2 : prev.time - 1;
          
          // Update used letters
          const newUsedLetters = [...prev.usedLetters];
          if (nextLetter === 0) {
            // Reset all letters when starting new word
            newUsedLetters.fill(false);
          } else {
            // Mark current letter as used
            newUsedLetters[prev.selectedLetter] = true;
          }
          
          return {
            selectedLetter: nextLetter,
            points: showBonus ? prev.points + 2 : prev.points,
            time: newTime,
            showBonus,
            bonus: 2,
            usedLetters: newUsedLetters
          };
        });
      }, 1000);

      return () => clearInterval(demoInterval);
    }
  }, [gameState]);

  const handleBackspace = () => {
    if (currentWord.length === 0) return;
    
    const lastLetter = currentWord[currentWord.length - 1];
    // Find the last used instance of this letter
    const lastUsedIndex = [...usedLetters]
      .reverse()
      .findIndex((used, index) => used && letters[letters.length - 1 - index] === lastLetter);
    
    if (lastUsedIndex !== -1) {
      const actualIndex = letters.length - 1 - lastUsedIndex;
      setCurrentWord(prev => prev.slice(0, -1));
      setUsedLetters(prev => {
        const newUsed = [...prev];
        newUsed[actualIndex] = false;
        return newUsed;
      });
    }
  };

  const generateBalancedLetters = (count: number) => {
    const newLetters: string[] = [];
    // Ensure at least 2 vowels in the initial set
    const vowelCount = Math.max(2, Math.floor(count * 0.3));
    const consonantCount = count - vowelCount;

    // Add vowels
    for (let i = 0; i < vowelCount; i++) {
      newLetters.push(VOWELS[Math.floor(Math.random() * VOWELS.length)]);
    }

    // Add consonants
    for (let i = 0; i < consonantCount; i++) {
      newLetters.push(CONSONANTS[Math.floor(Math.random() * CONSONANTS.length)]);
    }

    // Shuffle the letters
    return newLetters.sort(() => Math.random() - 0.5);
  };

  const startNewGame = () => {
    const initialLetters = generateBalancedLetters(10);
    setLetters(initialLetters);
    setWords([]);
    setCurrentWord('');
    setGameState('playing');
    setUsedLetters(new Array(10).fill(false));
    setError('');
    setPoints(0);
    setLevel(1);
    setShowLevelUp(false);
    setSelectedLetter(null);
    setTimeLeft(30);
    setTimerActive(true);
  };

  const addMoreLetters = () => {
    const newLetters = generateBalancedLetters(5);
    setLetters([...letters, ...newLetters]);
    setUsedLetters(new Array(letters.length + 5).fill(false));
    setLevel(prev => prev + 1);
    setShowLevelUp(true);
    setTimeout(() => setShowLevelUp(false), 2000);
  };

  const handleLetterClick = (letter: string, index: number) => {
    if (usedLetters[index]) return;
    
    setSelectedLetter(index);
    setTimeout(() => setSelectedLetter(null), 500);
    
    setCurrentWord(prev => prev + letter);
    setUsedLetters(prev => {
      const newUsed = [...prev];
      newUsed[index] = true;
      return newUsed;
    });
  };

  const checkWordValidity = async (word: string) => {
    // Check if word is already used
    if (words.includes(word)) {
      return { valid: false, error: 'Word already used' };
    }

    // Check if word is in common words list (for quick validation)
    if (word.length === 3 && COMMON_WORDS.includes(word)) {
      return { valid: true };
    }

    try {
      const response = await fetch(`${DICTIONARY_API}${word.toLowerCase()}`);
      const data = await response.json();
      return {
        valid: Array.isArray(data) && data.length > 0,
        error: 'Not a valid word'
      };
    } catch (error) {
      console.error('Error checking word:', error);
      return { valid: false, error: 'Error checking word' };
    }
  };

  const handleSubmitWord = async () => {
    if (currentWord.length < 2) {
      setError('Word must be at least 2 letters long');
      return;
    }

    const { valid, error } = await checkWordValidity(currentWord);
    if (!valid) {
      setError(error || 'Not a valid word');
      return;
    }

    setError('');
    const newWords = [...words, currentWord];
    setWords(newWords);
    
    // Calculate points based on word length
    const wordPoints = POINTS[currentWord.length as keyof typeof POINTS] || 0;
    setPoints(prev => prev + wordPoints);
    
    // Add time based on points earned
    setTimeLeft(prev => prev + wordPoints);
    setTimeBonus(wordPoints);
    
    setCurrentWord('');
    setUsedLetters(new Array(letters.length).fill(false));

    // Check if we need to add more letters
    if (newWords.length === 3 || newWords.length === 6) {
      addMoreLetters();
    }

    // Check if game is complete (after 10 words)
    if (newWords.length === 10) {
      setGameState('won');
      setTimerActive(false);
    }
  };

  const handleClearWord = () => {
    setCurrentWord('');
    setUsedLetters(new Array(letters.length).fill(false));
    setError('');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6">
      {gameState === 'start' ? (
        <div className="text-center">
          <div className="bg-blue-50 p-6 rounded-lg mb-8">
            <div className="space-y-6">
              {/* Game Elements Demo */}
              <div className="flex flex-col items-center space-y-4">
                <div className="flex gap-2">
                  {['C', 'A', 'T'].map((letter, index) => (
                    <div
                      key={letter}
                      className={`w-10 h-10 rounded-md flex items-center justify-center text-xl font-bold transition-all duration-200 ${
                        demoState.usedLetters[index]
                          ? 'bg-gray-300 text-gray-500'
                          : demoState.selectedLetter === index
                          ? 'bg-blue-600 text-white'
                          : 'bg-blue-500 text-white'
                      }`}
                      style={{
                        transform: demoState.selectedLetter === index ? 'translateY(-8px)' : 'translateY(0)',
                        transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                    >
                      {letter}
                    </div>
                  ))}
                </div>
                <div className="text-sm text-gray-600">Click or type letters to form words</div>
              </div>

              {/* Points and Timer Display */}
              <div className="flex justify-center items-center space-x-8">
                <div className="relative">
                  <div className="text-4xl font-bold text-blue-500/30">{demoState.points}</div>
                  {demoState.showBonus && (
                    <div className="absolute -top-6 right-0 text-green-500 font-bold animate-bounce">
                      +{demoState.bonus}
                    </div>
                  )}
                  <div className="text-sm text-gray-600 mt-1">Points</div>
                </div>
                <div className="relative">
                  <div className={`text-4xl font-bold ${demoState.time < 10 ? 'text-red-500' : 'text-blue-500/30'}`}>
                    {formatTime(demoState.time)}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">Time</div>
                </div>
              </div>

              {/* Game Rules */}
              <div className="grid grid-cols-2 gap-4 text-left">
                <div className="p-3 bg-white rounded-lg shadow-sm">
                  <h3 className="font-semibold text-blue-800 mb-1">Level Up</h3>
                  <p className="text-gray-600 text-sm">New letters every 3 words</p>
                </div>
                <div className="p-3 bg-white rounded-lg shadow-sm">
                  <h3 className="font-semibold text-blue-800 mb-1">Win Condition</h3>
                  <p className="text-gray-600 text-sm">Make 10 words to win</p>
                </div>
                <div className="p-3 bg-white rounded-lg shadow-sm">
                  <h3 className="font-semibold text-blue-800 mb-1">Time Bonus</h3>
                  <p className="text-gray-600 text-sm">Each word adds time</p>
                </div>
                <div className="p-3 bg-white rounded-lg shadow-sm">
                  <h3 className="font-semibold text-blue-800 mb-1">Controls</h3>
                  <p className="text-gray-600 text-sm">Type or click to play</p>
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              startNewGame();
              setGameState('playing');
            }}
            className="px-8 py-3 bg-blue-500 text-white rounded-lg text-lg font-semibold hover:bg-blue-600 transition-colors duration-200"
          >
            Start Game
          </button>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center mb-4">
            <div className="text-lg font-semibold">Level: {level}</div>
            <div className="text-lg font-semibold">Points: {points}</div>
            <div className="relative">
              <div className={`text-4xl font-bold ${timeLeft < 10 ? 'text-red-500' : 'text-blue-500/30'}`}>
                {formatTime(timeLeft)}
              </div>
              {timeBonus !== null && (
                <div className="absolute -top-6 right-0 text-green-500 font-bold animate-bounce">
                  +{timeBonus}
                </div>
              )}
            </div>
          </div>

          {showLevelUp && (
            <div className="mb-4 p-3 bg-green-100 text-green-800 rounded-md text-center font-bold animate-bounce">
              Level Up! New letters added!
            </div>
          )}

          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Current Letters</h2>
            <div className="flex flex-wrap gap-2">
              {letters.map((letter, index) => (
                <button
                  key={index}
                  onClick={() => handleLetterClick(letter, index)}
                  disabled={usedLetters[index]}
                  className={`w-10 h-10 rounded-md flex items-center justify-center text-xl font-bold transition-all duration-200 ${
                    usedLetters[index]
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : selectedLetter === index
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-500 text-white hover:bg-blue-600 hover:scale-105'
                  }`}
                  style={{
                    transform: selectedLetter === index ? 'translateY(-8px)' : 'translateY(0)',
                    transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
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
                {currentWord.split('').map((letter, index) => (
                  <span
                    key={index}
                    className="inline-block"
                  >
                    {letter}
                  </span>
                ))}
              </div>
              <button
                onClick={handleClearWord}
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors duration-200"
              >
                Clear
              </button>
            </div>
            {error && (
              <p className="text-red-500 text-sm mt-2 animate-shake">{error}</p>
            )}
          </div>

          <button
            onClick={handleSubmitWord}
            disabled={currentWord.length < 2}
            className="w-full py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-300 transition-colors duration-200"
          >
            Submit Word
          </button>

          <div className="mt-6">
            <h2 className="text-xl font-semibold mb-2">Words Made ({words.length}/10)</h2>
            <div className="space-y-2">
              {words.map((word, index) => (
                <div 
                  key={index} 
                  className="p-2 bg-gray-100 rounded-md flex justify-between items-center animate-slide-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <span>{word}</span>
                  <span className="text-sm text-gray-600">
                    +{POINTS[word.length as keyof typeof POINTS] || 0} points
                  </span>
                </div>
              ))}
            </div>
          </div>

          {gameState !== 'playing' && (
            <div className="mt-6 p-4 bg-blue-100 rounded-md animate-fade-in">
              <p className="text-center font-semibold">
                {gameState === 'won' ? 'Congratulations! You won!' : 'Game Over!'}
              </p>
              <p className="text-center mt-2">Final Score: {points} points</p>
              <button
                onClick={startNewGame}
                className="w-full mt-2 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors duration-200"
              >
                Play Again
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
} 