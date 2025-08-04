
import express from 'express';
import cors from 'cors';
import { GameState, PlayerState, WorldState } from './types.js';
import { handleAction, updatePlayerStateForOfflineProgress, updateWorldState } from './gameEngine.js';
import { getInitialPlayerState, getInitialWorldState, WORLD_STATE_USER_ID } from './constants.js';
import { supabase } from './config/db.js';
import { Json } from './database.types.js';
import { exit } from 'process';

const app = express();
const PORT = process.env.PORT || 10000;

const allowedOrigin = process.env.FRONTEND_URL;
console.log(`CORS configured to allow origin: ${allowedOrigin || '!!! NOT SET - WILL BLOCK FRONTEND !!!'}`);

const corsOptions = {
  origin: allowedOrigin,
  optionsSuccessStatus: 200 
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }) as any);

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
    return `1:${Math.floor(Math.random() * 499) + 1}:16`; 
};

const initializeWorld = async () => {
    const { data } = await supabase.from('game_state').select('user_id').eq('user_id', WORLD_STATE_USER_ID).single();
    if (!data) {
        console.log("No world state found. Initializing new world...");
        const initialWorldState = getInitialWorldState();
        
        const { data: users } = await supabase.from('users').select('username');
        if (users) {
            for (const user of users) {
                const { data: playerStateData } = await supabase.from('game_state').select('state').eq('user_id', user.username).single();
                if (playerStateData?.state) {
                    const homeCoords = Object.keys((playerStateData.state as any).colonies)[0];
                    if (homeCoords) {
                         initialWorldState.occupiedCoordinates[homeCoords] = user.username;
                    }
                }
            }
        }

        const { error: insertError } = await supabase.from('game_state').insert({
            user_id: WORLD_STATE_USER_ID,
            state: initialWorldState as unknown as Json
        });

        if (insertError) {
            console.error("FATAL: Could not initialize world state.", insertError);
            exit(1);
        } else {
            console.log("World state initialized successfully.");
        }
    } else {
        console.log("World state loaded.");
    }
};


// --- Auth Endpoints ---

app.post('/api/signup', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password || username.length < 3 || password.length < 3) {
        return res.status(400).json({ message: 'Nazwa użytkownika i hasło muszą mieć co najmniej 3 znaki.' });
    }

    try {
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

        // Fetch world state to find a spot
        const { data: worldData, error: worldError } = await supabase.from('game_state').select('state').eq('user_id', WORLD_STATE_USER_ID).single();
        if (worldError || !worldData) {
            return res.status(500).json({ message: 'Błąd krytyczny: Nie można załadować świata gry.' });
        }
        const worldState = worldData.state as unknown as WorldState;

        const homeCoords = findUnoccupiedCoordinates(worldState.occupiedCoordinates);
        worldState.occupiedCoordinates[homeCoords] = username;
        
        const newPlayerState = getInitialPlayerState(username, homeCoords);

        const { error: insertUserError } = await supabase
            .from('users')
            .insert([{ username, password }]);

        if (insertUserError) {
            console.error('Signup insert user error:', insertUserError);
            return res.status(500).json({ message: 'Nie udało się utworzyć użytkownika.' });
        }

        const { error: insertStateError } = await supabase
            .from('game_state')
            .insert([{ user_id: username, state: newPlayerState as unknown as Json }]);
        
        if (insertStateError) {
            console.error('Signup insert state error:', insertStateError);
            // Rollback user creation
            await supabase.from('users').delete().eq('username', username);
            return res.status(500).json({ message: 'Nie udało się utworzyć stanu gry.' });
        }
        
        // Save the updated world state
        const { error: worldSaveError } = await supabase.from('game_state').update({ state: worldState as unknown as Json }).eq('user_id', WORLD_STATE_USER_ID);
        if (worldSaveError) {
             console.error('Signup world save error:', worldSaveError);
             // Non-fatal, but should be logged
        }
        
        res.status(201).json({ message: 'Konto utworzone pomyślnie! Możesz się teraz zalogować.' });
    } catch (e) {
        console.error('Signup exception:', e);
        res.status(500).json({ message: 'Wystąpił nieoczekiwany błąd.' });
    }
});

app.post('/api/login', async (req, res) => {
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

// --- Auth Middleware ---
const authMiddleware = (req: any, res: any, next: any) => {
    const token = req.headers.authorization;
    if (!token) {
        return res.status(401).json({ message: 'Brak autoryzacji.' });
    }
    req.userId = token;
    next();
};

// --- Game State Management ---
const loadCombinedGameState = async (userId: string): Promise<GameState | null> => {
    const { data: playerData, error: playerError } = await supabase.from('game_state').select('*').eq('user_id', userId).single();
    const { data: worldData, error: worldError } = await supabase.from('game_state').select('*').eq('user_id', WORLD_STATE_USER_ID).single();
    
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

    const { updatedWorldState, messagesForPlayers } = updateWorldState(worldState);
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
    
    const playerSavePromise = supabase.from('game_state').update({ state: playerState as unknown as Json }).eq('user_id', userId);
    const worldSavePromise = supabase.from('game_state').update({ state: worldState as unknown as Json }).eq('user_id', WORLD_STATE_USER_ID);

    const [playerResult, worldResult] = await Promise.all([playerSavePromise, worldSavePromise]);

    if (playerResult.error) {
        console.error(`Failed to save player state for user ${userId}:`, playerResult.error);
    }
     if (worldResult.error) {
        console.error(`Failed to save world state:`, worldResult.error);
    }
};

// --- API Endpoints ---
app.get('/health', (req, res) => res.status(200).send('OK'));

app.get('/api/state', authMiddleware, async (req: any, res) => {
    const gameState = await loadCombinedGameState(req.userId);
    if (gameState) {
        res.json(gameState);
    } else {
        res.status(404).json({ message: 'Nie znaleziono stanu gry dla tego użytkownika.' });
    }
});

app.post('/api/action', authMiddleware, async (req: any, res) => {
    let gameState = await loadCombinedGameState(req.userId);
    if (!gameState) {
        return res.status(404).json({ message: 'Nie znaleziono stanu gry.' });
    }

    const { type, payload } = req.body;
    try {
        const result = handleAction(gameState, type, payload);
        if (result?.error) {
            return res.status(400).json({ message: result.error });
        }

        await saveStates(req.userId, gameState);

        res.status(200).json({ message: result?.message || 'Akcja przetworzona', gameState });
    } catch (e: any) {
        console.error(`Error processing action ${type} for user ${req.userId}:`, e);
        res.status(500).json({ message: e.message || 'Wystąpił błąd podczas przetwarzania akcji.' });
    }
});

app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
    console.log(`Persistence provider: Supabase`);
    initializeWorld();
});
