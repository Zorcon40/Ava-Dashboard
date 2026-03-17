let ws = null;
let recognition = null;
let isListening = false;
let isPushToTalk = false;
let audioContext = null;
let analyser = null;
let microphone = null;
let animationId = null;

const WAKE_WORDS = ['hey ava', 'ok ava', 'hey eva', 'ok eva'];

// DOM elements
const startListeningBtn = document.getElementById('startListening');
const stopListeningBtn = document.getElementById('stopListening');
const pushToTalkBtn = document.getElementById('pushToTalk');
const textInput = document.getElementById('textInput');
const sendButton = document.getElementById('sendButton');
const conversation = document.getElementById('conversation');
const connectionStatus = document.getElementById('connectionStatus');
const micStatus = document.getElementById('micStatus');
const systemStatus = document.getElementById('systemStatus');
const sessionIdSpan = document.getElementById('sessionId');
const canvas = document.getElementById('waveform');
const canvasCtx = canvas.getContext('2d');

// Initialize WebSocket connection
function connectWebSocket() {
    ws = new WebSocket('ws://localhost:3000');

    ws.onopen = () => {
        console.log('✅ Connected to server');
        connectionStatus.textContent = 'Connected';
        connectionStatus.style.color = '#10b981';
        addSystemMessage('Connected to AVA Dashboard');
    };

    ws.onmessage = async (event) => {
        if (event.data instanceof Blob) {
            await playAudioChunk(event.data);
            return;
        }

        try {
            const data = JSON.parse(event.data);
            handleServerMessage(data);
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    };

    ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        connectionStatus.textContent = 'Error';
        connectionStatus.style.color = '#ef4444';
    };

    ws.onclose = () => {
        console.log('👋 Disconnected from server');
        connectionStatus.textContent = 'Disconnected';
        connectionStatus.style.color = '#ef4444';
        setTimeout(connectWebSocket, 3000);
    };
}

function handleServerMessage(data) {
    switch (data.type) {
        case 'connected':
            sessionIdSpan.textContent = data.sessionId.substring(0, 8) + '...';
            break;
        case 'ava_text_response':
            addMessage('AVA', data.text);
            clearProcessingMessage();
            break;
        case 'ava_processing':
            showProcessingMessage(data.message);
            break;
        case 'audio_start':
            systemStatus.textContent = 'Playing audio...';
            break;
        case 'audio_end':
            systemStatus.textContent = 'Ready';
            break;
        case 'error':
            addSystemMessage('Error: ' + data.message);
            clearProcessingMessage();
            break;
    }
}

// Initialize Speech Recognition
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        addSystemMessage('Speech recognition not supported in this browser');
        startListeningBtn.disabled = true;
        pushToTalkBtn.disabled = true;
        return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        console.log('🎤 Speech recognition started');
        micStatus.textContent = 'Active';
        micStatus.style.color = '#10b981';
    };

    recognition.onend = () => {
        console.log('🎤 Speech recognition ended');
        micStatus.textContent = 'Inactive';
        micStatus.style.color = '#a0a8c0';

        if (isListening && !isPushToTalk) {
            recognition.start();
        }
    };

    recognition.onerror = (event) => {
        console.error('❌ Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
            addSystemMessage('Microphone access denied');
            stopListening();
        }
    };

    recognition.onresult = (event) => {
        const results = event.results;
        const lastResult = results[results.length - 1];

        if (lastResult.isFinal) {
            const transcript = lastResult[0].transcript.trim();
            console.log('📝 Transcript:', transcript);

            if (isPushToTalk) {
                sendCommand(transcript);
                stopPushToTalk();
            } else {
                checkForWakeWord(transcript);
            }
        }
    };
}

function checkForWakeWord(transcript) {
    const lowerTranscript = transcript.toLowerCase();

    for (const wakeWord of WAKE_WORDS) {
        const wakeWordIndex = lowerTranscript.indexOf(wakeWord);
        if (wakeWordIndex !== -1) {
            console.log('🎯 Wake word detected!');
            systemStatus.textContent = 'Wake word detected!';
            
            const command = lowerTranscript.substring(wakeWordIndex + wakeWord.length).trim();
            
            if (command) {
                sendCommand(command);
            }

            setTimeout(() => {
                systemStatus.textContent = 'Ready';
            }, 2000);

            return;
        }
    }
}

function startListening() {
    if (!recognition) return;
    isListening = true;
    isPushToTalk = false;
    recognition.start();
    startListeningBtn.disabled = true;
    stopListeningBtn.disabled = false;
    startWaveformVisualization();
}

