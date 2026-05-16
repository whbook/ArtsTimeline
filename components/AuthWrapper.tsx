import React, { useState, useEffect } from 'react';

// SHA-256 hash of '4008580933'
const TARGET_HASH = '35904b4ee4a2a637825efa2ca74adeac64d09eea6451026949e2f5311a1ed5cb';
const MAX_ATTEMPTS = 5;

// Helper to hash string
async function hashPassword(password: string) {
  const msgUint8 = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export const AuthWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isBanned, setIsBanned] = useState(false);

  useEffect(() => {
    const auth = localStorage.getItem('arts_timeline_auth');
    if (auth === 'true') {
      setIsAuthenticated(true);
    }
    checkBanStatus();
  }, []);

  const checkBanStatus = () => {
    const banDataStr = localStorage.getItem('arts_timeline_ban');
    if (banDataStr) {
      const banData = JSON.parse(banDataStr);
      const today = new Date().toDateString();
      if (banData.date === today && banData.attempts >= MAX_ATTEMPTS) {
        setIsBanned(true);
        return true;
      } else if (banData.date !== today) {
        // Reset for a new day
        localStorage.removeItem('arts_timeline_ban');
      }
    }
    return false;
  };

  const recordFailedAttempt = () => {
    const today = new Date().toDateString();
    const banDataStr = localStorage.getItem('arts_timeline_ban');
    let attempts = 1;
    if (banDataStr) {
      const banData = JSON.parse(banDataStr);
      if (banData.date === today) {
        attempts = banData.attempts + 1;
      }
    }
    localStorage.setItem('arts_timeline_ban', JSON.stringify({ date: today, attempts }));
    if (attempts >= MAX_ATTEMPTS) {
      setIsBanned(true);
    }
    return attempts;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (checkBanStatus()) return;

    const hash = await hashPassword(password);
    if (hash === TARGET_HASH) {
      localStorage.setItem('arts_timeline_auth', 'true');
      setIsAuthenticated(true);
    } else {
      const attempts = recordFailedAttempt();
      if (attempts >= MAX_ATTEMPTS) {
        setError('错误次数过多，今日已禁止访问。');
      } else {
        setError(`密码错误，今日还可尝试 ${MAX_ATTEMPTS - attempts} 次。`);
      }
      setPassword('');
    }
  };

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 bg-[#f8f8f5] flex items-center justify-center z-[9999]">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full border border-gray-200">
        <h2 className="text-2xl font-serif font-bold text-gray-800 mb-6 text-center">Arts Timeline</h2>
        {isBanned ? (
          <div className="text-red-600 text-center font-medium p-4 bg-red-50 rounded">
            由于多次输入错误，您今日的访问已被暂时限制。请明日再试。
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">请输入访问密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Password"
                autoFocus
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              className="w-full bg-gray-800 text-white font-medium py-2 px-4 rounded hover:bg-gray-900 transition-colors"
            >
              进入系统
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
