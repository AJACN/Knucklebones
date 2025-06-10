document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DO DOM ---
    const gameModeSelection = document.getElementById('game-mode-selection');
    const difficultySelection = document.getElementById('difficulty-selection');
    const backToModeSelectButton = document.getElementById('back-to-mode-select');
    const gameWrapper = document.getElementById('game-wrapper');
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

    // --- ESTADO DO JOGO ---
    let p1Board, p2Board, currentPlayer, p1Die, p2Die, gameActive, gameMode, difficulty;

    // --- FUNÇÕES DE ANIMAÇÃO, UTILIDADE E LÓGICA ---

    async function animateDieRoll(dieElement, finalValue) {
        dieElement.classList.add('rolling');
        const rollInterval = setInterval(() => {
            dieElement.textContent = Math.floor(Math.random() * 6) + 1;
        }, 50);
        await new Promise(resolve => setTimeout(resolve, 500));
        clearInterval(rollInterval);
        dieElement.classList.remove('rolling');
        dieElement.textContent = finalValue;
    }

    function animateCell(cell, animationClass) {
        if (cell) {
            cell.classList.add(animationClass);
            cell.addEventListener('animationend', () => {
                cell.classList.remove(animationClass);
            }, { once: true });
        }
    }

    function applyGravity(board, col) {
        const columnValues = [];
        for (let r = 0; r < 3; r++) {
            if (board[r][col] !== 0) {
                columnValues.push(board[r][col]);
            }
        }
        for (let r = 0; r < 3; r++) {
            board[r][col] = r < columnValues.length ? columnValues[r] : 0;
        }
    }

    function createBoard(boardElement) {
        boardElement.innerHTML = '';
        for (let c = 0; c < 3; c++) {
            const column = document.createElement('div');
            column.className = 'column';
            column.dataset.col = c;
            for (let r = 0; r < 3; r++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = r;
                cell.dataset.col = c;
                column.appendChild(cell);
            }
            boardElement.appendChild(column);
        }
    }

    function calculateScore(board) {
        let totalScore = 0;
        for (let col = 0; col < 3; col++) {
            const columnValues = [];
            for (let row = 0; row < 3; row++) {
                if (board[row][col] !== 0) columnValues.push(board[row][col]);
            }
            const counts = columnValues.reduce((acc, val) => ({ ...acc, [val]: (acc[val] || 0) + 1 }), {});
            totalScore += Object.entries(counts).reduce((sum, [val, count]) => sum + parseInt(val) * count * count, 0);
        }
        return totalScore;
    }

    function getFirstEmptyRow(board, col) {
        for (let r = 0; r < 3; r++) {
            if (board[r][col] === 0) return r;
        }
        return -1;
    }

    function isBoardFull(board) {
        return board.every(row => row.every(cell => cell !== 0));
    }
    
    // ==================================================================
    // IA ATUALIZADA COM ANÁLISE DE CUSTO-BENEFÍCIO
    // ==================================================================
    function cpuChooseColumn() {
        const availableCols = [0, 1, 2].filter(c => getFirstEmptyRow(p2Board, c) !== -1);
        if (availableCols.length === 0) return -1;

        if (difficulty === 'easy') {
            return availableCols[Math.floor(Math.random() * availableCols.length)];
        }

        let scoredMoves = [];
        for (const col of availableCols) {
            let score = 0;
            const myColData = p2Board.map(row => row[col]).filter(val => val !== 0);

            // 1. PONTUAÇÃO DE COMBO (ganho de pontos para si mesmo)
            const initialCpuScore = calculateScore(p2Board);
            const tempCpuBoard = JSON.parse(JSON.stringify(p2Board));
            const rowToPlace = getFirstEmptyRow(tempCpuBoard, col);
            tempCpuBoard[rowToPlace][col] = p2Die;
            score += calculateScore(tempCpuBoard) - initialCpuScore;

            // 2. PONTUAÇÃO DE ATAQUE (com custo-benefício)
            const destroyedCount = p1Board.map(row => row[col]).filter(val => val === p2Die).length;
            if (destroyedCount > 0) {
                // BENEFÍCIO: Calcula os pontos que seriam removidos do oponente.
                const p1ScoreBefore = calculateScore(p1Board);
                const tempP1Board = JSON.parse(JSON.stringify(p1Board));
                for(let r=0; r<3; r++) { if(tempP1Board[r][col] === p2Die) tempP1Board[r][col] = 0; }
                applyGravity(tempP1Board, col); // Aplica gravidade para um cálculo de score preciso
                const p1ScoreAfter = calculateScore(tempP1Board);
                const benefit = p1ScoreBefore - p1ScoreAfter;

                if (difficulty === 'hard') {
                    // CUSTO: Calcula o prejuízo de devolver espaços vazios.
                    let cost = 0;
                    const p1CellCount = p1Board.flat().filter(val => val !== 0).length;
                    
                    // Custo é maior se o dado destruído for de baixo valor (1 ou 2).
                    if (p2Die <= 2) {
                        cost += destroyedCount * 5; 
                    }
                    // Custo é altíssimo se o tabuleiro do oponente estiver quase cheio.
                    if (p1CellCount >= 7) {
                        cost += destroyedCount * 8;
                    }
                    score += (benefit - cost); // A pontuação do ataque pode ser negativa se for uma má ideia.
                } else { // Dificuldade Média não calcula o custo e ataca de forma mais simples.
                    score += destroyedCount * p2Die * 3;
                }
            }

            // --- LÓGICA ADICIONAL APENAS PARA O MODO DIFÍCIL ---
            if (difficulty === 'hard') {
                // 3. Valor Intrínseco e Potencial Futuro
                score += p2Die * 0.1; // Bônus pequeno pelo valor do dado
                if (myColData.length === 0) {
                    score += p2Die; // Bônus maior para iniciar uma coluna com um dado alto (investimento)
                } else if (myColData.includes(p2Die)) {
                    score += p2Die * 0.5; // Bônus por preparar um combo
                }

                // 4. Análise de Risco: Não colocar dados altos em perigo
                const playerCanDestroy = getFirstEmptyRow(p1Board, col) !== -1;
                if (playerCanDestroy && p2Die >= 5) {
                    const playerHasMatch = p1Board.some(row => row.includes(p2Die));
                    if (!playerHasMatch) score -= p2Die * 2;
                }
                
                // 5. Análise de Segurança: Priorizar colunas seguras
                const isSafeColumn = getFirstEmptyRow(p1Board, col) === -1;
                if (isSafeColumn) {
                    score += 2;
                }
            }
            
            scoredMoves.push({ col, score });
        }

        // Ordena as jogadas da melhor para a pior
        scoredMoves.sort((a, b) => b.score - a.score);
        const bestScore = scoredMoves[0].score;
        const bestMoves = scoredMoves.filter(move => move.score === bestScore);
        
        // --- TOMADA DE DECISÃO ---
        // Para o modo Médio, se a melhor jogada não for um ganho claro, joga aleatoriamente.
        if (difficulty === 'medium' && bestScore <= 0) {
            return availableCols[Math.floor(Math.random() * availableCols.length)];
        }

        // Para Difícil (ou Médio com uma boa jogada), escolhe aleatoriamente entre as melhores opções para não ser previsível.
        return bestMoves[Math.floor(Math.random() * bestMoves.length)].col;
    }

    // --- LÓGICA DE INICIALIZAÇÃO E FLUXO DE JOGO ---
    function initializeGame() {
        gameWrapper.classList.remove('hidden');
        difficultySelection.classList.add('hidden');
        gameModeSelection.classList.add('hidden');
        createBoard(p1BoardEl);
        createBoard(p2BoardEl);
        p1Board = Array(3).fill(0).map(() => Array(3).fill(0));
        p2Board = Array(3).fill(0).map(() => Array(3).fill(0));
        gameActive = true;
        currentPlayer = 'p1';
        p1Die = Math.floor(Math.random() * 6) + 1;
        p2Die = null;
        messageInfoElement.textContent = "";
        if (gameMode === 'cpu') {
            p1Label.innerHTML = `Você <span class="score">(<span id="p1-score">0</span>)</span>`;
            p2Label.innerHTML = `CPU <span class="score">(<span id="p2-score">0</span>)</span>`;
            document.getElementById('p1-die-label').textContent = 'Você Rolou';
            document.getElementById('p2-die-label').textContent = 'CPU Rolou';
            p2BoardEl.classList.remove('human-player');
        } else {
            p1Label.innerHTML = `Jogador 1 <span class="score">(<span id="p1-score">0</span>)</span>`;
            p2Label.innerHTML = `Jogador 2 <span class="score">(<span id="p2-score">0</span>)</span>`;
            document.getElementById('p1-die-label').textContent = 'Jogador 1';
            document.getElementById('p2-die-label').textContent = 'Jogador 2';
            p2BoardEl.classList.add('human-player');
        }
        updateDisplay();
        animateDieRoll(p1DieDisplay, p1Die);
        p2DieDisplay.textContent = '';
        switchTurnUI();
    }
    function updateDisplay() {
        [p1Board, p2Board].forEach((boardData, index) => {
            const boardEl = index === 0 ? p1BoardEl : p2BoardEl;
            for (let r = 0; r < 3; r++) {
                for (let c = 0; c < 3; c++) {
                    const cell = boardEl.querySelector(`.cell[data-row='${r}'][data-col='${c}']`);
                    if(cell) cell.textContent = boardData[r][c] === 0 ? '' : boardData[r][c];
                }
            }
        });
        document.getElementById('p1-score').textContent = calculateScore(p1Board);
        document.getElementById('p2-score').textContent = calculateScore(p2Board);
    }
    function handleColumnClick(event) {
        if (!gameActive) return;
        const col = parseInt(event.currentTarget.dataset.col);
        const activePlayerBoard = (currentPlayer === 'p1') ? p1Board : p2Board;
        const opponentBoard = (currentPlayer === 'p1') ? p2Board : p1Board;
        const activePlayerDie = (currentPlayer === 'p1') ? p1Die : p2Die;
        const row = getFirstEmptyRow(activePlayerBoard, col);
        if (row === -1) return;
        manageEventListeners(true);
        activePlayerBoard[row][col] = activePlayerDie;
        let cellsDestroyed = false;
        for (let r_idx = 0; r_idx < 3; r_idx++) {
            if (opponentBoard[r_idx][col] === activePlayerDie) {
                const opponentBoardEl = (currentPlayer === 'p1') ? p2BoardEl : p1BoardEl;
                const destroyedCell = opponentBoardEl.querySelector(`.cell[data-row='${r_idx}'][data-col='${col}']`);
                animateCell(destroyedCell, 'destroyed');
                opponentBoard[r_idx][col] = 0;
                cellsDestroyed = true;
            }
        }
        if (cellsDestroyed) applyGravity(opponentBoard, col);
        const boardEl = (currentPlayer === 'p1') ? p1BoardEl : p2BoardEl;
        const placedCell = boardEl.querySelector(`.cell[data-row='${row}'][data-col='${col}']`);
        animateCell(placedCell, 'placed');
        setTimeout(() => {
            updateDisplay();
            switchTurn();
        }, cellsDestroyed ? 500 : 100);
    }
    function switchTurn() {
        if (isBoardFull(p1Board) || isBoardFull(p2Board)) {
            endGame();
            return;
        }
        currentPlayer = (currentPlayer === 'p1') ? 'p2' : 'p1';
        if (currentPlayer === 'p1') {
            p1Die = Math.floor(Math.random() * 6) + 1;
            p2Die = null;
            animateDieRoll(p1DieDisplay, p1Die);
            if(gameMode === 'player') p2DieDisplay.textContent = '';
        } else {
            p2Die = Math.floor(Math.random() * 6) + 1;
            p1Die = null;
            animateDieRoll(p2DieDisplay, p2Die);
            if(gameMode === 'player') p1DieDisplay.textContent = '';
        }
        switchTurnUI();
        if (gameMode === 'cpu' && currentPlayer === 'p2') {
            setTimeout(triggerCpuLogic, 1500);
        }
    }
    function switchTurnUI() {
        const p1Name = gameMode === 'cpu' ? 'Sua' : 'Jogador 1';
        const p2Name = gameMode === 'cpu' ? 'CPU' : 'Jogador 2';
        turnInfoElement.textContent = `Vez do ${currentPlayer === 'p1' ? p1Name : p2Name}!`;
        p1Area.classList.toggle('active-player', currentPlayer === 'p1' && gameActive);
        p2Area.classList.toggle('active-player', currentPlayer === 'p2' && gameActive);
        manageEventListeners();
    }
    function manageEventListeners(removeAll = false) {
        const p1Cols = p1BoardEl.querySelectorAll('.column');
        const p2Cols = p2BoardEl.querySelectorAll('.column');
        p1Cols.forEach(c => c.removeEventListener('click', handleColumnClick));
        p2Cols.forEach(c => c.removeEventListener('click', handleColumnClick));
        if (!gameActive || removeAll) return;
        if (currentPlayer === 'p1') {
            p1Cols.forEach(c => c.addEventListener('click', handleColumnClick));
        } else if (gameMode === 'player') {
             p2Cols.forEach(c => c.addEventListener('click', handleColumnClick));
        }
    }
    function triggerCpuLogic() {
        const col = cpuChooseColumn();
        if (col === -1) {
            switchTurn();
            return;
        }
        const cpuColumn = p2BoardEl.querySelector(`.column[data-col='${col}']`);
        handleColumnClick({ currentTarget: cpuColumn });
    }
    function endGame() {
        gameActive = false;
        const p1s = calculateScore(p1Board);
        const p2s = calculateScore(p2Board);
        const p1Name = gameMode === 'cpu' ? 'Você' : 'Jogador 1';
        const p2Name = gameMode === 'cpu' ? 'CPU' : 'Jogador 2';
        if (p1s > p2s) messageInfoElement.textContent = `🎉 ${p1Name} Venceu!`;
        else if (p2s > p1s) messageInfoElement.textContent = `☠️ ${p2Name} Venceu!`;
        else messageInfoElement.textContent = "⚖️ Empate!";
        turnInfoElement.textContent = "Fim de Jogo!";
        switchTurnUI();
    }

    // --- EVENT LISTENERS DOS MENUS ---
    document.querySelectorAll('[data-mode]').forEach(button => {
        button.addEventListener('click', () => {
            gameMode = button.dataset.mode;
            gameModeSelection.classList.add('hidden');
            if (gameMode === 'cpu') {
                difficultySelection.classList.remove('hidden');
            } else {
                initializeGame();
            }
        });
    });
    document.querySelectorAll('[data-difficulty]').forEach(button => {
        button.addEventListener('click', () => {
            difficulty = button.dataset.difficulty;
            initializeGame();
        });
    });
    mainMenuButton.addEventListener('click', () => {
        gameWrapper.classList.add('hidden');
        difficultySelection.classList.add('hidden');
        gameModeSelection.classList.remove('hidden');
    });
    backToModeSelectButton.addEventListener('click', () => {
        difficultySelection.classList.add('hidden');
        gameModeSelection.classList.remove('hidden');
    });
});