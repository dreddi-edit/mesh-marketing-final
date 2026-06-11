/**
 * Gemini Live speech-to-speech client (Vertex via WebSocket proxy).
 */
(() => {
  const TARGET_RATE = 16000;
  const PLAYBACK_RATE = 24000;

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
        this.port.postMessage({ type: 'audio', data: out }, [out.buffer]);
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
          if (e.data === 'interrupt') {
            this.queue = new Int16Array(0);
            return;
          }
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
          if (i < this.queue.length) {
            out[i] = this.queue[i] / 32768;
          } else {
            out[i] = 0;
          }
        }
        if (this.queue.length > out.length) {
          this.queue = this.queue.slice(out.length);
        } else {
          this.queue = new Int16Array(0);
        }
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
    const step = 0x8000;
    for (let i = 0; i < bytes.length; i += step) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
    }
    return btoa(bin);
  }

  function base64ToInt16(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Int16Array(bytes.buffer);
  }

  class MeshVoiceLive {
    constructor(hooks) {
      this.hooks = hooks;
      this.config = null;
      this.ws = null;
      this.ready = false;
      this.captureCtx = null;
      this.captureNode = null;
      this.captureStream = null;
      this.playCtx = null;
      this.playNode = null;
      this.userLine = '';
      this.botLine = '';
      this._connectResolve = null;
    }

    async loadConfig() {
      const res = await fetch('/api/voice/session');
      const data = await res.json();
      if (!data.enabled || !data.proxyUrl) throw new Error('VOICE_UNAVAILABLE');
      this.config = data;
      return data;
    }

    async connect() {
      if (this.ready) return;
      const cfg = this.config || (await this.loadConfig());
      const serviceUrl =
        'wss://us-central1-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent';
      const modelUri = `projects/${cfg.projectId}/locations/us-central1/publishers/google/models/${cfg.model}`;

      this.hooks.onStatus?.('Allow microphone…');
      await this.startMic();

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
          this.ws.send(JSON.stringify({ service_url: serviceUrl }));
          this.ws.send(
            JSON.stringify({
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
                  automatic_activity_detection: { disabled: false },
                },
              },
            }),
          );
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
          try {
            data = JSON.parse(ev.data);
          } catch {
            if (!settled) settle(reject, new Error('Invalid voice response'));
            return;
          }
          this.onMessage(data).catch((e) => {
            if (!settled) settle(reject, e);
          });
        };
      });

      this.hooks.onStatus?.('Listening — speak now');
    }

    sendAudio(float32) {
      if (!this.ready || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      const b64 = pcm16ToBase64(float32);
      this.ws.send(
        JSON.stringify({
          realtime_input: {
            audio: { mime_type: 'audio/pcm;rate=16000', data: b64 },
          },
        }),
      );
    }

    async startMic() {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone not supported in this browser');
      }
      try {
        this.captureStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
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
        if (e.data?.type === 'audio') this.sendAudio(e.data.data);
      };
      this.captureCtx.createMediaStreamSource(this.captureStream).connect(this.captureNode);
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
      const sc = { text: t.text, finished: t.finished };
      if (kind === 'input') {
        if (sc.text) {
          this.userLine = sc.text;
          this.hooks.onUserPartial?.(this.userLine);
        }
        if (sc.finished && this.userLine) {
          this.hooks.onUserFinal?.(this.userLine);
          this.userLine = '';
          this.hooks.onStatus?.('Thinking…');
        }
      } else {
        if (sc.text) {
          this.botLine += sc.text;
          this.hooks.onBotPartial?.(this.botLine);
          this.hooks.onStatus?.('Speaking…');
        }
        if (sc.finished && this.botLine) {
          this.hooks.onBotFinal?.(this.botLine);
          this.botLine = '';
          this.hooks.onStatus?.('Listening — speak now');
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
        this.playNode.port.postMessage(pcm.buffer, [pcm.buffer]);
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
        if (sc.interrupted && this.playNode) {
          this.playNode.port.postMessage('interrupt');
        }
        if (sc.inputTranscription || sc.input_transcription) {
          this.handleTranscription('input', sc.inputTranscription || sc.input_transcription);
        }
        if (sc.outputTranscription || sc.output_transcription) {
          this.handleTranscription('output', sc.outputTranscription || sc.output_transcription);
        }
        const turn = sc.modelTurn || sc.model_turn;
        if (turn?.parts?.length) {
          await this.playPcmParts(turn.parts);
        }
        if (sc.turnComplete || sc.turn_complete) {
          if (this.botLine) {
            this.hooks.onBotFinal?.(this.botLine);
            this.botLine = '';
          }
          this.hooks.onStatus?.('Listening — speak now');
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

    disconnect(userInitiated = true) {
      this.ready = false;
      this._connectResolve = null;
      try {
        this.ws?.close();
      } catch { /* ignore */ }
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
