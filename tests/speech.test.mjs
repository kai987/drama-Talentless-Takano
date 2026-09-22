import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSpeechController } from '../src/speech.js';

class FakeUtterance {
  constructor(text) { this.text = text; }
}

function fakeSynthesis({ voices = [{ lang: 'ja-JP', name: 'Japanese' }] } = {}) {
  return {
    voices,
    speaking: false,
    paused: false,
    current: null,
    calls: [],
    getVoices() { return this.voices; },
    speak(utterance) { this.current = utterance; this.speaking = true; this.paused = false; this.calls.push(['speak', utterance.text]); },
    pause() { this.paused = true; this.calls.push(['pause']); },
    resume() { this.paused = false; this.calls.push(['resume']); },
    cancel() { this.speaking = false; this.paused = false; this.calls.push(['cancel']); }
  };
}

test('same speech button cycles play -> pause -> resume without restarting', () => {
  const synthesis = fakeSynthesis();
  const states = [];
  const controller = createSpeechController({ synthesis, UtteranceCtor: FakeUtterance, onStateChange: state => states.push(state) });

  assert.deepEqual(controller.toggle({ key: '04-01:work:0', text: '問題が大きくなる前に。' }), { ok: true, key: '04-01:work:0', status: 'playing' });
  const firstUtterance = synthesis.current;
  assert.deepEqual(controller.toggle({ key: '04-01:work:0', text: '問題が大きくなる前に。' }), { ok: true, key: '04-01:work:0', status: 'paused' });
  assert.equal(synthesis.current, firstUtterance);
  assert.deepEqual(controller.toggle({ key: '04-01:work:0', text: '問題が大きくなる前に。' }), { ok: true, key: '04-01:work:0', status: 'playing' });
  assert.equal(synthesis.current, firstUtterance);
  assert.deepEqual(synthesis.calls, [['speak', '問題が大きくなる前に。'], ['pause'], ['resume']]);
  assert.equal(states.at(-1).status, 'playing');
});

test('clicking another speech button cancels the current utterance and starts the new one', () => {
  const synthesis = fakeSynthesis();
  const controller = createSpeechController({ synthesis, UtteranceCtor: FakeUtterance });
  controller.toggle({ key: 'a', text: '一つ目' });
  const old = synthesis.current;
  controller.toggle({ key: 'b', text: '二つ目' });
  assert.deepEqual(synthesis.calls, [['speak', '一つ目'], ['cancel'], ['speak', '二つ目']]);
  assert.deepEqual(controller.getState(), { key: 'b', status: 'playing' });

  old.onerror?.({ error: 'canceled' });
  assert.deepEqual(controller.getState(), { key: 'b', status: 'playing' });
});

test('end and stop return playback state to idle', () => {
  const synthesis = fakeSynthesis();
  const controller = createSpeechController({ synthesis, UtteranceCtor: FakeUtterance });
  controller.toggle({ key: 'a', text: '再生' });
  synthesis.current.onend?.();
  assert.deepEqual(controller.getState(), { key: null, status: 'idle' });

  controller.toggle({ key: 'b', text: '停止' });
  controller.stop();
  assert.deepEqual(controller.getState(), { key: null, status: 'idle' });
  assert.equal(synthesis.calls.at(-1)[0], 'cancel');
});

test('missing Japanese voice and unsupported synthesis fail without changing state', () => {
  const noVoice = fakeSynthesis({ voices: [{ lang: 'en-US' }] });
  const controller = createSpeechController({ synthesis: noVoice, UtteranceCtor: FakeUtterance });
  assert.equal(controller.toggle({ key: 'a', text: '日本語' }).reason, 'no-voice');
  assert.deepEqual(controller.getState(), { key: null, status: 'idle' });

  const unsupported = createSpeechController({});
  assert.equal(unsupported.toggle({ key: 'a', text: '日本語' }).reason, 'unsupported');
});
