/**
 * Gemini Live speech-to-speech (Vertex via WebSocket proxy).
 * Uses manual activity markers — required for reliable turn detection.
 */
(() => {
  const TARGET_RATE = 16000;
  const PLAYBACK_RATE = 24000;
  const SILENCE_MS = 1400;
  const SPEECH_THRESHOLD = 0.012;

  const CAPTURE_WORKLET = `
    class AudioCaptureProcessor extends AudioWorkletProcessor {
      constructor() {
        super();
        this.ratio = sampleRate / ${TARGET_RATE};
        this.buf = [];
        this.minOut = 320;
      }
      process(inputs) {
        const input = inputs[0]?.[0];
        if (!input) return true;
        for (let i = 0; i < input.length; i++) this.buf.push(input[i]);
        const outLen = Math.floor(this.buf.length / this.ratio);
        if (outLen < this.minOut) return true;
        const consumed = Math.floor(outLen * this.ratio);
        const out = new Float32Array(outLen);
        for (let i = 0; i < outLen; i++) {
          const pos = i * this.ratio;
          const idx = Math.floor(pos);
          const frac = pos - idx;
          const s0 = this.buf[idx] ?? 0;
          const s1 = this.buf[idx + 1] ?? s0;
          out[i] = s0 + frac * (s1 - s0);
        }
        this.buf.splice(0, consumed);
        this.port.postMessage({ type: 'audio', data: out });
        return true;
      }
    }
    registerProcessor('audio-capture-processor', AudioCaptureProcessor);
  `;

  const PLAYBACK_WORKLET = `
    class PCMPlayerProcessor extends AudioWorkletProcessor {
      constructor() {
        super();
        this.queue = new Int16Array(0);
        this.port.onmessage = (e) => {
          if (e.data === 'interrupt') { this.queue = new Int16Array(0); return; }
          const incoming = new Int16Array(e.data);
          const merged = new Int16Array(this.queue.length + incoming.length);
          merged.set(this.queue);
          merged.set(incoming, this.queue.length);
          this.queue = merged;
        };
      }
      process(_, outputs) {
        const out = outputs[0][0];
        for (let i = 0; i < out.length; i++) {
          out[i] = i < this.queue.length ? this.queue[i] / 32768 : 0;
        }
        if (this.queue.length > out.length) this.queue = this.queue.slice(out.length);
        else this.queue = new Int16Array(0);
        return true;
      }
    }
    registerProcessor('pcm-player-processor', PCMPlayerProcessor);
  `;

  function workletUrl(code) {
    return URL.createObjectURL(new Blob([code], { type: 'application/javascript' }));
  }

  function pcm16ToBase64(float32) {
    const pcm = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    const bytes = new Uint8Array(pcm.buffer);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }

  function base64ToInt16(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Int16Array(bytes.buffer);
  }

  function peakLevel(float32) {
    let p = 0;
    for (let i = 0; i < float32.length; i++) p = Math.max(p, Math.abs(float32[i]));
    return p;
  }

  class MeshVoiceLive {
    constructor(hooks) {
      this.hooks = hooks;
      this.config = null;
      this.ws = null;
      this.ready = false;
      this.inActivity = false;
      this.heardSpeech = false;
      this.silenceSince = 0;
      this.captureCtx = null;
      this.captureNode = null;
      this.captureStream = null;
      this.playCtx = null;
      this.playNode = null;
      this.userLine = '';
      this.botLine = '';
      this._connectResolve = null;
      this._endingTurn = false;
    }

    async loadConfig() {
      const res = await fetch('/api/voice/session');
      const data = await res.json();
      if (!data.enabled || !data.proxyUrl) throw new Error('VOICE_UNAVAILABLE');
      this.config = data;
      return data;
    }

    sendJson(obj) {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      this.ws.send(JSON.stringify(obj));
    }

    beginActivity() {
      if (this.inActivity) return;
      this.inActivity = true;
      this.heardSpeech = false;
      this.silenceSince = 0;
      this.sendJson({ realtime_input: { activity_start: {} } });
      this.hooks.onStatus?.('Listening — speak now');
    }

    endActivity() {
      if (!this.inActivity || this._endingTurn) return;
      this._endingTurn = true;
      this.inActivity = false;
      this.sendJson({ realtime_input: { activity_end: {} } });
      this.hooks.onStatus?.('Thinking…');
      setTimeout(() => { this._endingTurn = false; }, 500);
    }

    async connect() {
      if (this.ready) return;
      const cfg = this.config || (await this.loadConfig());
      const serviceUrl =
        'wss://us-central1-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent';
      const modelUri = `projects/${cfg.projectId}/locations/us-central1/publishers/google/models/${cfg.model}`;

      this.hooks.onStatus?.('Allow microphone…');
      await this.startMic();
      this.hooks.onStatus?.('Connecting…');

      await new Promise((resolve, reject) => {
        let settled = false;
        const settle = (fn, value) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          this._connectResolve = null;
          fn(value);
        };
        const timeout = setTimeout(() => settle(reject, new Error('Voice connection timed out')), 20000);
        this._connectResolve = () => settle(resolve);

        this.ws = new WebSocket(cfg.proxyUrl);
        this.ws.onopen = () => {
          this.sendJson({ service_url: serviceUrl });
          this.sendJson({
            setup: {
              model: modelUri,
              generation_config: {
                response_modalities: ['AUDIO'],
                speech_config: {
                  voice_config: { prebuilt_voice_config: { voice_name: cfg.voice || 'Puck' } },
                },
              },
              system_instruction: { parts: [{ text: cfg.systemInstruction }] },
              input_audio_transcription: {},
              output_audio_transcription: {},
              realtime_input_config: {
                automatic_activity_detection: { disabled: true },
              },
            },
          });
        };
        this.ws.onerror = () => settle(reject, new Error('WebSocket connection failed'));
        this.ws.onclose = (ev) => {
          if (!settled) {
            const reason = ev.reason ? `: ${ev.reason}` : '';
            settle(reject, new Error(`Voice disconnected (${ev.code}${reason})`));
            return;
          }
          this.ready = false;
          this.ws = null;
          this.hooks.onDisconnected?.();
        };
        this.ws.onmessage = (ev) => {
          let data;
          try { data = JSON.parse(ev.data); } catch {
            if (!settled) settle(reject, new Error('Invalid voice response'));
            return;
          }
          this.onMessage(data).catch((e) => { if (!settled) settle(reject, e); });
        };
      });

      this.beginActivity();
    }

    onAudioChunk(float32) {
      if (!this.ready) return;
      const level = peakLevel(float32);
      const now = Date.now();

      if (this.inActivity) {
        this.sendJson({
          realtime_input: {
            audio: { mime_type: 'audio/pcm;rate=16000', data: pcm16ToBase64(float32) },
          },
        });

        if (level > SPEECH_THRESHOLD) {
          this.heardSpeech = true;
          this.silenceSince = 0;
          this.hooks.onStatus?.('Hearing you…');
        } else if (this.heardSpeech) {
          if (!this.silenceSince) this.silenceSince = now;
          else if (now - this.silenceSince >= SILENCE_MS) this.endActivity();
        }
      } else if (!this._endingTurn && !this.botLine) {
        // Between turns — auto-start next utterance when user speaks again
        if (level > SPEECH_THRESHOLD) this.beginActivity();
      }
    }

    async startMic() {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone not supported in this browser');
      }
      try {
        this.captureStream = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      } catch (e) {
        if (e?.name === 'NotAllowedError') {
          throw new Error('Microphone blocked — allow access in browser settings and try again');
        }
        if (e?.name === 'NotFoundError') throw new Error('No microphone found on this device');
        throw new Error('Could not access microphone');
      }

      this.captureCtx = new AudioContext();
      if (this.captureCtx.state === 'suspended') await this.captureCtx.resume();
      await this.captureCtx.audioWorklet.addModule(workletUrl(CAPTURE_WORKLET));
      this.captureNode = new AudioWorkletNode(this.captureCtx, 'audio-capture-processor');
      this.captureNode.port.onmessage = (e) => {
        if (e.data?.type === 'audio') this.onAudioChunk(e.data.data);
      };
      const src = this.captureCtx.createMediaStreamSource(this.captureStream);
      const mute = this.captureCtx.createGain();
      mute.gain.value = 0;
      src.connect(this.captureNode);
      this.captureNode.connect(mute);
      mute.connect(this.captureCtx.destination);
    }

    async ensurePlayer() {
      if (this.playCtx) return;
      this.playCtx = new AudioContext({ sampleRate: PLAYBACK_RATE });
      if (this.playCtx.state === 'suspended') await this.playCtx.resume();
      await this.playCtx.audioWorklet.addModule(workletUrl(PLAYBACK_WORKLET));
      this.playNode = new AudioWorkletNode(this.playCtx, 'pcm-player-processor');
      this.playNode.connect(this.playCtx.destination);
    }

    handleTranscription(kind, t) {
      if (kind === 'input') {
        if (t.text) {
          this.userLine = t.text;
          this.hooks.onUserPartial?.(this.userLine);
        }
        if (t.finished && this.userLine) {
          this.hooks.onUserFinal?.(this.userLine);
          this.userLine = '';
        }
      } else {
        if (t.text) {
          this.botLine += t.text;
          this.hooks.onBotPartial?.(this.botLine);
          this.hooks.onStatus?.('Speaking…');
        }
        if (t.finished && this.botLine) {
          this.hooks.onBotFinal?.(this.botLine);
          this.botLine = '';
        }
      }
    }

    async playPcmParts(parts) {
      await this.ensurePlayer();
      for (const part of parts) {
        const inline = part.inlineData || part.inline_data;
        if (!inline?.data) continue;
        const mime = inline.mimeType || inline.mime_type || '';
        if (!mime.startsWith('audio/pcm')) continue;
        const pcm = base64ToInt16(inline.data);
        this.playNode.port.postMessage(pcm.buffer);
      }
    }

    async onMessage(data) {
      if (data.error) throw new Error(data.error.message || 'Voice error');
      if (data.setupComplete) {
        this.ready = true;
        this._connectResolve?.();
        return;
      }

      const sc = data.serverContent || data.server_content;
      if (sc) {
        if (sc.interrupted && this.playNode) this.playNode.port.postMessage('interrupt');
        if (sc.inputTranscription || sc.input_transcription) {
          this.handleTranscription('input', sc.inputTranscription || sc.input_transcription);
        }
        if (sc.outputTranscription || sc.output_transcription) {
          this.handleTranscription('output', sc.outputTranscription || sc.output_transcription);
        }
        const turn = sc.modelTurn || sc.model_turn;
        if (turn?.parts?.length) await this.playPcmParts(turn.parts);
        if (sc.turnComplete || sc.turn_complete) {
          if (this.botLine) {
            this.hooks.onBotFinal?.(this.botLine);
            this.botLine = '';
          }
          this.heardSpeech = false;
          this.silenceSince = 0;
          this.hooks.onStatus?.('Speak again or tap mic to stop');
        }
        return;
      }

      if (data.inputTranscription || data.input_transcription) {
        this.handleTranscription('input', data.inputTranscription || data.input_transcription);
      }
      if (data.outputTranscription || data.output_transcription) {
        this.handleTranscription('output', data.outputTranscription || data.output_transcription);
      }
    }

    /** User tapped mic while active — finish current utterance. */
    finishTurn() {
      if (this.inActivity) this.endActivity();
    }

    disconnect(userInitiated = true) {
      if (this.inActivity) {
        try { this.sendJson({ realtime_input: { activity_end: {} } }); } catch { /* ignore */ }
      }
      this.ready = false;
      this.inActivity = false;
      this._connectResolve = null;
      try { this.ws?.close(); } catch { /* ignore */ }
      this.ws = null;
      this.captureNode?.disconnect();
      this.captureNode = null;
      this.captureCtx?.close().catch(() => {});
      this.captureCtx = null;
      this.captureStream?.getTracks().forEach((t) => t.stop());
      this.captureStream = null;
      this.playNode?.disconnect();
      this.playNode = null;
      this.playCtx?.close().catch(() => {});
      this.playCtx = null;
      if (userInitiated) this.hooks.onStatus?.('Stopped');
      this.hooks.onDisconnected?.();
    }
  }

  window.MeshVoiceLive = MeshVoiceLive;
})();
