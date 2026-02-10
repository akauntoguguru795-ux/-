const i18n = {
  ja: {
    title_upload: "ファイル取り込み",
    title_settings: "API設定",
    title_results: "文字起こし結果",
    drop_primary: "MP3ファイルをドラッグ&ドロップ",
    drop_secondary: "または下のボタンで選択",
    max_files: "最大同時ファイル数",
    max_size: "最大ファイルサイズ (MB)",
    language: "文字起こし言語",
    response: "出力形式",
    provider: "APIタイプ",
    endpoint: "エンドポイント",
    apikey: "APIキー",
    model: "モデル名",
    temperature: "温度",
    auto_save: "自動保存"
  },
  en: {
    title_upload: "File Import",
    title_settings: "API Settings",
    title_results: "Transcription Results",
    drop_primary: "Drag & drop MP3 files",
    drop_secondary: "or tap the button below",
    max_files: "Max simultaneous files",
    max_size: "Max file size (MB)",
    language: "Transcription language",
    response: "Response format",
    provider: "API type",
    endpoint: "Endpoint",
    apikey: "API key",
    model: "Model name",
    temperature: "Temperature",
    auto_save: "Auto save"
  }
};

const state = {
  lang: localStorage.getItem("lang") || "ja",
  queue: [],
  results: [],
  running: false,
  cancel: false
};

const els = {
  dropZone: document.getElementById("dropZone"),
  fileInput: document.getElementById("fileInput"),
  selectBtn: document.getElementById("selectBtn"),
  queue: document.getElementById("queue"),
  results: document.getElementById("results"),
  maxFiles: document.getElementById("maxFiles"),
  maxSize: document.getElementById("maxSize"),
  language: document.getElementById("language"),
  responseFormat: document.getElementById("responseFormat"),
  provider: document.getElementById("provider"),
  endpoint: document.getElementById("endpoint"),
  apiKey: document.getElementById("apiKey"),
  model: document.getElementById("model"),
  temperature: document.getElementById("temperature"),
  autoSave: document.getElementById("autoSave"),
  startBtn: document.getElementById("startBtn"),
  stopBtn: document.getElementById("stopBtn"),
  clearBtn: document.getElementById("clearBtn"),
  copyAllBtn: document.getElementById("copyAllBtn"),
  downloadAllBtn: document.getElementById("downloadAllBtn"),
  clearHistoryBtn: document.getElementById("clearHistoryBtn")
};

function applyI18n() {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n;
    if (i18n[state.lang] && i18n[state.lang][key]) {
      el.textContent = i18n[state.lang][key];
    }
  });
}

function saveSettings() {
  const settings = {
    maxFiles: els.maxFiles.value,
    maxSize: els.maxSize.value,
    language: els.language.value,
    responseFormat: els.responseFormat.value,
    provider: els.provider.value,
    endpoint: els.endpoint.value,
    apiKey: els.apiKey.value,
    model: els.model.value,
    temperature: els.temperature.value,
    autoSave: els.autoSave.value
  };
  localStorage.setItem("settings", JSON.stringify(settings));
}

function loadSettings() {
  const settings = JSON.parse(localStorage.getItem("settings") || "{}");
  Object.entries(settings).forEach(([key, val]) => {
    if (els[key]) els[key].value = val;
  });
}

function loadHistory() {
  const data = JSON.parse(localStorage.getItem("transcripts") || "[]");
  state.results = data;
  renderResults();
}

function updateLangButtons() {
  document.querySelectorAll(".lang-switch .pill").forEach(btn => {
    btn.classList.toggle("primary", btn.dataset.lang === state.lang);
  });
}

function addFiles(fileList) {
  const maxFiles = parseInt(els.maxFiles.value, 10);
  const maxSize = parseInt(els.maxSize.value, 10) * 1024 * 1024;

  const files = Array.from(fileList);
  const availableSlots = Math.max(0, maxFiles - state.queue.length);

  files.slice(0, availableSlots).forEach(file => {
    const isMp3 = file.type === "audio/mpeg" || file.name.toLowerCase().endsWith(".mp3");
    if (!isMp3) {
      alert(`MP3のみ対応: ${file.name}`);
      return;
    }
    if (file.size > maxSize) {
      alert(`サイズ超過: ${file.name}`);
      return;
    }
    state.queue.push({
      id: crypto.randomUUID(),
      file,
      status: "pending",
      progress: 0,
      result: "",
      error: ""
    });
  });

  if (files.length > availableSlots) {
    alert("上限に達しました。設定の最大ファイル数を確認してください。");
  }

  renderQueue();
}

