import express, { Response, NextFunction } from 'express';
import cors from 'cors';
import { GameState, PlayerState, WorldState } from './src/types';
import { handleAction, updatePlayerStateForOfflineProgress, updateWorldState } from './src/gameEngine';
import { getInitialPlayerState, getInitialWorldState, getInitialNpcPopulation, TOTAL_NPC_COUNT } from './src/constants';
import { supabase } from './src/config/db';

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
app.options('*', cors(corsOptions)); // enable pre-flight for all routes

app.use(express.json());

const findUnoccupiedCoordinates = (occupied: Record<string, string>): string => {
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
    // Fallback in case all preferred spots are taken
    return `1:${Math.floor(Math.random() * 499) + 1}:16`; 
};

// Simplified and more robust world initialization
const initializeWorld = async () => {
    console.log("SERVER CODE VERSION: 4.0 - Initializing world state...");
    const { data, error } = await supabase
        .from('world_state')
        .select('*')
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
            .insert([{ id: 1, state: initialWorldState as any }]);

        if (insertError) {
            console.error("FATAL: Could not initialize world state.", insertError);
            throw new Error("FATAL: Could not initialize world state.");
        } else {
            console.log("World state initialized successfully with NPCs.");
        }
    } else {
        console.log("World state loaded.");
        const worldState = data.state as unknown as WorldState;
        if (!worldState.npcStates || Object.keys(worldState.npcStates).length < TOTAL_NPC_COUNT) {
             console.log(`World state has insufficient NPCs (${Object.keys(worldState.npcStates || {}).length}). Populating to ${TOTAL_NPC_COUNT}...`);

             const playerCoords = Object.keys(worldState.occupiedCoordinates || {}).filter(coord => !(worldState.npcStates || {})[coord]);
             const { npcStates, occupiedCoordinates: npcOccupiedCoordinates } = getInitialNpcPopulation(playerCoords);

             worldState.npcStates = npcStates;
             // Merge coordinates, preserving existing player locations
             worldState.occupiedCoordinates = { ...worldState.occupiedCoordinates, ...npcOccupiedCoordinates };

             const { error: updateError } = await supabase.from('world_state').update({ state: worldState as any }).eq('id', 1);
            if (updateError) {
                console.error("FATAL: Could not migrate world state to add NPCs.", updateError);
                throw new Error("FATAL: Could not migrate world state.");
            }
            console.log("NPC migration successful.");
        }
    }
};


// --- Auth Endpoints ---

app.post('/api/signup', async (req: express.Request, res: Response) => {
    const { username, password }: { username?: string, password?: string } = req.body;
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
        const worldState = worldData.state as unknown as WorldState;

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
            .insert([{ user_id: username, state: newPlayerState as any }]);
        
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
        const { error: worldSaveError } = await supabase.from('world_state').update({ state: worldState as any }).eq('id', 1);
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

app.post('/api/login', async (req: express.Request, res: Response) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Nazwa użytkownika i hasło są wymagane.' });
    }

    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .single();
        
        if (error || !user) {
             return res.status(401).json({ message: 'Nieprawidłowa nazwa użytkownika lub hasło.' });
        }

        if (user.password !== password) {
            return res.status(401).json({ message: 'Nieprawidłowa nazwa użytkownika lub hasło.' });
        }

        res.status(200).json({ message: 'Zalogowano pomyślnie.', token: user.username });
    } catch (e) {
        console.error('Login exception:', e);
        res.status(500).json({ message: 'Wystąpił nieoczekiwany błąd.' });
    }
});

interface AppRequest extends express.Request {
    userId?: string;
}

const authMiddleware = (req: AppRequest, res: Response, next: NextFunction) => {
    const token = req.headers.authorization;
    if (!token) {
        return res.status(401).json({ message: 'Brak autoryzacji.' });
    }
    req.userId = token;
    next();
};

