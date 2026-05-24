function normalizeThemeName(themeName) {
    const raw = (themeName || '').toLowerCase();
    const allowed = new Set([
        'bootstrap5.3', 'bootstrap5.3-dark',
        'fluent2', 'fluent2-dark',
        'highcontrast'
    ]);
    if (allowed.has(raw)) return raw;

    const cdnFallback = {
        'material3': 'bootstrap5.3',
        'material3-dark': 'bootstrap5.3-dark',
        'tailwind3': 'bootstrap5.3',
        'tailwind3-dark': 'bootstrap5.3-dark',
        'tailwind': 'bootstrap5.3',
        'tailwind-dark': 'bootstrap5.3-dark',
        'material': 'bootstrap5.3',
        'material-dark': 'bootstrap5.3-dark'
    };
    if (cdnFallback[raw]) return cdnFallback[raw];
    return raw.endsWith('-dark') ? 'bootstrap5.3-dark' : 'bootstrap5.3';
}

function setThemeCookie(themeName) {
    const normalized = normalizeThemeName(themeName);
    document.cookie = `sf-theme=${normalized};path=/;max-age=31536000;SameSite=Lax`;
}

function getThemeCookieValue() {
    const match = document.cookie.match(/sf-theme=([^;]+)/);
    const normalized = normalizeThemeName(match ? match[1] : 'bootstrap5.3');
    if (match && match[1] !== normalized) {
        setThemeCookie(normalized);
    }
    return normalized;
}

function getSidebarOpenState(key) {
    try {
        const fromStorage = localStorage.getItem(key);
        if (fromStorage === '1' || fromStorage === '0') return fromStorage;
    } catch { }
    const match = document.cookie.match(new RegExp(`${key}=([^;]+)`));
    return match ? match[1] : null;
}

function setSidebarOpenState(key, isOpen) {
    const value = isOpen ? '1' : '0';
    try { localStorage.setItem(key, value); } catch { }
    document.cookie = `${key}=${value};path=/;max-age=31536000;SameSite=Lax`;
}

// 导出文件辅助
window.downloadFile = function(fileName, contentType, bytesBase64) {
    const binaryString = window.atob(bytesBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
