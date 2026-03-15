import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(
  new URL("../server/package.json", import.meta.url)
);
const WebSocket = require("ws");

const APP_URL = "http://127.0.0.1:3001";
const PREVIEW_URL = "http://localhost:4182";
const CHROME_BIN = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(
  SCRIPT_DIR,
  "../deliverables/prismai-manual-shots/ready-now"
);

async function ensureChromeExists() {
  await fs.access(CHROME_BIN);
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
    server.on("error", reject);
  });
}

async function waitForJson(url, timeoutMs = 15000) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  throw new Error(
    `Timed out waiting for ${url}${lastError ? `: ${lastError.message}` : ""}`
  );
}

class CDPSession {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.ws.once("open", resolve);
      this.ws.once("error", reject);
    });

    this.ws.on("message", (raw) => {
      const message = JSON.parse(String(raw));
      if (message.id) {
        const entry = this.pending.get(message.id);
        if (!entry) return;
        this.pending.delete(message.id);
        if (message.error) {
          entry.reject(new Error(message.error.message || "CDP error"));
        } else {
          entry.resolve(message.result);
        }
        return;
      }

      const handlers = this.listeners.get(message.method) || [];
      handlers.forEach((handler) => handler(message.params || {}));
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  waitForEvent(method, predicate = () => true, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`Timed out waiting for event ${method}`));
      }, timeoutMs);

      const handler = (params) => {
        if (!predicate(params)) return;
        cleanup();
        resolve(params);
      };

      const cleanup = () => {
        clearTimeout(timeout);
        const current = this.listeners.get(method) || [];
        this.listeners.set(
          method,
          current.filter((entry) => entry !== handler)
        );
      };

      const current = this.listeners.get(method) || [];
      current.push(handler);
      this.listeners.set(method, current);
    });
  }

  async close() {
    await new Promise((resolve) => {
      this.ws.once("close", resolve);
      this.ws.close();
    });
  }
}

async function launchBrowser() {
  const port = await getFreePort();
  const userDataDir = path.join(os.tmpdir(), `prismai-shot-profile-${port}`);
  await fs.mkdir(userDataDir, { recursive: true });

  const chrome = spawn(
    CHROME_BIN,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--disable-sync",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      "about:blank",
    ],
    {
      stdio: "ignore",
    }
  );

  const version = await waitForJson(`http://127.0.0.1:${port}/json/version`);
  return { chrome, port, userDataDir, version };
}

async function waitForTarget(port, targetId, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const targets = await waitForJson(`http://127.0.0.1:${port}/json/list`);
    const target = targets.find((entry) => entry.id === targetId);
    if (target?.webSocketDebuggerUrl) return target;
    await delay(250);
  }
  throw new Error(`Timed out waiting for target ${targetId}`);
}

async function createPage(browser) {
  const browserSession = new CDPSession(browser.version.webSocketDebuggerUrl);
  await browserSession.connect();
  const { targetId } = await browserSession.send("Target.createTarget", {
    url: "about:blank",
  });
  await browserSession.close();
  const target = await waitForTarget(browser.port, targetId);
  const page = new CDPSession(target.webSocketDebuggerUrl);
  await page.connect();
  await page.send("Page.enable");
  await page.send("Runtime.enable");
  await page.send("DOM.enable");
  return { page, targetId: target.id };
}

async function closePage(port, targetId, page) {
  if (page) await page.close().catch(() => {});
  await fetch(`http://127.0.0.1:${port}/json/close/${targetId}`).catch(() => {});
}

async function setViewport(page, { width, height, mobile = false }) {
  await page.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
  });
  await page.send("Emulation.setVisibleSize", { width, height }).catch(() => {});
}

async function navigate(page, url) {
  const loadEvent = page.waitForEvent("Page.loadEventFired", () => true, 20000);
  await page.send("Page.navigate", { url });
  await loadEvent;
  await delay(1200);
}

