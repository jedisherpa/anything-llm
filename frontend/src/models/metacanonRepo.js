import { API_BASE } from "@/utils/constants";
import { baseHeaders, safeJsonParse } from "@/utils/request";

const REPO_BASE = `${API_BASE}/metacanonai/repo`;

async function jsonOrError(response) {
  const payload = await safeJsonParse(await response.text(), {});
  if (!response.ok) {
    return { ...payload, error: payload?.error || "Request failed." };
  }
  return payload;
}

const MetacanonRepo = {
  async info() {
    const response = await fetch(`${REPO_BASE}/info`, {
      headers: baseHeaders(),
    });
    return jsonOrError(response);
  },
  async children(relativePath = "") {
    const response = await fetch(
      `${REPO_BASE}/children?path=${encodeURIComponent(relativePath)}`,
      {
        headers: baseHeaders(),
      }
    );
    return jsonOrError(response);
  },
  async index() {
    const response = await fetch(`${REPO_BASE}/index`, {
      headers: baseHeaders(),
    });
    return jsonOrError(response);
  },
  async file(relativePath = "") {
    const response = await fetch(
      `${REPO_BASE}/file?path=${encodeURIComponent(relativePath)}`,
      {
        headers: baseHeaders(),
      }
    );
    return jsonOrError(response);
  },
  async save(relativePath = "", content = "") {
    const response = await fetch(`${REPO_BASE}/file`, {
      method: "POST",
      headers: {
        ...baseHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: relativePath,
        content,
      }),
    });
    return jsonOrError(response);
  },
};

export default MetacanonRepo;
