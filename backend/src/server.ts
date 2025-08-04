import express from 'express';
import cors from 'cors';
import { GameState, PlayerState, WorldState } from './types';
import { handleAction, updatePlayerStateForOfflineProgress, updateWorldState } from './gameEngine';
import { getInitialPlayerState, getInitialWorldState } from './constants';
import { supabase } from './config/db';

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
    console.log("Initializing world state...");
    const { data, error } = await supabase
        .from('world_state')
        .select('id')
        .eq('id', 1)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116: no rows found
        console.error("FATAL: Could not query for world state.", error);
        throw new Error("FATAL: Could not query for world state.");
    }

    if (!data) {
        console.log("No world state found. Initializing new world...");
        const initialWorldState = getInitialWorldState();

        const { data: users, error: usersError } = await supabase.from('users').select('username');
        if (usersError) {
             console.error("Failed to fetch users during world initialization", usersError);
        } else if (users) {
            for (const user of users) {
                const { data: playerStateData } = await supabase
                    .from('player_states')
                    .select('state')
                    .eq('user_id', user.username)
                    .single();
                
                if (playerStateData?.state) {
                     const homeCoords = Object.keys(((playerStateData.state as unknown) as PlayerState).colonies)[0];
                    if (homeCoords) {
                         initialWorldState.occupiedCoordinates[homeCoords] = user.username;
                    }
                }
            }
        }

        const { error: insertError } = await supabase
            .from('world_state')
            .insert([{ id: 1, state: initialWorldState }]);

        if (insertError) {
            console.error("FATAL: Could not initialize world state.", insertError);
            throw new Error("FATAL: Could not initialize world state.");
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

        const { data: worldData, error: worldError } = await supabase.from('world_state').select('state').eq('id', 1).single();
        if (worldError || !worldData?.state) {
            console.error('Signup world load error:', worldError);
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
            .from('player_states')
            .insert([{ user_id: username, state: newPlayerState }]);
        
        if (insertStateError) {
            console.error('Signup insert state error:', insertStateError);
            await supabase.from('users').delete().eq('username', username);
            return res.status(500).json({ message: 'Nie udało się utworzyć stanu gry.' });
        }
        
        const { error: worldSaveError } = await supabase.from('world_state').update({ state: worldState }).eq('id', 1);
        if (worldSaveError) {
             console.error('Signup world save error:', worldSaveError);
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

const authMiddleware = (req: any, res: any, next: any) => {
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
    
    if (playerError || !playerData?.state) {
        console.error(`Error loading player state for user ${userId}:`, playerError);
        return null;
    }
    if (worldError || !worldData?.state) {
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
    
    const playerSavePromise = supabase.from('player_states').update({ state: playerState }).eq('user_id', userId);
    const worldSavePromise = supabase.from('world_state').update({ state: worldState }).eq('id', 1);

    const [playerResult, worldResult] = await Promise.all([playerSavePromise, worldSavePromise]);

    if (playerResult.error) {
        console.error(`Failed to save player state for user ${userId}:`, playerResult.error);
    }
     if (worldResult.error) {
        console.error(`Failed to save world state:`, worldResult.error);
    }
};

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

const startServer = async () => {
    console.log("Attempting to initialize world...");
    try {
        await initializeWorld();
        app.listen(PORT, () => {
            console.log(`Backend server running on port ${PORT}`);
            console.log(`Persistence provider: Supabase`);
            console.log("✅ Your service is live!");
        });
    } catch (error) {
        console.error("❌ FATAL: Server failed to start due to world initialization failure.", error);
        (process as any).exit(1);
    }
};

startServer();