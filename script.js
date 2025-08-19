document.addEventListener('DOMContentLoaded', () => {
    // ==================================================================
    // --- CONSTANTES E ESTADO DO JOGO ---
    // ==================================================================

    const BOARD_ROWS = 3;
    const BOARD_COLS = 3;
    const DICE_SIDES = 6;

    const gameState = {
        p1Board: [],
        p2Board: [],
        currentPlayer: 'p1',
        dice: { p1: null, p2: null },
        gameActive: false,
        mode: 'cpu',
        difficulty: 'medium',
        tutorialStep: 0
    };

    // ==================================================================
    // --- ELEMENTOS DO DOM ---
    // ==================================================================
    const gameModeSelection = document.getElementById('game-mode-selection');
    const difficultySelection = document.getElementById('difficulty-selection');
    const backToModeSelectButton = document.getElementById('back-to-mode-select');
    const gameWrapper = document.getElementById('game-wrapper');
    const tutorialTooltip = document.getElementById('tutorial-tooltip');
    const tutorialText = document.getElementById('tutorial-text');
    const p1Label = document.getElementById('p1-label');
    const p2Label = document.getElementById('p2-label');
    const p1BoardEl = document.getElementById('p1-board');
    const p2BoardEl = document.getElementById('p2-board');
    const p1DieDisplay = document.getElementById('p1-die-display');
    const p2DieDisplay = document.getElementById('p2-die-display');
    const p1Area = document.getElementById('p1-area');
    const p2Area = document.getElementById('p2-area');
    const turnInfoElement = document.getElementById('turn-info');
    const messageInfoElement = document.getElementById('message-info');
    const mainMenuButton = document.getElementById('main-menu-button');


    // ==================================================================
    // --- LÓGICA DO TUTORIAL ---
    // ==================================================================
    const tutorialSteps = [
        { text: "Bem-vindo! O objetivo é ter mais pontos que seu oponente. Você rolou um 3. Clique na primeira coluna para posicioná-lo.", p1Die: 3, p2Board: [[0,0,0],[0,0,0],[0,0,0]], requiredCol: 0 },
        { text: "Ótimo! Agora, vamos fazer um combo. Coloque este 4 na coluna do meio para começar.", p1Die: 4, p2Board: [[0,0,0],[0,0,0],[0,0,0]], requiredCol: 1 },
        { text: "Excelente! Coloque outro 4 na mesma coluna. Dados iguais multiplicam a pontuação da coluna!", p1Die: 4, p2Board: [[0,0,0],[0,0,0],[0,0,0]], requiredCol: 1 },
        { text: "Perfeito! (4+4) x 2 = 16 pontos! Agora, ataque. Coloque este 5 na terceira coluna para destruir o dado do oponente.", p1Die: 5, p2Board: [[0,0,5],[0,0,0],[0,0,0]], requiredCol: 2 },
        { text: "Exato! Você removeu o dado dele. Se houvesse dados acima, eles cairiam. Agora o oponente vai jogar.", p1Die: null, requiredCol: null },
        { text: "O oponente jogou um 6. Você completou o tutorial! Clique em 'Menu Principal' para jogar de verdade.", p1Die: null, requiredCol: null }
    ];

    function startTutorial() {
        gameState.tutorialStep = 0;
        gameState.mode = 'tutorial';
        initializeGame();
    }

    async function runTutorialStep() {
        if (gameState.tutorialStep >= tutorialSteps.length) return;
        const step = tutorialSteps[gameState.tutorialStep];
        
        gameState.dice.p1 = step.p1Die;
        if (step.p2Board) gameState.p2Board = JSON.parse(JSON.stringify(step.p2Board));
        
        tutorialText.textContent = step.text;
        updateDisplay();
        
        if (gameState.dice.p1) await animateDieRoll(p1DieDisplay, gameState.dice.p1);
        
        p1BoardEl.querySelectorAll('.column').forEach(c => c.classList.remove('highlight'));

        if (step.requiredCol !== null) {
            const requiredColumnEl = p1BoardEl.querySelector(`.column[data-col='${step.requiredCol}']`);
            if (requiredColumnEl) {
                requiredColumnEl.classList.add('highlight');
                requiredColumnEl.addEventListener('click', handleTutorialClick, { once: true });
                await delay(100);
                tutorialTooltip.classList.remove('hidden');
                positionTutorialTooltip(requiredColumnEl);
                tutorialTooltip.style.opacity = '1';
            }
        } else {
            tutorialTooltip.classList.remove('hidden');
            positionTutorialTooltip(null);
            tutorialTooltip.style.opacity = '1';

            if (gameState.tutorialStep === 4) {
                await delay(1500);
                gameState.p2Board[0][0] = 6;
                await animateDieRoll(p2DieDisplay, 6);
                animateCell(p2BoardEl.querySelector(`.cell[data-row='0'][data-col='0']`), 'placed');
                updateDisplay();
                await delay(2500);
                gameState.tutorialStep++;
                runTutorialStep();
            } else if (gameState.tutorialStep === 5) {
                turnInfoElement.textContent = "Tutorial Concluído!";
            }
        }
    }

    async function handleTutorialClick(event) {
        const clickedCol = parseInt(event.currentTarget.dataset.col);
        const step = tutorialSteps[gameState.tutorialStep];
        if (clickedCol !== step.requiredCol) return;
        
        tutorialTooltip.style.opacity = '0';
        event.currentTarget.classList.remove('highlight');
    
        const row = getFirstEmptyRow(gameState.p1Board, clickedCol);
        gameState.p1Board[row][clickedCol] = gameState.dice.p1;
    
        if (step.requiredCol === 2) {
            gameState.p2Board[0][2] = 0;
            animateCell(p2BoardEl.querySelector(`.cell[data-row='0'][data-col='2']`), 'destroyed');
        }
    
        updateDisplay();
        animateCell(p1BoardEl.querySelector(`.cell[data-row='${row}'][data-col='${clickedCol}']`), 'placed');
        
        await delay(1500);
        gameState.tutorialStep++;
        tutorialTooltip.classList.add('hidden');
        runTutorialStep();
    }
    
    // ==================================================================
    // --- FUNÇÕES DE LÓGICA E FLUXO DE JOGO ---
    // ==================================================================
    function initializeGame() {
        gameWrapper.classList.remove('hidden');
        difficultySelection.classList.add('hidden');
        gameModeSelection.classList.add('hidden');

        createBoard(p1BoardEl);
        createBoard(p2BoardEl);
        gameState.p1Board = Array(BOARD_ROWS).fill(0).map(() => Array(BOARD_COLS).fill(0));
        gameState.p2Board = Array(BOARD_ROWS).fill(0).map(() => Array(BOARD_COLS).fill(0));
        
        gameState.gameActive = true;
        gameState.currentPlayer = 'p1';
        gameState.dice.p1 = rollDie();
        gameState.dice.p2 = null;
        messageInfoElement.textContent = "";
        tutorialTooltip.classList.add('hidden');

        p1BoardEl.addEventListener('click', handleBoardClick);
        p2BoardEl.addEventListener('click', handleBoardClick);

        if (gameState.mode === 'tutorial') {
            setupLabels('Você', 'Oponente', 'Você Rolou', 'Oponente');
            runTutorialStep();
            return;
        }

        if (gameState.mode === 'cpu') {
            setupLabels('Você', 'CPU', 'Você Rolou', 'CPU Rolou');
            p2BoardEl.classList.remove('human-player');
        } else {
            setupLabels('Jogador 1', 'Jogador 2', 'Jogador 1', 'Jogador 2');
            p2BoardEl.classList.add('human-player');
        }
        
        updateDisplay();
        animateDieRoll(p1DieDisplay, gameState.dice.p1);
        p2DieDisplay.innerHTML = '';
        switchTurnUI();
    }
    
    function handleBoardClick(event) {
        if (gameState.mode === 'tutorial' || !gameState.gameActive) return;
        const columnEl = event.target.closest('.column');
        if (!columnEl) return;
        const isP1Board = event.currentTarget.id === 'p1-board';
        const isMyTurn = (isP1Board && gameState.currentPlayer === 'p1') || 
                         (!isP1Board && gameState.currentPlayer === 'p2' && gameState.mode === 'player');
        
        if (isMyTurn) {
            placeDieInColumn(parseInt(columnEl.dataset.col));
        }
    }

    function placeDieInColumn(col) {
        const active = {
            board: gameState.currentPlayer === 'p1' ? gameState.p1Board : gameState.p2Board,
            boardEl: gameState.currentPlayer === 'p1' ? p1BoardEl : p2BoardEl,
            die: gameState.currentPlayer === 'p1' ? gameState.dice.p1 : gameState.dice.p2
        };
        const opponent = {
            board: gameState.currentPlayer === 'p1' ? gameState.p2Board : gameState.p1Board,
            boardEl: gameState.currentPlayer === 'p1' ? p2BoardEl : p1BoardEl
        };

        const row = getFirstEmptyRow(active.board, col);
        if (row === -1) return;

        p1BoardEl.style.pointerEvents = 'none';
        p2BoardEl.style.pointerEvents = 'none';

        active.board[row][col] = active.die;
        
        let cellsDestroyed = false;
        opponent.board.forEach((r, r_idx) => {
            if (r[col] === active.die) {
                const destroyedCell = opponent.boardEl.querySelector(`.cell[data-row='${r_idx}'][data-col='${col}']`);
                animateCell(destroyedCell, 'destroyed');
                opponent.board[r_idx][col] = 0;
                cellsDestroyed = true;
            }
        });
        
        if (cellsDestroyed) applyGravity(opponent.board, col);
        updateDisplay();
        animateCell(active.boardEl.querySelector(`.cell[data-row='${row}'][data-col='${col}']`), 'placed');
        
        setTimeout(() => {
            updateDisplay();
            switchTurn();
        }, cellsDestroyed ? 500 : 100);
    }
    
    async function switchTurn() {
        if (isBoardFull(gameState.p1Board) || isBoardFull(gameState.p2Board)) {
            endGame();
            return;
        }
        
        gameState.currentPlayer = (gameState.currentPlayer === 'p1') ? 'p2' : 'p1';
        
        if (gameState.currentPlayer === 'p1') {
            gameState.dice.p1 = rollDie();
            await animateDieRoll(p1DieDisplay, gameState.dice.p1);
            if(gameState.mode === 'player') p2DieDisplay.innerHTML = '';
        } else {
            gameState.dice.p2 = rollDie();
            await animateDieRoll(p2DieDisplay, gameState.dice.p2);
            if(gameState.mode === 'player') p1DieDisplay.innerHTML = '';
        }
        
        switchTurnUI();
        p1BoardEl.style.pointerEvents = 'auto';
        p2BoardEl.style.pointerEvents = 'auto';

        if (gameState.mode === 'cpu' && gameState.currentPlayer === 'p2') {
            triggerCpuLogic();
        }
    }

    function endGame() {
        gameState.gameActive = false;
        const p1s = calculateScore(gameState.p1Board);
        const p2s = calculateScore(gameState.p2Board);
        const p1Name = gameState.mode === 'cpu' ? 'Você' : 'Jogador 1';
        const p2Name = gameState.mode === 'cpu' ? 'CPU' : 'Jogador 2';
        
        if (p1s > p2s) messageInfoElement.textContent = `🎉 ${p1Name} Venceu!`;
        else if (p2s > p1s) messageInfoElement.textContent = `☠️ ${p2Name} Venceu!`;
        else messageInfoElement.textContent = "⚖️ Empate!";
        
        turnInfoElement.textContent = "Fim de Jogo!";
        switchTurnUI();
    }
    
    function returnToMainMenu() {
        gameWrapper.classList.add('hidden');
        difficultySelection.classList.add('hidden');
        gameModeSelection.classList.remove('hidden');
        
        gameState.gameActive = false;
        tutorialTooltip.classList.add('hidden');
        tutorialTooltip.style.opacity = '0';
        p1BoardEl.removeEventListener('click', handleBoardClick);
        p2BoardEl.removeEventListener('click', handleBoardClick);
    }

    // ==================================================================
    // --- LÓGICA DA CPU ---
    // ==================================================================
    async function triggerCpuLogic() {
        p1BoardEl.style.pointerEvents = 'none';
        const col = cpuChooseColumn();
        await delay(1000);
        if (col === -1) {
            switchTurn();
            return;
        }
        const cpuColumnEl = p2BoardEl.querySelector(`.column[data-col='${col}']`);
        cpuColumnEl.classList.add('highlight');
        await delay(700);
        cpuColumnEl.classList.remove('highlight');
        placeDieInColumn(col);
    }

    function cpuChooseColumn() {
        const availableCols = [0, 1, 2].filter(c => getFirstEmptyRow(gameState.p2Board, c) !== -1);
        if (availableCols.length === 0) return -1;
        if (gameState.difficulty === 'easy') return availableCols[Math.floor(Math.random() * availableCols.length)];
        let scoredMoves = [];
        for (const col of availableCols) {
            let score = 0;
            const p2Die = gameState.dice.p2;
            const initialCpuScore = calculateScore(gameState.p2Board);
            const tempCpuBoard = JSON.parse(JSON.stringify(gameState.p2Board));
            tempCpuBoard[getFirstEmptyRow(tempCpuBoard, col)][col] = p2Die;
            score += calculateScore(tempCpuBoard) - initialCpuScore;
            if (gameState.p1Board.filter(row => row[col] === p2Die).length > 0) {
                const p1ScoreBefore = calculateScore(gameState.p1Board);
                const tempP1Board = JSON.parse(JSON.stringify(gameState.p1Board));
                for(let r=0; r<BOARD_ROWS; r++) { if(tempP1Board[r][col] === p2Die) tempP1Board[r][col] = 0; }
                applyGravity(tempP1Board, col);
                score += p1ScoreBefore - calculateScore(tempP1Board);
            }
            scoredMoves.push({ col, score });
        }
        scoredMoves.sort((a, b) => b.score - a.score);
        return scoredMoves[0].col;
    }


    // ==================================================================
    // --- FUNÇÕES UTILITÁRIAS E DE EXIBIÇÃO ---
    // ==================================================================
    const delay = (ms) => new Promise(res => setTimeout(res, ms));
    const rollDie = () => Math.floor(Math.random() * DICE_SIDES) + 1;

    function createDieVisual(value) {
        const dieVisual = document.createElement('div');
        dieVisual.className = 'die-visual';
        dieVisual.dataset.value = value;
        for (let i = 0; i < value; i++) {
            const pip = document.createElement('span');
            pip.className = 'pip';
            dieVisual.appendChild(pip);
        }
        return dieVisual;
    }

    function create3dDie() {
        const cube = document.createElement('div');
        cube.className = 'dice-cube';
        const facesData = {
            front: 1, back: 6,
            right: 4, left: 3,
            top: 5, bottom: 2
        };
        for (const [faceName, faceValue] of Object.entries(facesData)) {
            const face = document.createElement('div');
            face.className = `face ${faceName}`;
            face.appendChild(createDieVisual(faceValue));
            cube.appendChild(face);
        }
        return cube;
    }

    function createBoard(boardElement) {
        boardElement.innerHTML = '';
        for (let c = 0; c < BOARD_COLS; c++) {
            const column = document.createElement('div');
            column.className = 'column';
            column.dataset.col = c;
            for (let r = 0; r < BOARD_ROWS; r++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = r;
                cell.dataset.col = c;
                column.appendChild(cell);
            }
            boardElement.appendChild(column);
        }
    }

    function updateDisplay() {
        const boards = [
            { data: gameState.p1Board, el: p1BoardEl, scoreEl: document.getElementById('p1-score') },
            { data: gameState.p2Board, el: p2BoardEl, scoreEl: document.getElementById('p2-score') }
        ];

        boards.forEach(board => {
            for (let r = 0; r < BOARD_ROWS; r++) {
                for (let c = 0; c < BOARD_COLS; c++) {
                    const cell = board.el.querySelector(`.cell[data-row='${r}'][data-col='${c}']`);
                    if (cell) {
                        cell.innerHTML = '';
                        const value = board.data[r][c];
                        if (value !== 0) {
                            cell.appendChild(createDieVisual(value));
                        }
                    }
                }
            }
            board.scoreEl.textContent = calculateScore(board.data);
        });
    }

    function switchTurnUI() {
        if (!gameState.gameActive) {
            p1Area.classList.remove('active-player');
            p2Area.classList.remove('active-player');
            return;
        }
        const p2Name = gameState.mode === 'cpu' ? 'CPU' : 'Jogador 2';
        const p1Name = gameState.mode === 'player' ? 'Vez do Jogador 1' : 'Sua vez!';
        
        turnInfoElement.textContent = (gameState.currentPlayer === 'p1') ? p1Name : `Vez do ${p2Name}!`;
        p1Area.classList.toggle('active-player', gameState.currentPlayer === 'p1');
        p2Area.classList.toggle('active-player', gameState.currentPlayer === 'p2');
    }

    function setupLabels(p1Name, p2Name, p1DieLabel, p2DieLabel) {
        p1Label.innerHTML = `${p1Name} <span class="score">(<span id="p1-score">0</span>)</span>`;
        p2Label.innerHTML = `${p2Name} <span class="score">(<span id="p2-score">0</span>)</span>`;
        document.getElementById('p1-die-label').textContent = p1DieLabel;
        document.getElementById('p2-die-label').textContent = p2DieLabel;
    }
    
    function calculateScore(board) {
        let totalScore = 0;
        for (let col = 0; col < BOARD_COLS; col++) {
            const counts = {};
            board.forEach(row => {
                if(row[col] !== 0) counts[row[col]] = (counts[row[col]] || 0) + 1;
            });
            totalScore += Object.entries(counts).reduce((sum, [val, count]) => sum + parseInt(val) * count * count, 0);
        }
        return totalScore;
    }

    function getFirstEmptyRow(board, col) {
        for (let r = 0; r < BOARD_ROWS; r++) {
            if (board[r][col] === 0) return r;
        }
        return -1;
    }

    function isBoardFull(board) {
        return board[BOARD_ROWS - 1].every(cell => cell !== 0);
    }
    
    function applyGravity(board, col) {
        const columnValues = board.map(row => row[col]).filter(val => val !== 0);
        for (let r = 0; r < BOARD_ROWS; r++) {
            board[r][col] = r < columnValues.length ? columnValues[r] : 0;
        }
    }

    // ALTERAÇÃO PRINCIPAL: A função de animação definitiva, com realismo e à prova de falhas.
    async function animateDieRoll(dieElement, finalValue) {
        dieElement.innerHTML = '';
        const cube = create3dDie();
        dieElement.appendChild(cube);

        // Mapeamento matemático correto das rotações para cada face de um dado real.
        const finalRotations = {
            1: { x: 0,    y: 0 },
            2: { x: 90,   y: 0 },
            3: { x: 0,    y: 90 },
            4: { x: 0,    y: -90 },
            5: { x: -90,  y: 0 },
            6: { x: 0,    y: -180 }
        };

        // 1. Define um estado inicial de giro alto e aleatório para imprevisibilidade.
        // Adicionamos múltiplos de 360 para garantir que ele dê voltas completas antes de parar.
        const randomSpins = 4 + Math.floor(Math.random() * 4); // Entre 4 e 7 giros completos
        const startX = 360 * randomSpins + (Math.random() * 180 - 90); // Adiciona um desvio
        const startY = 360 * randomSpins + (Math.random() * 180 - 90);
        const startZ = 360 * randomSpins + (Math.random() * 180 - 90);

        // Aplica o estado inicial de giro sem transição.
        cube.style.transition = 'none';
        cube.style.transform = `rotateX(${startX}deg) rotateY(${startY}deg) rotateZ(${startZ}deg)`;

        // 2. Força o navegador a renderizar o estado inicial (previne o "pulo" da animação).
        cube.offsetHeight; 

        // 3. Adiciona a transição e aplica a rotação final exata.
        cube.style.transition = `transform 2s cubic-bezier(0.2, 0.8, 0.25, 1)`;
        const finalTransform = `rotateX(${finalRotations[finalValue].x}deg) rotateY(${finalRotations[finalValue].y}deg)`;
        cube.style.transform = finalTransform;

        // 4. Aguarda a animação de "pouso" terminar.
        await delay(2000); // Deve corresponder à duração da transição.

        // 5. Substitui o cubo 3D pela imagem 2D final para um acabamento limpo.
        dieElement.innerHTML = '';
        dieElement.appendChild(createDieVisual(finalValue));
    }


    function animateCell(cell, animationClass) {
        if (cell) {
            cell.classList.add(animationClass);
            cell.addEventListener('animationend', () => cell.classList.remove(animationClass), { once: true });
        }
    }

    function positionTutorialTooltip(targetColumnElement) {
        if (!targetColumnElement) {
            tutorialTooltip.style.top = '20px';
            tutorialTooltip.style.left = '50%';
            tutorialTooltip.style.transform = 'translateX(-50%)';
            return;
        }
        const rect = targetColumnElement.getBoundingClientRect();
        const wrapperRect = gameWrapper.getBoundingClientRect();
        tutorialTooltip.style.top = `${rect.top - wrapperRect.top - tutorialTooltip.offsetHeight - 15}px`;
        tutorialTooltip.style.left = `${rect.left - wrapperRect.left + rect.width / 2}px`;
        tutorialTooltip.style.transform = 'translateX(-50%)';
    }

    // ==================================================================
    // --- EVENT LISTENERS DOS MENUS ---
    // ==================================================================
    document.querySelectorAll('[data-mode]').forEach(button => {
        button.addEventListener('click', () => {
            const mode = button.dataset.mode;
            gameModeSelection.classList.add('hidden');
            if (mode === 'tutorial') {
                startTutorial();
            } else if (mode === 'cpu') {
                gameState.mode = 'cpu';
                difficultySelection.classList.remove('hidden');
            } else {
                gameState.mode = 'player';
                initializeGame();
            }
        });
    });

    document.querySelectorAll('[data-difficulty]').forEach(button => {
        button.addEventListener('click', () => {
            gameState.difficulty = button.dataset.difficulty;
            initializeGame();
        });
    });
    
    mainMenuButton.addEventListener('click', returnToMainMenu);

    backToModeSelectButton.addEventListener('click', () => {
        difficultySelection.classList.add('hidden');
        gameModeSelection.classList.remove('hidden');
    });
});