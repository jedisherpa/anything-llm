import React, { startTransition, useEffect, useRef, useState } from "react";
import createPrismHeroScene from "@/pages/PrismHero/createPrismHeroScene";
import {
  CUSTOM_EXPRESSION_ID,
  EXPRESSION_PRESETS,
  PRISM_EXPRESSIONS,
  PRISM_SHAPES,
} from "@/pages/PrismHero/prismShapeState";
import {
  CUSTOM_MUSIC_DANCE_MODE_ID,
  createAudioMotionController,
  DEFAULT_MUSIC_SETTINGS,
  EMPTY_AUDIO_REACTIVITY,
  formatAudioTime,
  getMusicDanceMode,
  MUSIC_DANCE_MODES,
  MUSIC_CONTROLS,
} from "@/pages/PrismDodecahedron/musicMotion";
import { loadBundledPlaylistManifest } from "@/pages/PrismDodecahedron/musicLibrary";
import "./index.css";

const PRISM_STATES = [
  {
    id: "idle",
    label: "Idle",
    description: "Gold resting state",
  },
  {
    id: "thinking",
    label: "Thinking",
    description: "Teal active pulse",
  },
  {
    id: "response",
    label: "Response",
    description: "Gold answer flare",
  },
  {
    id: "error",
    label: "Error",
    description: "Red failure signal",
  },
];

const INITIAL_MODE = "idle";
const INITIAL_SHAPE = "dodecahedron";
const INITIAL_EXPRESSION = "friendly";

const DEFAULT_TUNING = {
  exposure: 0.96,
  bloom: 0.82,
  glow: 0.9,
  motion: 0.72,
  reflections: 1.18,
  particles: 0.62,
  hover: 0.92,
  look: 0.42,
};

const DEFAULT_MOTION = {
  spinX: 0,
  spinY: 0,
  spinZ: 0,
  zoom: 1,
  speed: 1,
  tilt: 1,
  attention: 0.9,
  anticipation: 0.7,
  settle: 0.8,
  breakup: 0,
  breakupPulse: 0,
  transformSpeed: 1,
  transformForce: 1,
};

const AUDIO_METERS = [
  { id: "level", label: "Level" },
  { id: "bass", label: "Bass" },
  { id: "mids", label: "Mids" },
  { id: "treble", label: "Highs" },
  { id: "transient", label: "Hit" },
];

const MOTION_GROUPS = [
  {
    id: "axis",
    title: "Axis",
    copy: "Spin, zoom, and overall camera flow.",
    controls: ["spinX", "spinY", "spinZ", "zoom", "speed", "tilt"],
  },
  {
    id: "behavior",
    title: "Behavior",
    copy: "Attention, breakup, and transform feel.",
    controls: [
      "attention",
      "anticipation",
      "settle",
      "transformSpeed",
      "transformForce",
      "breakup",
      "breakupPulse",
    ],
  },
];

const DEFAULT_PANEL_VISIBILITY = {
  lab: true,
  motion: true,
  music: true,
  debug: true,
};

const DEFAULT_LAB_SECTION_VISIBILITY = {
  modes: true,
  expressions: true,
  shapes: true,
  looks: false,
};

const PANEL_WINDOW_CONFIG = {
  lab: {
    width: 480,
    minVisibleWidth: 240,
  },
  motion: {
    width: 360,
    minVisibleWidth: 220,
  },
  music: {
    width: 360,
    minVisibleWidth: 220,
  },
};

const PANEL_WINDOW_MARGIN = 16;

const LOOK_PRESETS = [
  {
    id: "studio",
    label: "Studio Glass",
    description: "Crisp, quieter, premium product-shot reflections.",
    tuning: {
      look: 0.08,
      exposure: 0.94,
      bloom: 0.68,
      glow: 0.74,
      reflections: 1.34,
      particles: 0.46,
      motion: 0.66,
    },
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "A controlled midpoint between studio polish and myth.",
    tuning: {
      look: 0.42,
      exposure: 0.96,
      bloom: 0.82,
      glow: 0.9,
      reflections: 1.18,
      particles: 0.62,
      motion: 0.72,
    },
  },
  {
    id: "artifact",
    label: "Mythic Artifact",
    description: "Warmer, richer, more dramatic reflections and aura.",
    tuning: {
      look: 0.95,
      exposure: 1,
      bloom: 0.96,
      glow: 1.1,
      reflections: 1.28,
      particles: 0.78,
      motion: 0.82,
    },
  },
];

const TUNING_CONTROLS = [
  { id: "look", label: "Look", min: 0, max: 1, step: 0.01 },
  { id: "exposure", label: "Exposure", min: 0.5, max: 1.4, step: 0.01 },
  { id: "bloom", label: "Bloom", min: 0.3, max: 1.6, step: 0.01 },
  { id: "glow", label: "Glow", min: 0.2, max: 1.6, step: 0.01 },
  { id: "motion", label: "Motion", min: 0.2, max: 1.4, step: 0.01 },
  { id: "reflections", label: "Reflections", min: 0.4, max: 1.8, step: 0.01 },
  { id: "particles", label: "Particles", min: 0, max: 1.4, step: 0.01 },
  { id: "hover", label: "Hover", min: 0, max: 1.4, step: 0.01 },
];

const MOTION_CONTROLS = [
  { id: "spinX", label: "Spin X", min: -1.5, max: 1.5, step: 0.01 },
  { id: "spinY", label: "Spin Y", min: -1.5, max: 1.5, step: 0.01 },
  { id: "spinZ", label: "Spin Z", min: -1.5, max: 1.5, step: 0.01 },
  { id: "speed", label: "Speed", min: 0, max: 3, step: 0.01 },
  { id: "tilt", label: "Tilt", min: 0, max: 5, step: 0.01 },
  { id: "attention", label: "Attention", min: 0, max: 1.8, step: 0.01 },
  {
    id: "anticipation",
    label: "Anticipation",
    min: 0,
    max: 1.8,
    step: 0.01,
  },
  { id: "settle", label: "Settle", min: 0, max: 1.8, step: 0.01 },
  { id: "zoom", label: "Zoom", min: 0.7, max: 1.6, step: 0.01 },
  {
    id: "transformSpeed",
    label: "Transform Speed",
    min: 0.4,
    max: 2.5,
    step: 0.01,
  },
  {
    id: "transformForce",
    label: "Transform Force",
    min: 0.35,
    max: 2,
    step: 0.01,
  },
  { id: "breakup", label: "Micro Breakup", min: 0, max: 1.2, step: 0.01 },
  {
    id: "breakupPulse",
    label: "Micro Break Pulse",
    min: 0,
    max: 2,
    step: 0.01,
  },
];

