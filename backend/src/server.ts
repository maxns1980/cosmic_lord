
import express from 'express';
import cors from 'cors';
import { GameState, PlanetSpecialization } from './types.js';
import { startGameEngine, handleAction } from './gameEngine.js';
import { getInitialState, PLAYER_HOME_COORDS } from './constants.js';
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

    if (data && data.state) {
        // --- MIGRATION LOGIC START ---
        // This ensures that games saved before a feature was added
        // get the default state for that feature, preventing crashes.
        const loadedState = data.state as unknown as Partial<GameState>;
        const defaultState = getInitialState();

        const migrateState = (loaded: Partial<GameState>): GameState => {
            const defaults = getInitialState();
            
            const merge = <T extends object>(defaultObj: T, loadedObj?: Partial<T>): T => {
                return { ...defaultObj, ...loadedObj };
            };

            // Start with a shallow merge for primitives and arrays
            const migrated = { ...defaults, ...loaded };

            // Deep merge nested objects to add new keys without losing saved data
            migrated.resources = merge(defaults.resources, loaded.resources);
            migrated.research = merge(defaults.research, loaded.research);
            migrated.shipLevels = merge(defaults.shipLevels, loaded.shipLevels);
            migrated.activeBoosts = merge(defaults.activeBoosts, loaded.activeBoosts);
            migrated.inventory = merge(defaults.inventory, loaded.inventory);
            
            migrated.merchantState = merge(defaults.merchantState, loaded.merchantState);
            migrated.pirateMercenaryState = merge(defaults.pirateMercenaryState, loaded.pirateMercenaryState);
            migrated.resourceVeinBonus = merge(defaults.resourceVeinBonus, loaded.resourceVeinBonus);
            migrated.ancientArtifactState = merge(defaults.ancientArtifactState, loaded.ancientArtifactState);
            migrated.spacePlague = merge(defaults.spacePlague, loaded.spacePlague);
            migrated.solarFlare = merge(defaults.solarFlare, loaded.solarFlare);
            migrated.contrabandState = merge(defaults.contrabandState, loaded.contrabandState);
            migrated.ghostShipState = merge(defaults.ghostShipState, loaded.ghostShipState);
            migrated.galacticGoldRushState = merge(defaults.galacticGoldRushState, loaded.galacticGoldRushState);
            migrated.stellarAuroraState = merge(defaults.stellarAuroraState, loaded.stellarAuroraState);
            migrated.dailyBonus = merge(defaults.dailyBonus, loaded.dailyBonus);

            // Deep merge colonies
            if (loaded.colonies) {
                const defaultColony = defaults.colonies[PLAYER_HOME_COORDS]!;
                for (const id in loaded.colonies) {
                    const loadedColony = loaded.colonies[id];
                    if (!loadedColony) continue;
                    
                    const baseColony = defaultColony; // Fallback
                    
                    migrated.colonies[id] = merge(baseColony, loadedColony);
                    migrated.colonies[id].buildings = merge(baseColony.buildings, loadedColony.buildings);
                    migrated.colonies[id].fleet = merge(baseColony.fleet, loadedColony.fleet);
                    migrated.colonies[id].defenses = merge(baseColony.defenses, loadedColony.defenses);
                }
            }

            // Deep merge moons
            if (loaded.moons) {
                const defaultColony = defaults.colonies[PLAYER_HOME_COORDS]!; // A moon is like a mini-colony
                for (const id in loaded.moons) {
                    const loadedMoon = loaded.moons[id];
                    if (!loadedMoon) continue;
                    
                    const defaultMoonTemplate = {
                        ...defaultColony,
                        name: 'Moon',
                        id: loadedMoon.id,
                        specialization: PlanetSpecialization.NONE,
                    };
                    migrated.moons[id] = merge(defaultMoonTemplate, loadedMoon);
                    migrated.moons[id].buildings = merge(defaultColony.buildings, loadedMoon.buildings);
                    migrated.moons[id].fleet = merge(defaultColony.fleet, loadedMoon.fleet);
                    migrated.moons[id].defenses = merge(defaultColony.defenses, loadedMoon.defenses);
                }
            }

            return migrated as GameState;
        };

        gameState = migrateState(loadedState);
        console.log(`Game state loaded and migrated from Supabase.`);
        // --- MIGRATION LOGIC END ---
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
