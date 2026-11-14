import {
  ENCORES, LINK_ROOM, LINK_POST_MS, LINK_TIMEOUT_MS, LINK_CONNECTED_MS, LINK_RTT_SLACK_MS,
  LINK_RTT_CREEP_MS, LINK_OFFSET_BLEND,
} from "./config.js";

const LEFT_STATE = { phase: "lobby", score: 0, encores: ENCORES, hype: 0, t: 0, venue: 0, bodies: [], events: [] };

export function relayFromUrl() {
  const relay = new URLSearchParams(location.search).get("relay");
  return relay ? relay.replace(/\/+$/, "") : null;
}

export function createLink(relayUrl) {
  return {
    url: relayUrl, id: Math.random().toString(36).slice(2),
    you: null, rival: null, startAt: null, connected: false,
    offset: 0, bestRtt: Infinity, seq: 0, accepted: 0,
    lastPost: -Infinity, lastOk: -Infinity, rivalSeen: performance.now(),
  };
}

export function pollLink(link, ownState, ready) {
  const now = performance.now();
  link.connected = now - link.lastOk < LINK_CONNECTED_MS;
  if (now - link.lastPost < LINK_POST_MS) return;
  link.lastPost = now;
  post(link, ownState, ready);
}

export function leaveLink(link) {
  post(link, LEFT_STATE, false);
  Object.assign(link, { you: null, rival: null, startAt: null, accepted: link.seq, rivalSeen: performance.now() });
}

export function localStartTime(link) {
  return link.startAt === null ? null : link.startAt - link.offset;
}

export function rivalSilence(link) {
  return performance.now() - link.rivalSeen;
}

async function post(link, state, ready) {
  const seq = ++link.seq;
  const sent = performance.now();
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), LINK_TIMEOUT_MS);
  try {
    const body = JSON.stringify({ room: LINK_ROOM, id: link.id, ready, state });
    const res = await fetch(`${link.url}/link`, { method: "POST", body, signal: abort.signal });
    const data = await res.json();
    if (res.ok && seq > link.accepted) accept(link, data, seq, sent, performance.now());
  } catch {
  } finally {
    clearTimeout(timer);
  }
}

function accept(link, data, seq, sent, received) {
  syncClock(link, sent, received, data.now);
  link.accepted = seq;
  link.you = data.you ?? null;
  link.startAt = data.startAt ?? null;
  link.rival = data.rival ?? null;
  if (link.rival) link.rivalSeen = received - link.rival.age;
  link.lastOk = received;
  link.connected = true;
}

function syncClock(link, sent, received, serverNow) {
  const rtt = received - sent;
  const sample = serverNow - (sent + rtt / 2);
  if (rtt < link.bestRtt) {
    link.offset = sample;
    link.bestRtt = rtt;
  } else if (rtt < link.bestRtt + LINK_RTT_SLACK_MS) {
    link.offset += (sample - link.offset) * LINK_OFFSET_BLEND;
  }
  link.bestRtt += LINK_RTT_CREEP_MS;
}
