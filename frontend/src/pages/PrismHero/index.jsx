import React, { useEffect, useRef, useState } from "react";
import createPrismHeroScene from "./createPrismHeroScene";
import "./index.css";

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

export default function PrismHeroPage() {
  const canvasRef = useRef(null);
  const reducedMotion = useReducedMotionPreference();
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneFailed, setSceneFailed] = useState(false);

  useEffect(() => {
    const controller = createPrismHeroScene(canvasRef.current, {
      reducedMotion,
      mode: "idle",
      enableScroll: true,
      enablePointer: true,
      initialConfig: {
        look: 0.8,
        glow: 1.04,
        bloom: 0.92,
        reflections: 1.12,
      },
      onReady: () => {
        setSceneReady(true);
        setSceneFailed(false);
      },
      onError: (error) => {
        console.error("Failed to initialize Prism hero scene", error);
        setSceneFailed(true);
      },
    });

    return () => controller.destroy();
  }, [reducedMotion]);

  return (
    <div className="prism-hero-page">
      <div className="prism-hero-canvas-shell" aria-hidden="true">
        <canvas ref={canvasRef} className="prism-hero-canvas" />
        <div
          className={`prism-hero-fallback${sceneFailed || !sceneReady ? " is-visible" : ""}`}
        />
      </div>

      <header className="prism-hero-topbar">
        <a className="prism-hero-brand" href="/login">
          <strong>AnythingLLM</strong>
          <span>Prism hero prototype</span>
        </a>
        <nav className="prism-hero-nav" aria-label="Prism hero navigation">
          <a className="prism-hero-button" href="#story">
            Explore the build
          </a>
          <a className="prism-hero-button is-primary" href="/login">
            Open the app
          </a>
        </nav>
      </header>

      <main className="prism-hero-scroll">
        <section className="prism-hero-section prism-hero-section--intro">
          <div className="prism-hero-sticky">
            <div className="prism-hero-copy">
              <p className="prism-hero-kicker">
                Full-bleed WebGL landing system
              </p>
              <h1 className="prism-hero-title">
                <span>Your</span>
                <span>Private LLM</span>
              </h1>
              <p className="prism-hero-subtitle">
                A cinematic first impression for AnythingLLM: dark void,
                luminous gold Prism, subtle breathing motion, and a
                scroll-driven dolly that turns the homepage into a product
                reveal instead of a static banner.
              </p>
              <div className="prism-hero-cta">
                <a className="prism-hero-button is-primary" href="#story">
                  See the scene anatomy
                </a>
                <a className="prism-hero-button" href="/login">
                  Keep current home intact
                </a>
              </div>
              <div
                className="prism-hero-meta"
                aria-label="Hero performance goals"
              >
                <div className="prism-hero-stat">
                  <strong>WebGL + bloom</strong>
                  <span>
                    Half-float composer with ACES filmic tone mapping.
                  </span>
                </div>
                <div className="prism-hero-stat">
                  <strong>Idle breathing</strong>
                  <span>
                    Emissive pulse and micro-scale motion on a 10s cycle.
                  </span>
                </div>
                <div className="prism-hero-stat">
                  <strong>Scroll camera</strong>
                  <span>
                    Dolly toward the Prism while keeping UI copy legible.
                  </span>
                </div>
              </div>
            </div>

            <aside className="prism-hero-card">
              <h2>Locked visual system</h2>
              <p>
                This prototype follows the brief closely while staying safe
                inside the existing frontend. The current authenticated home
                route is untouched.
              </p>
              <ul className="prism-hero-list">
                <li>
                  <span>Background</span>
                  <span>#1A1A1A</span>
                </li>
                <li>
                  <span>Prism</span>
                  <span>Dodecahedron glass + gold wireframe</span>
                </li>
                <li>
                  <span>Motion</span>
                  <span>Breathing, rotation, parallax, dolly</span>
                </li>
                <li>
                  <span>Performance</span>
                  <span>DPR capped at 1.5 with mobile reductions</span>
                </li>
              </ul>
            </aside>
          </div>
        </section>

        <section id="story" className="prism-hero-section">
          <div className="prism-hero-grid">
            <article className="prism-hero-grid-card">
              <h2>Scene graph</h2>
              <h3>Procedural, not asset-heavy</h3>
              <p>
                The Prism is built directly in Three.js, so we do not need
                Blender or Houdini just to get the base hero online. That keeps
                iteration fast and avoids shipping heavyweight geometry for a
                shape the GPU can generate instantly.
              </p>
              <small>Group + mesh + wireframe + core light</small>
            </article>

            <article className="prism-hero-grid-card">
              <h2>Atmosphere</h2>
              <h3>Gold volumetrics by post-processing</h3>
              <p>
                Unreal Bloom, a half-float render target, warm point lights, and
                a soft field of drifting particles create the sense of suspended
                light without forcing the browser through an overbuilt shader
                stack.
              </p>
              <small>Composer + bloom + FXAA</small>
            </article>

            <article className="prism-hero-grid-card">
              <h2>Interaction</h2>
              <h3>Breathing at rest, cinematic on scroll</h3>
              <p>
                When the visitor is idle, the object pulses gently. As they
                scroll, the camera pushes forward, the Prism rotates into frame,
                and the whole landing sequence feels authored instead of merely
                animated.
              </p>
              <small>10 second pulse + scroll progress interpolation</small>
            </article>

            <article className="prism-hero-grid-card">
              <h2>Integration path</h2>
              <h3>Ready for the real landing surface</h3>
              <p>
                Because this ships as <code>/prism-hero</code>, we can review
                the visual direction first. If you want, the next pass can
                replace a marketing homepage, hook CTAs into downloads/docs, and
                pull copy from a CMS or config instead of hardcoding it.
              </p>
              <small>Prototype route now, production integration next</small>
            </article>
          </div>
        </section>

        <footer className="prism-hero-footer">
          Built inside the existing AnythingLLM frontend as an isolated
          prototype route for review.
        </footer>
      </main>
    </div>
  );
}
