const { io } = require('socket.io-client');

const URL = process.env.URL || 'http://localhost:3000'; // your backend port
const { TOKEN_A, TOKEN_B, ID_A, ID_B } = process.env;
if (!TOKEN_A || !TOKEN_B || !ID_A || !ID_B) {
    console.error('Set TOKEN_A, TOKEN_B, ID_A, ID_B');
    process.exit(1);
}

const connect = (token) =>
    new Promise((resolve, reject) => {
        const s = io(URL, { auth: { token } });
        s.on('connect', () => resolve(s));
        s.on('connect_error', reject);
    });

// emit and wait for the ack (or report a timeout)
const emitAck = (s, event, payload) =>
    new Promise((resolve) => {
        s.timeout(5000).emit(event, payload, (err, res) =>
            resolve(err ? { ok: false, message: 'no ack (timeout)' } : res)
        );
    });

// resolves with the event data, or null if it doesn't arrive in time
const waitFor = (s, event, ms = 2000) =>
    new Promise((resolve) => {
        const timer = setTimeout(() => {
            s.off(event, handler);
            resolve(null);
        }, ms);
        const handler = (data) => {
            clearTimeout(timer);
            resolve(data);
        };
        s.once(event, handler);
    });

let passed = 0;
let failed = 0;
const check = (name, condition, extra = '') => {
    if (condition) {
        passed++;
        console.log(`PASS  ${name}`);
    } else {
        failed++;
        console.log(`FAIL  ${name} ${extra}`);
    }
};

(async () => {
    const A = await connect(TOKEN_A);
    const B = await connect(TOKEN_B);
    console.log('Both connected\n');

    // start from a clean state
    await emitAck(A, 'setTimer', { receiver: ID_B, seconds: 0 });

    // 1. plain text, no type (backwards compatibility)
    let gotB = waitFor(B, 'receiveMessage');
    let res = await emitAck(A, 'sendMessage', { content: 'hello', receiver: ID_B });
    let received = await gotB;
    check('1 text without type is saved', res.ok === true && res.message?.type === 'text');
    check('1 receiver gets it', received?.content === 'hello');

    // 2. valid location
    gotB = waitFor(B, 'receiveMessage');
    res = await emitAck(A, 'sendMessage', {
        type: 'location', receiver: ID_B, location: { lat: 36.19, lng: 44.01 },
    });
    received = await gotB;
    check('2 valid location saved', res.ok === true && res.message?.location?.lat === 36.19, JSON.stringify(res));
    check('2 receiver gets location', received?.type === 'location');

    // 3-7. invalid messages
    const bad = [
        ['3 lat 91 rejected', { type: 'location', receiver: ID_B, location: { lat: 91, lng: 10 } }],
        ['4 lat as string rejected', { type: 'location', receiver: ID_B, location: { lat: '36.2', lng: 44 } }],
        ['5 location null rejected', { type: 'location', receiver: ID_B, location: null }],
        ['6 unknown type rejected', { type: 'video', receiver: ID_B, content: 'x' }],
        ['7 invalid receiver rejected', { content: 'x', receiver: 'not-an-id' }],
        ['7b empty content rejected', { content: '   ', receiver: ID_B }],
        ['7c lng 181 rejected', { type: 'location', receiver: ID_B, location: { lat: 10, lng: 181 } }],
    ];
    for (const [name, payload] of bad) {
        res = await emitAck(A, 'sendMessage', payload);
        check(name, res.ok === false, JSON.stringify(res));
    }

    // 8. timer value not in the whitelist
    res = await emitAck(A, 'setTimer', { receiver: ID_B, seconds: 7 });
    check('8 timer of 7 seconds rejected', res.ok === false);

    // 9. valid timer, both users are notified
    const tA = waitFor(A, 'timerChanged');
    const tB = waitFor(B, 'timerChanged');
    res = await emitAck(A, 'setTimer', { receiver: ID_B, seconds: 5 });
    check('9 setTimer 5 ok', res.ok === true, JSON.stringify(res));
    check('9 A notified', (await tA)?.seconds === 5);
    check('9 B notified', (await tB)?.seconds === 5);

    // 10. getTimer returns the saved value (asked by B, so it works for both sides)
    res = await emitAck(B, 'getTimer', { receiver: ID_A });
    check('10 getTimer returns 5 for the other user', res.ok === true && res.seconds === 5);

    // 11. a message sent with the timer on gets expiresAt, then disappears
    const expA = waitFor(A, 'messageExpired', 9000);
    const expB = waitFor(B, 'messageExpired', 9000);
    res = await emitAck(A, 'sendMessage', { content: 'self destruct', receiver: ID_B });
    check('11 message has expiresAt', !!res.message?.expiresAt);
    const id = res.message?._id;
    const [eA, eB] = await Promise.all([expA, expB]);
    check('11 A told the message expired', eA?.messageId === id);
    check('11 B told the message expired', eB?.messageId === id);

    // 12. timer off: no expiresAt
    await emitAck(A, 'setTimer', { receiver: ID_B, seconds: 0 });
    res = await emitAck(A, 'sendMessage', { content: 'permanent', receiver: ID_B });
    check('12 no expiresAt when timer is off', res.ok === true && !res.message?.expiresAt);

    console.log(`\n${passed} passed, ${failed} failed`);
    A.close();
    B.close();
    process.exit(failed ? 1 : 0);
})().catch((e) => {
    console.error('Test crashed:', e.message);
    process.exit(1);
});