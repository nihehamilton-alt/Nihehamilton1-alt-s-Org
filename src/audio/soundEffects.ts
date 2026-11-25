// MOTOR DE ÁUDIO WEB AUDIO API DO REI RUN — PADRÃO COMERCIAL iGAMING
// Ritmo Autêntico de Kuduro / Afro-House / Kizomba & Efeitos Urbanos de Luanda

class SoundEngine {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;
  public volume: number = 0.7; // 0.0 a 1.0
  private bgmInterval: number | null = null;
  private bgmStep: number = 0;
  public isBgmActive: boolean = false;
  public currentBpm: number = 126;

  private celebrationBus: GainNode | null = null;
  private celebrationCompressor: DynamicsCompressorNode | null = null;
  private stadiumReverb: ConvolverNode | null = null;
  private stadiumReverbSend: GainNode | null = null;
  private activeCelebrationNodes: AudioNode[] = [];
  private activeCelebrationSources: Array<{ stop: (when?: number) => void }> = [];
  private lastVictoryFanfareAt: number = 0;

  private initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {
        // Ignora bloqueio de autoplay antes do gesto do utilizador
      });
    }
  }

  public unlockAudio() {
    this.initContext();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {
        // Ignora bloqueio de autoplay
      });
    }
  }

  private getCelebrationOutputs(): {
    dryDest: AudioNode;
    wetDest: AudioNode;
  } | null {
    if (!this.ctx) return null;
    const ctx = this.ctx;

    if (!this.celebrationCompressor || !this.celebrationBus) {
      try {
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.setValueAtTime(-14, ctx.currentTime);
        comp.knee.setValueAtTime(14, ctx.currentTime);
        comp.ratio.setValueAtTime(4, ctx.currentTime);
        comp.attack.setValueAtTime(0.004, ctx.currentTime);
        comp.release.setValueAtTime(0.22, ctx.currentTime);

        const master = ctx.createGain();
        master.gain.setValueAtTime(1.0, ctx.currentTime);

        comp.connect(master);
        master.connect(ctx.destination);

        this.celebrationCompressor = comp;
        this.celebrationBus = master;
      } catch {
        return { dryDest: ctx.destination, wetDest: ctx.destination };
      }
    }

    if (!this.stadiumReverb && typeof ctx.createConvolver === 'function') {
      try {
        const length = Math.floor(ctx.sampleRate * 1.35);
        const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
          const data = impulse.getChannelData(ch);
          for (let i = 0; i < length; i++) {
            const t = i / length;
            // Reflexão inicial densa + decaimento de estádio aberto
            const env = Math.pow(1 - t, 2.4) * (i < ctx.sampleRate * 0.02 ? i / (ctx.sampleRate * 0.02) : 1);
            data[i] = (Math.random() * 2 - 1) * env;
          }
        }
        const convolver = ctx.createConvolver();
        convolver.buffer = impulse;

        const reverbFilter = ctx.createBiquadFilter();
        reverbFilter.type = 'lowpass';
        reverbFilter.frequency.setValueAtTime(3600, ctx.currentTime);

        const wetGain = ctx.createGain();
        wetGain.gain.setValueAtTime(0.26, ctx.currentTime);

        wetGain.connect(convolver);
        convolver.connect(reverbFilter);
        reverbFilter.connect(this.celebrationCompressor);

        this.stadiumReverb = convolver;
        this.stadiumReverbSend = wetGain;
      } catch {
        this.stadiumReverbSend = null;
      }
    }

    return {
      dryDest: this.celebrationCompressor,
      wetDest: this.stadiumReverbSend || this.celebrationCompressor,
    };
  }

  private trackCelebrationSource(src: { stop: (when?: number) => void }) {
    this.activeCelebrationSources.push(src);
  }

  private trackCelebrationNode(node: AudioNode) {
    this.activeCelebrationNodes.push(node);
  }

  public stopCelebrationAudio() {
    for (const src of this.activeCelebrationSources) {
      try {
        src.stop();
      } catch {
        // Já terminou
      }
    }
    this.activeCelebrationSources = [];

    for (const node of this.activeCelebrationNodes) {
      try {
        node.disconnect();
      } catch {
        // Já desconectado
      }
    }
    this.activeCelebrationNodes = [];
  }

  public setVolume(val: number) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.volume === 0) {
      this.enabled = false;
      this.stopRaceBgm();
      this.stopCelebrationAudio();
    } else {
      this.enabled = true;
    }
  }

  // Pulo do Rei Zero
  playJump() {
    if (!this.enabled || this.volume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.16);

    gain.gain.setValueAtTime(0.28 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.18);
  }

  // Deslize / Agachamento no asfalto com fricção
  playSlide() {
    if (!this.enabled || this.volume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.22);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, now);
    filter.frequency.exponentialRampToValueAtTime(120, now + 0.22);

    gain.gain.setValueAtTime(0.24 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.24);
  }

  // Troca rápida de faixa
  playLaneSwitch() {
    if (!this.enabled || this.volume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(500, now + 0.08);

    gain.gain.setValueAtTime(0.2 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  // Dash de alta velocidade
  playDash() {
    if (!this.enabled || this.volume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(160, now);
    osc1.frequency.exponentialRampToValueAtTime(850, now + 0.28);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(320, now);
    osc2.frequency.exponentialRampToValueAtTime(1600, now + 0.28);

    gain.gain.setValueAtTime(0.3 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.3);
    osc2.stop(now + 0.3);
  }

  // Som rítmico de passadas de sprint no asfalto (alternância pé esquerdo/direito + vento aerodinâmico)
  playSprintStep(intensity: number = 1, stepIndex: number = 0) {
    if (!this.enabled || this.volume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const isRightFoot = stepIndex % 2 === 1;
    const boost = Math.max(0.8, Math.min(1.6, intensity));
    const stepGain = Math.min(0.16, 0.085 * boost) * this.volume;

    // 1. Impacto seco da sapatilha no asfalto (ruído filtrado curto)
    try {
      const dur = 0.032;
      const bufferSize = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.28));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime((isRightFoot ? 920 : 780) * boost, now);
      filter.Q.setValueAtTime(1.4, now);

      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(stepGain, now);
      nGain.gain.exponentialRampToValueAtTime(0.0005, now + dur);

      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(this.ctx.destination);
      noise.start(now);
    } catch {
      // Ignora caso o buffer de áudio não esteja pronto
    }

    // 2. Pulso grave suave de passada atlética
    const thump = this.ctx.createOscillator();
    const tGain = this.ctx.createGain();
    thump.type = 'triangle';
    thump.frequency.setValueAtTime(isRightFoot ? 124 : 108, now);
    thump.frequency.exponentialRampToValueAtTime(46, now + 0.042);

    tGain.gain.setValueAtTime(stepGain * 0.85, now);
    tGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.045);

    thump.connect(tGain);
    tGain.connect(this.ctx.destination);
    thump.start(now);
    thump.stop(now + 0.046);
  }

  // Impulso aerodinâmico de sprint em aceleração (Dash / Kikuuba Nitro / Gasosa)
  playSprintBurst() {
    if (!this.enabled || this.volume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    try {
      const dur = 0.22;
      const bufferSize = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const env = Math.sin((i / bufferSize) * Math.PI);
        data[i] = (Math.random() * 2 - 1) * env;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(420, now);
      filter.frequency.exponentialRampToValueAtTime(2100, now + dur);
      filter.Q.setValueAtTime(1.1, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.22 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start(now);
    } catch {
      // Fallback silencioso
    }
  }

  // Kikuuba Nitro ativado!
  playNitro() {
    if (!this.enabled || this.volume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.38);

    gain.gain.setValueAtTime(0.32 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.4);
  }

  // Chapéu do Kudurista (Imunidade)
  playHatImmunity() {
    if (!this.enabled || this.volume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880, 1108.73];
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const st = now + idx * 0.05;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, st);
      gain.gain.setValueAtTime(0.22 * this.volume, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.22);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(st);
      osc.stop(st + 0.22);
    });
  }

  // Gasosa (Impulso rápido)
  playGasosa() {
    if (!this.enabled || this.volume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(380, now);
    osc.frequency.exponentialRampToValueAtTime(950, now + 0.18);

    gain.gain.setValueAtTime(0.26 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  // Buzina Tradicional de Candongueiro (Hiace "BEEP BEEP!")
  playCandongueiroHorn() {
    if (!this.enabled || this.volume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    [420, 510].forEach((freq) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.18 * this.volume, now);
      gain.gain.setValueAtTime(0.18 * this.volume, now + 0.09);
      gain.gain.setValueAtTime(0, now + 0.11);
      gain.gain.setValueAtTime(0.18 * this.volume, now + 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now);
      osc.stop(now + 0.26);
    });
  }

  // Apito de Trânsito do Polícia
  playPoliceWhistle() {
    if (!this.enabled || this.volume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(2600, now);
    osc.frequency.setValueAtTime(2850, now + 0.06);
    osc.frequency.setValueAtTime(2600, now + 0.12);

    gain.gain.setValueAtTime(0.22 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.22);
  }

  // Sirene de Entrada no Modo Rei Difícil (20s)
  playHardModeSiren() {
    if (!this.enabled || this.volume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.linearRampToValueAtTime(950, now + 0.25);
    osc.frequency.linearRampToValueAtTime(600, now + 0.5);

    gain.gain.setValueAtTime(0.24 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.55);
  }

  // Tropeço em obstáculo (Abrandamento de habilidade, sem morte)
  playStumble() {
    if (!this.enabled || this.volume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.28);

    gain.gain.setValueAtTime(0.3 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  // Coleta de moeda ou pontuação
  playCoin() {
    if (!this.enabled || this.volume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(987.77, now);
    osc.frequency.setValueAtTime(1318.51, now + 0.05);

    gain.gain.setValueAtTime(0.22 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  // Celebração de Coroação no Trono Real (Kizomba Fanfarra + Aplausos)
  playCoronationFanfare() {
    if (!this.enabled || this.volume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const chords = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98];
    chords.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const st = now + idx * 0.08;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, st);
      gain.gain.setValueAtTime(0.28 * this.volume, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.5);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(st);
      osc.stop(st + 0.5);
    });
  }

  // Explosão Imediata de Confetes e Fanfarra Triunfal ao abrir o Pódio
  playVictoryExplosion() {
    if (!this.enabled || this.volume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // 1. Som de "POP" e "BOOM" de canhão de confetes (Disparo pirotécnico sintético)
    try {
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.16);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.03));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1600, now);
      filter.frequency.exponentialRampToValueAtTime(140, now + 0.16);
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.36 * this.volume, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
      noise.start(now);
    } catch {
      // Fallback gracioso se buffer não for suportado
    }

    // 2. Acorde triunfal cintilante de vitória (Harmonia de Luanda)
    const chords = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98];
    chords.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      const st = now + idx * 0.045;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, st);
      gain.gain.setValueAtTime(0.32 * this.volume, st);
      gain.gain.exponentialRampToValueAtTime(0.001, st + 0.55);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(st);
      osc.stop(st + 0.55);
    });
  }

  // Multidão de estádio a vibrar e aplaudir em estéreo (Cheering Crowd procedural de alta fidelidade)
  playCheeringCrowd(durationSec: number = 4.2, startOffsetSec: number = 0) {
    if (!this.enabled || this.volume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const ctx = this.ctx;
    const outputs = this.getCelebrationOutputs();
    if (!outputs) return;

    const startTime = ctx.currentTime + startOffsetSec;
    const vol = this.volume;

    // 1. Leito estéreo de clamor do estádio com formantes modulados por LFO
    try {
      const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * durationSec));
      const crowdBuffer = ctx.createBuffer(2, sampleCount, ctx.sampleRate);

      for (let ch = 0; ch < 2; ch++) {
        const data = crowdBuffer.getChannelData(ch);
        // Ruído rosa aproximado (Paul Kellet) para densidade orgânica de centenas de vozes
        let b0 = 0;
        let b1 = 0;
        let b2 = 0;
        let b3 = 0;
        let b4 = 0;
        let b5 = 0;
        let b6 = 0;
        for (let i = 0; i < sampleCount; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
          b6 = white * 0.115926;
          data[i] = Math.max(-1, Math.min(1, pink));
        }
      }

      const crowdSrc = ctx.createBufferSource();
      crowdSrc.buffer = crowdBuffer;

      // Formante grave/médio do rugido da arquibancada (520Hz -> 780Hz)
      const roarFormant = ctx.createBiquadFilter();
      roarFormant.type = 'bandpass';
      roarFormant.frequency.setValueAtTime(480, startTime);
      roarFormant.frequency.linearRampToValueAtTime(780, startTime + 0.65);
      roarFormant.frequency.linearRampToValueAtTime(610, startTime + durationSec);
      roarFormant.Q.setValueAtTime(0.95, startTime);

      // Formante brilhante de euforia / vivas (1550Hz -> 2350Hz)
      const cheerFormant = ctx.createBiquadFilter();
      cheerFormant.type = 'bandpass';
      cheerFormant.frequency.setValueAtTime(1450, startTime);
      cheerFormant.frequency.linearRampToValueAtTime(2350, startTime + 0.55);
      cheerFormant.frequency.linearRampToValueAtTime(1650, startTime + durationSec);
      cheerFormant.Q.setValueAtTime(1.1, startTime);

      // LFO orgânico para "respiração" e ondas de vibração da torcida
      const lfo = ctx.createOscillator();
      const lfoDepth = ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.65, startTime);
      lfoDepth.gain.setValueAtTime(190, startTime);
      lfo.connect(lfoDepth);
      lfoDepth.connect(roarFormant.frequency);
      lfoDepth.connect(cheerFormant.frequency);

      const roarGain = ctx.createGain();
      roarGain.gain.setValueAtTime(0.001, startTime);
      roarGain.gain.linearRampToValueAtTime(0.28 * vol, startTime + 0.16);
      roarGain.gain.linearRampToValueAtTime(0.36 * vol, startTime + 0.68);
      roarGain.gain.setValueAtTime(0.32 * vol, startTime + 1.9);
      roarGain.gain.exponentialRampToValueAtTime(0.001, startTime + durationSec);

      const cheerGain = ctx.createGain();
      cheerGain.gain.setValueAtTime(0.001, startTime);
      cheerGain.gain.linearRampToValueAtTime(0.24 * vol, startTime + 0.2);
      cheerGain.gain.linearRampToValueAtTime(0.32 * vol, startTime + 0.72);
      cheerGain.gain.setValueAtTime(0.25 * vol, startTime + 1.85);
      cheerGain.gain.exponentialRampToValueAtTime(0.001, startTime + durationSec);

      crowdSrc.connect(roarFormant);
      roarFormant.connect(roarGain);
      roarGain.connect(outputs.dryDest);
      roarGain.connect(outputs.wetDest);

      crowdSrc.connect(cheerFormant);
      cheerFormant.connect(cheerGain);
      cheerGain.connect(outputs.dryDest);
      cheerGain.connect(outputs.wetDest);

      crowdSrc.start(startTime);
      crowdSrc.stop(startTime + durationSec);
      lfo.start(startTime);
      lfo.stop(startTime + durationSec);

      this.trackCelebrationSource(crowdSrc);
      this.trackCelebrationSource(lfo);
      this.trackCelebrationNode(roarGain);
      this.trackCelebrationNode(cheerGain);
    } catch {
      // Fallback gracioso se áudio espacial falhar
    }

    // 2. Rajadas individuais de palmas e apupos distribuídas em estéreo
    try {
      const clapCount = 30;
      const clapDur = 0.032;
      const clapLen = Math.max(1, Math.floor(ctx.sampleRate * clapDur));
      const clapBuf = ctx.createBuffer(1, clapLen, ctx.sampleRate);
      const clapData = clapBuf.getChannelData(0);
      for (let i = 0; i < clapLen; i++) {
        // Duplo transiente rápido típico de palma humana
        const tap1 = Math.exp(-i / (ctx.sampleRate * 0.0045));
        const tap2 = i > ctx.sampleRate * 0.008 ? 0.55 * Math.exp(-(i - ctx.sampleRate * 0.008) / (ctx.sampleRate * 0.006)) : 0;
        clapData[i] = (Math.random() * 2 - 1) * (tap1 + tap2);
      }

      for (let c = 0; c < clapCount; c++) {
        // Maior densidade nos primeiros 1.8s, diminuindo naturalmente até 3.2s
        const progress = c / clapCount;
        const clapOffset = 0.05 + Math.pow(progress, 1.18) * (durationSec * 0.78) + (Math.random() * 0.09);
        const clapStart = startTime + clapOffset;
        if (clapStart >= startTime + durationSec - 0.1) continue;

        const src = ctx.createBufferSource();
        src.buffer = clapBuf;

        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(1050 + ((c * 293) % 1500), clapStart);
        bp.Q.setValueAtTime(1.8 + (c % 3) * 0.45, clapStart);

        const cGain = ctx.createGain();
        const peak = (0.09 + (1 - progress * 0.55) * 0.08) * vol;
        cGain.gain.setValueAtTime(peak, clapStart);
        cGain.gain.exponentialRampToValueAtTime(0.0008, clapStart + clapDur);

        src.connect(bp);
        bp.connect(cGain);

        if (typeof ctx.createStereoPanner === 'function') {
          const pan = ctx.createStereoPanner();
          pan.pan.setValueAtTime(((c % 9) / 4 - 1) * 0.82, clapStart);
          cGain.connect(pan);
          pan.connect(outputs.dryDest);
          pan.connect(outputs.wetDest);
        } else {
          cGain.connect(outputs.dryDest);
        }

        src.start(clapStart);
        src.stop(clapStart + clapDur);
        this.trackCelebrationSource(src);
      }
    } catch {
      // Fallback silencioso
    }

    // 3. Coro vocal harmónico de estádio ("Wooo! / Campeão!") com filtros formantes vocálicos
    try {
      const vocalChord = [
        { base: 261.63, target: 277.18, f1: 580, f2: 1120, gain: 0.055 }, // C4 leve subida de euforia
        { base: 392.00, target: 392.00, f1: 640, f2: 1240, gain: 0.05 },  // G4
        { base: 523.25, target: 538.00, f1: 720, f2: 1380, gain: 0.045 }, // C5
        { base: 659.25, target: 659.25, f1: 780, f2: 1520, gain: 0.035 }, // E5
      ];

      vocalChord.forEach((v, idx) => {
        const osc = ctx.createOscillator();
        osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(v.base, startTime + 0.12);
        osc.frequency.linearRampToValueAtTime(v.target, startTime + 0.95);
        osc.frequency.linearRampToValueAtTime(v.base, startTime + 2.4);

        const vowel1 = ctx.createBiquadFilter();
        vowel1.type = 'bandpass';
        vowel1.frequency.setValueAtTime(v.f1, startTime);
        vowel1.Q.setValueAtTime(3.2, startTime);

        const vowel2 = ctx.createBiquadFilter();
        vowel2.type = 'bandpass';
        vowel2.frequency.setValueAtTime(v.f2, startTime);
        vowel2.Q.setValueAtTime(3.6, startTime);

        const vGain = ctx.createGain();
        vGain.gain.setValueAtTime(0.0005, startTime);
        vGain.gain.linearRampToValueAtTime(v.gain * vol, startTime + 0.42);
        vGain.gain.setValueAtTime(v.gain * 0.9 * vol, startTime + 1.35);
        vGain.gain.exponentialRampToValueAtTime(0.0005, startTime + Math.min(durationSec - 0.1, 3.1));

        osc.connect(vowel1);
        osc.connect(vowel2);
        vowel1.connect(vGain);
        vowel2.connect(vGain);
        vGain.connect(outputs.wetDest);
        vGain.connect(outputs.dryDest);

        osc.start(startTime + 0.08);
        osc.stop(startTime + Math.min(durationSec, 3.15));
        this.trackCelebrationSource(osc);
        this.trackCelebrationNode(vGain);
      });
    } catch {
      // Fallback silencioso
    }
  }

  // Fanfarra Real de Metais & Percussão Sinfónica de Estádio (Victory Fanfare)
  playVictoryFanfare(startOffsetSec: number = 0) {
    if (!this.enabled || this.volume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    if (startOffsetSec === 0) {
      this.stopCelebrationAudio();
    }
    this.lastVictoryFanfareAt = Date.now();

    const ctx = this.ctx;
    const outputs = this.getCelebrationOutputs();
    if (!outputs) return;

    const baseTime = ctx.currentTime + startOffsetSec;
    const vol = this.volume;

    // Helper para sintetizar nota de naipe de metais (trompetes + trompas em estéreo)
    const scheduleBrassNote = (
      freq: number,
      offset: number,
      dur: number,
      level: number,
      panVal: number = 0,
      vibrato: boolean = false
    ) => {
      const t0 = baseTime + offset;
      const oscA = ctx.createOscillator();
      const oscB = ctx.createOscillator();
      const oscSub = ctx.createOscillator();

      oscA.type = 'sawtooth';
      oscB.type = 'sawtooth';
      oscSub.type = 'triangle';

      oscA.frequency.setValueAtTime(freq, t0);
      oscB.frequency.setValueAtTime(freq, t0);
      oscA.detune.setValueAtTime(-7, t0);
      oscB.detune.setValueAtTime(7, t0);
      oscSub.frequency.setValueAtTime(freq * 0.5, t0);

      // Filtro dinâmico de sopro metálico (ataque brilhante que estabiliza com calor)
      const hornFilter = ctx.createBiquadFilter();
      hornFilter.type = 'lowpass';
      hornFilter.Q.setValueAtTime(1.4, t0);
      hornFilter.frequency.setValueAtTime(Math.min(4800, freq * 2.2), t0);
      hornFilter.frequency.exponentialRampToValueAtTime(Math.min(6200, freq * 5.2), t0 + 0.045);
      hornFilter.frequency.exponentialRampToValueAtTime(Math.min(3400, freq * 3.1), t0 + dur);

      const env = ctx.createGain();
      const peak = level * vol;
      env.gain.setValueAtTime(0.0005, t0);
      env.gain.linearRampToValueAtTime(peak, t0 + 0.025);
      env.gain.setValueAtTime(peak * 0.84, t0 + Math.max(0.05, dur * 0.62));
      env.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);

      if (vibrato && dur > 0.45) {
        const vib = ctx.createOscillator();
        const vibDepth = ctx.createGain();
        vib.type = 'sine';
        vib.frequency.setValueAtTime(5.4, t0 + 0.18);
        vibDepth.gain.setValueAtTime(0, t0);
        vibDepth.gain.linearRampToValueAtTime(8, t0 + 0.35);
        vib.connect(vibDepth);
        vibDepth.connect(oscA.detune);
        vibDepth.connect(oscB.detune);
        vib.start(t0 + 0.16);
        vib.stop(t0 + dur);
        this.trackCelebrationSource(vib);
      }

      oscA.connect(hornFilter);
      oscB.connect(hornFilter);
      oscSub.connect(hornFilter);
      hornFilter.connect(env);

      if (typeof ctx.createStereoPanner === 'function') {
        const pan = ctx.createStereoPanner();
        pan.pan.setValueAtTime(panVal, t0);
        env.connect(pan);
        pan.connect(outputs.dryDest);
        pan.connect(outputs.wetDest);
      } else {
        env.connect(outputs.dryDest);
        env.connect(outputs.wetDest);
      }

      oscA.start(t0);
      oscB.start(t0);
      oscSub.start(t0);
      oscA.stop(t0 + dur + 0.02);
      oscB.stop(t0 + dur + 0.02);
      oscSub.stop(t0 + dur + 0.02);

      this.trackCelebrationSource(oscA);
      this.trackCelebrationSource(oscB);
      this.trackCelebrationSource(oscSub);
      this.trackCelebrationNode(env);
    };

    // Helper para tímpano sinfónico
    const scheduleTimpaniHit = (freq: number, offset: number, level: number) => {
      const t0 = baseTime + offset;
      const osc = ctx.createOscillator();
      const body = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * 1.35, t0);
      osc.frequency.exponentialRampToValueAtTime(freq, t0 + 0.09);

      body.type = 'triangle';
      body.frequency.setValueAtTime(freq * 1.5, t0);
      body.frequency.exponentialRampToValueAtTime(freq, t0 + 0.12);

      gain.gain.setValueAtTime(level * vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.48);

      osc.connect(gain);
      body.connect(gain);
      gain.connect(outputs.dryDest);
      gain.connect(outputs.wetDest);

      osc.start(t0);
      body.start(t0);
      osc.stop(t0 + 0.5);
      body.stop(t0 + 0.5);

      this.trackCelebrationSource(osc);
      this.trackCelebrationSource(body);
      this.trackCelebrationNode(gain);
    };

    // Helper para prato crash cintilante de clímax
    const scheduleCrashCymbal = (offset: number, dur: number, level: number) => {
      try {
        const t0 = baseTime + offset;
        const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
        const buf = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
          const d = buf.getChannelData(ch);
          for (let i = 0; i < len; i++) {
            d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * (dur * 0.34)));
          }
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;

        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.setValueAtTime(4600, t0);

        const cGain = ctx.createGain();
        cGain.gain.setValueAtTime(level * vol, t0);
        cGain.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);

        src.connect(hp);
        hp.connect(cGain);
        cGain.connect(outputs.dryDest);
        cGain.connect(outputs.wetDest);

        src.start(t0);
        src.stop(t0 + dur);
        this.trackCelebrationSource(src);
        this.trackCelebrationNode(cGain);
      } catch {
        // Ignora caso não suportado
      }
    };

    // Frase heróica de chamada em Dó Maior triunfal:
    // G4 -> C5 -> E5 -> G5 (pickup rápido e marcante) -> acorde majestoso C5 + E5 + G5 + C6
    scheduleTimpaniHit(98.0, 0.0, 0.34);     // G2 downbeat
    scheduleCrashCymbal(0.0, 0.9, 0.14);
    scheduleBrassNote(392.00, 0.00, 0.15, 0.18, -0.25); // G4
    scheduleBrassNote(523.25, 0.13, 0.15, 0.19, 0.2);   // C5
    scheduleBrassNote(659.25, 0.26, 0.16, 0.21, -0.15); // E5
    scheduleTimpaniHit(130.81, 0.40, 0.26);             // C3 pré-clímax
    scheduleBrassNote(783.99, 0.40, 0.23, 0.23, 0.15);  // G5

    // Clímax Real (0.64s): Acorde completo de fanfarra + tímpano + prato crash + sinos dourados
    scheduleTimpaniHit(130.81, 0.64, 0.42);
    scheduleCrashCymbal(0.64, 1.55, 0.22);
    scheduleBrassNote(261.63, 0.64, 1.85, 0.18, -0.35, true); // C4 base
    scheduleBrassNote(523.25, 0.64, 1.85, 0.21, -0.22, true); // C5
    scheduleBrassNote(659.25, 0.64, 1.85, 0.19, 0.22, true);  // E5
    scheduleBrassNote(783.99, 0.64, 1.85, 0.20, 0.35, true);  // G5
    scheduleBrassNote(1046.5, 0.64, 1.95, 0.16, 0.0, true);   // C6 coroação

    // Sinos cintilantes de campeonato por cima do acorde final
    const bellNotes = [1046.5, 1318.51, 1567.98, 2093.0];
    bellNotes.forEach((freq, idx) => {
      const tBell = baseTime + 0.66 + idx * 0.085;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, tBell);

      gain.gain.setValueAtTime(0.11 * vol, tBell);
      gain.gain.exponentialRampToValueAtTime(0.0006, tBell + 0.85);

      osc.connect(gain);
      gain.connect(outputs.dryDest);
      gain.connect(outputs.wetDest);

      osc.start(tBell);
      osc.stop(tBell + 0.88);
      this.trackCelebrationSource(osc);
      this.trackCelebrationNode(gain);
    });
  }

  public wasVictoryFanfareTriggeredRecently(windowMs: number = 1500): boolean {
    return this.lastVictoryFanfareAt > 0 && Date.now() - this.lastVictoryFanfareAt <= windowMs;
  }

  // Sequência completa exclusiva do 1.º Lugar ao abrir o Pódio:
  // Disparo pirotécnico + Fanfarra Real de Metais + Multidão em Delírio no Estádio
  playFirstPlaceVictoryCelebration() {
    if (!this.enabled || this.volume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    this.stopCelebrationAudio();

    // Explosão imediata de confetes no frame de entrada
    try {
      const now = this.ctx.currentTime;
      const outputs = this.getCelebrationOutputs();
      const dest = outputs ? outputs.dryDest : this.ctx.destination;
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.18);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.032));
      }
      const pop = this.ctx.createBufferSource();
      pop.buffer = buffer;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1800, now);
      lp.frequency.exponentialRampToValueAtTime(150, now + 0.18);
      const pGain = this.ctx.createGain();
      pGain.gain.setValueAtTime(0.32 * this.volume, now);
      pGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      pop.connect(lp);
      lp.connect(pGain);
      pGain.connect(dest);
      pop.start(now);
      this.trackCelebrationSource(pop);
    } catch {
      // Fallback silencioso
    }

    // Fanfarra triunfal + vibração imediata da multidão sincronizadas no relógio de áudio
    this.playVictoryFanfare(0.02);
    this.playCheeringCrowd(4.4, 0.06);
  }

  // Efeito sonoro comemorativo oficial acionado quando o pódio é exibido (showPodium === true)
  playCelebratorySound(isFirstPlace: boolean = true) {
    if (!this.enabled || this.volume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    if (isFirstPlace) {
      this.playFirstPlaceVictoryCelebration();
    } else {
      this.playVictoryExplosion();
    }
  }

  // Efeito sonoro comemorativo imediato ao cruzar a meta no Top 3 (1.º, 2.º ou 3.º lugar)
  playTopThreeCelebration(rank: number = 3) {
    if (rank < 1 || rank > 3) return;
    if (!this.enabled || this.volume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const vol = this.volume;

    // Progressão harmónica distinta por posição no pódio (1.º Ouro, 2.º Prata, 3.º Bronze)
    const notesByRank: Record<number, number[]> = {
      1: [523.25, 659.25, 783.99, 1046.5, 1318.51], // Dó Maior Real até Mi6
      2: [440.0, 554.37, 659.25, 880.0],            // Lá Maior Prata
      3: [392.0, 493.88, 587.33, 783.99],           // Sol Maior Bronze
    };

    const notes = notesByRank[rank] || notesByRank[3];
    const stepSec = rank === 1 ? 0.055 : 0.065;

    notes.forEach((freq, idx) => {
      const t0 = now + idx * stepSec;
      const osc = ctx.createOscillator();
      const harmonic = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t0);

      harmonic.type = 'sine';
      harmonic.frequency.setValueAtTime(freq * 2, t0);

      const peak = (idx === notes.length - 1 ? 0.28 : 0.2) * vol;
      const dur = idx === notes.length - 1 ? 0.45 : 0.24;

      gain.gain.setValueAtTime(0.0005, t0);
      gain.gain.linearRampToValueAtTime(peak, t0 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);

      osc.connect(gain);
      harmonic.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t0);
      harmonic.start(t0);
      osc.stop(t0 + dur + 0.02);
      harmonic.stop(t0 + dur + 0.02);
    });
  }

  // Contagem regressiva (3, 2, 1, CORRE REI!)
  playCountdownTick() {
    if (!this.enabled || this.volume <= 0) return;
    this.initContext();
    if (!this.ctx) return;
    const ctx = this.ctx;

    const triggerTick = () => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(460, now);
      gain.gain.setValueAtTime(0.24 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(triggerTick).catch(() => {});
    } else {
      triggerTick();
    }
  }

  playCountdownGo() {
    if (!this.enabled || this.volume <= 0) return;
    this.initContext();
    if (!this.ctx) return;
    const ctx = this.ctx;

    const triggerGo = () => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.22);

      gain.gain.setValueAtTime(0.35 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.26);
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(triggerGo).catch(() => {});
    } else {
      triggerGo();
    }
  }

  // Sintonizador dinâmico de BPM (126 BPM fácil -> 138 BPM modo difícil)
  public setRaceSpeed(isHardMode: boolean) {
    const targetBpm = isHardMode ? 138 : 126;
    if (this.currentBpm !== targetBpm) {
      this.currentBpm = targetBpm;
      if (this.isBgmActive) {
        this.restartBgmWithCurrentBpm();
      }
    }
  }

  private restartBgmWithCurrentBpm() {
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
    const stepDurationMs = (60 / this.currentBpm / 4) * 1000;
    this.bgmInterval = window.setInterval(() => this.bgmTick(), stepDurationMs);
  }

  private bgmTick() {
    if (!this.isBgmActive || !this.enabled || !this.ctx || this.volume <= 0) return;
    const now = this.ctx.currentTime;
    const step = this.bgmStep % 16;

    // Escala africana menor pentatônica (A minor / D dorian Luanda groove)
    const bassline = [110, 110, 130.81, 110, 146.83, 110, 164.81, 130.81];
    const marimbaNotes = [440, 523.25, 587.33, 659.25, 587.33, 523.25, 440, 392.0];

    // 1. Kick Drum Kuduro sincopado (0, 4, 6, 8, 12, 14)
    if (step === 0 || step === 4 || step === 8 || step === 12 || step === 6 || step === 14) {
      const kickOsc = this.ctx.createOscillator();
      const kickGain = this.ctx.createGain();
      kickOsc.type = 'sine';
      kickOsc.frequency.setValueAtTime(155, now);
      kickOsc.frequency.exponentialRampToValueAtTime(38, now + 0.08);

      kickGain.gain.setValueAtTime(0.28 * this.volume, now);
      kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      kickOsc.connect(kickGain);
      kickGain.connect(this.ctx.destination);
      kickOsc.start(now);
      kickOsc.stop(now + 0.09);
    }

    // 2. Caixa / Palmas sincopadas (beats 4 e 12)
    if (step === 4 || step === 12) {
      const snareOsc = this.ctx.createOscillator();
      const snareGain = this.ctx.createGain();
      snareOsc.type = 'triangle';
      snareOsc.frequency.setValueAtTime(240, now);

      snareGain.gain.setValueAtTime(0.16 * this.volume, now);
      snareGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      snareOsc.connect(snareGain);
      snareGain.connect(this.ctx.destination);
      snareOsc.start(now);
      snareOsc.stop(now + 0.08);
    }

    // 3. Shaker / Chimbau africano em semicolcheias
    if (step % 2 === 1) {
      const hatOsc = this.ctx.createOscillator();
      const hatGain = this.ctx.createGain();
      hatOsc.type = 'square';
      hatOsc.frequency.setValueAtTime(6500, now);

      hatGain.gain.setValueAtTime(0.03 * this.volume, now);
      hatGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

      hatOsc.connect(hatGain);
      hatGain.connect(this.ctx.destination);
      hatOsc.start(now);
      hatOsc.stop(now + 0.03);
    }

    // 4. Baixo Afro-House rítmico (Groove)
    if (step % 2 === 0) {
      const bassNote = bassline[(step / 2) % bassline.length];
      const bassOsc = this.ctx.createOscillator();
      const bassGain = this.ctx.createGain();
      bassOsc.type = 'sawtooth';
      bassOsc.frequency.setValueAtTime(bassNote, now);

      bassGain.gain.setValueAtTime(0.1 * this.volume, now);
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      bassOsc.connect(bassGain);
      bassGain.connect(this.ctx.destination);
      bassOsc.start(now);
      bassOsc.stop(now + 0.12);
    }

    // 5. Marimba / Sintetizador melódico Kuduro
    if (step % 2 === 1) {
      const leadFreq = marimbaNotes[(step + Math.floor(this.bgmStep / 16)) % marimbaNotes.length];
      const leadOsc = this.ctx.createOscillator();
      const leadGain = this.ctx.createGain();
      leadOsc.type = 'sine';
      leadOsc.frequency.setValueAtTime(leadFreq, now);

      leadGain.gain.setValueAtTime(0.08 * this.volume, now);
      leadGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      leadOsc.connect(leadGain);
      leadGain.connect(this.ctx.destination);
      leadOsc.start(now);
      leadOsc.stop(now + 0.1);
    }

    this.bgmStep++;
  }

  // Inicia a música de fundo
  playRaceBgm() {
    if (!this.enabled || this.isBgmActive || this.volume <= 0) return;
    this.initContext();
    if (!this.ctx) return;

    this.isBgmActive = true;
    this.bgmStep = 0;
    this.currentBpm = 126;

    const stepDurationMs = (60 / this.currentBpm / 4) * 1000;
    this.bgmInterval = window.setInterval(() => this.bgmTick(), stepDurationMs);
  }

  stopRaceBgm() {
    this.isBgmActive = false;
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
  }
}

export const sounds = new SoundEngine();
