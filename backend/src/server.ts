
import express from 'express';
import cors from 'cors';
import { GameState } from './types.js';
import { startGameEngine, handleAction } from './gameEngine.js';
import { getInitialState } from './constants.js';
import { supabase } from './config/db.js';
import { Json } from './database.types.js';

const app = express();
const PORT = process.env.PORT || 10000;

// --- CORS Configuration for Debugging ---
const allowedOrigin = process.env.FRONTEND_URL;
console.log(`CORS configured to allow origin: ${allowedOrigin || '!!! NOT SET - WILL BLOCK FRONTEND !!!'}`);

const corsOptions = {
  origin: allowedOrigin,
  optionsSuccessStatus: 200 
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }) as any);

let gameState: GameState | null = null;

async function loadGameState() {
    const { data, error } = await supabase
        .from('game_state')
        .select('state')
        .eq('id', 1)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116: "object not found"
        console.error("Error loading game state from Supabase:", error);
        throw error;
    }

    if (data) {
        gameState = data.state as GameState;
        console.log(`Game state loaded from Supabase.`);
    } else {
        console.log(`No saved game state found in Supabase. Creating new game state.`);
        gameState = getInitialState();
        const { error: insertError } = await supabase
            .from('game_state')
            .insert([{ id: 1, state: gameState as unknown as Json }]);
        
        if (insertError) {
            console.error("Error creating initial game state in Supabase:", insertError);
            throw insertError;
        }
    }
}

async function saveGameState() {
    if (gameState) {
        try {
            const { error } = await supabase
                .from('game_state')
                .update({ state: gameState as unknown as Json })
                .eq('id', 1);

            if (error) {
                console.error("Failed to save game state to Supabase:", error);
            }
        } catch (error) {
            console.error("An exception occurred while saving game state:", error);
        }
    }
}

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

app.get('/api/state', (req, res) => {
    if (gameState) {
        res.json(gameState);
    } else {
        res.status(503).json({ message: 'Game state not initialized yet.' });
    }
});

app.post('/api/action', (req, res) => {
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
            console.log(`Persistence provider: Supabase`);
        });
    } else {
        console.error("FATAL: Game state could not be initialized.");
        (process as any).exit(1);
    }
});