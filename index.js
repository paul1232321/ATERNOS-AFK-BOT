// ============================================================
// STABLE AFK BOT (FIXED VERSION)
// No KeepAliveError loop / optimized for Aternos
// Replace your FULL index.js with this
// ============================================================

const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { GoalBlock } = goals;
const express = require('express');
const http = require('http');
const config = require('./settings.json');

// ============================================================
// SIMPLE WEB SERVER (keep alive)
// ============================================================
const app = express();
const PORT = process.env.PORT || 5000;

app.get('/', (req, res) => {
  res.send(`Bot running: ${config.name}`);
});

app.get('/ping', (req, res) => res.send('ok'));

app.listen(PORT, '0.0.0.0', () => {
  console.log('[WEB] Server started on port', PORT);
});

// ============================================================
// BOT STATE
// ============================================================
let bot;
let reconnectTimeout;
let isReconnecting = false;

const state = {
  connected: false,
  lastAction: Date.now(),
  reconnects: 0
};

// ============================================================
// SAFE INTERVALS
// ============================================================
let intervals = [];
function addInterval(fn, ms) {
  const id = setInterval(fn, ms);
  intervals.push(id);
  return id;
}
function clearIntervals() {
  for (const i of intervals) clearInterval(i);
  intervals = [];
}

// ============================================================
// BOT CREATION
// ============================================================
function createBot() {
  if (isReconnecting) return;
  isReconnecting = true;

  console.log('[BOT] Starting...');

  bot = mineflayer.createBot({
    username: config['bot-account'].username,
    password: config['bot-account'].password || undefined,
    auth: config['bot-account'].type,
    host: config.server.ip,
    port: config.server.port,
    version: config.server.version,
    checkTimeoutInterval: 60000
  });

  bot.loadPlugin(pathfinder);

  // ============================================================
  // SPAWN
  // ============================================================
  bot.once('spawn', () => {
    console.log('[BOT] Connected ✔');

    state.connected = true;
    state.reconnects = 0;
    isReconnecting = false;

    const mcData = require('minecraft-data')(config.server.version);
    const movements = new Movements(bot, mcData);

    bot.pathfinder.setMovements(movements);

    // OPTIONAL MOVE TO POSITION (SAFE)
    if (config.position?.enabled) {
      bot.pathfinder.setGoal(
        new GoalBlock(
          config.position.x,
          config.position.y,
          config.position.z
        )
      );
    }

    // ============================================================
    // SAFE ANTI-AFK (ONLY ONE SYSTEM)
    // ============================================================
    addInterval(() => {
      if (!bot || !state.connected) return;

      bot.setControlState('jump', true);
      setTimeout(() => {
        if (bot) bot.setControlState('jump', false);
      }, 200);

      state.lastAction = Date.now();
    }, 30000); // 30 sec SAFE

    // ============================================================
    // SIMPLE LOOK AROUND (NO OVERLOAD)
    // ============================================================
    addInterval(() => {
      if (!bot || !state.connected) return;

      const yaw = Math.random() * Math.PI * 2;
      const pitch = (Math.random() - 0.5) * 0.5;
      bot.look(yaw, pitch, true);
    }, 10000);

    // ============================================================
    // CHAT (SAFE SLOW MODE)
    // ============================================================
    if (config.utils?.['chat-messages']?.enabled) {
      const msgs = config.utils['chat-messages'].messages;
      let i = 0;

      addInterval(() => {
        if (!bot || !state.connected) return;

        bot.chat(msgs[i]);
        i = (i + 1) % msgs.length;

        state.lastAction = Date.now();
      }, 10000); // 10 seconds safe
    }

  });

  // ============================================================
  // DISCONNECT HANDLING
  // ============================================================
  bot.on('end', (reason) => {
    console.log('[BOT] Disconnected:', reason);

    state.connected = false;
    clearIntervals();

    scheduleReconnect();
  });

  bot.on('kicked', (reason) => {
    console.log('[BOT] Kicked:', reason);

    state.connected = false;
    clearIntervals();

    scheduleReconnect();
  });

  bot.on('error', (err) => {
    console.log('[BOT] Error:', err.message);
  });
}

// ============================================================
// RECONNECT LOGIC (STABLE)
// ============================================================
function scheduleReconnect() {
  if (reconnectTimeout) clearTimeout(reconnectTimeout);

  state.reconnects++;

  const delay = Math.min(5000 + state.reconnects * 2000, 30000);

  console.log(`[BOT] Reconnecting in ${delay / 1000}s`);

  reconnectTimeout = setTimeout(() => {
    createBot();
  }, delay);
}

// ============================================================
// START
// ============================================================
console.log('==============================');
console.log(' STABLE AFK BOT LOADING');
console.log('==============================');

createBot();
