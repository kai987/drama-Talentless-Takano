export function createSpeechController({
  synthesis,
  UtteranceCtor,
  selectVoice = voices => voices.find(voice => /^ja(?:-|_|$)/i.test(voice.lang)),
  onStateChange = () => {},
  onError = () => {}
} = {}) {
  let current = null;

  const getState = () => current ? { key: current.key, status: current.status } : { key: null, status: 'idle' };
  const emit = () => onStateChange(getState());

  function clear(utterance) {
    if (!current || (utterance && current.utterance !== utterance)) return;
    current = null;
    emit();
  }

  function stop() {
    const hadPlayback = Boolean(current || synthesis?.speaking || synthesis?.paused);
    current = null;
    if (hadPlayback && typeof synthesis?.cancel === 'function') synthesis.cancel();
    emit();
  }

  function toggle({ key, text, lang = 'ja-JP', rate = 0.88 } = {}) {
    if (!synthesis || typeof synthesis.speak !== 'function' || typeof synthesis.pause !== 'function' || typeof synthesis.resume !== 'function' || !UtteranceCtor) {
      return { ok: false, reason: 'unsupported', ...getState() };
    }
    if (!key || !text) return { ok: false, reason: 'empty', ...getState() };

    if (current?.key === key && current.status === 'playing') {
      synthesis.pause();
      current.status = 'paused';
      emit();
      return { ok: true, ...getState() };
    }

    if (current?.key === key && current.status === 'paused') {
      synthesis.resume();
      current.status = 'playing';
      emit();
      return { ok: true, ...getState() };
    }

    const voices = typeof synthesis.getVoices === 'function' ? synthesis.getVoices() : [];
    const voice = selectVoice?.(voices);
    if (!voice) return { ok: false, reason: 'no-voice', ...getState() };

    if (current || synthesis.speaking || synthesis.paused) {
      current = null;
      synthesis.cancel();
    }

    const utterance = new UtteranceCtor(text);
    utterance.lang = lang;
    utterance.voice = voice;
    utterance.rate = rate;
    utterance.onend = () => clear(utterance);
    utterance.onerror = event => {
      if (!current || current.utterance !== utterance) return;
      const ignored = ['interrupted', 'canceled'].includes(event?.error);
      current = null;
      emit();
      if (!ignored) onError(event);
    };

    current = { key, status: 'playing', utterance };
    synthesis.speak(utterance);
    emit();
    return { ok: true, ...getState() };
  }

  return { toggle, stop, getState };
}
