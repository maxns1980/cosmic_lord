import express from 'express';
import cors from 'cors';
import { GameState } from './types.js';
import { handleAction, updateStateForOfflineProgress } from './gameEngine.js';
import { getInitialState } from './constants.js';
import { supabase } from './config/db.js';
import { Json } from './database.types.js';

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

        const { error: insertUserError } = await supabase
            .from('users')
            .insert({ username, password });

        if (insertUserError) {
            console.error('Signup insert user error:', insertUserError);
            return res.status(500).json({ message: 'Nie udało się utworzyć użytkownika.' });
        }

        const newGameState = getInitialState();
        const { error: insertStateError } = await supabase
            .from('game_state')
            .insert({ user_id: username, state: newGameState as unknown as Json });
        
        if (insertStateError) {
            console.error('Signup insert state error:', insertStateError);
            return res.status(500).json({ message: 'Nie udało się utworzyć stanu gry.' });
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
            .select('username, password')
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
const loadAndProcessGameState = async (userId: string): Promise<GameState | null> => {
    const { data, error } = await supabase
        .from('game_state')
        .select('state')
        .eq('user_id', userId)
        .single();
    
    if (error || !data) {
        console.error(`Error loading game state for user ${userId}:`, error);
        return null;
    }
    
    let gameState = data.state as unknown as GameState;
    gameState = updateStateForOfflineProgress(gameState);
    return gameState;
};

const saveGameState = async (userId: string, gameState: GameState) => {
    gameState.lastSaveTime = Date.now();
    const { error } = await supabase
        .from('game_state')
        .update({ state: gameState as unknown as Json })
        .eq('user_id', userId);

    if (error) {
        console.error(`Failed to save game state for user ${userId}:`, error);
    }
};

// --- API Endpoints ---
app.get('/health', (req, res) => res.status(200).send('OK'));

app.get('/api/state', authMiddleware, async (req: any, res) => {
    const gameState = await loadAndProcessGameState(req.userId);
    if (gameState) {
        res.json(gameState);
    } else {
        res.status(404).json({ message: 'Nie znaleziono stanu gry dla tego użytkownika.' });
    }
});

app.post('/api/action', authMiddleware, async (req: any, res) => {
    let gameState = await loadAndProcessGameState(req.userId);
    if (!gameState) {
        return res.status(404).json({ message: 'Nie znaleziono stanu gry.' });
    }

    const { type, payload } = req.body;
    try {
        const result = handleAction(gameState, type, payload);
        if (result?.error) {
            return res.status(400).json({ message: result.error });
        }

        await saveGameState(req.userId, gameState);

        res.status(200).json({ message: result?.message || 'Akcja przetworzona', gameState });
    } catch (e: any) {
        console.error(`Error processing action ${type} for user ${req.userId}:`, e);
        res.status(500).json({ message: e.message || 'Wystąpił błąd podczas przetwarzania akcji.' });
    }
});

app.listen(PORT, () => {
    console.log(`Backend server running on port ${PORT}`);
    console.log(`Persistence provider: Supabase`);
});