async function setTheme(page, theme) {
  await page.send("Runtime.evaluate", {
    expression: `
      (() => {
        localStorage.setItem("theme", ${JSON.stringify(theme)});
        document.documentElement.setAttribute("data-theme", ${JSON.stringify(theme)});
        if (document.body) document.body.classList.toggle("light", ${theme === "light"});
        return true;
      })()
    `,
    awaitPromise: true,
    returnByValue: true,
  });
  const loadEvent = page.waitForEvent("Page.loadEventFired", () => true, 20000);
  await page.send("Page.reload", { ignoreCache: true });
  await loadEvent;
  await delay(1200);
}

async function clickByText(page, text, occurrence = 0) {
  const result = await page.send("Runtime.evaluate", {
    expression: `
      (() => {
        const targetText = ${JSON.stringify(text)};
        const occurrence = ${occurrence};
        const nodes = [...document.querySelectorAll("button, a, [role='button']")];
        const matches = nodes.filter((node) =>
          (node.innerText || node.textContent || "").replace(/\\s+/g, " ").trim().includes(targetText)
        );
        const target = matches[occurrence] || null;
        if (!target) return false;
        target.click();
        return true;
      })()
    `,
    awaitPromise: true,
    returnByValue: true,
  });
  await delay(900);
  return !!result?.result?.value;
}

async function setInputByPlaceholder(page, placeholder, value) {
  await page.send("Runtime.evaluate", {
    expression: `
      (() => {
        const input = [...document.querySelectorAll("input, textarea")]
          .find((node) => (node.getAttribute("placeholder") || "").includes(${JSON.stringify(placeholder)}));
        if (!input) return false;
        const descriptor = Object.getOwnPropertyDescriptor(input.__proto__, "value");
        if (descriptor?.set) descriptor.set.call(input, ${JSON.stringify(value)});
        else input.value = ${JSON.stringify(value)};
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      })()
    `,
    awaitPromise: true,
    returnByValue: true,
  });
  await delay(300);
}

async function capture(page, outputFile, clip = null) {
  const screenshot = await page.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: !clip,
    clip: clip
      ? {
          x: clip.x,
          y: clip.y,
          width: clip.width,
          height: clip.height,
          scale: 1,
        }
      : undefined,
  });
  await fs.writeFile(outputFile, Buffer.from(screenshot.data, "base64"));
}

async function waitForText(page, text, timeoutMs = 15000) {
  const started = Date.now();
  const expected = String(text).toLowerCase();
  while (Date.now() - started < timeoutMs) {
    const result = await page.send("Runtime.evaluate", {
      expression: `document.body && (document.body.innerText || '').toLowerCase().includes(${JSON.stringify(
        expected
      )})`,
      returnByValue: true,
    });
    if (result?.result?.value) return true;
    await delay(250);
  }
  const bodyText = await page
    .send("Runtime.evaluate", {
      expression:
        "document.body ? (document.body.innerText || document.body.textContent || '') : ''",
      returnByValue: true,
    })
    .then((result) => result?.result?.value || "")
    .catch(() => "");
  throw new Error(
    `Timed out waiting for text: ${text}\nVisible text:\n${String(bodyText)
      .trim()
      .slice(0, 1200)}`
  );
}

