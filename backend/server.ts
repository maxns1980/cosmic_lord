import express, { Request, Response, NextFunction } from 'express';
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
            .insert([{ id: 1, state: initialWorldState as Json }]);

        if (insertError) {
            console.error("FATAL: Could not initialize world state.", insertError);
            throw new Error("FATAL: Could not initialize world state.");
        } else {
            console.log("World state initialized successfully with NPCs.");
        }
    } else {
        console.log("World state loaded.");
        const worldState = data.state as WorldState;
        
        let migrationNeeded = false;
        if (!worldState.publicPlayerData) {
             migrationNeeded = true;
        } else if (worldState.npcStates) {
            // Check if publicPlayerData is missing for any NPC
            for (const coord in worldState.npcStates) {
                const npc = worldState.npcStates[coord];
                if (!worldState.publicPlayerData[npc.name]) {
                    migrationNeeded = true;
                    break;
                }
            }
        }
        
        // MIGRATION: Add publicPlayerData if it doesn't exist or is incomplete for NPCs
        if (migrationNeeded) {
            console.log("Migrating world state: adding or completing publicPlayerData.");
            if (!worldState.publicPlayerData) {
                worldState.publicPlayerData = {};
            }
            
            const { data: allPlayers, error: allPlayersError } = await supabase.from('player_states').select('user_id, state');

            if (allPlayersError) {
                console.error("MIGRATION FAILED: could not fetch players to build public data.", allPlayersError);
            } else if (allPlayers) {
                for (const player of allPlayers) {
                    if (!player.user_id) continue;
                    const playerState = player.state as PlayerState;
                    const points = calculatePlayerPoints(playerState);
                    worldState.publicPlayerData[player.user_id] = {
                        points: points,
                        lastActivity: playerState.lastSaveTime || Date.now()
                    };
                }
                console.log(`Migration successful. Populated/verified public data for ${allPlayers.length} players.`);
            }

            // Handle NPCs
            if (worldState.npcStates) {
                for (const coord in worldState.npcStates) {
                    const npc = worldState.npcStates[coord];
                    const points = calculatePointsForNpc(npc);
                    worldState.publicPlayerData[npc.name] = {
                        points: points,
                        lastActivity: npc.lastUpdateTime
                    };
                }
                console.log(`Migration successful. Populated public data for ${Object.keys(worldState.npcStates).length} NPCs.`);
            }

             const { error: updateError } = await supabase.from('world_state').update({ state: worldState as Json }).eq('id', 1);
            if (updateError) {
                console.error("MIGRATION FAILED: Could not save migrated world state.", updateError);
            }
        }


        if (!worldState.npcStates || Object.keys(worldState.npcStates).length < TOTAL_NPC_COUNT) {
             console.log(`World state has insufficient NPCs (${Object.keys(worldState.npcStates || {}).length}). Populating to ${TOTAL_NPC_COUNT}...`);

             const playerCoords = Object.keys(worldState.occupiedCoordinates || {}).filter(coord => !(worldState.npcStates || {})[coord]);
             const { npcStates, occupiedCoordinates: npcOccupiedCoordinates } = getInitialNpcPopulation(playerCoords);

             worldState.npcStates = npcStates;
             // Merge coordinates, preserving existing player locations
             worldState.occupiedCoordinates = { ...worldState.occupiedCoordinates, ...npcOccupiedCoordinates };

             const { error: updateError } = await supabase.from('world_state').update({ state: worldState as Json }).eq('id', 1);
            if (updateError) {
                console.error("FATAL: Could not migrate world state to add NPCs.", updateError);
                throw new Error("FATAL: Could not migrate world state.");
            }
            console.log("NPC migration successful.");
        }
    }
};


// --- Auth Endpoints ---

app.post('/api/signup', async (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (!username || !password || username.length < 3 || password.length < 3) {
        return res.status(400).json({ message: 'Nazwa użytkownika i hasło muszą mieć co najmniej 3 znaki.' });
    }

    try {
        // 1. Check if user already exists
        const { data: existingUser, error: findError } = await supabase
            .from('users')
            .select('username')
            .eq('username', username)
            .single();

        if (findError && findError.code !== 'PGRST116') {
            console.error('Signup find error:', findError);
            return res.status(500).json({ message: 'Błąd serwera przy sprawdzaniu użytkownika.' });
        }

        if (existingUser) {
            return res.status(409).json({ message: 'Nazwa użytkownika jest już zajęta.' });
        }

        // 2. Get world state to find a free spot
        const { data: worldData, error: worldError } = await supabase.from('world_state').select('state').eq('id', 1).single();
        if (worldError || !worldData) {
            console.error('Signup world load error:', worldError);
            return res.status(500).json({ message: 'Błąd krytyczny: Nie można załadować świata gry.' });
        }
        const worldState = worldData.state as WorldState;

        // 3. Find coordinates and create initial player state
        const homeCoords = findUnoccupiedCoordinates(worldState.occupiedCoordinates);
        const newPlayerState = getInitialPlayerState(username, homeCoords);

        // 4. Create the new user
        const { error: insertUserError } = await supabase
            .from('users')
            .insert([{ username, password }]);

        if (insertUserError) {
            console.error('Signup insert user error:', insertUserError);
            return res.status(500).json({ message: 'Nie udało się utworzyć użytkownika.' });
        }

        // 5. Create the player state
        const { error: insertStateError } = await supabase
            .from('player_states')
            .insert([{ user_id: username, state: newPlayerState as Json }]);
        
        if (insertStateError) {
            console.error('Signup insert state error:', insertStateError);
            // Rollback user creation if state creation fails
            await supabase.from('users').delete().eq('username', username);
             if (insertStateError.message.includes('relation "public.player_states" does not exist')) {
                return res.status(500).json({ message: 'Błąd serwera: Tabela "player_states" nie istnieje w bazie danych. Uruchom poprawny skrypt SQL.' });
            }
            return res.status(500).json({ message: 'Nie udało się utworzyć stanu gry.' });
        }
        
        // 6. Update world state with the new occupied coordinate
        worldState.occupiedCoordinates[homeCoords] = username;
        const initialPoints = calculatePlayerPoints(newPlayerState);
        worldState.publicPlayerData[username] = { points: initialPoints, lastActivity: Date.now() };

        const { error: worldSaveError } = await supabase.from('world_state').update({ state: worldState as Json }).eq('id', 1);
        if (worldSaveError) {
             console.error('Signup world save error:', worldSaveError);
             // This is not a fatal error for the user, but should be logged.
        }
        
        res.status(201).json({ message: 'Konto utworzone pomyślnie! Możesz się teraz zalogować.' });
    } catch (e) {
        console.error('Signup exception:', e);
        res.status(500).json({ message: 'Wystąpił nieoczekiwany błąd.' });
    }
});

app.post('/api/login', async (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Nazwa użytkownika i hasło są wymagane