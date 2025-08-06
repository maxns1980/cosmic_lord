
import express from 'express';
import { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { GameState, PlayerState, WorldState, Json } from './src/types';
import { handleAction, updatePlayerStateForOfflineProgress, updateWorldState, processRandomEvents } from './src/gameEngine';
import { getInitialPlayerState, getInitialWorldState, getInitialNpcPopulation, TOTAL_NPC_COUNT } from './src/constants';
import { supabase } from './src/config/db';
import { calculatePlayerPoints } from './src/utils/pointsLogic';
import { calculatePointsForNpc } from './src/utils/npcLogic';

declare global {
    namespace Express {
        interface Request {
            userId?: string;
        }
    }
}

const app = express();
const PORT = process.env.PORT || 10000;

const allowedOrigin = process.env.FRONTEND_URL || 'https://star-lord.netlify.app';
console.log(`CORS configured to allow origin: ${allowedOrigin}`);

const corsOptions = {
  origin: allowedOrigin,
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  optionsSuccessStatus: 200,
  preflightContinue: false,
};

app.use(cors(corsOptions));
app.use(express.json());

const findUnoccupiedCoordinates = (occupied: Record<string, string>): string => {
    const MAX_ATTEMPTS = 1000; // To prevent an infinite loop in a full universe
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
        const g = Math.floor(Math.random() * 9) + 1;
        const s = Math.floor(Math.random() * 499) + 1;
        const p = Math.floor(Math.random() * (12 - 4 + 1)) + 4; // Positions 4-12
        const coords = `${g}:${s}:${p}`;
        if (!occupied[coords]) {
            console.log(`Found random unoccupied coordinates after ${i + 1} attempts: ${coords}`);
            return coords;
        }
    }

    // Fallback to sequential search if random attempts fail (for a very full universe)
    console.warn(`Could not find random coordinates after ${MAX_ATTEMPTS} attempts. Falling back to sequential search.`);
    for (let g = 1; g <= 9; g++) {
        for (let s = 1; s <= 499; s++) {
            for (let p = 4; p <= 12; p++) {
                const coords = `${g}:${s}:${p}`;
                if (!occupied[coords]) {
                    return coords;
                }
            }
        }
    }

    // Absolute fallback (should never be reached in a normal game)
    return `1:${Math.floor(Math.random() * 499) + 1}:16`;
};

// Simplified and more robust world initialization
const initializeWorld = async () => {
    console.log("SERVER CODE VERSION: 4.0 - Initializing world state...");
    const { data, error } = await supabase
        .from('world_state')
        .select('state')
        .eq('id', 1)
        .single();

    // PGRST116 means "No rows found", which is expected on first run.
    if (error && error.code !== 'PGRST116') { 
        console.error("FATAL: Could not query for world state.", error);
        throw new Error("FATAL: Could not query for world state.");
    }

    if (!data) {
        console.log("No world state found. Creating new world...");
        const initialWorldState = getInitialWorldState();
        const { error: insertError } = await supabase
            .from('world_state')
            .insert([{ id: 1, state: initialWorldState as unknown as Json }]);

        if (insertError) {
            console.error("FATAL: Could not initialize world state.", insertError);
            throw new Error("FATAL: Could not initialize world state.");
        } else {
            console.log("World state