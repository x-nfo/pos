/**
 * Web Audio API & Audio Asset for POS cash register "Ka-Ching" sound
 * Zero-dependency, offline-ready, and lightweight sound effects.
 */

const STORAGE_KEY = "pos_sound_enabled";

let sharedAudioCtx = null;

export function getOrCreateAudioContext() {
    if (typeof window === "undefined") return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;

    if (!sharedAudioCtx) {
        sharedAudioCtx = new AudioCtx();
    }
    return sharedAudioCtx;
}

// Auto-unlock AudioContext on first user interaction anywhere on the page
if (typeof window !== "undefined") {
    const unlockAudio = () => {
        const ctx = getOrCreateAudioContext();
        if (ctx && ctx.state === "suspended") {
            ctx.resume().catch(() => {});
        }
    };

    window.addEventListener("pointerdown", unlockAudio, { capture: true, passive: true });
    window.addEventListener("keydown", unlockAudio, { capture: true, passive: true });
    window.addEventListener("touchstart", unlockAudio, { capture: true, passive: true });
}

export function isSoundEnabled() {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) !== "false";
}

export function setSoundEnabled(enabled) {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
}

export function toggleSoundEnabled() {
    const next = !isSoundEnabled();
    setSoundEnabled(next);
    return next;
}

/**
 * Synthesizes the iconic mechanical cash register "Ka-Ching!" sound:
 * 1. "KA-" : Mechanical drawer latch snap & spring release
 * 2. "-CHING!" : Resonant brass register bell ring with harmonics
 * 3. Coin jingle pings (coins settling in drawer till)
 */
export function playSynthesizedKaChing() {
    try {
        const ctx = getOrCreateAudioContext();
        if (!ctx) return;

        if (ctx.state === "suspended") {
            ctx.resume().catch(() => {});
        }

        const now = ctx.currentTime;

        // 1. "KA-" : Mechanical drawer latch snap & spring release (0 - 60ms)
        const clickOsc = ctx.createOscillator();
        const clickGain = ctx.createGain();
        clickOsc.type = "triangle";
        clickOsc.frequency.setValueAtTime(450, now);
        clickOsc.frequency.exponentialRampToValueAtTime(90, now + 0.05);

        clickGain.gain.setValueAtTime(0.35, now);
        clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

        clickOsc.connect(clickGain);
        clickGain.connect(ctx.destination);
        clickOsc.start(now);
        clickOsc.stop(now + 0.05);

        // Snap noise burst
        const noiseBufferSize = Math.floor(ctx.sampleRate * 0.04);
        const noiseBuffer = ctx.createBuffer(1, noiseBufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseBufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer;

        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = "bandpass";
        noiseFilter.frequency.setValueAtTime(1400, now);
        noiseFilter.Q.setValueAtTime(2.5, now);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.25, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(ctx.destination);
        noise.start(now);
        noise.stop(now + 0.04);

        // 2. "-CHING!" : Resonant brass register bell ring (starts at 55ms, rings for ~1s)
        const bellStart = now + 0.055;
        const bellDuration = 0.95;

        // Iconic cash register bell frequencies (fundamental B6 ~1975Hz + overtones)
        const bellFreqs = [1975.5, 2637.0, 3951.0, 5274.0];
        const bellGains = [0.22, 0.15, 0.10, 0.05];

        bellFreqs.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, bellStart);
            osc.frequency.exponentialRampToValueAtTime(freq * 0.996, bellStart + bellDuration);

            const initGain = bellGains[idx];
            gain.gain.setValueAtTime(initGain, bellStart);
            gain.gain.exponentialRampToValueAtTime(0.0001, bellStart + bellDuration);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(bellStart);
            osc.stop(bellStart + bellDuration);
        });

        // 3. Metallic coin clatter / drawer roll
        const coins = [
            { time: 0.08, freq: 3136, amp: 0.08 },
            { time: 0.13, freq: 3520, amp: 0.07 },
            { time: 0.18, freq: 2793, amp: 0.06 },
            { time: 0.23, freq: 3951, amp: 0.05 },
        ];

        coins.forEach((c) => {
            const coinTime = now + c.time;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sine";
            osc.frequency.setValueAtTime(c.freq, coinTime);

            gain.gain.setValueAtTime(c.amp, coinTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, coinTime + 0.08);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(coinTime);
            osc.stop(coinTime + 0.08);
        });
    } catch (e) {
        // Silently catch autoplay restriction or unsupported context
    }
}

/**
 * Plays the iconic cashier "Ka-Ching" sound.
 * Tries cashier-quotka-chingquot-sound-effect.mp3 first, then cash-register.wav, with Web Audio API synthesis fallback.
 */
export function playSuccessChime() {
    if (!isSoundEnabled()) return;
    if (typeof window === "undefined") return;

    try {
        const audio = new Audio(
            "/sounds/cashier-quotka-chingquot-sound-effect.mp3"
        );
        audio.volume = 0.65;

        const fallback = () => {
            try {
                const fallbackAudio = new Audio("/sounds/cash-register.wav");
                fallbackAudio.volume = 0.65;
                fallbackAudio.play().catch(() => {
                    playSynthesizedKaChing();
                });
            } catch {
                playSynthesizedKaChing();
            }
        };

        audio.onerror = fallback;

        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(() => {
                fallback();
            });
        }
    } catch (e) {
        playSynthesizedKaChing();
    }
}

/**
 * Synthesizes a clean, pleasant two-tone chime for incoming online orders.
 */
export function playOrderAlertChime() {
    if (!isSoundEnabled()) return;
    if (typeof window === "undefined") return;

    try {
        const ctx = getOrCreateAudioContext();
        if (!ctx) return;

        if (ctx.state === "suspended") {
            ctx.resume().catch(() => {});
        }

        const now = ctx.currentTime;
        const notes = [
            { time: 0, freq: 880, dur: 0.35, gain: 0.22 },
            { time: 0.15, freq: 1174.66, dur: 0.65, gain: 0.28 },
        ];

        notes.forEach(({ time, freq, dur, gain: noteGain }) => {
            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();

            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, now + time);

            gainNode.gain.setValueAtTime(noteGain, now + time);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);

            osc.connect(gainNode);
            gainNode.connect(ctx.destination);

            osc.start(now + time);
            osc.stop(now + time + dur);
        });
    } catch {
        // Silently catch autoplay restrictions
    }
}