async function run() {
  await ensureChromeExists();
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await launchBrowser();

  const shots = [
    {
      name: "01-forge-overview-dark.png",
      route: `${APP_URL}/workspace/prism-preview`,
      viewport: { width: 1440, height: 900, mobile: false },
      theme: "dark",
      waitFor: "How can I help you today?",
    },
    {
      name: "02-three-modes-dark.png",
      route: `${APP_URL}/workspace/prism-preview`,
      viewport: { width: 1440, height: 900, mobile: false },
      theme: "dark",
      waitFor: "How can I help you today?",
    },
    {
      name: "03-three-modes-light.png",
      route: `${APP_URL}/workspace/prism-preview`,
      viewport: { width: 1440, height: 900, mobile: false },
      theme: "light",
      waitFor: "How can I help you today?",
    },
    {
      name: "04-three-modes-cathedral.png",
      route: `${APP_URL}/workspace/prism-preview`,
      viewport: { width: 1440, height: 900, mobile: false },
      theme: "cathedral",
      waitFor: "How can I help you today?",
    },
    {
      name: "05-library-dashboard.png",
      route: `${PREVIEW_URL}/metacanonai/library`,
      viewport: { width: 1440, height: 1100, mobile: false },
      theme: "dark",
      waitFor: "PrismAI Library",
    },
    {
      name: "06-building-a-constellation.png",
      route: `${PREVIEW_URL}/metacanonai/library`,
      viewport: { width: 1440, height: 1100, mobile: false },
      theme: "dark",
      waitFor: "Draft Constellation",
      afterLoad: async (page) => {
        await clickByText(page, "Lenses");
        await delay(1200);
        await clickByText(page, "Add to Constellation");
        await clickByText(page, "Add to Constellation");
        await setInputByPlaceholder(page, "Custom Constellation Name", "Founder Operating Constellation");
      },
    },
    {
      name: "07-provider-matrix.png",
      route: `${PREVIEW_URL}/settings/llm-preference`,
      viewport: { width: 1440, height: 1200, mobile: false },
      theme: "dark",
      waitFor: "LLM Preference",
      afterLoad: async (page) => {
        await page.send("Runtime.evaluate", {
          expression: `
            (() => {
              const button = [...document.querySelectorAll("button")]
                .find((node) => node.querySelector("img") && node.querySelector("svg"));
              if (!button) return false;
              button.click();
              return true;
            })()
          `,
          awaitPromise: true,
          returnByValue: true,
        });
        await delay(1200);
      },
    },
    {
      name: "08-giving-prism-a-voice-transcription.png",
      route: `${PREVIEW_URL}/settings/transcription-preference`,
      viewport: { width: 1440, height: 1200, mobile: false },
      theme: "dark",
      waitFor: "Transcription Model Preference",
    },
    {
      name: "09-giving-prism-a-voice-audio.png",
      route: `${PREVIEW_URL}/settings/audio-preference`,
      viewport: { width: 1440, height: 1400, mobile: false },
      theme: "dark",
      waitFor: "Speech-to-text Preference",
    },
    {
      name: "10-feeding-prism.png",
      route: `${APP_URL}/workspace/prism-preview`,
      viewport: { width: 1440, height: 900, mobile: false },
      theme: "dark",
      waitFor: "Feed Prism",
      clip: { x: 220, y: 210, width: 1040, height: 410 },
    },
  ];

  const startIndex = Number(process.env.SHOT_START_INDEX || "0");
  const endIndex = Number(process.env.SHOT_END_INDEX || `${shots.length}`);
  const selectedShots = shots.slice(startIndex, endIndex);

  const manifest = [];

  try {
    for (const shot of selectedShots) {
      const outputFile = path.join(OUTPUT_DIR, shot.name);
      const { page, targetId } = await createPage(browser);
      try {
        await setViewport(page, shot.viewport);
        await navigate(page, shot.route);
        if (shot.theme) await setTheme(page, shot.theme);
        if (shot.waitFor) await waitForText(page, shot.waitFor);
        if (shot.afterLoad) await shot.afterLoad(page);
        await capture(page, outputFile, shot.clip);
        manifest.push({
          file: shot.name,
          route: shot.route,
          theme: shot.theme || "default",
          viewport: shot.viewport,
        });
        console.log(`Captured ${shot.name}`);
      } finally {
        await closePage(browser.port, targetId, page);
      }
    }
  } finally {
    browser.chrome.kill("SIGTERM");
  }

  await fs.writeFile(
    path.join(OUTPUT_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  );
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