function renderQueue() {
  els.queue.innerHTML = "";
  state.queue.forEach(item => {
    const div = document.createElement("div");
    div.className = "queue-item";
    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <strong>${item.file.name}</strong>
        <span class="status ${item.status}">${statusText(item.status)}</span>
      </div>
      <div style="color:#9fb3c8; font-size:0.85rem;">${(item.file.size/1024/1024).toFixed(1)} MB</div>
      <div class="progress"><div style="width:${item.progress}%"></div></div>
      ${item.error ? `<div style="color:#ef4444; margin-top:6px; font-size:0.85rem;">${item.error}</div>` : ""}
    `;
    els.queue.appendChild(div);
  });
}

function renderResults() {
  els.results.innerHTML = "";
  state.results.forEach(res => {
    const div = document.createElement("div");
    div.className = "result-item";
    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
        <strong>${res.fileName}</strong>
        <div style="display:flex; gap:8px;">
          <button class="btn" data-action="copy" data-id="${res.id}">コピー</button>
          <button class="btn" data-action="download" data-id="${res.id}">DL</button>
        </div>
      </div>
      <pre style="white-space:pre-wrap; margin-top:8px;">${escapeHtml(res.text)}</pre>
    `;
    els.results.appendChild(div);
  });
}

function statusText(status) {
  switch (status) {
    case "pending": return "待機中";
    case "processing": return "処理中";
    case "done": return "完了";
    case "error": return "エラー";
    default: return status;
  }
}

function escapeHtml(str) {
  return str.replace(/[&<>"]/g, s => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[s] || s));
}

async function transcribeQueue() {
  if (state.running) return;
  state.running = true;
  state.cancel = false;

  for (const item of state.queue) {
    if (state.cancel) break;
    if (item.status === "done") continue;

    item.status = "processing";
    item.progress = 10;
    renderQueue();

    try {
      const text = await transcribeFile(item.file, progress => {
        item.progress = progress;
        renderQueue();
      });
      item.status = "done";
      item.progress = 100;
      item.result = text;
      state.results.unshift({ id: item.id, fileName: item.file.name, text, createdAt: Date.now() });
      if (els.autoSave.value === "on") saveHistory();
      renderResults();
    } catch (err) {
      item.status = "error";
      item.error = err.message || "エラー";
    }
    renderQueue();
  }

  state.running = false;
}

async function transcribeFile(file, onProgress) {
  const provider = els.provider.value;
  const model = els.model.value || "whisper-1";
  const language = els.language.value;
  const responseFormat = els.responseFormat.value;
  const temperature = els.temperature.value || 0;

  if (provider === "demo") {
    onProgress(60);
    await new Promise(r => setTimeout(r, 900));
    onProgress(100);
    return `[DEMO] ${file.name}\nThis is a simulated transcription. Replace with a real API for actual output.`;
  }

  const endpoint = els.endpoint.value.trim();
  if (!endpoint) throw new Error("エンドポイントを入力してください");

  const form = new FormData();
  form.append("file", file);
  form.append("model", model);
  if (language !== "auto") form.append("language", language);
  form.append("response_format", responseFormat);
  form.append("temperature", temperature);

  onProgress(40);

  const headers = {};
  if (provider === "openai" && els.apiKey.value.trim()) {
    headers["Authorization"] = `Bearer ${els.apiKey.value.trim()}`;
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: form
  });

  onProgress(80);

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`APIエラー: ${res.status} ${msg}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (responseFormat === "json" || contentType.includes("json")) {
    const data = await res.json();
    return data.text || data.transcript || JSON.stringify(data, null, 2);
  }
  return await res.text();
}

function saveHistory() {
  localStorage.setItem("transcripts", JSON.stringify(state.results));
}

function copyAll() {
  const text = state.results.map(r => `${r.fileName}\n${r.text}`).join("\n\n");
  navigator.clipboard.writeText(text);
  alert("コピーしました");
}

function downloadAll() {
  const text = state.results.map(r => `### ${r.fileName}\n${r.text}`).join("\n\n");
  downloadText("all-transcripts.txt", text);
}

function downloadText(name, text) {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function clearHistory() {
  state.results = [];
  saveHistory();
  renderResults();
}

function setupListeners() {
  els.dropZone.addEventListener("click", () => els.fileInput.click());
  els.selectBtn.addEventListener("click", () => els.fileInput.click());

  els.fileInput.addEventListener("change", e => addFiles(e.target.files));

  ["dragenter", "dragover"].forEach(evt => {
    els.dropZone.addEventListener(evt, e => {
      e.preventDefault();
      e.stopPropagation();
      els.dropZone.classList.add("active");
    });
  });

  ["dragleave", "drop"].forEach(evt => {
    els.drop