function stopListening() {
    if (!recognition) return;
    isListening = false;
    recognition.stop();
    startListeningBtn.disabled = false;
    stopListeningBtn.disabled = true;
    stopWaveformVisualization();
}

function startPushToTalk() {
    if (!recognition) return;
    isPushToTalk = true;
    isListening = false;
    recognition.start();
    pushToTalkBtn.textContent = 'Recording...';
    pushToTalkBtn.style.background = '#ef4444';
    startWaveformVisualization();
}

function stopPushToTalk() {
    if (!recognition) return;
    isPushToTalk = false;
    recognition.stop();
    pushToTalkBtn.textContent = 'Push to Talk';
    pushToTalkBtn.style.background = '#10b981';
    stopWaveformVisualization();
}

async function startWaveformVisualization() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        analyser = audioContext.createAnalyser();
        microphone = audioContext.createMediaStreamSource(stream);
        microphone.connect(analyser);
        
        analyser.fftSize = 2048;
        drawWaveform();
    } catch (error) {
        console.error('❌ Microphone access error:', error);
        addSystemMessage('Could not access microphone');
    }
}

function stopWaveformVisualization() {
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    if (microphone) {
        microphone.disconnect();
        microphone = null;
    }
    if (analyser) {
        analyser.disconnect();
        analyser = null;
    }
    
    canvasCtx.fillStyle = 'rgb(15, 20, 25)';
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawWaveform() {
    if (!analyser) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
        animationId = requestAnimationFrame(draw);
        analyser.getByteTimeDomainData(dataArray);

        canvasCtx.fillStyle = 'rgb(15, 20, 25)';
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = 'rgb(100, 200, 255)';
        canvasCtx.beginPath();

        const sliceWidth = canvas.width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = (v * canvas.height) / 2;

            if (i === 0) {
                canvasCtx.moveTo(x, y);
            } else {
                canvasCtx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        canvasCtx.lineTo(canvas.width, canvas.height / 2);
        canvasCtx.stroke();
    };

    draw();
}

function sendCommand(text) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        addSystemMessage('Not connected to server');
        return;
    }

    addMessage('You', text);
    
    ws.send(JSON.stringify({
        type: 'user_command',
        text: text
    }));
}

function addMessage(sender, text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender.toLowerCase()}`;
    
    const time = new Date().toLocaleTimeString();
    
    messageDiv.innerHTML = `
        <div class="message-sender">${sender}</div>
        <div class="message-text">${text}</div>
        <div class="message-time">${time}</div>
    `;
    
    conversation.appendChild(messageDiv);
    conversation.scrollTop = conversation.scrollHeight;
}

function addSystemMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system';
    
    const time = new Date().toLocaleTimeString();
    
    messageDiv.innerHTML = `
        <div class="message-sender">System</div>
        <div class="message-text">${text}</div>
        <div class="message-time">${time}</div>
    `;
    
    conversation.appendChild(messageDiv);
    conversation.scrollTop = conversation.scrollHeight;
}

function showProcessingMessage(text) {
    clearProcessingMessage();
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message processing';
    messageDiv.id = 'processingMessage';
    
    messageDiv.innerHTML = `
        <div class="spinner"></div>
        <div class="message-text">${text}</div>
    `;
    
    conversation.appendChild(messageDiv);
    conversation.scrollTop = conversation.scrollHeight;
}

function clearProcessingMessage() {
    const processingMsg = document.getElementById('processingMessage');
    if (processingMsg) {
        processingMsg.remove();
    }
}

async function playAudioChunk(blob) {
    const arrayBuffer = await blob.arrayBuffer();
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioCtx.destination);
    source.start(0);
}

// Event listeners
startListeningBtn.addEventListener('click', startListening);
stopListeningBtn.addEventListener('click', stopListening);

pushToTalkBtn.addEventListener('mousedown', startPushToTalk);
pushToTalkBtn.addEventListener('mouseup', stopPushToTalk);
pushToTalkBtn.addEventListener('mouseleave', () => {
    if (isPushToTalk) stopPushToTalk();
});

sendButton.addEventListener('click', () => {
    const text = textInput.value.trim();
    if (text) {
        sendCommand(text);
        textInput.value = '';
    }
});

textInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const text = textInput.value.trim();
        if (text) {
            sendCommand(text);
            textInput.value = '';
        }
    }
});

// Initialize
connectWebSocket();
initSpeechRecognition();

// Clear waveform on load
canvasCtx.fillStyle = 'rgb(15, 20, 25)';
canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
