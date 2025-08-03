
import express, { Request, Response } from 'express';
import cors, { CorsOptions } from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { GameState } from './types.js';
import { startGameEngine, handleAction } from './gameEngine.js';
import { getInitialState } from './constants.js';
import { exit } from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Simplified CORS Configuration
const corsOptions: CorsOptions = {
    origin: [process.env.FRONTEND_URL || 'http://localhost:5173'],
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const GAME_STATE_FILE = path.join(DATA_DIR, 'gamestate.json');

let gameState: GameState | null = null;

async function loadGameState() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        const data = await fs.readFile(GAME_STATE_FILE, 'utf-8');
        gameState = JSON.parse(data);
        console.log(`Game state loaded from ${GAME_STATE_FILE}.`);
    } catch (error) {
        console.log(`No saved game state found at ${GAME_STATE_FILE}. Starting new game.`);
        gameState = getInitialState();
    }
}

async function saveGameState() {
    if (gameState) {
        try {
            await fs.writeFile(GAME_STATE_FILE, JSON.stringify(gameState, null, 2));
        } catch (error) {
            console.error("Failed to save game state:", error);
        }
    }
}

app.get('/api/state', (req: Request, res: Response) => {
    if (gameState) {
        res.json(gameState);
    } else {
        res.status(503).json({ message: 'Game state not initialized yet.' });
    }
});

app.post('/api/action', (req: Request, res: Response) => {
    if (!gameState) {
        return res.status(503).json({ message: 'Game state not initialized yet.' });
    }
    const { type, payload } = req.body;
    try {
        const result = handleAction(gameState, type, payload);
        if (result?.error) {
            return res.status(400).json({ message: result.error });
        }
        res.status(200).json({ message: result?.message || 'Action processed' });
    } catch (e: any) {
        console.error(`Error processing action ${type}:`, e);
        res.status(500).json({ message: e.message || 'An error occurred processing the action.' });
    }
});

loadGameState().then(() => {
    if (gameState) {
        startGameEngine(gameState, saveGameState);
        
        app.listen(PORT, () => {
            console.log(`Backend server running on port ${PORT}`);
            console.log(`Data will be saved in: ${DATA_DIR}`);
        });
    } else {
        console.error("FATAL: Game state could not be initialized.");
        exit(1);
    }
});
