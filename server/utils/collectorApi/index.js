const { EncryptionManager } = require("../EncryptionManager");
const { Agent } = require("undici");

/**
 * @typedef {Object} CollectorOptions
 * @property {string} whisperProvider - The provider to use for whisper, defaults to "local"
 * @property {string} WhisperModelPref - The model to use for whisper if set.
 * @property {string} openAiKey - The API key to use for OpenAI interfacing, mostly passed to OAI Whisper provider.
 * @property {Object} ocr - The OCR options
 * @property {{allowAnyIp: "true"|null|undefined}} runtimeSettings - The runtime settings that are passed to the collector. Persisted across requests.
 */

// When running locally will occupy the 0.0.0.0 hostname space but when deployed inside
// of docker this endpoint is not exposed so it is only on the Docker instances internal network
// so no additional security is needed on the endpoint directly. Auth is done however by the express
// middleware prior to leaving the node-side of the application so that is good enough >:)
class CollectorApi {
  /** @type {number} - The maximum timeout for extension requests in milliseconds */
  extensionRequestTimeout = 15 * 60_000; // 15 minutes
  /** @type {number} - The default timeout for collector requests in milliseconds */
  requestTimeout = 10 * 60_000; // 10 minutes
  /** @type {Agent} - Shared agent for regular collector requests */
  requestAgent = new Agent({
    headersTimeout: this.requestTimeout,
    bodyTimeout: this.requestTimeout,
  });
  /** @type {Agent} - The agent for extension requests */
  extensionRequestAgent = new Agent({
    headersTimeout: this.extensionRequestTimeout,
    bodyTimeout: this.extensionRequestTimeout,
  });

  constructor() {
    const { CommunicationKey } = require("../comKey");
    this.comkey = new CommunicationKey();
    this.endpoint = `http://${process.env.COLLECTOR_HOST || "127.0.0.1"}:${process.env.COLLECTOR_PORT || 8888}`;
  }

  log(text, ...args) {
    console.log(`\x1b[36m[CollectorApi]\x1b[0m ${text}`, ...args);
  }

