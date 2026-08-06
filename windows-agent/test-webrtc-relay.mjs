// Phase 3.5 verification: relay round-trip test for WebRTC signaling messages.
// Connects a fake agent + viewer on the same sessionId and confirms the relay
// passes through webrtc_offer, webrtc_answer, webrtc_ice, and webrtc_connected.
// Does NOT test actual P2P video (that needs a real browser with RTCPeerConnection),
// but proves the signaling channel works end-to-end.
import WebSocket from 'ws';

const RELAY = 'ws://localhost:8080';
const sessionId = 'test-webrtc-' + Date.now();

const agent = new WebSocket(`${RELAY}?sessionId=${sessionId}&role=agent`);
const viewer = new WebSocket(`${RELAY}?sessionId=${sessionId}&role=viewer`);

let got = { offer: false, answer: false, ice: false, connected: false };
let done = 0;
const need = 4;

const finish = () => {
  console.log('\n=== WebRTC signaling relay round-trip results ===');
  console.log('webrtc_offer passed through:', got.offer ? 'PASS' : 'FAIL');
  console.log('webrtc_answer passed through:', got.answer ? 'PASS' : 'FAIL');
  console.log('webrtc_ice passed through:', got.ice ? 'PASS' : 'FAIL');
  console.log('webrtc_connected passed through:', got.connected ? 'PASS' : 'FAIL');
  const allPass = got.offer && got.answer && got.ice && got.connected;
  console.log('\nOverall:', allPass ? 'ALL PASS ✅' : 'SOME FAILED ❌');
  agent.close();
  viewer.close();
  process.exit(allPass ? 0 : 1);
};

const checkDone = () => {
  if (done >= need) finish();
};

viewer.on('open', () => {
  console.log('[viewer] connected');
});

agent.on('open', () => {
  console.log('[agent] connected');
  // Wait for both to be connected, then send the signaling sequence.
  setTimeout(() => {
    // 1. Agent sends offer
    agent.send(JSON.stringify({ type: 'webrtc_offer', sdp: 'v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\ns=-\r\n' }));
    // 3. Agent sends ICE candidate
    setTimeout(() => {
      agent.send(JSON.stringify({ type: 'webrtc_ice', candidate: { candidate: 'candidate:1 1 udp 1 127.0.0.1 1 typ host', sdpMid: '0', sdpMLineIndex: 0 } }));
    }, 50);
  }, 100);
});

viewer.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('[viewer] received:', msg.type);
  if (msg.type === 'webrtc_offer') {
    got.offer = true; done++;
    // 2. Viewer answers
    viewer.send(JSON.stringify({ type: 'webrtc_answer', sdp: 'v=0\r\no=- 2 1 IN IP4 127.0.0.1\r\ns=-\r\n' }));
    // 4. Viewer sends webrtc_connected
    setTimeout(() => {
      viewer.send(JSON.stringify({ type: 'webrtc_connected' }));
    }, 50);
  } else if (msg.type === 'webrtc_ice') {
    got.ice = true; done++;
  }
});

agent.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('[agent] received:', msg.type);
  if (msg.type === 'webrtc_answer') {
    got.answer = true; done++;
  } else if (msg.type === 'webrtc_connected') {
    got.connected = true; done++;
  }
});

setTimeout(() => {
  console.log('TIMEOUT — not all messages received');
  finish();
}, 5000);

checkDone();