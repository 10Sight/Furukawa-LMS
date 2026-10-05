import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAuthSession } from "./authSession.js";

const storage = (initial = {}) => {
    const data = new Map(Object.entries(initial));
    return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) };
};
const signedIn = { user: JSON.stringify({ id: 14, fullName: 'Sample User' }), token: 'test-token', isLoggedIn: 'true' };
const createNetwork = () => {
    const peers = new Set();
    return () => {
        const peer = {
            postMessage(data) {
                for (const target of peers) if (target !== peer) queueMicrotask(() => { if (peers.has(target)) target.onmessage?.({ data }); });
            },
            close() { peers.delete(peer); },
        };
        peers.add(peer);
        return peer;
    };
};

test('persistent credentials are removed and never used for a fresh visit', async () => {
    const persistent = storage(signedIn);
    const session = createAuthSession({ sessionStorage: storage(signedIn), localStorage: persistent, navigationType: 'navigate' });
    await session.initialize();
    assert.equal(session.getItem('token'), null);
    assert.equal(persistent.getItem('token'), null);
});

test('refresh retains the current tab login', async () => {
    const session = createAuthSession({ sessionStorage: storage(signedIn), localStorage: storage(), navigationType: 'reload' });
    await session.initialize();
    assert.equal(session.getItem('token'), 'test-token');
});

test('CMS tabs share login with an open portal tab and synchronize logout', async () => {
    const createChannel = createNetwork();
    const first = createAuthSession({ sessionStorage: storage(signedIn), localStorage: storage(), navigationType: 'reload', createChannel });
    await first.initialize();
    const second = createAuthSession({ sessionStorage: storage(), localStorage: storage(), navigationType: 'navigate', createChannel });
    await second.initialize();
    assert.equal(second.getItem('token'), 'test-token');
    first.setItem('isLoggedIn', 'false');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(second.getItem('token'), null);
    assert.equal(first.getItem('token'), null);
    first.disconnect(); second.disconnect();
});

test('reopening after the last tab closes requires login, even with restored storage', async () => {
    const createChannel = createNetwork();
    const first = createAuthSession({ sessionStorage: storage(signedIn), localStorage: storage(), navigationType: 'reload', createChannel });
    await first.initialize();
    first.disconnect();
    const reopened = createAuthSession({ sessionStorage: storage(signedIn), localStorage: storage(), navigationType: 'back_forward', createChannel });
    await reopened.initialize();
    assert.equal(reopened.getItem('token'), null);
    reopened.disconnect();
});

test('logout while the login request is waiting does not restore authentication', async () => {
    const createChannel = createNetwork();
    const first = createAuthSession({ sessionStorage: storage(), localStorage: storage(), navigationType: 'navigate', createChannel });
    await first.initialize();
    first.setItem('user', signedIn.user); first.setItem('token', signedIn.token); first.setItem('isLoggedIn', 'true');
    first.setItem('isLoggedIn', 'false');
    const second = createAuthSession({ sessionStorage: storage(), localStorage: storage(), navigationType: 'navigate', createChannel });
    await second.initialize();
    assert.equal(second.getItem('token'), null);
    first.disconnect(); second.disconnect();
});
