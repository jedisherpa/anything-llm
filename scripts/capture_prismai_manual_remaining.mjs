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

const PREVIEW_URL = "http://127.0.0.1:4182";
const CHROME_BIN =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(
  SCRIPT_DIR,
  "../deliverables/prismai-manual-shots/remaining"
);
const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

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

  waitForEvent(method, predicate = () => true, timeoutMs = 30000) {
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
    { stdio: "ignore" }
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
  await page.send("Network.enable");
  return { page, targetId: target.id };
}

async function closePage(port, targetId, page) {
  if (page) await page.close().catch(() => {});
  await fetch(`http://127.0.0.1:${port}/json/close/${targetId}`).catch(
    () => {}
  );
}

async function setViewport(page, { width, height, mobile = false }) {
  await page.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: mobile ? 3 : 1,
    mobile,
  });
  await page.send("Emulation.setVisibleSize", { width, height }).catch(() => {});
}

async function setUserAgent(page, mobile = false) {
  if (!mobile) return;
  await page.send("Emulation.setUserAgentOverride", {
    userAgent: MOBILE_UA,
    platform: "iPhone",
  });
}

async function navigate(page, url) {
  const loadEvent = page.waitForEvent("Page.loadEventFired", () => true, 45000);
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
  const loadEvent = page.waitForEvent("Page.loadEventFired", () => true, 45000);
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
  throw new Error(`Timed out waiting for text: ${text}`);
}

async function run() {
  await ensureChromeExists();
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const browser = await launchBrowser();
  const shots = [
    {
      name: "11-threshold-onboarding.png",
      route: `${PREVIEW_URL}/onboarding?preview=1`,
      viewport: { width: 430, height: 932, mobile: true },
      theme: "dark",
      waitFor: "Explore the Artifact",
    },
    {
      name: "12-scrying-glass-mobile-idle.png",
      route: `${PREVIEW_URL}/workspace/prism-preview`,
      viewport: { width: 430, height: 932, mobile: true },
      theme: "dark",
      waitFor: "How can I help you today?",
    },
    {
      name: "13-alignment-menu-mobile.png",
      route: `${PREVIEW_URL}/workspace/prism-preview`,
      viewport: { width: 430, height: 932, mobile: true },
      theme: "dark",
      waitFor: "How can I help you today?",
      afterLoad: async (page) => {
        await clickByText(page, "Align");
        await waitForText(page, "Starter Packs");
      },
    },
    {
      name: "14-decorated-sidebar.png",
      route: `${PREVIEW_URL}/workspace/prism-preview`,
      viewport: { width: 1440, height: 1280, mobile: false },
      theme: "dark",
      waitFor: "Featured Lenses",
      afterLoad: async (page) => {
        await page.send("Runtime.evaluate", {
          expression: `
            (() => {
              const scrollable = document.querySelector('.overflow-y-scroll.no-scroll');
              if (scrollable) scrollable.scrollTop = 900;
              const lens = document.querySelector('.metacanon-lens-card');
              if (lens) {
                lens.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
                lens.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
                lens.click();
              }
              return true;
            })()
          `,
          awaitPromise: true,
          returnByValue: true,
        });
        await delay(1200);
      },
      clip: { x: 0, y: 0, width: 380, height: 1180 },
    },
    {
      name: "15-chat-vs-query-mode.png",
      route: `${PREVIEW_URL}/workspace/prism-preview`,
      viewport: { width: 1440, height: 960, mobile: false },
      theme: "dark",
      waitFor: "Chat vs Query",
      afterLoad: async (page) => {
        await page.send("Runtime.evaluate", {
          expression: `
            (() => {
              const buttons = [...document.querySelectorAll('.metacanon-chat-mode-toggle__button')];
              const queryButton = buttons.find((button) =>
                (button.innerText || button.textContent || '').includes('Query')
              );
              if (!queryButton) return false;
              queryButton.click();
              return true;
            })()
          `,
          awaitPromise: true,
          returnByValue: true,
        });
        await delay(900);
      },
      clip: { x: 120, y: 110, width: 1220, height: 650 },
    },
    {
      name: "16-prism-in-motion.png",
      route: `${PREVIEW_URL}/metacanonai/manual-previews`,
      viewport: { width: 1600, height: 1080, mobile: false },
      theme: "dark",
      waitFor: "Prism in Motion",
      clip: { x: 80, y: 180, width: 1440, height: 680 },
    },
    {
      name: "17-sub-sphere-in-action.png",
      route: `${PREVIEW_URL}/metacanonai/manual-previews`,
      viewport: { width: 1600, height: 1200, mobile: false },
      theme: "dark",
      waitFor: "Sub-Sphere in Action",
      afterLoad: async (page) => {
        await page.send("Runtime.evaluate", {
          expression: `
            (() => {
              const expand = document.querySelector('#sub-sphere-action-preview button[aria-label="Show thought chain"]');
              if (expand) expand.click();
              return true;
            })()
          `,
          awaitPromise: true,
          returnByValue: true,
        });
        await delay(800);
      },
      clip: { x: 150, y: 720, width: 1280, height: 470 },
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
        await setUserAgent(page, shot.viewport.mobile);
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
