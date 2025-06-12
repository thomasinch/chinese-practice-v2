let conversation = [];
let mediaRecorder;
let audioChunks = [];
let running = false;
let recording = false;
const systemPrompt = `You are a friendly Chinese teacher named 小王. Hold conversational practice with the learner:\n- Speak mostly Mandarin Chinese, sprinkling English only when necessary for comprehension.\n- Subtly correct grammar, vocabulary and pronunciation after each learner utterance.\n- If the learner says "word是什么？", give the English meaning.\n- If learner asks about a grammar structure, explain briefly in English followed by a Chinese example.\n- Begin now with the scenario the learner provided.`;

const apiKeyInput = document.getElementById('apiKey');
const scenarioInput = document.getElementById('scenario');
const startStopBtn = document.getElementById('startStop');
const recordBtn = document.getElementById('recordButton');
const transcriptDiv = document.getElementById('transcript');
const ttsAudio = document.getElementById('ttsAudio');

function scrollTranscriptToBottom() {
  transcriptDiv.scrollTop = transcriptDiv.scrollHeight;
}

startStopBtn.addEventListener('click', () => {
  if (!running) {
    startConversation();
  } else {
    stopConversation();
  }
});

recordBtn.addEventListener('click', () => {
  if (!recording) {
    startRecording();
  } else {
    stopRecording();
  }
});

ttsAudio.addEventListener('ended', () => {
  if (running) {
    recordBtn.disabled = false;
  }
});

async function startConversation() {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    alert('Please enter your OpenAI API key.');
    return;
  }
  running = true;
  startStopBtn.textContent = 'Stop';
  transcriptDiv.textContent = '';
  conversation = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: scenarioInput.value.trim() }
  ];
  console.log('Starting conversation');
  await getAssistantResponse(apiKey);
}

function stopConversation() {
  running = false;
  if (recording) {
    mediaRecorder.stop();
  }
  startStopBtn.textContent = 'Go';
  recordBtn.disabled = true;
  console.log('Conversation stopped');
}

async function startRecording() {
  if (!running) return;
  recordBtn.textContent = 'Stop Recording';
  recordBtn.disabled = false;
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

function stopRecording() {
  if (!recording) return;
  recordBtn.textContent = 'Record';
  recording = false;
  mediaRecorder.stop();
  recordBtn.disabled = true;
}

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
  scrollTranscriptToBottom();
  console.log('Assistant:', assistantText);
  await speakAssistantText(apiKey, assistantText);
}

async function speakAssistantText(apiKey, text) {
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
