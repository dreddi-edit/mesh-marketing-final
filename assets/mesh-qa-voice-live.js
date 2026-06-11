/**
 * Gemini Live voice client (ADK-style) — needs MESH_VOICE_PROXY_URL WebSocket proxy.
 */
(() => {
  const CAPTURE_WORKLET = `
    class AudioCaptureProcessor extends AudioWorkletProcessor {
      process(inputs) {
        const input = inputs[0]?.[0];
        if (input) this.port.postMessage({ type: 'audio', data: input });
        return true;
      }
    }
    registerProcessor('audio-capture-processor', AudioCaptureProcessor);
  `;

  const PLAYBACK_WORKLET = `
    class PCMProcessor extends AudioWorkletProcessor {
      constructor() {
        super();
        this.queue = [];
        this.port.onmessage = (e) => {
          if (e.data === 'interrupt') this.queue = [];
          else this.queue.push(...e.data);
        };
      }
      process(_, outputs) {
        const out = outputs[0][0];
        for (let i = 0; i < out.length; i++) {
          out[i] = this.queue.length ? this.queue.shift() : 0;
        }
        return true;
      }
    }
    registerProcessor('pcm-processor', PCMProcessor);
  `;

  function workletUrl(code) {
    return URL.createObjectURL(new Blob([code], { type: 'application/javascript' }));
  }

  function pcm16ToBase64(float32) {
    const pcm = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      pcm[i] = s * 0x7fff;
    }
    const bytes = new Uint8Array(pcm.buffer);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function base64ToFloat32(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const pcm = new Int16Array(bytes.buffer);
    const out = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) out[i] = pcm[i] / 32768;
    return out;
  }

  class MeshVoiceLive {
    constructor(hooks) {
      this.hooks = hooks;
      this.config = null;
      this.ws = null;
      this.connected = false;
      this.streaming = false;
      this.captureCtx = null;
      this.captureNode = null;
      this.captureStream = null;
      this.playCtx = null;
      this.playNode = null;
      this.userLine = '';
      this.botLine = '';
    }

    async loadConfig() {
      const res = await fetch('/api/voice/session');
      const data = await res.json();
      if (!data.enabled || !data.proxyUrl) {
        throw new Error('VOICE_UNAVAILABLE');
      }
      this.config = data;
      return data;
    }

    async connect() {
      if (this.connected) return;
      const cfg = this.config || (await this.loadConfig());
      const serviceUrl =
        'wss://us-central1-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent';
      const modelUri = `projects/${cfg.projectId}/locations/us-central1/publishers/google/models/${cfg.model}`;

      await new Promise((resolve, reject) => {
        this.ws = new WebSocket(cfg.proxyUrl);
        this.ws.onopen = () => {
          this.connected = true;
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
              },
            }),
          );
          resolve();
        };
        this.ws.onerror = () => reject(new Error('WebSocket failed'));
        this.ws.onclose = () => this.disconnect(false);
        this.ws.onmessage = (ev) => this.onMessage(JSON.parse(ev.data));
      });

      await this.startMic();
      this.hooks.onStatus?.('Live — speak anytime');
    }

    async startMic() {
      if (this.streaming) return;
      this.captureStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
      });
      this.captureCtx = new AudioContext({ sampleRate: 16000 });
      await this.captureCtx.audioWorklet.addModule(workletUrl(CAPTURE_WORKLET));
      this.captureNode = new AudioWorkletNode(this.captureCtx, 'audio-capture-processor');
      this.captureNode.port.onmessage = (e) => {
        if (!this.streaming || !this.connected || e.data.type !== 'audio') return;
        const b64 = pcm16ToBase64(e.data.data);
        this.ws?.send(
          JSON.stringify({
            realtime_input: { media_chunks: [{ mime_type: 'audio/pcm', data: b64 }] },
          }),
        );
      };
      this.captureCtx.createMediaStreamSource(this.captureStream).connect(this.captureNode);
      this.streaming = true;
    }

    async ensurePlayer() {
      if (this.playCtx) return;
      this.playCtx = new AudioContext({ sampleRate: 24000 });
      await this.playCtx.audioWorklet.addModule(workletUrl(PLAYBACK_WORKLET));
      this.playNode = new AudioWorkletNode(this.playCtx, 'pcm-processor');
      this.playNode.connect(this.playCtx.destination);
    }

    async onMessage(data) {
      if (data.setupComplete) {
        this.hooks.onStatus?.('Listening…');
        return;
      }
      const sc = data.serverContent;
      if (!sc) return;

      if (sc.inputTranscription?.text) {
        this.userLine = sc.inputTranscription.text;
        this.hooks.onUserPartial?.(this.userLine);
        if (sc.inputTranscription.finished) {
          this.hooks.onUserFinal?.(this.userLine);
          this.userLine = '';
        }
      }
      if (sc.outputTranscription?.text) {
        this.botLine += sc.outputTranscription.text;
        this.hooks.onBotPartial?.(this.botLine);
        if (sc.outputTranscription.finished) {
          this.hooks.onBotFinal?.(this.botLine);
          this.botLine = '';
        }
      }
      if (sc.interrupted && this.playNode) {
        this.playNode.port.postMessage('interrupt');
      }
      const parts = sc.modelTurn?.parts;
      if (parts?.length && parts[0].inlineData?.data) {
        await this.ensurePlayer();
        if (this.playCtx.state === 'suspended') await this.playCtx.resume();
        this.playNode.port.postMessage(base64ToFloat32(parts[0].inlineData.data));
      }
    }

    disconnect(userInitiated = true) {
      this.streaming = false;
      this.connected = false;
      try {
        this.ws?.close();
      } catch { /* ignore */ }
      this.ws = null;
      this.captureNode?.disconnect();
      this.captureNode = null;
      this.captureCtx?.close();
      this.captureCtx = null;
      this.captureStream?.getTracks().forEach((t) => t.stop());
      this.captureStream = null;
      this.playNode?.disconnect();
      this.playNode = null;
      this.playCtx?.close();
      this.playCtx = null;
      if (userInitiated) this.hooks.onStatus?.('Call ended');
      this.hooks.onDisconnected?.();
    }
  }

  window.MeshVoiceLive = MeshVoiceLive;
})();
