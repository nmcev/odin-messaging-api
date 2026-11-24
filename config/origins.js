// Front-end addresses allowed to call the API (HTTP + Socket.IO).
// Extra ones (e.g. a laptop's Wi-Fi address for a classroom demo) can be added with
// CLIENT_ORIGINS="http://192.168.1.20:4173,http://localhost:4173"
const DEFAULT_ORIGINS = ['http://localhost:5173', 'https://talkmate-odin.netlify.app'];

const extra = (process.env.CLIENT_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

module.exports = [...new Set([...DEFAULT_ORIGINS, ...extra])];
