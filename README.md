# Ava Dashboard

A sophisticated web-based voice interface for interacting with OpenClaw's AVA AI assistant.

## 🚀 Live Demo

Visit the live dashboard: [Coming soon after Vercel deployment]

## ✨ Features

- **Voice Interaction** - Wake word detection ("Hey AVA", "OK AVA")
- **Web Speech API** - Real-time speech-to-text
- **ElevenLabs TTS** - Natural voice responses
- **OpenClaw Gateway** - AI assistant integration
- **Real-time Waveform** - Audio visualization
- **Push-to-Talk** - Alternative voice input
- **Text Chat** - Direct message input
- **WebSocket** - Real-time bidirectional communication

## 🛠️ Tech Stack

- **Backend**: Node.js, Express, WebSocket
- **Frontend**: HTML5, CSS3, JavaScript
- **APIs**: OpenClaw Gateway, ElevenLabs TTS, Web Speech API
- **Deployment**: Vercel

## 🏃 Quick Start

### Prerequisites
- Node.js 18+
- OpenClaw Gateway API token
- ElevenLabs API key

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/ava-dashboard.git
cd ava-dashboard

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your API keys

# Start the server
npm start
```

Visit `http://localhost:3000` in your browser.

## 🔑 Environment Variables

Create a `.env` file with the following:

```env
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=your_voice_id
OPENCLAW_GATEWAY_TOKEN=your_openclaw_token
OPENCLAW_API_URL=https://api.openclaw.ai/v1
PORT=3000
```

## 📖 Usage

1. Open the dashboard in your browser
2. Click "Start Listening" to enable wake word detection
3. Say "Hey AVA" or "OK AVA" followed by your command
4. Alternatively, use "Push to Talk" or type messages directly

## 🎯 Wake Words

- "Hey AVA"
- "OK AVA"
- "Hey Eva"
- "OK Eva"

## 📝 License

MIT

## 👤 Author

Dallas

## 🙏 Acknowledgments

Built with OpenClaw's AVA AI assistant and ElevenLabs text-to-speech technology.
