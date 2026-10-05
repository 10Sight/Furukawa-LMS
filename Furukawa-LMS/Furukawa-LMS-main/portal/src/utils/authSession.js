// Authentication lasts for open portal tabs; preferences and records stay persistent.
export function createAuthSession({ sessionStorage, localStorage, navigationType, createChannel }) {
    const keys = ['user', 'token', 'isLoggedIn'];
    const listeners = new Set();
    for (const key of keys) localStorage.removeItem(key);
    if (navigationType !== 'reload') {
        for (const key of keys) sessionStorage.removeItem(key);
    }
    let channel;
    let pending;
    const snapshot = () => Object.fromEntries(keys.map(key => [key, sessionStorage.getItem(key)]));
    const authenticated = data => {
        try { return data.isLoggedIn === 'true' && Boolean(data.token) && !data.token.startsWith('mock-') && Boolean(JSON.parse(data.user)?.id || JSON.parse(data.user)?._id); }
        catch { return false; }
    };
    const apply = data => {
        for (const key of keys) {
            if (data[key] == null) sessionStorage.removeItem(key);
            else sessionStorage.setItem(key, data[key]);
        }
        for (const listener of listeners) listener();
    };
    const connect = () => {
        if (channel || !createChannel) return;
        channel = createChannel('fme-portal-auth-session');
        channel.onmessage = ({ data }) => {
            if (data?.type === 'request' && authenticated(snapshot())) {
                channel.postMessage({ type: 'response', requestId: data.requestId, session: snapshot() });
            } else if (data?.type === 'response' && pending?.id === data.requestId && authenticated(data.session)) {
                apply(data.session);
                pending.finish();
            } else if (data?.type === 'login' && authenticated(data.session)) {
                apply(data.session);
            } else if (data?.type === 'logout') {
                apply({});
            }
        };
    };
    const initialize = () => {
        connect();
        if (authenticated(snapshot()) || !channel) return Promise.resolve();
        return new Promise(resolve => {
            const id = Math.random().toString(36).slice(2);
            const timer = setTimeout(() => { pending = null; resolve(); }, 700);
            pending = { id, finish: () => { clearTimeout(timer); pending = null; resolve(); } };
            channel.postMessage({ type: 'request', requestId: id });
        });
    };
    return {
        getItem: key => sessionStorage.getItem(key),
        setItem(key, value) {
            sessionStorage.setItem(key, value);
            if (key === 'isLoggedIn') {
                channel?.postMessage(value === 'true'
                    ? { type: 'login', session: snapshot() }
                    : { type: 'logout' });
                if (value !== 'true') for (const item of ['user', 'token']) sessionStorage.removeItem(item);
            }
        },
        removeItem: key => sessionStorage.removeItem(key),
        initialize,
        subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
        disconnect() { channel?.close(); channel = null; },
        async resume() { apply({}); await initialize(); },
    };
}

export const authSession = typeof window === 'undefined' ? null : createAuthSession({
    sessionStorage: window.sessionStorage,
    localStorage: window.localStorage,
    navigationType: window.performance.getEntriesByType('navigation')[0]?.type,
    createChannel: typeof BroadcastChannel === 'undefined' ? null : name => new BroadcastChannel(name),
});