const MOTION_CONTROL_MAP = Object.fromEntries(
  MOTION_CONTROLS.map((control) => [control.id, control])
);

const EXPRESSION_OPTIONS = [
  ...PRISM_EXPRESSIONS,
  {
    id: CUSTOM_EXPRESSION_ID,
    label: "Custom",
    description: "Manual shape or mode override.",
  },
];

const MUSIC_DANCE_MODE_OPTIONS = [
  ...MUSIC_DANCE_MODES,
  {
    id: CUSTOM_MUSIC_DANCE_MODE_ID,
    label: "Custom",
    description: "Manual music tuning lives between the main dance modes.",
  },
];

function useReducedMotionPreference() {
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  return reducedMotion;
}

function splitExpressionPatch(expressionId) {
  const preset = EXPRESSION_PRESETS[expressionId];
  const tuningPatch = {};
  const motionPatch = {};

  if (!preset?.configPatch) {
    return { motionPatch, tuningPatch };
  }

  Object.entries(preset.configPatch).forEach(([key, value]) => {
    if (Object.hasOwn(DEFAULT_TUNING, key)) {
      tuningPatch[key] = value;
    } else if (Object.hasOwn(DEFAULT_MOTION, key)) {
      motionPatch[key] = value;
    }
  });

  return { motionPatch, tuningPatch };
}

function getAssetStatusCopy(assetStatus) {
  if (assetStatus === "ready") {
    return "Shape library loaded locally. Full transformation set is available.";
  }

  if (assetStatus === "failed") {
    return "Shape asset fallback active. The procedural dodecahedron is still live.";
  }

  return "Loading the platonic solids library for multi-shape transitions.";
}

function getUploadedTrackName(filename) {
  return filename.replace(/\.[^/.]+$/, "");
}

function buildUploadedTracks(fileList) {
  return fileList.map((file, index) => ({
    id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
    name: getUploadedTrackName(file.name),
    filename: file.name,
    url: URL.createObjectURL(file),
    source: "upload",
  }));
}

function getPlaylistTrack(playlist, trackId) {
  return playlist.find((track) => track.id === trackId) ?? null;
}

