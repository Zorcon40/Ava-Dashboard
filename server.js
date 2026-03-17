import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID;
const OPENCLAW_GATEWAY_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN;
const OPENCLAW_API_URL = process.env.OPENCLAW_API_URL;

const sessions = new Map();

app.use(express.static(join(__dirname, 'public')));
app.use(express.json());

// Simple health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'AVA Dashboard is running!' });
});

wss.on('connection', (ws) => {
  const sessionId = randomUUID();
  sessions.set(ws, sessionId);
  
  console.log(`✅ Client connected - Session: ${sessionId}`);

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      if (data.type === 'user_command') {
        const userText = data.text;
        console.log('🎤 User command received:', userText);

        const responseText = await sendToOpenClaw(sessionId, userText, ws);
        
        if (responseText) {
          console.log('💬 AVA response:', responseText);

          ws.send(JSON.stringify({
            type: 'ava_text_response',
            text: responseText
          }));

          await generateAndStreamTTS(responseText, ws);
        }
      }
    } catch (error) {
      console.error('❌ Error processing message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to process command'
      }));
    }
  });

  ws.on('close', () => {
    console.log('👋 Client disconnected');
    sessions.delete(ws);
  });

  ws.send(JSON.stringify({
    type: 'connected',
    sessionId: sessionId
  }));
});

async function sendToOpenClaw(sessionId, userMessage, ws) {
  try {
    ws.send(JSON.stringify({
      type: 'ava_processing',
      message: 'AVA is thinking...'
    }));

    const response = await fetch(`${OPENCLAW_API_URL}/sessions/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENCLAW_GATEWAY_TOKEN}`,
      },
      body: JSON.stringify({
        session_id: sessionId,
        message: userMessage,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenClaw API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('📥 OpenClaw response received:', data);

    if (data.status === 'processing' || data.status === 'pending') {
      console.log('⏳ Task is async, polling for completion...');
      return await pollForCompletion(sessionId, data.task_id, ws);
    }

    return data.response || data.message || 'Task completed successfully.';
  } catch (error) {
    console.error('❌ OpenClaw API error:', error);
    return `I encountered an error: ${error.message}. Please try again.`;
  }
}

async function pollForCompletion(sessionId, taskId, ws, maxAttempts = 30) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      const response = await fetch(`${OPENCLAW_API_URL}/tasks/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${OPENCLAW_GATEWAY_TOKEN}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Task polling error: ${response.status}`);
      }

      const data = await response.json();

      if (data.status === 'completed') {
        return data.response || data.result || 'Task completed.';
      } else if (data.status === 'failed') {
        return 'Sorry, the task failed. Please try again.';
      }

      ws.send(JSON.stringify({
        type: 'ava_processing',
        message: `Still processing... (${attempt + 1}/${maxAttempts})`
      }));
    } catch (error) {
      console.error('❌ Polling error:', error);
    }
  }

  return 'The task is taking longer than expected. Please try again.';
}

async function generateAndStreamTTS(text, ws) {
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    ws.send(JSON.stringify({
      type: 'audio_start'
    }));

    const reader = response.body;
    for await (const chunk of reader) {
      if (ws.readyState === ws.OPEN) {
        ws.send(chunk);
      }
    }

    ws.send(JSON.stringify({
      type: 'audio_end'
    }));

    console.log('✅ TTS streaming complete');
  } catch (error) {
    console.error('❌ TTS generation error:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Failed to generate speech'
    }));
  }
}

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                                                            ║');
  console.log('║              🤖 AVA Dashboard Server                       ║');
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`✅ Server running on http://${HOST}:${PORT}`);
  console.log(`✅ WebSocket ready for connections`);
  console.log('');
  if (HOST === 'localhost' || HOST === '127.0.0.1') {
    console.log('📝 Open http://localhost:3000 in your browser');
  } else {
    console.log('🌐 Server accessible externally');
  }
  console.log('');
});
