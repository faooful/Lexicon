// Game state
let gameState = {
    letters: [],
    currentWord: [],
    usedLetters: new Set(),
    points: 0,
    level: 1,
    timeLeft: 30,
    gameState: 'start',
    words: new Set(),
    showLevelUp: false,
    timeBonus: 0,
    selectedLetter: null,
    demoState: {
        selectedLetter: null,
        points: 0,
        time: 30,
        showBonus: false
    }
};

// Constants
const POINTS = {
    3: 2,
    4: 3,
    5: 5,
    6: 8,
    7: 13,
    8: 21
};

// DOM Elements
const gameContainer = document.getElementById('game');

// Initialize game
function initGame() {
    renderGame();
    setupEventListeners();
}

// Render game based on current state
function renderGame() {
    let content = '';
    
    switch(gameState.gameState) {
        case 'start':
            content = renderStartScreen();
            break;
        case 'playing':
            content = renderPlayingScreen();
            break;
        case 'gameOver':
            content = renderGameOverScreen();
            break;
        case 'win':
            content = renderWinScreen();
            break;
    }
    
    gameContainer.innerHTML = content;
}

// Start screen
function renderStartScreen() {
    return `
        <div class="text-center space-y-6">
            <h1 class="text-3xl font-bold text-blue-600">Word Game</h1>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="bg-blue-50 p-4 rounded-lg">
                    <div class="text-xl font-semibold mb-2">Create Words</div>
                    <div class="flex justify-center space-x-2 mb-2">
                        <button class="w-12 h-12 bg-blue-100 text-blue-600 font-bold rounded-lg shadow hover:bg-blue-200 transition">C</button>
                        <button class="w-12 h-12 bg-blue-100 text-blue-600 font-bold rounded-lg shadow hover:bg-blue-200 transition">A</button>
                        <button class="w-12 h-12 bg-blue-100 text-blue-600 font-bold rounded-lg shadow hover:bg-blue-200 transition">T</button>
                    </div>
                    <p class="text-sm text-gray-600">Use the letters to form valid words</p>
                </div>
                <div class="bg-green-50 p-4 rounded-lg">
                    <div class="text-xl font-semibold mb-2">Earn Points</div>
                    <div class="text-2xl font-bold text-green-600 mb-2">${gameState.demoState.points}</div>
                    <p class="text-sm text-gray-600">Longer words earn more points</p>
                </div>
                <div class="bg-yellow-50 p-4 rounded-lg">
                    <div class="text-xl font-semibold mb-2">Beat the Clock</div>
                    <div class="text-2xl font-bold text-yellow-600 mb-2">0:${gameState.demoState.time.toString().padStart(2, '0')}</div>
                    <p class="text-sm text-gray-600">30 seconds to start, each word adds time</p>
                </div>
                <div class="bg-purple-50 p-4 rounded-lg">
                    <div class="text-xl font-semibold mb-2">Level Up</div>
                    <p class="text-sm text-gray-600">New letters every 3 words</p>
                </div>
            </div>
            <button onclick="startGame()" class="mt-6 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow hover:bg-blue-700 transition">
                Start Game
            </button>
        </div>
    `;
}