function getViewportSize() {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

function clampPanelWindow(panelId, layout, viewport) {
  const config = PANEL_WINDOW_CONFIG[panelId];
  if (!config) return layout;

  const maxX = Math.max(
    PANEL_WINDOW_MARGIN,
    viewport.width - config.minVisibleWidth - PANEL_WINDOW_MARGIN
  );
  const maxY = Math.max(PANEL_WINDOW_MARGIN, viewport.height - 72);

  return {
    ...layout,
    x: Math.min(maxX, Math.max(PANEL_WINDOW_MARGIN, layout.x)),
    y: Math.min(maxY, Math.max(PANEL_WINDOW_MARGIN, layout.y)),
  };
}

function createDefaultPanelWindows(viewport) {
  const baseWindows = {
    lab: {
      x: PANEL_WINDOW_MARGIN,
      y: 176,
      width: PANEL_WINDOW_CONFIG.lab.width,
      collapsed: false,
      z: 1,
    },
    motion: {
      x: Math.max(PANEL_WINDOW_MARGIN, viewport.width - 376),
      y: 176,
      width: PANEL_WINDOW_CONFIG.motion.width,
      collapsed: false,
      z: 2,
    },
    music: {
      x: Math.max(PANEL_WINDOW_MARGIN, viewport.width - 376),
      y: Math.max(420, viewport.height - 420),
      width: PANEL_WINDOW_CONFIG.music.width,
      collapsed: false,
      z: 3,
    },
  };

  return Object.fromEntries(
    Object.entries(baseWindows).map(([panelId, layout]) => [
      panelId,
      clampPanelWindow(panelId, layout, viewport),
    ])
  );
}

export default function PrismDodecahedronPage() {
  const canvasRef = useRef(null);
  const guiHostRef = useRef(null);
  const guiRef = useRef(null);
  const guiControllersRef = useRef([]);
  const audioRef = useRef(null);
  const uploadedTrackUrlsRef = useRef(new Set());
  const shouldResumePlaybackRef = useRef(false);
  const audioMetricsFrameRef = useRef(0);
  const dragStateRef = useRef(null);
  const guiStateRef = useRef({
    mode: INITIAL_MODE,
    shape: INITIAL_SHAPE,
    expression: INITIAL_EXPRESSION,
    assetStatus: "loading",
    transitionPhase: "idle",
    musicDanceMode: MUSIC_DANCE_MODES[0].id,
    musicStatus: "Idle",
    trackLabel: "No track",
    resetMusic() {},
    ...DEFAULT_TUNING,
    ...DEFAULT_MOTION,
    ...DEFAULT_MUSIC_SETTINGS,
    studioGlass() {},
    balancedLook() {},
    mythicArtifact() {},
    resetTuning() {},
    resetMotion() {},
  });
  const controllerRef = useRef(null);
  const reducedMotion = useReducedMotionPreference();
  const [mode, setMode] = useState(INITIAL_MODE);
  const [shape, setShape] = useState(INITIAL_SHAPE);
  const [expression, setExpression] = useState(INITIAL_EXPRESSION);
  const [tuning, setTuning] = useState(DEFAULT_TUNING);
  const [motionConfig, setMotionConfig] = useState(DEFAULT_MOTION);
  const [musicSettings, setMusicSettings] = useState(DEFAULT_MUSIC_SETTINGS);
  const [audioMetrics, setAudioMetrics] = useState(EMPTY_AUDIO_REACTIVITY);
  const [availableShapes, setAvailableShapes] = useState([INITIAL_SHAPE]);
  const [assetStatus, setAssetStatus] = useState("loading");
  const [transitionPhase, setTransitionPhase] = useState("idle");
  const [audioError, setAudioError] = useState("");
  const [libraryTracks, setLibraryTracks] = useState([]);
  const [libraryStatus, setLibraryStatus] = useState("loading");
  const [libraryTitle, setLibraryTitle] = useState("Prism Library");
  const [uploadedTracks, setUploadedTracks] = useState([]);
  const [currentTrackId, setCurrentTrackId] = useState(null);
  const [panelVisibility, setPanelVisibility] = useState(
    DEFAULT_PANEL_VISIBILITY
  );
  const [labSectionVisibility, setLabSectionVisibility] = useState(
    DEFAULT_LAB_SECTION_VISIBILITY
  );
  const [viewport, setViewport] = useState(() => getViewportSize());
  const [draggingPanelId, setDraggingPanelId] = useState(null);
  const [panelWindows, setPanelWindows] = useState(() =>
    createDefaultPanelWindows(getViewportSize())
  );
  const [relaxMode, setRelaxMode] = useState(false);
  const [showRelaxHint, setShowRelaxHint] = useState(false);

  const playlist = [...libraryTracks, ...uploadedTracks];
  const currentTrack = getPlaylistTrack(playlist, currentTrackId);
  const currentTrackIndex = currentTrack
    ? playlist.findIndex((track) => track.id === currentTrack.id)
    : -1;
  const floatingWindowsEnabled = viewport.width > 920;
  const expressionLabel =
    EXPRESSION_OPTIONS.find((item) => item.id === expression)?.label ??
    "Custom";
  const shapeControlsLocked = transitionPhase !== "idle";
  const musicDanceMode = getMusicDanceMode(musicSettings);
  const musicDanceModeLabel =
    MUSIC_DANCE_MODE_OPTIONS.find((item) => item.id === musicDanceMode)?.label ??
    "Custom";
  const libraryBadge =
    libraryStatus === "ready"
      ? `${libraryTracks.length} built-in tracks`
      : libraryStatus === "empty"
        ? "No bundled tracks"
        : libraryStatus === "failed"
          ? "Library unavailable"
          : "Loading library";
  const trackCountLabel = playlist.length
    ? `${currentTrackIndex + 1 || 1}/${playlist.length}`
    : "No tracks";
  const canControlPlayback = Boolean(currentTrack || playlist.length);
  const controlPanels = [
    { id: "lab", label: "Lab", meta: expressionLabel },
    { id: "motion", label: "Motion", meta: "Axis + behavior" },
    {
      id: "music",
      label: "Music",
      meta: playlist.length
        ? `${playlist.length} tracks / ${musicDanceModeLabel}`
        : `${musicDanceModeLabel} / ${libraryBadge}`,
    },
    { id: "debug", label: "Debug", meta: "lil-gui" },
  ];

  function updateTuning(key, value) {
    startTransition(() => {
      setTuning((current) => ({
        ...current,
        [key]: value,
      }));
    });
  }

  function updateMotion(key, value) {
    startTransition(() => {
      setMotionConfig((current) => ({
        ...current,
        [key]: value,
      }));
    });
  }

  function updateMusicSetting(key, value) {
    startTransition(() => {
      setMusicSettings((current) => ({
        ...current,
        [key]: value,
      }));
    });
  }

  function resetTuning() {
    startTransition(() => {
      setTuning(DEFAULT_TUNING);
    });
  }

  function resetMotion() {
    startTransition(() => {
      setMotionConfig(DEFAULT_MOTION);
    });
  }

  function resetMusic() {
    startTransition(() => {
      setMusicSettings(DEFAULT_MUSIC_SETTINGS);
    });
  }

  function applyMusicDanceMode(modeId) {
    if (modeId === CUSTOM_MUSIC_DANCE_MODE_ID) return;

    const preset = MUSIC_DANCE_MODES.find((mode) => mode.id === modeId);
    if (!preset) return;

    startTransition(() => {
      setMusicSettings((current) => ({
        ...current,
        ...preset.settings,
      }));
    });
  }

  function applyLookPreset(preset) {
    startTransition(() => {
      setTuning((current) => ({
        ...current,
        ...preset.tuning,
      }));
    });
  }

  function applyExpressionPreset(expressionId) {
    if (expressionId === CUSTOM_EXPRESSION_ID) return;

    const preset = EXPRESSION_PRESETS[expressionId];
    if (!preset || !availableShapes.includes(preset.shape)) return;

    const { motionPatch, tuningPatch } = splitExpressionPatch(expressionId);

    startTransition(() => {
      setTuning((current) => ({
        ...current,
        ...tuningPatch,
      }));
      setMotionConfig((current) => ({
        ...current,
        ...motionPatch,
      }));
    });

    controllerRef.current?.setExpression(expressionId);
  }

  function selectMode(nextMode) {
    controllerRef.current?.setMode(nextMode);
  }

  function selectShape(nextShape) {
    if (transitionPhase !== "idle" || !availableShapes.includes(nextShape)) {
      return;
    }

    controllerRef.current?.setShape(nextShape);
  }

  function handleTrackUpload(event) {
    const files = Array.from(event.currentTarget.files ?? []);
    if (!files.length) return;

    const uploadedTracks = buildUploadedTracks(files);
    uploadedTracks.forEach((track) =>
      uploadedTrackUrlsRef.current.add(track.url)
    );

    startTransition(() => {
      setUploadedTracks((current) => [...current, ...uploadedTracks]);
      setCurrentTrackId((current) => current ?? uploadedTracks[0]?.id ?? null);
    });

    event.currentTarget.value = "";
  }

  function selectTrack(trackId) {
    if (!trackId || currentTrackId === trackId) return;
    shouldResumePlaybackRef.current = Boolean(
      audioRef.current && !audioRef.current.paused && !audioRef.current.ended
    );
    startTransition(() => {
      setCurrentTrackId(trackId);
    });
  }

  function stepTrack(direction) {
    if (!playlist.length) return;

    const baseIndex =
      currentTrackIndex >= 0 ? currentTrackIndex : direction > 0 ? -1 : 0;
    const nextIndex = Math.min(
      playlist.length - 1,
      Math.max(0, baseIndex + direction)
    );
    const nextTrack = playlist[nextIndex];
    if (!nextTrack) return;
    selectTrack(nextTrack.id);
  }

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;

    if (!currentTrack && playlist[0]) {
      shouldResumePlaybackRef.current = true;
      startTransition(() => {
        setCurrentTrackId(playlist[0].id);
      });
      return;
    }

    if (audio.paused || audio.ended) {
      const playPromise = audio.play();
      if (typeof playPromise?.catch === "function") {
        playPromise.catch(() => {});
      }
      return;
    }

    audio.pause();
  }

  function clearUploadedTracks() {
    const currentIsUploaded = uploadedTracks.some(
      (track) => track.id === currentTrackId
    );
    const wasPlaying = Boolean(
      audioRef.current && !audioRef.current.paused && !audioRef.current.ended
    );

    if (!libraryTracks.length && !uploadedTracks.length) {
      return;
    }

    uploadedTrackUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    uploadedTrackUrlsRef.current.clear();

    if (!libraryTracks.length) {
      audioRef.current?.pause();
      if (audioRef.current) {
        audioRef.current.removeAttribute("src");
        audioRef.current.load();
      }

      shouldResumePlaybackRef.current = false;
      controllerRef.current?.setAudioReactivity(EMPTY_AUDIO_REACTIVITY);

      startTransition(() => {
        setUploadedTracks([]);
        setCurrentTrackId(null);
        setAudioMetrics(EMPTY_AUDIO_REACTIVITY);
        setAudioError("");
      });
      return;
    }

    shouldResumePlaybackRef.current = currentIsUploaded && wasPlaying;

    startTransition(() => {
      setUploadedTracks([]);
      setCurrentTrackId((current) =>
        currentIsUploaded ? libraryTracks[0]?.id ?? null : current
      );
      setAudioError("");
    });
  }

  function togglePanelVisibility(panelId) {
    startTransition(() => {
      setPanelVisibility((current) => ({
        ...current,
        [panelId]: !current[panelId],
      }));
    });
  }

  function toggleLabSection(sectionId) {
    startTransition(() => {
      setLabSectionVisibility((current) => ({
        ...current,
        [sectionId]: !current[sectionId],
      }));
    });
  }

  function bringPanelToFront(panelId) {
    setPanelWindows((current) => {
      const panel = current[panelId];
      if (!panel) return current;
      const topZ = Math.max(...Object.values(current).map((item) => item.z));
      if (panel.z === topZ) return current;

      return {
        ...current,
        [panelId]: {
          ...panel,
          z: topZ + 1,
        },
      };
    });
  }

  function togglePanelCollapsed(panelId) {
    bringPanelToFront(panelId);
    startTransition(() => {
      setPanelWindows((current) => ({
        ...current,
        [panelId]: {
          ...current[panelId],
          collapsed: !current[panelId].collapsed,
        },
      }));
    });
  }

  function handlePanelPointerDown(panelId, event) {
    if (!floatingWindowsEnabled || event.button !== 0) return;

    const panel = panelWindows[panelId];
    if (!panel) return;

    bringPanelToFront(panelId);
    dragStateRef.current = {
      panelId,
      offsetX: event.clientX - panel.x,
      offsetY: event.clientY - panel.y,
    };
    setDraggingPanelId(panelId);
    event.preventDefault();
  }

  function toggleRelaxMode() {
    const nextValue = !relaxMode;
    startTransition(() => {
      setRelaxMode(nextValue);
      setShowRelaxHint(nextValue);
    });
  }

  useEffect(() => {
    let isCancelled = false;

    async function setupBundledLibrary() {
      try {
        const nextLibrary = await loadBundledPlaylistManifest();
        if (isCancelled) return;

        startTransition(() => {
          setLibraryTracks(nextLibrary.tracks);
          setLibraryStatus(nextLibrary.status);
          setLibraryTitle(nextLibrary.title ?? "Prism Library");
          setCurrentTrackId((current) => current ?? nextLibrary.tracks[0]?.id ?? null);
        });
      } catch (error) {
        if (isCancelled) return;

        startTransition(() => {
          setLibraryTracks([]);
          setLibraryStatus("failed");
        });
      }
    }

    setupBundledLibrary();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    const controller = createPrismHeroScene(canvasRef.current, {
      reducedMotion,
      mode: INITIAL_MODE,
      initialShape: INITIAL_SHAPE,
      initialExpression: INITIAL_EXPRESSION,
      enableScroll: false,
      enablePointer: true,
      enableClickCycle: true,
      stageStyle: "minimal",
      initialConfig: {
        ...DEFAULT_TUNING,
        ...DEFAULT_MOTION,
      },
      onModeChange: (nextMode) =>
        startTransition(() => {
          setMode(nextMode);
        }),
      onShapeChange: (nextShape) =>
        startTransition(() => {
          setShape(nextShape);
        }),
      onExpressionChange: (nextExpression) =>
        startTransition(() => {
          setExpression(nextExpression);
        }),
      onTransitionPhaseChange: (nextPhase) =>
        startTransition(() => {
          setTransitionPhase(nextPhase);
        }),
      onShapeAssetsChange: ({ availableShapes: nextShapes, status }) =>
        startTransition(() => {
          setAvailableShapes(nextShapes);
          setAssetStatus(status);
        }),
    });

    controllerRef.current = controller;
    startTransition(() => {
      setAvailableShapes(controller.getAvailableShapes?.() ?? [INITIAL_SHAPE]);
    });

    return () => {
      controller.destroy();
      controllerRef.current = null;
    };
  }, [reducedMotion]);

  useEffect(() => {
    controllerRef.current?.setConfig({
      ...tuning,
      ...motionConfig,
      ...musicSettings,
    });
  }, [motionConfig, musicSettings, tuning]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const audioController = createAudioMotionController({
      audio,
      onFrame: (metrics) => {
        controllerRef.current?.setAudioReactivity(metrics);

        const now = window.performance.now();
        if (now - audioMetricsFrameRef.current > 90) {
          audioMetricsFrameRef.current = now;
          startTransition(() => {
            setAudioMetrics(metrics);
          });
        }
      },
      onError: (error) => {
        startTransition(() => {
          setAudioError(
            error?.message ??
              "This browser blocked the audio analyzer for this track."
          );
        });
      },
    });

    return () => {
      audioController.destroy();
      controllerRef.current?.setAudioReactivity(EMPTY_AUDIO_REACTIVITY);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!currentTrack?.url) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      controllerRef.current?.setAudioReactivity(EMPTY_AUDIO_REACTIVITY);
      return;
    }

    audio.src = currentTrack.url;
    audio.load();
    if (shouldResumePlaybackRef.current) {
      const playPromise = audio.play();
      if (typeof playPromise?.catch === "function") {
        playPromise.catch(() => {});
      }
    }
    shouldResumePlaybackRef.current = false;
    setAudioError("");
  }, [currentTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const handleEnded = () => {
      const currentIndex = playlist.findIndex(
        (track) => track.id === currentTrackId
      );
      if (currentIndex >= 0 && currentIndex < playlist.length - 1) {
        shouldResumePlaybackRef.current = true;
        startTransition(() => {
          setCurrentTrackId(playlist[currentIndex + 1].id);
        });
      }
    };

    audio.addEventListener("ended", handleEnded);
    return () => audio.removeEventListener("ended", handleEnded);
  }, [currentTrackId, libraryTracks, uploadedTracks]);

  useEffect(() => {
    return () => {
      uploadedTrackUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      uploadedTrackUrlsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!relaxMode) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setRelaxMode(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [relaxMode]);

  useEffect(() => {
    if (!relaxMode || !showRelaxHint) return undefined;

    const timeoutId = window.setTimeout(() => {
      setShowRelaxHint(false);
    }, 2200);

    return () => window.clearTimeout(timeoutId);
  }, [relaxMode, showRelaxHint]);

  useEffect(() => {
    const handlePointerMove = (event) => {
      const dragState = dragStateRef.current;
      if (!dragState || !floatingWindowsEnabled) return;

      setPanelWindows((current) => {
        const panel = current[dragState.panelId];
        if (!panel) return current;

        const nextLayout = clampPanelWindow(
          dragState.panelId,
          {
            ...panel,
            x: event.clientX - dragState.offsetX,
            y: event.clientY - dragState.offsetY,
          },
          getViewportSize()
        );

        if (nextLayout.x === panel.x && nextLayout.y === panel.y) {
          return current;
        }

        return {
          ...current,
          [dragState.panelId]: nextLayout,
        };
      });
    };

    const handlePointerUp = () => {
      dragStateRef.current = null;
      setDraggingPanelId(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [floatingWindowsEnabled]);

  useEffect(() => {
    const handleResize = () => {
      const nextViewport = getViewportSize();
      setViewport(nextViewport);
      setPanelWindows((current) =>
        Object.fromEntries(
          Object.entries(current).map(([panelId, layout]) => [
            panelId,
            clampPanelWindow(panelId, layout, nextViewport),
          ])
        )
      );
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const activeLookPreset =
    LOOK_PRESETS.find(
      (preset) => Math.abs(tuning.look - preset.tuning.look) < 0.08
    )?.id ?? "custom";

  useEffect(() => {
    let isCancelled = false;

    async function setupGui() {
      const { default: GUI } = await import("lil-gui");
      if (isCancelled || !guiHostRef.current) return;

      const gui = new GUI({
        container: guiHostRef.current,
        title: "Prism Debug",
        width: 320,
      });
      guiRef.current = gui;
      gui.domElement.classList.add("prism-debug-panel");

      const guiState = guiStateRef.current;
      const hoverControl = TUNING_CONTROLS.find(
        (control) => control.id === "hover"
      );
      const registerController = (controller) => {
        guiControllersRef.current.push(controller);
        return controller;
      };
      const patchTuning = (nextPartial) => {
        startTransition(() => {
          setTuning((current) => ({
            ...current,
            ...nextPartial,
          }));
        });
      };
      const patchMotion = (nextPartial) => {
        startTransition(() => {
          setMotionConfig((current) => ({
            ...current,
            ...nextPartial,
          }));
        });
      };
      const patchMusic = (nextPartial) => {
        startTransition(() => {
          setMusicSettings((current) => ({
            ...current,
            ...nextPartial,
          }));
        });
      };

      guiState.studioGlass = () => applyLookPreset(LOOK_PRESETS[0]);
      guiState.balancedLook = () => applyLookPreset(LOOK_PRESETS[1]);
      guiState.mythicArtifact = () => applyLookPreset(LOOK_PRESETS[2]);
      guiState.resetTuning = () => resetTuning();
      guiState.resetMotion = () => resetMotion();
      guiState.resetMusic = () => resetMusic();

      const stateFolder = gui.addFolder("State");
      registerController(
        stateFolder
          .add(
            guiState,
            "mode",
            PRISM_STATES.map((state) => state.id)
          )
          .name("Mode")
          .onChange((nextMode) => selectMode(nextMode))
      );
      registerController(
        stateFolder
          .add(
            guiState,
            "shape",
            PRISM_SHAPES.map((item) => item.id)
          )
          .name("Shape")
          .onChange((nextShape) => selectShape(nextShape))
      );
      registerController(
        stateFolder
          .add(
            guiState,
            "expression",
            EXPRESSION_OPTIONS.map((item) => item.id)
          )
          .name("Expression")
          .onChange((nextExpression) => applyExpressionPreset(nextExpression))
      );
      registerController(
        stateFolder.add(guiState, "assetStatus").name("Assets")
      );
      registerController(
        stateFolder.add(guiState, "transitionPhase").name("Transform")
      );
      stateFolder.open();

      const lookFolder = gui.addFolder("Looks");
      registerController(
        lookFolder.add(guiState, "studioGlass").name("Studio glass")
      );
      registerController(
        lookFolder.add(guiState, "balancedLook").name("Balanced")
      );
      registerController(
        lookFolder.add(guiState, "mythicArtifact").name("Mythic artifact")
      );
      registerController(
        lookFolder
          .add(guiState, "look", 0, 1, 0.01)
          .name("Look mix")
          .onChange((value) => patchTuning({ look: value }))
      );
      lookFolder.open();

      const renderFolder = gui.addFolder("Render");
      TUNING_CONTROLS.filter(
        (control) => !["look", "hover"].includes(control.id)
      ).forEach((control) => {
        registerController(
          renderFolder
            .add(guiState, control.id, control.min, control.max, control.step)
            .name(control.label)
            .onChange((value) => patchTuning({ [control.id]: value }))
        );
      });

      const interactionFolder = gui.addFolder("Interaction");
      registerController(
        interactionFolder
          .add(
            guiState,
            "hover",
            hoverControl.min,
            hoverControl.max,
            hoverControl.step
          )
          .name("Hover")
          .onChange((value) => patchTuning({ hover: value }))
      );
      registerController(
        interactionFolder.add(guiState, "resetTuning").name("Reset tuning")
      );

      const motionFolder = gui.addFolder("Motion");
      MOTION_CONTROLS.forEach((control) => {
        registerController(
          motionFolder
            .add(guiState, control.id, control.min, control.max, control.step)
            .name(control.label)
            .onChange((value) => patchMotion({ [control.id]: value }))
        );
      });
      registerController(
        motionFolder.add(guiState, "resetMotion").name("Reset motion")
      );
      motionFolder.open();

      const musicFolder = gui.addFolder("Music");
      registerController(
        musicFolder
          .add(
            guiState,
            "musicDanceMode",
            MUSIC_DANCE_MODE_OPTIONS.map((item) => item.id)
          )
          .name("Dance mode")
          .onChange((nextMode) => applyMusicDanceMode(nextMode))
      );
      registerController(musicFolder.add(guiState, "trackLabel").name("Track"));
      registerController(
        musicFolder.add(guiState, "musicStatus").name("Playback")
      );
      MUSIC_CONTROLS.forEach((control) => {
        registerController(
          musicFolder
            .add(guiState, control.id, control.min, control.max, control.step)
            .name(control.label)
            .onChange((value) => patchMusic({ [control.id]: value }))
        );
      });
      registerController(
        musicFolder.add(guiState, "resetMusic").name("Reset music")
      );

      guiControllersRef.current.forEach((controller) =>
        controller.updateDisplay()
      );
    }

    setupGui();

    return () => {
      isCancelled = true;
      guiControllersRef.current = [];
      guiRef.current?.destroy();
      guiRef.current = null;
    };
  }, []);

  useEffect(() => {
    const guiState = guiStateRef.current;
    guiState.mode = mode;
    guiState.shape = shape;
    guiState.expression = expression;
    guiState.assetStatus = assetStatus;
    guiState.transitionPhase = transitionPhase;
    guiState.musicDanceMode = musicDanceMode;
    guiState.trackLabel = currentTrack?.name ?? "No track";
    guiState.musicStatus = audioMetrics.playing
      ? "Playing"
      : currentTrack
        ? "Loaded"
        : "Idle";
    Object.assign(guiState, tuning, motionConfig, musicSettings);
    guiControllersRef.current.forEach((controller) =>
      controller.updateDisplay()
    );
  }, [
    assetStatus,
    audioMetrics.playing,
    expression,
    currentTrack,
    mode,
    musicSettings,
    motionConfig,
    musicDanceMode,
    shape,
    transitionPhase,
    tuning,
  ]);

  const renderLabSection = (sectionId, title, meta, children) => {
    const isOpen = labSectionVisibility[sectionId];

    return (
      <section className={`prism-dodecahedron-fold${isOpen ? " is-open" : ""}`}>
        <button
          type="button"
          className="prism-dodecahedron-fold-toggle"
          onClick={() => toggleLabSection(sectionId)}
          aria-expanded={isOpen}
        >
          <span>
            <strong>{title}</strong>
            <small>{meta}</small>
          </span>
          <em>{isOpen ? "Hide" : "Show"}</em>
        </button>
        {isOpen ? (
          <div className="prism-dodecahedron-fold-content">{children}</div>
        ) : null}
      </section>
    );
  };

  const renderFloatingPanel = ({
    panelId,
    className,
    title,
    subtitle,
    children,
  }) => {
    const panel = panelWindows[panelId];
    const isCollapsed = panel?.collapsed;
    const panelStyle =
      floatingWindowsEnabled && panel
        ? {
            left: `${panel.x}px`,
            top: `${panel.y}px`,
            width: `${panel.width}px`,
            zIndex: 4 + panel.z,
          }
        : undefined;

    return (
      <section
        className={`${className} prism-dodecahedron-window${floatingWindowsEnabled ? " is-floating" : " is-stacked"}${isCollapsed ? " is-collapsed" : ""}${draggingPanelId === panelId ? " is-dragging" : ""}`}
        style={panelStyle}
        onPointerDown={() => bringPanelToFront(panelId)}
      >
        <div
          className={`prism-dodecahedron-window-header${floatingWindowsEnabled ? " is-draggable" : ""}`}
          onPointerDown={(event) => handlePanelPointerDown(panelId, event)}
        >
          <div className="prism-dodecahedron-window-meta">
            <p>{title}</p>
            <span>{subtitle}</span>
          </div>

          <div className="prism-dodecahedron-window-actions">
            <button
              type="button"
              className="prism-dodecahedron-window-button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => togglePanelCollapsed(panelId)}
            >
              {isCollapsed ? "Expand" : "Collapse"}
            </button>
          </div>
        </div>

        {!isCollapsed ? (
          <div className="prism-dodecahedron-window-body">{children}</div>
        ) : null}
      </section>
    );
  };

  return (
    <div
      className={`prism-dodecahedron-page${relaxMode ? " is-relax-mode" : ""}`}
    >
      <div className="prism-dodecahedron-canvas-shell" aria-hidden="true">
        <canvas ref={canvasRef} className="prism-dodecahedron-canvas" />
      </div>

      <div
        ref={guiHostRef}
        className={`prism-dodecahedron-debug-gui${panelVisibility.debug && !relaxMode ? "" : " is-hidden"}`}
      />

      <audio
        ref={audioRef}
        className="prism-dodecahedron-audio is-hidden"
        preload="metadata"
      />

      <main className="prism-dodecahedron-overlay">
        <header
          className={`prism-dodecahedron-header${relaxMode ? " is-hidden" : ""}`}
        >
          <div>
            <p className="prism-dodecahedron-kicker">Shape-state lab</p>
            <h1 className="prism-dodecahedron-title">The Prism</h1>
            <p className="prism-dodecahedron-subtitle">
              A live WebGL body language sandbox for Prism. The balanced self is
              the dodecahedron, but this lab can now break apart and reform into
              other solids so we can build personality out of simple
              transformations before we ever wire it to chat.
            </p>
          </div>

          <div className="prism-dodecahedron-links">
            <a className="prism-dodecahedron-link" href="/prism-hero">
              Open hero route
            </a>
            <a className="prism-dodecahedron-link" href="/login">
              Back to app
            </a>
            <button
              type="button"
              className="prism-dodecahedron-link"
              onClick={toggleRelaxMode}
            >
              Relax mode
            </button>
          </div>
        </header>

        <div
          className={`prism-dodecahedron-control-dock${relaxMode ? " is-hidden" : ""}`}
        >
          {controlPanels.map((panel) => (
            <button
              key={panel.id}
              type="button"
              className={`prism-dodecahedron-toggle${panelVisibility[panel.id] ? " is-active" : ""}`}
              onClick={() => togglePanelVisibility(panel.id)}
              aria-pressed={panelVisibility[panel.id]}
            >
              {panel.label}
              <small>
                {panelVisibility[panel.id] ? "Hide" : "Show"} {panel.meta}
              </small>
            </button>
          ))}
        </div>

        {!relaxMode && panelVisibility.lab
          ? renderFloatingPanel({
              panelId: "lab",
              className: "prism-dodecahedron-panel",
              title: "Shape-State Lab",
              subtitle: "Expressions, body selection, and render treatment.",
              children: (
                <>
                  <p>
                    Hover the Prism to wake it up, click it to cycle modes, then
                    use the grouped sections below to preview
                    breakup-and-reassembly transitions without keeping every
                    control open at once.
                  </p>

                  <div className="prism-dodecahedron-status-row">
                    <span className="prism-dodecahedron-badge">
                      Assets: {assetStatus}
                    </span>
                    <span className="prism-dodecahedron-badge">
                      Transform: {transitionPhase}
                    </span>
                    <span className="prism-dodecahedron-badge">
                      Expression: {expressionLabel}
                    </span>
                  </div>

                  <p className="prism-dodecahedron-status-copy">
                    {getAssetStatusCopy(assetStatus)}
                  </p>

                  <div className="prism-dodecahedron-lab-sections">
                    {renderLabSection(
                      "modes",
                      "Modes",
                      "State cycling and direct wake-up controls.",
                      <>
                        <div className="prism-dodecahedron-states">
                          {PRISM_STATES.map((state) => (
                            <button
                              key={state.id}
                              type="button"
                              className={`prism-dodecahedron-state${mode === state.id ? " is-active" : ""}`}
                              onClick={() => selectMode(state.id)}
                            >
                              {state.label}
                              <small>{state.description}</small>
                            </button>
                          ))}
                        </div>

                        <p className="prism-dodecahedron-hint">
                          Click directly on the Prism to cycle modes.
                        </p>
                      </>
                    )}

                    {renderLabSection(
                      "expressions",
                      "Expressions",
                      shapeControlsLocked
                        ? "Locked during transformation."
                        : "Preset personality bundles.",
                      <div className="prism-dodecahedron-chip-grid">
                        {PRISM_EXPRESSIONS.map((item) => {
                          const disabled =
                            shapeControlsLocked ||
                            !availableShapes.includes(item.shape);

                          return (
                            <button
                              key={item.id}
                              type="button"
                              className={`prism-dodecahedron-chip${expression === item.id ? " is-active" : ""}`}
                              onClick={() => applyExpressionPreset(item.id)}
                              disabled={disabled}
                            >
                              {item.label}
                              <small>{item.description}</small>
                            </button>
                          );
                        })}
                        <div className="prism-dodecahedron-chip is-static">
                          Custom
                          <small>
                            Manual shape or mode overrides land here.
                          </small>
                        </div>
                      </div>
                    )}

                    {renderLabSection(
                      "shapes",
                      "Shapes",
                      `Current body: ${shape}.`,
                      <div className="prism-dodecahedron-chip-grid">
                        {PRISM_SHAPES.map((item) => {
                          const disabled =
                            shapeControlsLocked ||
                            !availableShapes.includes(item.id);

                          return (
                            <button
                              key={item.id}
                              type="button"
                              className={`prism-dodecahedron-chip${shape === item.id ? " is-active" : ""}`}
                              onClick={() => selectShape(item.id)}
                              disabled={disabled}
                            >
                              {item.label}
                              <small>{item.description}</small>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {renderLabSection(
                      "looks",
                      "Looks",
                      "Glass presets and render tuning.",
                      <>
                        <div className="prism-dodecahedron-presets">
                          {LOOK_PRESETS.map((preset) => (
                            <button
                              key={preset.id}
                              type="button"
                              className={`prism-dodecahedron-preset${activeLookPreset === preset.id ? " is-active" : ""}`}
                              onClick={() => applyLookPreset(preset)}
                            >
                              {preset.label}
                              <small>{preset.description}</small>
                            </button>
                          ))}
                        </div>

                        <p className="prism-dodecahedron-look-copy">
                          Drag <strong>Look</strong> toward `0.00` for tighter
                          studio glass or toward `1.00` for the heavier mythic
                          artifact treatment.
                        </p>

                        <div className="prism-dodecahedron-tuning">
                          {TUNING_CONTROLS.map((control) => (
                            <label
                              key={control.id}
                              className="prism-dodecahedron-control"
                            >
                              <span>
                                {control.label}
                                <strong>{tuning[control.id].toFixed(2)}</strong>
                              </span>
                              <input
                                type="range"
                                min={control.min}
                                max={control.max}
                                step={control.step}
                                value={tuning[control.id]}
                                onChange={(event) =>
                                  updateTuning(
                                    control.id,
                                    Number(event.currentTarget.value)
                                  )
                                }
                              />
                            </label>
                          ))}
                        </div>

                        <div className="prism-dodecahedron-actions">
                          <button
                            type="button"
                            className="prism-dodecahedron-link"
                            onClick={resetTuning}
                          >
                            Reset tuning
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </>
              ),
            })
          : null}

        {!relaxMode && panelVisibility.motion
          ? renderFloatingPanel({
              panelId: "motion",
              className: "prism-dodecahedron-motion-panel",
              title: "Motion",
              subtitle: "Axis control and body-language tuning.",
              children: (
                <>
                  <p>
                    Motion is grouped into orbit controls and behavioral
                    controls, so it is easier to tune camera feel separately
                    from personality movement.
                  </p>

                  {MOTION_GROUPS.map((group) => (
                    <section
                      key={group.id}
                      className="prism-dodecahedron-control-group"
                    >
                      <div className="prism-dodecahedron-section-head">
                        <h3>{group.title}</h3>
                        <span>{group.copy}</span>
                      </div>

                      <div className="prism-dodecahedron-motion-grid">
                        {group.controls.map((controlId) => {
                          const control = MOTION_CONTROL_MAP[controlId];

                          return (
                            <label
                              key={control.id}
                              className="prism-dodecahedron-motion-control"
                            >
                              <span>
                                {control.label}
                                <strong>
                                  {motionConfig[control.id].toFixed(2)}
                                </strong>
                              </span>
                              <input
                                type="range"
                                min={control.min}
                                max={control.max}
                                step={control.step}
                                value={motionConfig[control.id]}
                                onChange={(event) =>
                                  updateMotion(
                                    control.id,
                                    Number(event.currentTarget.value)
                                  )
                                }
                              />
                            </label>
                          );
                        })}
                      </div>
                    </section>
                  ))}

                  <div className="prism-dodecahedron-actions">
                    <button
                      type="button"
                      className="prism-dodecahedron-link"
                      onClick={resetMotion}
                    >
                      Reset motion
                    </button>
                  </div>
                </>
              ),
            })
          : null}

        {!relaxMode && panelVisibility.music
          ? renderFloatingPanel({
              panelId: "music",
              className: "prism-dodecahedron-music-panel",
              title: "Music",
              subtitle: `${trackCountLabel} / ${musicDanceModeLabel}`,
              children: (
                <>
                  <p>
                    Prism can now ship with a small built-in library for the
                    deployed site, and you can still add temporary local MP3s
                    on top. Bass drives pulse and lift, mids steer the body,
                    highs add shimmer and ring accents, and the dance mode
                    decides how hard the existing platonic breakup logic gets
                    pushed.
                  </p>

                  <div className="prism-dodecahedron-status-row">
                    <span className="prism-dodecahedron-badge">
                      Library: {libraryBadge}
                    </span>
                    <span className="prism-dodecahedron-badge">
                      Source: {libraryTitle}
                    </span>
                  </div>

                  <div className="prism-dodecahedron-section-head">
                    <h3>Dance Mode</h3>
                    <span>Breakup intensity profile</span>
                  </div>

                  <div className="prism-dodecahedron-chip-grid prism-dodecahedron-music-mode-grid">
                    {MUSIC_DANCE_MODES.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`prism-dodecahedron-chip${musicDanceMode === item.id ? " is-active" : ""}`}
                        onClick={() => applyMusicDanceMode(item.id)}
                      >
                        {item.label}
                        <small>{item.description}</small>
                      </button>
                    ))}
                    <div
                      className={`prism-dodecahedron-chip is-static${musicDanceMode === CUSTOM_MUSIC_DANCE_MODE_ID ? " is-active" : ""}`}
                    >
                      Custom
                      <small>
                        Manual music slider changes land between groove and
                        dance.
                      </small>
                    </div>
                  </div>

                  <div className="prism-dodecahedron-music-actions">
                    <label className="prism-dodecahedron-upload">
                      <input
                        type="file"
                        accept=".mp3,audio/*"
                        multiple
                        onChange={handleTrackUpload}
                      />
                      Add MP3s
                    </label>
                    <button
                      type="button"
                      className="prism-dodecahedron-link"
                      onClick={togglePlayback}
                      disabled={!canControlPlayback}
                    >
                      {audioMetrics.playing ? "Pause" : "Play"}
                    </button>
                    <button
                      type="button"
                      className="prism-dodecahedron-link"
                      onClick={() => stepTrack(-1)}
                      disabled={playlist.length < 2 || currentTrackIndex <= 0}
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      className="prism-dodecahedron-link"
                      onClick={() => stepTrack(1)}
                      disabled={
                        playlist.length < 2 ||
                        currentTrackIndex >= playlist.length - 1
                      }
                    >
                      Next
                    </button>
                  </div>

                  <div className="prism-dodecahedron-status-row">
                    <span className="prism-dodecahedron-badge">
                      Playback: {audioMetrics.playing ? "playing" : "stopped"}
                    </span>
                    <span className="prism-dodecahedron-badge">
                      Track: {currentTrack ? currentTrack.name : "none"}
                    </span>
                    <span className="prism-dodecahedron-badge">
                      Uploaded: {uploadedTracks.length}
                    </span>
                  </div>

                  {audioError ? (
                    <p className="prism-dodecahedron-audio-error">
                      {audioError}
                    </p>
                  ) : (
                    <p className="prism-dodecahedron-audio-copy">
                      {currentTrack
                        ? `${formatAudioTime(audioMetrics.currentTime)} / ${formatAudioTime(audioMetrics.duration)}`
                        : "Uploaded audio stays local to this browser session."}
                    </p>
                  )}

                  <div className="prism-dodecahedron-section-head">
                    <h3>Playlist</h3>
                    <span>
                      {currentTrack ? currentTrack.name : "No selection"}
                    </span>
                  </div>

                  <div className="prism-dodecahedron-track-list">
                    {playlist.length ? (
                      playlist.map((track) => (
                        <button
                          key={track.id}
                          type="button"
                          className={`prism-dodecahedron-track${currentTrackId === track.id ? " is-active" : ""}`}
                          onClick={() => selectTrack(track.id)}
                        >
                          {track.name}
                          <small>
                            {track.filename}
                            {track.source === "library" ? " · bundled" : " · local"}
                          </small>
                        </button>
                      ))
                    ) : (
                      <div className="prism-dodecahedron-track-empty">
                        No tracks yet. Add MP3s here or drop songs into
                        `/public/music` and list them in `playlist.json` for the
                        deployed site.
                      </div>
                    )}
                  </div>

                  <div className="prism-dodecahedron-section-head">
                    <h3>Live Signal</h3>
                    <span>Browser-side audio analysis</span>
                  </div>

                  <div className="prism-dodecahedron-meter-grid">
                    {AUDIO_METERS.map((meter) => (
                      <div key={meter.id} className="prism-dodecahedron-meter">
                        <span>
                          {meter.label}
                          <strong>{audioMetrics[meter.id].toFixed(2)}</strong>
                        </span>
                        <div className="prism-dodecahedron-meter-track">
                          <div
                            className="prism-dodecahedron-meter-fill"
                            style={{
                              width: `${Math.min(100, audioMetrics[meter.id] * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="prism-dodecahedron-section-head">
                    <h3>Reactivity</h3>
                    <span>How much the track moves Prism</span>
                  </div>

                  <div className="prism-dodecahedron-motion-grid prism-dodecahedron-music-grid">
                    {MUSIC_CONTROLS.map((control) => (
                      <label
                        key={control.id}
                        className="prism-dodecahedron-motion-control"
                      >
                        <span>
                          {control.label}
                          <strong>
                            {musicSettings[control.id].toFixed(2)}
                          </strong>
                        </span>
                        <input
                          type="range"
                          min={control.min}
                          max={control.max}
                          step={control.step}
                          value={musicSettings[control.id]}
                          onChange={(event) =>
                            updateMusicSetting(
                              control.id,
                              Number(event.currentTarget.value)
                            )
                          }
                        />
                      </label>
                    ))}
                  </div>

                  <div className="prism-dodecahedron-actions">
                    <button
                      type="button"
                      className="prism-dodecahedron-link"
                      onClick={resetMusic}
                    >
                      Reset music
                    </button>
                    <button
                      type="button"
                      className="prism-dodecahedron-link"
                      onClick={clearUploadedTracks}
                      disabled={!uploadedTracks.length}
                    >
                      Clear uploads
                    </button>
                  </div>
                </>
              ),
            })
          : null}

        {relaxMode && showRelaxHint ? (
          <div className="prism-dodecahedron-relax-hint" aria-hidden="true">
            Press Esc to exit relax mode
          </div>
        ) : null}

        {relaxMode ? (
          <div
            className="prism-dodecahedron-relax-transport"
            aria-label="Relax mode playback controls"
          >
            <button
              type="button"
              className="prism-dodecahedron-relax-control"
              onClick={() => stepTrack(-1)}
              disabled={playlist.length < 2 || currentTrackIndex <= 0}
            >
              Prev
            </button>
            <button
              type="button"
              className="prism-dodecahedron-relax-control"
              onClick={togglePlayback}
              disabled={!canControlPlayback}
            >
              {audioMetrics.playing ? "Pause" : "Play"}
            </button>
            <button
              type="button"
              className="prism-dodecahedron-relax-control"
              onClick={() => stepTrack(1)}
              disabled={
                playlist.length < 2 || currentTrackIndex >= playlist.length - 1
              }
            >
              Next
            </button>
            <span className="prism-dodecahedron-relax-track">
              {currentTrack ? currentTrack.name : "No track loaded"}
            </span>
          </div>
        ) : null}
      </main>
    </div>
  );
}
