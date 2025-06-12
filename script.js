// conversation history
let conversation = [];
// recorder objects
let mediaRecorder;
let audioChunks = [];
// flags for UI state
let running = false;
let recording = false;
// instructions sent to the assistant
const systemPrompt = `You are a friendly Chinese teacher named 小王. Hold conversational practice with the learner:\n- Speak mostly Mandarin Chinese, sprinkling English only when necessary for comprehension.\n- Subtly correct grammar, vocabulary and pronunciation after each learner utterance.\n- If the learner says "word是什么？", give the English meaning.\n- If learner asks about a grammar structure, explain briefly in English followed by a Chinese example.\n- Begin now with the scenario the learner provided.`;

// grab page elements
const apiKeyInput = document.getElementById('apiKey');
const scenarioInput = document.getElementById('scenario');
const startStopBtn = document.getElementById('startStop');
const talkBtn = document.getElementById('talkButton');
const transcriptDiv = document.getElementById('transcript');
const ttsAudio = document.getElementById('ttsAudio');
const repeatBtn = document.getElementById('repeatButton');
let lastAssistantText = '';

// keep transcript scrolled to bottom
function scrollTranscriptToBottom() {
  transcriptDiv.scrollTop = transcriptDiv.scrollHeight;
}

// Load stored API key if present
const savedKey = localStorage.getItem('openai_api_key');
if (savedKey) {
  apiKeyInput.value = savedKey;
}

// Save API key whenever it changes
apiKeyInput.addEventListener('input', () => {
  localStorage.setItem('openai_api_key', apiKeyInput.value);
});

// start or stop the conversation
startStopBtn.addEventListener('click', () => {
  if (!running) {
    startConversation();
  } else {
    stopConversation();
  }
});

// begin recording when holding the button
talkBtn.addEventListener('pointerdown', (e) => {
  if (!talkBtn.disabled && !recording) {
    startRecording();
  }
});

// stop recording when released
talkBtn.addEventListener('pointerup', (e) => {
  if (recording) {
    stopRecording();
  }
});

// cancel if pointer leaves button
talkBtn.addEventListener('pointerleave', (e) => {
  if (recording) {
    stopRecording();
  }
});

// allow recording with spacebar
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !talkBtn.disabled && !recording) {
    e.preventDefault();
    startRecording();
  }
});

// stop recording when spacebar released
document.addEventListener('keyup', (e) => {
  if (e.code === 'Space' && recording) {
    e.preventDefault();
    stopRecording();
  }
});

// speak again when repeat button clicked
repeatBtn.addEventListener('click', async () => {
  const apiKey = apiKeyInput.value.trim();
  if (lastAssistantText && apiKey) {
    await speakAssistantText(apiKey, lastAssistantText);
  }
});

// enable mic after audio playback
ttsAudio.addEventListener('ended', () => {
  if (running) {
    talkBtn.disabled = false;
    talkBtn.textContent = '说话时按住 (Press and hold while speaking)';
  }
});

// begin a new chat session
async function startConversation() {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    alert('Please enter your OpenAI API key.');
    return;
  }
  running = true;
  startStopBtn.textContent = 'Stop';
  transcriptDiv.textContent = '';
  talkBtn.textContent = '老师正在讲话 (Teacher is speaking)...';
  talkBtn.disabled = true;
  conversation = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: scenarioInput.value.trim() }
  ];
  console.log('Starting conversation');
  await getAssistantResponse(apiKey);
}

// reset UI and stop any recording
function stopConversation() {
  running = false;
  if (recording) {
    mediaRecorder.stop();
  }
  startStopBtn.textContent = 'Go';
  repeatBtn.disabled = true;
  talkBtn.disabled = true;
  talkBtn.textContent = '说话时按住 (Press and hold while speaking)';
  console.log('Conversation stopped');
}

// start capturing microphone input
async function startRecording() {
  if (!running) return;
  talkBtn.textContent = '现在讲 (Speak now)';
  talkBtn.classList.add('holding');
  recording = true;
  audioChunks = [];
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.start();
  mediaRecorder.addEventListener('dataavailable', event => {
    audioChunks.push(event.data);
  });
  mediaRecorder.addEventListener('stop', async () => {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    console.log('Recording stopped, sending to OpenAI');
    await sendUserAudio(audioBlob);
    stream.getTracks().forEach(t => t.stop());
  });
}

// finish the current recording
function stopRecording() {
  if (!recording) return;
  talkBtn.textContent = '老师正在讲话 (Teacher is speaking)...';
  talkBtn.classList.remove('holding');
  recording = false;
  mediaRecorder.stop();
  talkBtn.disabled = true;
}

// transcribe audio then ask GPT
async function sendUserAudio(blob) {
  const apiKey = apiKeyInput.value.trim();
  const formData = new FormData();
  formData.append('file', blob, 'speech.webm');
  formData.append('model', 'gpt-4o-transcribe');

  const sttResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: formData
  });
  const sttData = await sttResponse.json();
  const userText = sttData.text;
  conversation.push({ role: 'user', content: userText });
  transcriptDiv.textContent += `\nYou: ${userText}`;
  scrollTranscriptToBottom();
  console.log('User said:', userText);
  await getAssistantResponse(apiKey);
}

// call chat completion and handle reply
async function getAssistantResponse(apiKey) {
  const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: conversation
    })
  });
  const chatData = await chatResponse.json();
  const assistantText = chatData.choices[0].message.content;
  conversation.push({ role: 'assistant', content: assistantText });
  transcriptDiv.textContent += `\nTeacher: ${assistantText}`;
  lastAssistantText = assistantText;
  repeatBtn.disabled = false;
  scrollTranscriptToBottom();
  console.log('Assistant:', assistantText);
  await speakAssistantText(apiKey, assistantText);
}

// use OpenAI TTS to read reply aloud
async function speakAssistantText(apiKey, text) {
  talkBtn.textContent = '老师正在讲话 (Teacher is speaking)...';
  talkBtn.disabled = true;
  const ttsResponse = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini-tts',
      input: text,
      voice: 'nova',
      instructions: 'Speak very slowly.'
    })
  });
  const ttsBlob = await ttsResponse.blob();
  const url = URL.createObjectURL(ttsBlob);
  ttsAudio.src = url;
  await ttsAudio.play();
  console.log('Playing assistant audio');
}
