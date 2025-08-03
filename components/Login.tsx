import React, { useState } from 'react';

interface LoginProps {
    onLoginSuccess: (token: string, username: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
    const [isLoginView, setIsLoginView] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    
    const API_URL = 'https://cosmic-lord-1skk.onrender.com';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setMessage(null);
        setIsLoading(true);

        const endpoint = isLoginView ? '/api/login' : '/api/signup';
        try {
            const response = await fetch(`${API_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Wystąpił błąd.');
            }

            if (isLoginView) {
                onLoginSuccess(data.token, username);
            } else {
                setMessage(data.message);
                setIsLoginView(true);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
            <div className="bg-gray-800 border border-cyan-700 rounded-xl shadow-2xl p-8 w-full max-w-md">
                <h1 className="text-4xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500 mb-6">
                    Kosmiczny Władca
                </h1>

                <div className="flex border-b border-gray-600 mb-6">
                    <button onClick={() => { setIsLoginView(true); setError(null); setMessage(null); }} className={`flex-1 py-2 font-semibold transition-colors duration-200 ${isLoginView ? 'text-cyan-300 border-b-2 border-cyan-400' : 'text-gray-500 hover:text-white'}`}>
                        Logowanie
                    </button>
                    <button onClick={() => { setIsLoginView(false); setError(null); setMessage(null); }} className={`flex-1 py-2 font-semibold transition-colors duration-200 ${!isLoginView ? 'text-cyan-300 border-b-2 border-cyan-400' : 'text-gray-500 hover:text-white'}`}>
                        Rejestracja
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && <p className="bg-red-900 border border-red-500 text-red-300 p-3 rounded-md text-center">{error}</p>}
                    {message && <p className="bg-green-900 border border-green-500 text-green-300 p-3 rounded-md text-center">{message}</p>}
                    <div>
                        <label htmlFor="username" className="block text-sm font-bold text-gray-300 mb-2">Nazwa użytkownika</label>
                        <input type="text" id="username" value={username} onChange={e => setUsername(e.target.value)} required minLength={3} className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500" />
                    </div>
                    <div>
                        <label htmlFor="password"  className="block text-sm font-bold text-gray-300 mb-2">Hasło</label>
                        <input type="password" id="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={3} className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500" />
                    </div>
                    <button type="submit" disabled={isLoading} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-md transition-all duration-300 disabled:bg-gray-500 disabled:cursor-wait">
                        {isLoading ? 'Przetwarzanie...' : (isLoginView ? 'Zaloguj się' : 'Zarejestruj się')}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