  /**
   * Attach options to the request passed to the collector API
   * @returns {CollectorOptions}
   */
  #attachOptions() {
    return {
      whisperProvider: process.env.WHISPER_PROVIDER || "local",
      WhisperModelPref: process.env.WHISPER_MODEL_PREF,
      openAiKey: process.env.OPEN_AI_KEY || null,
      ocr: {
        langList: process.env.TARGET_OCR_LANG || "eng",
      },
      runtimeSettings: {
        allowAnyIp: process.env.COLLECTOR_ALLOW_ANY_IP ?? "false",
        browserLaunchArgs: process.env.ANYTHINGLLM_CHROMIUM_ARGS ?? [],
      },
    };
  }

  #signedHeaders(data) {
    return {
      "Content-Type": "application/json",
      "X-Integrity": this.comkey.sign(data),
      "X-Payload-Signer": this.comkey.encrypt(
        new EncryptionManager().xPayload
      ),
    };
  }

  async #parseJsonResponse(response) {
    if (response.ok) return response.json();

    let details = "";
    try {
      const contentType = response.headers?.get?.("content-type") || "";
      if (contentType.includes("application/json")) {
        const payload = await response.json();
        details =
          payload?.error || payload?.reason || JSON.stringify(payload || {});
      } else {
        details = await response.text();
      }
    } catch {
      details = "";
    }

    const statusText = response.statusText ? ` ${response.statusText}` : "";
    const suffix = details?.trim() ? `: ${details.trim()}` : "";
    throw new Error(
      `Collector request failed (${response.status}${statusText})${suffix}`
    );
  }

  async #postJson(endpoint, data, fallback, dispatcher = this.requestAgent) {
    try {
      const response = await fetch(`${this.endpoint}${endpoint}`, {
        method: "POST",
        headers: this.#signedHeaders(data),
        body: data,
        dispatcher,
      });
      return await this.#parseJsonResponse(response);
    } catch (error) {
      this.log(error.message);
      return fallback(error);
    }
  }

  async online() {
    return await fetch(this.endpoint)
      .then((res) => res.ok)
      .catch(() => false);
  }

  async acceptedFileTypes() {
    return await fetch(`${this.endpoint}/accepts`)
      .then((res) => {
        if (!res.ok) throw new Error("failed to GET /accepts");
        return res.json();
      })
      .then((res) => res)
      .catch((e) => {
        this.log(e.message);
        return null;
      });
  }

  /**
   * Process a document
   * - Will append the options and optional metadata to the request body
   * @param {string} filename - The filename of the document to process
   * @param {Object} metadata - Optional metadata key:value pairs
   * @returns {Promise<Object>} - The response from the collector API
   */
  async processDocument(filename = "", metadata = {}) {
    if (!filename) return false;

    const data = JSON.stringify({
      filename,
      metadata,
      options: this.#attachOptions(),
    });

    return await this.#postJson(
      "/process",
      data,
      (error) => ({
        success: false,
        reason: error.message,
        documents: [],
      }),
      this.requestAgent
    );
  }

  /**
   * Parse a document without promoting it into the selectable document library.
   * Useful for one-off transcription/extraction flows like chat speech-to-text.
   * @param {string} filename
   * @returns {Promise<Object>}
   */
  async parseDocument(filename = "") {
    if (!filename) return false;

    const data = JSON.stringify({
      filename,
      options: this.#attachOptions(),
    });

    return await this.#postJson(
      "/parse",
      data,
      (error) => ({
        success: false,
        reason: error.message,
        documents: [],
      }),
      this.requestAgent
    );
  }

  /**
   * Process a link
   * - Will append the options to the request body
   * @param {string} link - The link to process
   * @param {{[key: string]: string}} scraperHeaders - Custom headers to apply to the web-scraping request URL
   * @param {[key: string]: string} metadata - Optional metadata to attach to the document
   * @returns {Promise<Object>} - The response from the collector API
   */
  async processLink(link = "", scraperHeaders = {}, metadata = {}) {
    if (!link) return false;

    const data = JSON.stringify({
      link,
      scraperHeaders,
      options: this.#attachOptions(),
      metadata: metadata,
    });

    return await this.#postJson("/process-link", data, (error) => ({
      success: false,
      reason: error.message,
      documents: [],
    }));
  }

  /**
   * Process raw text as a document for the collector
   * - Will append the options to the request body
   * @param {string} textContent - The text to process
   * @param {[key: string]: string} metadata - The metadata to process
   * @returns {Promise<Object>} - The response from the collector API
   */
  async processRawText(textContent = "", metadata = {}) {
    const data = JSON.stringify({
      textContent,
      metadata,
      options: this.#attachOptions(),
    });
    return await this.#postJson("/process-raw-text", data, (error) => ({
      success: false,
      reason: error.message,
      documents: [],
    }));
  }

  // We will not ever expose the document processor to the frontend API so instead we relay
  // all requests through the server. You can use this function to directly expose a specific endpoint
  // on the document processor.
  async forwardExtensionRequest({ endpoint, method, body }) {
    const data = typeof body === "string" ? body : JSON.stringify(body);
    return await this.#postJson(
      endpoint,
      data,
      (error) => ({ success: false, data: {}, reason: error.message }),
      this.extensionRequestAgent
    );
  }

  /**
   * Get the content of a link only in a specific format
   * - Will append the options to the request body
   * @param {string} link - The link to get the content of
   * @param {"text"|"html"} captureAs - The format to capture the content as
   * @returns {Promise<Object>} - The response from the collector API
   */
  async getLinkContent(link = "", captureAs = "text") {
    if (!link) return false;

    const data = JSON.stringify({
      link,
      captureAs,
      options: this.#attachOptions(),
    });
    return await this.#postJson("/util/get-link", data, () => ({
      success: false,
      content: null,
    }));
  }

  /**
   * Parse a document without processing it
   * - Will append the options to the request body
   * @param {string} filename - The filename of the document to parse
   * @returns {Promise<Object>} - The response from the collector API
   */
  async parseDocument(filename = "") {
    if (!filename) return false;

    const data = JSON.stringify({
      filename,
      options: this.#attachOptions(),
    });

    return await this.#postJson("/parse", data, (error) => ({
      success: false,
      reason: error.message,
      documents: [],
    }));
  }
}

module.exports.CollectorApi = CollectorApi;
