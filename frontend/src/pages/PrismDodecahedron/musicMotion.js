export const MUSIC_DANCE_MODES = [
  {
    id: "groove",
    label: "Groove",
    description: "Looser sway with restrained breakup on the beat.",
    settings: {
      musicMix: 0.9,
      musicPulse: 0.94,
      musicMotion: 0.78,
      musicShimmer: 0.72,
      musicBreakup: 0.44,
    },
  },
  {
    id: "dance",
    label: "Dance",
    description: "Sharper hits with stronger breakup accents and snap.",
    settings: {
      musicMix: 1,
      musicPulse: 1.12,
      musicMotion: 1.02,
      musicShimmer: 0.88,
      musicBreakup: 1.04,
    },
  },
];

export const DEFAULT_MUSIC_SETTINGS = {
  ...MUSIC_DANCE_MODES[0].settings,
};

export const MUSIC_CONTROLS = [
  { id: "musicMix", label: "Music Mix", min: 0, max: 1.6, step: 0.01 },
  { id: "musicPulse", label: "Beat Pulse", min: 0, max: 1.8, step: 0.01 },
  {
    id: "musicMotion",
    label: "Motion Flow",
    min: 0,
    max: 1.8,
    step: 0.01,
  },
  {
    id: "musicShimmer",
    label: "Shimmer",
    min: 0,
    max: 1.8,
    step: 0.01,
  },
  {
    id: "musicBreakup",
    label: "Breakup Drive",
    min: 0,
    max: 1.6,
    step: 0.01,
  },
];

export const CUSTOM_MUSIC_DANCE_MODE_ID = "custom";

export function getMusicDanceMode(settings) {
  const matchedPreset = MUSIC_DANCE_MODES.find((mode) =>
    Object.entries(mode.settings).every(
      ([key, value]) => Math.abs((settings[key] ?? 0) - value) < 0.02
    )
  );

  return matchedPreset?.id ?? CUSTOM_MUSIC_DANCE_MODE_ID;
}