const loadCombinedGameState = async (userId: string): Promise<GameState | null> => {
    const { data: playerData, error: playerError } = await supabase.from('player_states').select('*').eq('user_id', userId).single();
    const { data: worldData, error: worldError } = await supabase.from('world_state').select('*').eq('id', 1).single();
    
    if (playerError || !playerData) {
        console.error(`Error loading player state for user ${userId}:`, playerError);
        return null;
    }
    if (worldError || !worldData) {
        console.error(`Error loading world state:`, worldError);
        return null;
    }
    
    let playerState = playerData.state as unknown as PlayerState;
    let worldState = worldData.state as unknown as WorldState;

    const lastNpcCheckBefore = worldState.lastGlobalNpcCheck;
    const { updatedWorldState } = updateWorldState(worldState);

    // If the world state was updated (e.g., NPCs evolved), save it back to the database.
    // This is crucial to persist world evolution outside of specific player actions.
    if (updatedWorldState.lastGlobalNpcCheck > lastNpcCheckBefore) {
        const { error } = await supabase.from('world_state').update({ state: updatedWorldState as any }).eq('id', 1);
        if (error) {
            console.error("Error saving world state after background update:", error);
        }
    }
    worldState = updatedWorldState;

    playerState = updatePlayerStateForOfflineProgress(playerState);
    
    return { ...playerState, ...worldState };
};

const saveStates = async (userId: string, gameState: GameState) => {
    const playerStateKeys = Object.keys(getInitialPlayerState("user", "1:1:1"));
    const worldStateKeys = Object.keys(getInitialWorldState());
    
    const playerState: Partial<PlayerState> = {};
    const worldState: Partial<WorldState> = {};

    for (const key in gameState) {
        if (playerStateKeys.includes(key)) {
            (playerState as any)[key] = (gameState as any)[key];
        }
        if (worldStateKeys.includes(key)) {
            (worldState as any)[key] = (gameState as any)[key];
        }
    }

    (playerState as PlayerState).lastSaveTime = Date.now();
    
    const playerSavePromise = supabase.from('player_states').update({ state: playerState as any }).eq('user_id', userId);
    const worldSavePromise = supabase.from('world_state').update({ state: worldState as any }).eq('id', 1);

    const [playerResult, worldResult] = await Promise.all([playerSavePromise, worldSavePromise]);

    if (playerResult.error) {
        console.error(`Failed to save player state for user ${userId}:`, playerResult.error);
    }
     if (worldResult.error) {
        console.error(`Failed to save world state:`, worldResult.error);
    }
};

app.get('/health', (req: express.Request, res: Response) => res.status(200).send('OK'));

app.get('/api/state', authMiddleware, async (req: AppRequest, res: Response) => {
    const gameState = await loadCombinedGameState(req.userId!);
    if (gameState) {
        res.json(gameState);
    } else {
        res.status(404).json({ message: 'Nie znaleziono stanu gry dla tego użytkownika.' });
    }
});

app.post('/api/action', authMiddleware, async (req: AppRequest, res: Response) => {
    let gameState = await loadCombinedGameState(req.userId!);
    if (!gameState) {
        return res.status(404).json({ message: 'Nie znaleziono stanu gry.' });
    }

    const { type, payload } = req.body;
    try {
        const result = handleAction(gameState, type, payload);
        if (result?.error) {
            return res.status(400).json({ message: result.error });
        }

        await saveStates(req.userId!, gameState);

        res.status(200).json({ message: result?.message || 'Akcja przetworzona', gameState });
    } catch (e: any) {
        console.error(`Error processing action ${type} for user ${req.userId!}:`, e);
        res.status(500).json({ message: e.message || 'Wystąpił błąd podczas przetwarzania akcji.' });
    }
});

const startServer = async () => {
    console.log("SERVER CODE VERSION: 4.0 - Attempting to start server...");
    try {
        await initializeWorld();
        app.listen(PORT, () => {
            console.log(`Backend server running on port ${PORT}`);
            console.log(`Persistence provider: Supabase`);
            console.log("✅ SERVER V4.0 IS LIVE!");
        });
    } catch (error) {
        console.error("❌ FATAL V4.0: Server failed to start due to world initialization failure.", error);
        (process as any).exit(1);
    }
};

startServer();