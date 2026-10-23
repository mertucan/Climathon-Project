// Çocuk mesajını duygulu sesle okur: önce Gemini TTS, alınamazsa tarayıcının konuşma sentezi.
import { synthesize } from './ai.js';
import { moodFor } from '../shared/gemini-core.js';
import { getLang, LANGUAGES } from './i18n.js';

const cache = new Map();
let audio = null;

export function stopVoice() {
  if (audio) { audio.pause(); audio = null; }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

// Gemini TTS 16 bit, mono, ham PCM döndürür; tarayıcının çalabilmesi için WAV başlığı eklenir.
function pcmToWavUrl(base64, sampleRate) {
  const pcm = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const header = new DataView(new ArrayBuffer(44));
  const write = (offset, text) => [...text].forEach((ch, i) => header.setUint8(offset + i, ch.charCodeAt(0)));
  write(0, 'RIFF'); header.setUint32(4, 36 + pcm.length, true); write(8, 'WAVE');
  write(12, 'fmt '); header.setUint32(16, 16, true); header.setUint16(20, 1, true); header.setUint16(22, 1, true);
  header.setUint32(24, sampleRate, true); header.setUint32(28, sampleRate * 2, true); header.setUint16(32, 2, true); header.setUint16(34, 16, true);
  write(36, 'data'); header.setUint32(40, pcm.length, true);
  return URL.createObjectURL(new Blob([header, pcm], { type: 'audio/wav' }));
}

function play(url) {
  stopVoice();
  audio = new Audio(url);
  return new Promise((resolve, reject) => {
    audio.onended = () => { audio = null; resolve(); };
    audio.onerror = () => reject(new Error('play'));
    audio.play().catch(reject);
  });
}

// Tarayıcı sesi için duyguya göre perde/hız: çocuksu ve canlı, ama anlaşılır.
const BROWSER_TONE = { celebrate: { pitch: 1.4, rate: 1.05 }, encourage: { pitch: 1.25, rate: 0.98 }, gentle: { pitch: 1.15, rate: 0.9 } };
function speakWithBrowser(text, mood) {
  if (!('speechSynthesis' in window)) return Promise.reject(new Error('no_speech'));
  stopVoice();
  const utterance = new SpeechSynthesisUtterance(text);
  const locale = LANGUAGES[getLang()].locale;
  utterance.lang = locale;
  const voice = speechSynthesis.getVoices().find(v => v.lang.replace('_', '-').startsWith(locale.slice(0, 2)));
  if (voice) utterance.voice = voice;
  Object.assign(utterance, BROWSER_TONE[mood] || BROWSER_TONE.encourage);
  return new Promise(resolve => {
    utterance.onend = resolve;
    utterance.onerror = resolve;
    speechSynthesis.speak(utterance);
  });
}

// started(source) ses başladığında çağrılır: 'gemini' ya da 'browser'.
export async function speak({ text, leftoverPercent }, { signal, onWait, started } = {}) {
  const mood = moodFor(leftoverPercent);
  const key = `${getLang()}|${mood}|${text}`;
  try {
    let url = cache.get(key);
    if (!url) {
      const response = await synthesize({ text, mood }, { signal, onWait });
      if (response) {
        const { mimeType, data, sampleRate } = response.result;
        url = /wav|mpeg|mp3|ogg/.test(mimeType) ? `data:${mimeType};base64,${data}` : pcmToWavUrl(data, sampleRate);
        cache.set(key, url);
      }
    }
    if (url) {
      started?.('gemini');
      await play(url);
      return 'gemini';
    }
  } catch (error) {
    if (error.code === 'aborted') throw error;
    console.warn('Gemini TTS kullanılamadı, tarayıcı sesi kullanılıyor:', error.message);
  }
  started?.('browser');
  await speakWithBrowser(text, mood);
  return 'browser';
}