export const EMPTY_AUDIO_REACTIVITY = Object.freeze({
  active: 0,
  playing: 0,
  level: 0,
  bass: 0,
  mids: 0,
  treble: 0,
  transient: 0,
  pulse: 0,
  progress: 0,
  currentTime: 0,
  duration: 0,
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function averageBand(data, startIndex, endIndex) {
  const upperBound = Math.min(data.length, Math.max(endIndex, startIndex + 1));
  let total = 0;

  for (let index = startIndex; index < upperBound; index += 1) {
    total += data[index];
  }

  return total / (upperBound - startIndex || 1) / 255;
}

function getFrequencyRangeIndices(analyser, audioContext, minHz, maxHz) {
  const binCount = analyser.frequencyBinCount;
  const nyquist = audioContext.sampleRate / 2;
  const startIndex = clamp(
    Math.floor((minHz / nyquist) * binCount),
    0,
    binCount
  );
  const endIndex = clamp(Math.ceil((maxHz / nyquist) * binCount), 0, binCount);

  return [startIndex, Math.max(endIndex, startIndex + 1)];
}

function normalizePeak(state, key, value, floor = 0.08) {
  const peakKey = `${key}Peak`;
  state[peakKey] = Math.max(value, (state[peakKey] ?? floor) * 0.992, floor);
  return clamp(value / Math.max(state[peakKey], floor), 0, 1.6);
}

function smooth(state, key, value, mix) {
  state[key] += (value - state[key]) * mix;
  return state[key];
}

function computeRms(timeDomainData) {
  let total = 0;

  for (let index = 0; index < timeDomainData.length; index += 1) {
    const sample = (timeDomainData[index] - 128) / 128;
    total += sample * sample;
  }

  return Math.sqrt(total / timeDomainData.length);
}

function createProcessingState(binCount) {
  return {
    bass: 0,
    mids: 0,
    treble: 0,
    level: 0,
    transient: 0,
    pulse: 0,
    prevLevel: 0,
    prevSpectrum: new Float32Array(binCount),
    bassPeak: 0.14,
    midsPeak: 0.12,
    treblePeak: 0.1,
    levelPeak: 0.1,
    fluxPeak: 0.04,
  };
}

export function formatAudioTime(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return "0:00";
  }

  const seconds = Math.floor(totalSeconds);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function createAudioMotionController({ audio, onFrame, onError }) {
  const AudioContextClass =
    window.AudioContext || window.webkitAudioContext || null;
  let audioContext = null;
  let analyser = null;
  let mediaSource = null;
  let frequencyData = null;
  let timeDomainData = null;
  let bandIndices = null;
  let rafId = 0;
  let destroyed = false;
  let processingState = null;

  const emitFrame = (frame) => {
    if (destroyed || typeof onFrame !== "function") {
      return;
    }

    onFrame(frame);
  };

  const emitSilentFrame = (isActive = false) => {
    emitFrame({
      ...EMPTY_AUDIO_REACTIVITY,
      active: isActive ? 1 : 0,
      progress:
        Number.isFinite(audio.duration) && audio.duration > 0
          ? clamp(audio.currentTime / audio.duration, 0, 1)
          : 0,
      currentTime: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
      duration: Number.isFinite(audio.duration) ? audio.duration : 0,
    });
  };

  const stopAnalysis = (isActive = false) => {
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }

    emitSilentFrame(isActive);
  };

  const ensureGraph = async () => {
    if (!AudioContextClass) {
      throw new Error("This browser does not support Web Audio analysis.");
    }

    if (!audioContext) {
      audioContext = new AudioContextClass();
    }

    if (!analyser) {
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.76;
      frequencyData = new Uint8Array(analyser.frequencyBinCount);
      timeDomainData = new Uint8Array(analyser.fftSize);
      processingState = createProcessingState(analyser.frequencyBinCount);
      bandIndices = {
        bass: getFrequencyRangeIndices(analyser, audioContext, 28, 180),
        mids: getFrequencyRangeIndices(analyser, audioContext, 180, 2200),
        treble: getFrequencyRangeIndices(analyser, audioContext, 2200, 12000),
      };
    }

    if (!mediaSource) {
      mediaSource = audioContext.createMediaElementSource(audio);
      mediaSource.connect(analyser);
      analyser.connect(audioContext.destination);
    }

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }
  };

  const analyze = () => {
    if (destroyed || !analyser) {
      return;
    }

    analyser.getByteFrequencyData(frequencyData);
    analyser.getByteTimeDomainData(timeDomainData);

    const rawBass = averageBand(frequencyData, ...bandIndices.bass);
    const rawMids = averageBand(frequencyData, ...bandIndices.mids);
    const rawTreble = averageBand(frequencyData, ...bandIndices.treble);
    const rawLevel =
      rawBass * 0.52 +
      rawMids * 0.33 +
      rawTreble * 0.15 +
      computeRms(timeDomainData) * 0.42;

    let spectralFlux = 0;
    for (let index = 0; index < frequencyData.length; index += 1) {
      const nextValue = frequencyData[index] / 255;
      const delta = nextValue - processingState.prevSpectrum[index];
      if (delta > 0) {
        spectralFlux += delta;
      }
      processingState.prevSpectrum[index] = nextValue;
    }
    spectralFlux /= frequencyData.length;

    const bass = smooth(
      processingState,
      "bass",
      normalizePeak(processingState, "bass", rawBass),
      0.24
    );
    const mids = smooth(
      processingState,
      "mids",
      normalizePeak(processingState, "mids", rawMids),
      0.18
    );
    const treble = smooth(
      processingState,
      "treble",
      normalizePeak(processingState, "treble", rawTreble),
      0.22
    );
    const level = smooth(
      processingState,
      "level",
      normalizePeak(processingState, "level", rawLevel),
      0.2
    );
    const risingLevel = Math.max(0, level - processingState.prevLevel * 0.92);
    const transientTarget = clamp(
      normalizePeak(processingState, "flux", spectralFlux, 0.018) * 0.72 +
        risingLevel * 1.2,
      0,
      1.5
    );
    const transient = smooth(
      processingState,
      "transient",
      transientTarget,
      0.34
    );
    const pulse = smooth(
      processingState,
      "pulse",
      clamp(bass * 0.9 + transient * 0.82 + level * 0.18, 0, 1.6),
      0.28
    );

    processingState.prevLevel = level;

    emitFrame({
      active: 1,
      playing: audio.paused ? 0 : 1,
      level,
      bass,
      mids,
      treble,
      transient,
      pulse,
      progress:
        Number.isFinite(audio.duration) && audio.duration > 0
          ? clamp(audio.currentTime / audio.duration, 0, 1)
          : 0,
      currentTime: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
      duration: Number.isFinite(audio.duration) ? audio.duration : 0,
    });

    if (!audio.paused && !audio.ended) {
      rafId = window.requestAnimationFrame(analyze);
    } else {
      rafId = 0;
    }
  };

  const startAnalysis = async () => {
    try {
      await ensureGraph();
      if (!rafId) {
        rafId = window.requestAnimationFrame(analyze);
      }
    } catch (error) {
      if (typeof onError === "function") {
        onError(error);
      }
    }
  };

  const handlePlay = () => {
    startAnalysis();
  };

  const handlePause = () => {
    stopAnalysis(Boolean(audio.currentSrc));
  };

  const handleEnded = () => {
    stopAnalysis(Boolean(audio.currentSrc));
  };

  const handleLoadedMetadata = () => {
    emitSilentFrame(Boolean(audio.currentSrc));
  };

  audio.addEventListener("play", handlePlay);
  audio.addEventListener("pause", handlePause);
  audio.addEventListener("ended", handleEnded);
  audio.addEventListener("loadedmetadata", handleLoadedMetadata);

  emitSilentFrame(false);

  return {
    start() {
      return startAnalysis();
    },
    destroy() {
      destroyed = true;
      stopAnalysis(false);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      mediaSource?.disconnect();
      analyser?.disconnect();
      if (audioContext && audioContext.state !== "closed") {
        audioContext.close().catch(() => {});
      }
    },
  };
}