// Playing screen
function renderPlayingScreen() {
    // Group letters by their position in a QWERTY keyboard
    const qwertyLayout = {
        'Q': [], 'W': [], 'E': [], 'R': [], 'T': [], 'Y': [], 'U': [], 'I': [], 'O': [], 'P': [],
        'A': [], 'S': [], 'D': [], 'F': [], 'G': [], 'H': [], 'J': [], 'K': [], 'L': [],
        'Z': [], 'X': [], 'C': [], 'V': [], 'B': [], 'N': [], 'M': []
    };

    // Group letters by their value
    gameState.letters.forEach((letter, index) => {
        if (qwertyLayout[letter]) {
            qwertyLayout[letter].push(index);
        }
    });

    return `
        <div class="space-y-6">
            <div class="flex justify-between items-center">
                <div class="text-2xl font-bold text-blue-600">${gameState.points} pts</div>
                <div class="text-4xl font-bold ${gameState.timeLeft < 10 ? 'text-red-500' : 'text-blue-500/30'}">
                    ${Math.floor(gameState.timeLeft / 60)}:${(gameState.timeLeft % 60).toString().padStart(2, '0')}
                </div>
                <div class="text-2xl font-bold text-purple-600">Level ${gameState.level}</div>
            </div>
            ${gameState.showLevelUp ? `
                <div class="text-center text-green-600 font-semibold animate-bounce">
                    Level Up! New letters added!
                </div>
            ` : ''}
            ${gameState.timeBonus > 0 ? `
                <div class="absolute top-0 left-1/2 transform -translate-x-1/2 text-green-600 font-bold animate-bounce">
                    +${gameState.timeBonus}s
                </div>
            ` : ''}
            
            <!-- QWERTY Keyboard Layout -->
            <div class="flex flex-col items-center space-y-2">
                <!-- Top Row -->
                <div class="flex space-x-1">
                    ${['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'].map(letter => `
                        <div class="flex space-x-1">
                            ${qwertyLayout[letter].map(index => `
                                <button 
                                    onclick="handleLetterClick(${index})"
                                    class="w-10 h-10 ${gameState.usedLetters.has(index) ? 'bg-gray-200 text-gray-400' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'} 
                                        font-bold rounded-lg shadow transition ${gameState.selectedLetter === index ? 'scale-110 rotate-6' : ''}"
                                >
                                    ${letter}
                                </button>
                            `).join('')}
                        </div>
                    `).join('')}
                </div>
                
                <!-- Middle Row -->
                <div class="flex space-x-1 ml-4">
                    ${['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'].map(letter => `
                        <div class="flex space-x-1">
                            ${qwertyLayout[letter].map(index => `
                                <button 
                                    onclick="handleLetterClick(${index})"
                                    class="w-10 h-10 ${gameState.usedLetters.has(index) ? 'bg-gray-200 text-gray-400' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'} 
                                        font-bold rounded-lg shadow transition ${gameState.selectedLetter === index ? 'scale-110 rotate-6' : ''}"
                                >
                                    ${letter}
                                </button>
                            `).join('')}
                        </div>
                    `).join('')}
                </div>
                
                <!-- Bottom Row -->
                <div class="flex space-x-1 ml-8">
                    ${['Z', 'X', 'C', 'V', 'B', 'N', 'M'].map(letter => `
                        <div class="flex space-x-1">
                            ${qwertyLayout[letter].map(index => `
                                <button 
                                    onclick="handleLetterClick(${index})"
                                    class="w-10 h-10 ${gameState.usedLetters.has(index) ? 'bg-gray-200 text-gray-400' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'} 
                                        font-bold rounded-lg shadow transition ${gameState.selectedLetter === index ? 'scale-110 rotate-6' : ''}"
                                >
                                    ${letter}
                                </button>
                            `).join('')}
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="flex flex-wrap gap-2 justify-center min-h-12">
                ${gameState.currentWord.map((letter, index) => `
                    <span class="text-2xl font-bold text-blue-600 animate-bounce" style="animation-delay: ${index * 0.1}s">
                        ${letter}
                    </span>
                `).join('')}
            </div>
            <div class="flex justify-center space-x-4">
                <button onclick="handleSubmitWord()" class="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg shadow hover:bg-green-700 transition">
                    Submit
                </button>
                <button onclick="handleClearWord()" class="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg shadow hover:bg-red-700 transition">
                    Clear
                </button>
            </div>
        </div>
    `;
}

// Game over screen
function renderGameOverScreen() {
    return `
        <div class="text-center space-y-6">
            <h2 class="text-2xl font-bold text-red-600">Game Over!</h2>
            <p class="text-xl">You scored ${gameState.points} points!</p>
            <button onclick="startGame()" class="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow hover:bg-blue-700 transition">
                Play Again
            </button>
        </div>
    `;
}

// Win screen
function renderWinScreen() {
    return `
        <div class="text-center space-y-6">
            <h2 class="text-2xl font-bold text-green-600">You Win!</h2>
            <p class="text-xl">Final Score: ${gameState.points} points</p>
            <button onclick="startGame()" class="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow hover:bg-blue-700 transition">
                Play Again
            </button>
        </div>
    `;
}

// Event listeners
function setupEventListeners() {
    document.addEventListener('keydown', handleKeyDown);
}

// Game functions
function startGame() {
    gameState = {
        ...gameState,
        letters: generateLetters(),
        currentWord: [],
        usedLetters: new Set(),
        points: 0,
        level: 1,
        timeLeft: 30,
        gameState: 'playing',
        words: new Set(),
        showLevelUp: false,
        timeBonus: 0,
        selectedLetter: null
    };
    startTimer();
    renderGame();
}

function generateLetters() {
    const vowels = 'AEIOU'.split('');
    const consonants = 'BCDFGHJKLMNPQRSTVWXYZ'.split('');
    const letters = [];
    
    // Add 3 vowels
    for (let i = 0; i < 3; i++) {
        letters.push(vowels[Math.floor(Math.random() * vowels.length)]);
    }
    
    // Add 7 consonants
    for (let i = 0; i < 7; i++) {
        letters.push(consonants[Math.floor(Math.random() * consonants.length)]);
    }
    
    return letters.sort(() => Math.random() - 0.5);
}

function handleLetterClick(index) {
    if (gameState.usedLetters.has(index)) return;
    
    gameState.selectedLetter = index;
    gameState.currentWord.push(gameState.letters[index]);
    gameState.usedLetters.add(index);
    
    renderGame();
    
    setTimeout(() => {
        gameState.selectedLetter = null;
        renderGame();
    }, 200);
}

function handleKeyDown(event) {
    if (gameState.gameState !== 'playing') return;
    
    if (event.key >= 'a' && event.key <= 'z') {
        const letter = event.key.toUpperCase();
        const availableIndices = gameState.letters
            .map((l, i) => l === letter && !gameState.usedLetters.has(i) ? i : -1)
            .filter(i => i !== -1);
        
        if (availableIndices.length > 0) {
            const index = availableIndices[0];
            handleLetterClick(index);
        }
    } else if (event.key === 'Backspace') {
        handleClearWord();
    } else if (event.key === 'Enter') {
        handleSubmitWord();
    }
}

function handleClearWord() {
    gameState.currentWord = [];
    gameState.usedLetters.clear();
    renderGame();
}

function handleSubmitWord() {
    const word = gameState.currentWord.join('').toLowerCase();
    
    if (word.length < 3) {
        showError('Word must be at least 3 letters long');
        return;
    }
    
    if (gameState.words.has(word)) {
        showError('Word already used');
        return;
    }
    
    // In a real game, you'd check against a dictionary here
    // For demo purposes, we'll accept any word of 3+ letters
    gameState.words.add(word);
    
    const points = POINTS[word.length] || 2;
    gameState.points += points;
    
    const timeBonus = Math.max(2, Math.floor(word.length / 2));
    gameState.timeLeft += timeBonus;
    gameState.timeBonus = timeBonus;
    
    setTimeout(() => {
        gameState.timeBonus = 0;
        renderGame();
    }, 1000);
    
    if (gameState.words.size >= 10) {
        gameState.gameState = 'win';
        clearInterval(gameState.timer);
    } else if (gameState.words.size % 3 === 0) {
        gameState.level++;
        gameState.showLevelUp = true;
        setTimeout(() => {
            gameState.showLevelUp = false;
            gameState.letters = [...gameState.letters, ...generateLetters().slice(0, 3)];
            renderGame();
        }, 2000);
    }
    
    gameState.currentWord = [];
    gameState.usedLetters.clear();
    renderGame();
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg animate-shake';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 2000);
}

function startTimer() {
    if (gameState.timer) {
        clearInterval(gameState.timer);
    }
    
    gameState.timer = setInterval(() => {
        gameState.timeLeft--;
        
        if (gameState.timeLeft <= 0) {
            clearInterval(gameState.timer);
            gameState.gameState = 'gameOver';
        }
        
        renderGame();
    }, 1000);
}

// Start demo animation
function startDemoAnimation() {
    setInterval(() => {
        if (gameState.gameState === 'start') {
            gameState.demoState.selectedLetter = Math.floor(Math.random() * 3);
            gameState.demoState.points = Math.min(30, gameState.demoState.points + 2);
            gameState.demoState.time = Math.max(20, gameState.demoState.time - 1);
            gameState.demoState.showBonus = true;
            
            setTimeout(() => {
                gameState.demoState.showBonus = false;
            }, 500);
            
            renderGame();
        }
    }, 2000);
}

// Initialize the game
initGame();
startDemoAnimation(); 