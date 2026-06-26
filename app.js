const CONFIG = window.SFX_SUPABASE_CONFIG || {};
const MUSIC_SECONDS = 30;
const BUCKET = "sfx-audio";
const DEVICE_ID_KEY = "sfx_collector_device_id";
const DEVICE_NAME_KEY = "sfx_collector_device_name";
const REMEMBER_LOGIN_KEY = "sfx_collector_remember_login";
const DEVICE_CHECK_MS = 30000;
const SMART_CATEGORY_RULES = [
  ["技能", ["技能", "护盾", "盾", "魔法", "法术", "释放", "施法", "蓄力", "光环", "skill", "spell", "magic", "cast", "shield", "aura"]],
  ["战斗", ["飞刀", "刀", "剑", "斩", "命中", "击中", "打击", "攻击", "受击", "爆炸", "子弹", "枪", "武器", "hit", "impact", "attack", "slash", "gun", "shot", "weapon"]],
  ["UI按钮", ["按钮", "点击", "确认", "取消", "菜单", "界面", "弹窗", "选择", "切换", "提示", "奖励", "领取", "获得", "宝箱", "button", "click", "ui", "menu", "select", "reward"]],
  ["环境", ["环境", "风", "雨", "水", "火", "雷", "森林", "城市", "室内", "房间", "ambient", "wind", "rain", "water", "fire", "forest", "city", "room", "loop"]],
  ["脚步", ["脚步", "走路", "跑步", "落地", "跳跃", "footstep", "step", "walk", "run", "jump", "land"]],
  ["机械", ["机械", "机器", "机关", "引擎", "电机", "齿轮", "金属", "开关", "门", "machine", "engine", "motor", "gear", "metal", "switch", "door"]],
  ["语音", ["语音", "人声", "对白", "台词", "喊叫", "笑", "哭", "voice", "vocal", "dialog", "speech", "laugh", "shout"]]
];

const sb = CONFIG.url && CONFIG.anonKey && !CONFIG.url.includes("YOUR_PROJECT_ID")
  ? window.supabase.createClient(CONFIG.url, CONFIG.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "sfx_collector_auth"
    }
  })
  : null;

const state = {
  user: null,
  sounds: [],
  urls: new Map(),
  query: "",
  kind: "all",
  category: "all",
  project: "all",
  favorite: "all",
  activeTag: "",
  sort: "newest",
  playingId: null,
  progressFrame: 0,
  pendingProgress: new Map(),
  currentDeviceId: "",
  deviceCheckTimer: 0,
  devices: []
};

const el = {
  cloudStatus: document.getElementById("cloudStatus"),
  authPanel: document.getElementById("authPanel"),
  importPanel: document.getElementById("importPanel"),
  filtersPanel: document.getElementById("filtersPanel"),
  accountPanel: document.getElementById("accountPanel"),
  accountEmail: document.getElementById("accountEmail"),
  emailInput: document.getElementById("emailInput"),
  signInBtn: document.getElementById("signInBtn"),
  magicLinkBtn: document.getElementById("magicLinkBtn"),
  rememberLogin: document.getElementById("rememberLogin"),
  signOutBtn: document.getElementById("signOutBtn"),
  deviceNameInput: document.getElementById("deviceNameInput"),
  saveDeviceNameBtn: document.getElementById("saveDeviceNameBtn"),
  refreshDevicesBtn: document.getElementById("refreshDevicesBtn"),
  deviceList: document.getElementById("deviceList"),
  dropzone: document.getElementById("dropzone"),
  importCategory: document.getElementById("importCategory"),
  importProject: document.getElementById("importProject"),
  autoMusic: document.getElementById("autoMusic"),
  smartCategory: document.getElementById("smartCategory"),
  pickFiles: document.getElementById("pickFiles"),
  pickFolder: document.getElementById("pickFolder"),
  fileInput: document.getElementById("fileInput"),
  folderInput: document.getElementById("folderInput"),
  modebar: document.getElementById("modebar"),
  searchInput: document.getElementById("searchInput"),
  categoryFilter: document.getElementById("categoryFilter"),
  projectFilter: document.getElementById("projectFilter"),
  favFilter: document.getElementById("favFilter"),
  tagChips: document.getElementById("tagChips"),
  sortSelect: document.getElementById("sortSelect"),
  autoClassifyBtn: document.getElementById("autoClassifyBtn"),
  clearFilters: document.getElementById("clearFilters"),
  refreshBtn: document.getElementById("refreshBtn"),
  list: document.getElementById("list"),
  countStat: document.getElementById("countStat"),
  sizeStat: document.getElementById("sizeStat"),
  player: document.getElementById("player"),
  toast: document.getElementById("toast"),
  editDialog: document.getElementById("editDialog"),
  editForm: document.getElementById("editForm"),
  editId: document.getElementById("editId"),
  editName: document.getElementById("editName"),
  editCategory: document.getElementById("editCategory"),
  editProject: document.getElementById("editProject"),
  editTags: document.getElementById("editTags"),
  editNotes: document.getElementById("editNotes"),
  categorySuggestions: document.getElementById("categorySuggestions"),
  projectSuggestions: document.getElementById("projectSuggestions"),
  closeDialog: document.getElementById("closeDialog"),
  cancelEdit: document.getElementById("cancelEdit")
};

init();

async function init() {
  bindEvents();
  state.currentDeviceId = getOrCreateDeviceId();
  el.deviceNameInput.value = localStorage.getItem(DEVICE_NAME_KEY) || defaultDeviceName();
  el.rememberLogin.checked = localStorage.getItem(REMEMBER_LOGIN_KEY) !== "false";
  if (!sb) {
    showToast("请先复制 config.example.js 为 config.js，并填入 Supabase 配置");
    renderAuth(false);
    return;
  }
  const { data } = await sb.auth.getSession();
  state.user = data.session?.user || null;
  if (state.user && !isAllowedEmail(state.user.email)) {
    await signOutDisallowedUser();
    return;
  }
  renderAuth(Boolean(state.user));
  if (state.user) {
    await registerCurrentDevice();
    await loadDevices();
    startDeviceChecks();
    await loadSounds();
  }
  sb.auth.onAuthStateChange(async (_event, session) => {
    state.user = session?.user || null;
    if (state.user && !isAllowedEmail(state.user.email)) {
      await signOutDisallowedUser();
      return;
    }
    if (state.user && localStorage.getItem(REMEMBER_LOGIN_KEY) === "false") {
      localStorage.removeItem("sfx_collector_auth");
    }
    renderAuth(Boolean(state.user));
    if (state.user) {
      await registerCurrentDevice();
      await loadDevices();
      startDeviceChecks();
      await loadSounds();
    }
    else {
      stopDeviceChecks();
      state.sounds = [];
      state.devices = [];
      render();
    }
  });
}

function bindEvents() {
  el.signInBtn.addEventListener("click", sendMagicLink);
  el.magicLinkBtn.addEventListener("click", sendMagicLink);
  el.rememberLogin.addEventListener("change", () => {
    localStorage.setItem(REMEMBER_LOGIN_KEY, el.rememberLogin.checked ? "true" : "false");
  });
  el.signOutBtn.addEventListener("click", signOutCurrentDevice);
  el.saveDeviceNameBtn.addEventListener("click", saveCurrentDeviceName);
  el.refreshDevicesBtn.addEventListener("click", loadDevices);
  el.refreshBtn.addEventListener("click", loadSounds);
  el.pickFiles.addEventListener("click", () => el.fileInput.click());
  el.pickFolder.addEventListener("click", () => el.folderInput.click());
  el.fileInput.addEventListener("change", async () => {
    await uploadFiles([...el.fileInput.files]);
    el.fileInput.value = "";
  });
  el.folderInput.addEventListener("change", async () => {
    await uploadFiles([...el.folderInput.files]);
    el.folderInput.value = "";
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    el.dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      el.dropzone.classList.add("drag");
    });
  });
  ["dragleave", "drop"].forEach((eventName) => {
    el.dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      el.dropzone.classList.remove("drag");
    });
  });
  el.dropzone.addEventListener("drop", async (event) => uploadFiles([...event.dataTransfer.files]));

  el.searchInput.addEventListener("input", () => {
    state.query = el.searchInput.value.trim().toLowerCase();
    renderList();
  });
  el.modebar.querySelectorAll("[data-kind]").forEach((button) => {
    button.addEventListener("click", () => {
      state.kind = button.dataset.kind;
      renderModebar();
      renderList();
    });
  });
  el.categoryFilter.addEventListener("change", () => {
    state.category = el.categoryFilter.value;
    renderList();
  });
  el.projectFilter.addEventListener("change", () => {
    state.project = el.projectFilter.value;
    renderList();
  });
  el.favFilter.addEventListener("change", () => {
    state.favorite = el.favFilter.value;
    renderList();
  });
  el.sortSelect.addEventListener("change", () => {
    state.sort = el.sortSelect.value;
    renderList();
  });
  el.autoClassifyBtn.addEventListener("click", autoClassifyAll);
  el.clearFilters.addEventListener("click", () => {
    state.query = "";
    state.kind = "all";
    state.category = "all";
    state.project = "all";
    state.favorite = "all";
    state.activeTag = "";
    state.sort = "newest";
    el.searchInput.value = "";
    el.favFilter.value = "all";
    el.sortSelect.value = "newest";
    render();
  });
  el.editForm.addEventListener("submit", saveEdit);
  el.closeDialog.addEventListener("click", () => el.editDialog.close());
  el.cancelEdit.addEventListener("click", () => el.editDialog.close());
  el.player.addEventListener("play", startProgressLoop);
  el.player.addEventListener("pause", () => {
    cancelProgressLoop();
    updatePlayingWaveform();
  });
  el.player.addEventListener("seeked", () => {
    if (state.playingId) state.pendingProgress.delete(state.playingId);
    updatePlayingWaveform();
  });
  el.player.addEventListener("ended", () => {
    cancelProgressLoop();
    if (state.playingId) state.pendingProgress.delete(state.playingId);
    updatePlayingWaveform();
    state.playingId = null;
    renderList();
  });
}

async function sendMagicLink() {
  const email = el.emailInput.value.trim();
  if (!email) {
    showToast("先填写邮箱，再发送登录邮件。");
    return;
  }
  if (!isAllowedEmail(email)) {
    showToast("这个音效库只允许指定邮箱登录。");
    return;
  }
  await applyRememberPreference();
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: new URL(".", window.location.href).href }
  });
  if (error) showAuthError(error);
  else showToast("登录邮件已经发出。打开邮件里的链接就能进入音效库。");
}

function isAllowedEmail(email) {
  const allowed = Array.isArray(CONFIG.allowedEmails) ? CONFIG.allowedEmails : [];
  if (!allowed.length) return true;
  const normalized = String(email || "").trim().toLowerCase();
  return allowed.map((item) => String(item).trim().toLowerCase()).includes(normalized);
}

async function signOutDisallowedUser() {
  showToast("这个音效库只允许指定邮箱登录。");
  state.user = null;
  state.sounds = [];
  state.devices = [];
  stopDeviceChecks();
  renderAuth(false);
  render();
  await sb.auth.signOut();
}

function showAuthError(error) {
  const message = error?.message || "登录失败";
  if (/email not confirmed/i.test(message)) {
    showToast("这个音效库账号还没有确认邮箱。请先打开注册邮箱里的 Supabase 确认邮件，或让我帮你关闭邮箱确认。");
    return;
  }
  if (/invalid login credentials/i.test(message)) {
    showToast("邮箱登录没有成功，请确认输入的是允许登录的邮箱。");
    return;
  }
  if (/rate limit|too many|security purposes/i.test(message)) {
    showToast("登录邮件发送太频繁了，稍等一会儿再试。");
    return;
  }
  showToast(message);
}

async function applyRememberPreference() {
  localStorage.setItem(REMEMBER_LOGIN_KEY, el.rememberLogin.checked ? "true" : "false");
  if (el.rememberLogin.checked) return;
  await sb.auth.signOut();
  try {
    localStorage.removeItem("sfx_collector_auth");
  } catch (_error) {
    // localStorage may be unavailable in private browsing.
  }
}

function getOrCreateDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function defaultDeviceName() {
  const platform = navigator.platform || "未知设备";
  const browser = browserName();
  return `${browser} / ${platform}`;
}

function browserName() {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return "Edge";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua)) return "Safari";
  return "浏览器";
}

async function registerCurrentDevice() {
  if (!state.user) return;
  const deviceName = el.deviceNameInput.value.trim() || defaultDeviceName();
  localStorage.setItem(DEVICE_NAME_KEY, deviceName);
  const { error } = await sb.from("user_devices").upsert({
    owner_id: state.user.id,
    device_id: state.currentDeviceId,
    name: deviceName,
    user_agent: navigator.userAgent,
    last_seen_at: new Date().toISOString(),
    revoked_at: null
  }, { onConflict: "owner_id,device_id" });
  if (error) showToast(error.message);
}

async function saveCurrentDeviceName() {
  const name = el.deviceNameInput.value.trim() || defaultDeviceName();
  el.deviceNameInput.value = name;
  localStorage.setItem(DEVICE_NAME_KEY, name);
  await registerCurrentDevice();
  await loadDevices();
  showToast("设备名已保存");
}

async function loadDevices() {
  if (!state.user) return;
  await touchCurrentDevice();
  const { data, error } = await sb
    .from("user_devices")
    .select("*")
    .order("last_seen_at", { ascending: false });
  if (error) {
    showToast(error.message);
    return;
  }
  state.devices = data || [];
  renderDevices();
}

async function touchCurrentDevice() {
  if (!state.user || !state.currentDeviceId) return;
  await sb
    .from("user_devices")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("device_id", state.currentDeviceId)
    .is("revoked_at", null);
}

function startDeviceChecks() {
  stopDeviceChecks();
  state.deviceCheckTimer = window.setInterval(checkCurrentDevice, DEVICE_CHECK_MS);
}

function stopDeviceChecks() {
  if (state.deviceCheckTimer) {
    window.clearInterval(state.deviceCheckTimer);
    state.deviceCheckTimer = 0;
  }
}

async function checkCurrentDevice() {
  if (!state.user || !state.currentDeviceId) return;
  const { data, error } = await sb
    .from("user_devices")
    .select("revoked_at")
    .eq("device_id", state.currentDeviceId)
    .maybeSingle();
  if (error) return;
  if (data?.revoked_at) {
    showToast("这台电脑已被你从设备设置中下线");
    await sb.auth.signOut();
    return;
  }
  await touchCurrentDevice();
}

async function revokeDevice(deviceId) {
  if (!state.user || !deviceId) return;
  if (deviceId === state.currentDeviceId) {
    await signOutCurrentDevice();
    return;
  }
  const { error } = await sb
    .from("user_devices")
    .update({ revoked_at: new Date().toISOString() })
    .eq("device_id", deviceId);
  if (error) showToast(error.message);
  else {
    showToast("已下线选中的电脑");
    await loadDevices();
  }
}

async function signOutCurrentDevice() {
  if (state.user && state.currentDeviceId) {
    await sb
      .from("user_devices")
      .update({ revoked_at: new Date().toISOString() })
      .eq("device_id", state.currentDeviceId);
  }
  await sb.auth.signOut();
}

function renderDevices() {
  if (!el.deviceList) return;
  if (!state.devices.length) {
    el.deviceList.innerHTML = `<div class="hint">当前还没有设备记录</div>`;
    return;
  }
  el.deviceList.innerHTML = state.devices.map((device) => {
    const isCurrent = device.device_id === state.currentDeviceId;
    const revoked = Boolean(device.revoked_at);
    const title = `${escapeHtml(device.name || "未命名设备")}${isCurrent ? "（当前）" : ""}`;
    return `
      <div class="device-item${revoked ? " revoked" : ""}">
        <div class="device-main">
          <div>
            <strong title="${escapeAttr(device.user_agent || "")}">${title}</strong>
            <div class="device-meta">
              ${revoked ? "已下线" : "在线凭证有效"} · 最后使用 ${formatDateTime(device.last_seen_at)}
            </div>
          </div>
          <button class="${isCurrent ? "ghost" : "danger"}" type="button" data-device-revoke="${escapeAttr(device.device_id)}">
            ${isCurrent ? "退出" : "下线"}
          </button>
        </div>
      </div>`;
  }).join("");
  el.deviceList.querySelectorAll("[data-device-revoke]").forEach((button) => {
    button.addEventListener("click", () => revokeDevice(button.dataset.deviceRevoke));
  });
}

function renderAuth(isSignedIn) {
  el.cloudStatus.textContent = isSignedIn ? "已连接" : "未连接";
  el.cloudStatus.classList.toggle("connected", isSignedIn);
  el.authPanel.hidden = isSignedIn;
  el.importPanel.hidden = !isSignedIn;
  el.filtersPanel.hidden = !isSignedIn;
  el.accountPanel.hidden = !isSignedIn;
  el.accountEmail.textContent = state.user?.email || "";
  if (isSignedIn) renderDevices();
}

async function loadSounds() {
  if (!state.user) return;
  const { data, error } = await sb
    .from("sounds")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    showToast(error.message);
    return;
  }
  state.sounds = (data || []).map(fromDbSound);
  await ensureSignedUrls();
  render();
}

async function ensureSignedUrls() {
  const missing = state.sounds.filter((sound) => !state.urls.has(sound.id));
  for (const sound of missing) {
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(sound.storagePath, 3600);
    if (!error && data?.signedUrl) state.urls.set(sound.id, data.signedUrl);
  }
}

async function uploadFiles(files) {
  if (!state.user) {
    showToast("请先登录");
    return;
  }
  const libraryFiles = files.filter((file) => /\.json$/i.test(file.name) || file.type === "application/json");
  let importedLibraries = 0;
  for (const file of libraryFiles) {
    importedLibraries += await importLibraryFile(file);
  }
  const audioFiles = files.filter((file) => file.type.startsWith("audio/") || /\.(wav|mp3|ogg|flac|m4a|aac)$/i.test(file.name));
  if (!audioFiles.length) {
    if (!importedLibraries) showToast("没有找到可上传的音频或旧库 JSON");
    return;
  }
  showToast(`正在上传 ${audioFiles.length} 个音频`);
  let count = 0;
  for (const file of audioFiles) {
    const duration = await probeDuration(file).catch(() => 0);
    const smartCategory = el.smartCategory.checked ? smartCategoryForName(file.name) : "";
    const category = el.autoMusic.checked && duration > MUSIC_SECONDS ? "音乐" : smartCategory || el.importCategory.value.trim() || "未分类";
    const storagePath = `${state.user.id}/${Date.now()}-${crypto.randomUUID()}${safeExtension(file.name)}`;
    const { error: uploadError } = await sb.storage.from(BUCKET).upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false
    });
    if (uploadError) {
      showToast(uploadError.message);
      continue;
    }
    const { error: dbError } = await sb.from("sounds").insert({
      owner_id: state.user.id,
      name: stripExtension(file.name),
      original_name: file.name,
      category,
      project: el.importProject.value.trim() || "网页收集",
      tags: [],
      notes: "",
      favorite: false,
      storage_path: storagePath,
      mime_type: file.type || "audio/*",
      size_bytes: file.size,
      duration_seconds: duration
    });
    if (dbError) showToast(dbError.message);
    else count += 1;
  }
  showToast(`已上传 ${count} 个音频`);
  await loadSounds();
}

async function importLibraryFile(file) {
  try {
    const payload = JSON.parse(await file.text());
    if (!payload || !Array.isArray(payload.sounds)) return 0;
    return await uploadLibrarySounds(payload.sounds);
  } catch (error) {
    showToast(`旧库导入失败：${error.message}`);
    return 0;
  }
}

async function uploadLibrarySounds(sounds) {
  if (!sounds.length) return 0;
  showToast(`正在导入旧库 ${sounds.length} 个音频`);
  let count = 0;
  let skipped = 0;
  const errors = [];
  for (const sound of sounds) {
    if (!sound.base64) {
      skipped += 1;
      errors.push(`${sound.name || "未命名音频"}：缺少音频数据`);
      continue;
    }
    const originalName = sound.originalName || `${sound.name || "未命名音频"}.mp3`;
    const size = Number(sound.size || 0);
    const exists = await soundExists(originalName, size);
    if (exists) {
      skipped += 1;
      errors.push(`${originalName}：云端已存在同名同大小文件`);
      continue;
    }
    const blob = base64ToBlob(sound.base64, sound.type || "audio/mpeg");
    const storagePath = `${state.user.id}/${Date.now()}-${crypto.randomUUID()}${safeExtension(originalName)}`;
    const { error: uploadError } = await sb.storage.from(BUCKET).upload(storagePath, blob, {
      contentType: blob.type || "application/octet-stream",
      upsert: false
    });
    if (uploadError) {
      errors.push(`${originalName}：${uploadError.message}`);
      skipped += 1;
      continue;
    }
    const duration = Number(sound.duration || 0);
    const category = duration > MUSIC_SECONDS ? "音乐" : sound.category || smartCategoryForName(originalName) || "未分类";
    const { error: dbError } = await sb.from("sounds").insert({
      owner_id: state.user.id,
      name: sound.name || stripExtension(originalName),
      original_name: originalName,
      category,
      project: sound.project || "旧库导入",
      tags: sound.tags || [],
      notes: sound.notes || "",
      favorite: Boolean(sound.favorite),
      storage_path: storagePath,
      mime_type: blob.type || sound.type || "audio/*",
      size_bytes: blob.size || size,
      duration_seconds: duration
    });
    if (dbError) {
      errors.push(`${originalName}：${dbError.message}`);
      skipped += 1;
    }
    else count += 1;
  }
  window.lastLibraryImportResult = { added: count, skipped, errors };
  if (errors.length) console.warn("旧库导入问题", errors);
  showToast(`旧库导入完成：新增 ${count} 个，跳过 ${skipped} 个`);
  await loadSounds();
  return count;
}

async function soundExists(originalName, size) {
  const { data, error } = await sb
    .from("sounds")
    .select("id")
    .eq("original_name", originalName)
    .eq("size_bytes", size)
    .maybeSingle();
  return !error && Boolean(data);
}

function base64ToBlob(base64, type) {
  const binary = atob(base64);
  const length = binary.length;
  const chunkSize = 8192;
  const chunks = [];
  for (let offset = 0; offset < length; offset += chunkSize) {
    const slice = binary.slice(offset, offset + chunkSize);
    const bytes = new Uint8Array(slice.length);
    for (let index = 0; index < slice.length; index += 1) bytes[index] = slice.charCodeAt(index);
    chunks.push(bytes);
  }
  return new Blob(chunks, { type });
}

function fromDbSound(row) {
  return {
    id: row.id,
    name: row.name,
    originalName: row.original_name,
    category: row.category,
    project: row.project,
    tags: row.tags || [],
    notes: row.notes || "",
    favorite: Boolean(row.favorite),
    storagePath: row.storage_path,
    audioBase64: row.audio_base64 || "",
    type: row.mime_type,
    size: Number(row.size_bytes || 0),
    duration: Number(row.duration_seconds || 0),
    createdAt: new Date(row.created_at).getTime(),
    waveform: null
  };
}

function render() {
  renderModebar();
  renderFilters();
  renderList();
}

function renderModebar() {
  el.modebar.querySelectorAll("[data-kind]").forEach((button) => {
    button.classList.toggle("active", button.dataset.kind === state.kind);
  });
}

function renderFilters() {
  const smartCategories = SMART_CATEGORY_RULES.map(([category]) => category).concat(["音乐", "未分类"]);
  const categories = unique(state.sounds.map((sound) => sound.category || "未分类").concat(smartCategories)).sort(localeSort);
  const projects = unique(state.sounds.map((sound) => sound.project || "未标注来源")).sort(localeSort);
  el.categoryFilter.innerHTML = `<option value="all">全部分类</option>${categories.map((category) => `<option value="${escapeAttr(category)}"${category === state.category ? " selected" : ""}>${escapeHtml(category)}</option>`).join("")}`;
  el.projectFilter.innerHTML = `<option value="all">全部项目/来源</option>${projects.map((project) => `<option value="${escapeAttr(project)}"${project === state.project ? " selected" : ""}>${escapeHtml(project)}</option>`).join("")}`;
  el.categorySuggestions.innerHTML = categories.map((category) => `<option value="${escapeAttr(category)}"></option>`).join("");
  el.projectSuggestions.innerHTML = projects.map((project) => `<option value="${escapeAttr(project)}"></option>`).join("");

  const tagCounts = new Map();
  state.sounds.flatMap((sound) => sound.tags || []).forEach((tag) => tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1));
  const tags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1] || localeSort(a[0], b[0])).slice(0, 24);
  el.tagChips.innerHTML = tags.length ? tags.map(([tag, count]) => `<button class="chip${tag === state.activeTag ? " active" : ""}" type="button" data-tag="${escapeAttr(tag)}">${escapeHtml(tag)} · ${count}</button>`).join("") : `<span class="hint">还没有标签</span>`;
  el.tagChips.querySelectorAll("[data-tag]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeTag = state.activeTag === button.dataset.tag ? "" : button.dataset.tag;
      renderFilters();
      renderList();
    });
  });
}

function renderList() {
  const sounds = filteredSounds();
  const totalSize = state.sounds.reduce((sum, sound) => sum + (sound.size || 0), 0);
  el.countStat.textContent = `${state.sounds.length} 个音频`;
  el.sizeStat.textContent = formatBytes(totalSize);
  if (!state.user) {
    el.list.innerHTML = `<div class="empty">登录后查看你的云端音效库</div>`;
    return;
  }
  if (!sounds.length) {
    el.list.innerHTML = `<div class="empty">${state.sounds.length ? "没有符合筛选条件的音频" : "先上传一些音频吧"}</div>`;
    return;
  }
  el.list.innerHTML = sounds.map((sound) => {
    const isPlaying = sound.id === state.playingId;
    const tags = (sound.tags || []).slice(0, 2).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
    return `
      <article class="sound">
        <div class="card-head">
          <button class="play" type="button" data-action="play" data-id="${sound.id}" title="${isPlaying ? "暂停" : "播放"}">${isPlaying ? "Ⅱ" : "▶"}</button>
          <div class="sound-title">
            <strong title="${escapeAttr(sound.name)}">${escapeHtml(sound.name)}</strong>
            ${sound.favorite ? `<span class="fav" title="已收藏">★</span>` : ""}
          </div>
        </div>
        <div class="waveform-wrap" data-wave-wrap="${sound.id}">
          <canvas class="waveform" data-wave-id="${sound.id}" width="320" height="72" title="点击波形位置从这里播放"></canvas>
          <span class="waveform-cursor" data-wave-cursor="${sound.id}"></span>
        </div>
        <div class="meta">
          <span>${escapeHtml(sound.category || "未分类")}</span>
          <span class="source">来自 ${escapeHtml(sound.project || "未标注来源")}</span>
          <span>${formatDuration(sound.duration)}</span>
          <span>${formatBytes(sound.size || 0)}</span>
          ${tags}
        </div>
        <div class="actions">
          <button class="icon ghost" type="button" data-action="favorite" data-id="${sound.id}" title="收藏">${sound.favorite ? "★" : "☆"}</button>
          <button class="icon ghost" type="button" data-action="edit" data-id="${sound.id}" title="编辑">✎</button>
          <button class="icon ghost" type="button" data-action="download" data-id="${sound.id}" title="下载">⇩</button>
          <button class="icon danger" type="button" data-action="delete" data-id="${sound.id}" title="删除">×</button>
        </div>
      </article>`;
  }).join("");
  el.list.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => handleAction(button.dataset.action, button.dataset.id));
  });
  bindWaveformInteractions(sounds);
  drawWaveforms(sounds);
}

function filteredSounds() {
  const query = state.query;
  return [...state.sounds]
    .filter((sound) => {
      if (state.kind === "music" && sound.category !== "音乐") return false;
      if (state.kind === "sfx" && sound.category === "音乐") return false;
      if (state.category !== "all" && sound.category !== state.category) return false;
      if (state.project !== "all" && (sound.project || "未标注来源") !== state.project) return false;
      if (state.favorite === "fav" && !sound.favorite) return false;
      if (state.activeTag && !(sound.tags || []).includes(state.activeTag)) return false;
      if (!query) return true;
      const haystack = [sound.name, sound.originalName, sound.notes, ...(sound.tags || [])].join(" ").toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => {
      if (state.sort === "name") return localeSort(a.name, b.name);
      if (state.sort === "category") return localeSort(a.category, b.category) || localeSort(a.name, b.name);
      if (state.sort === "project") return localeSort(a.project, b.project) || localeSort(a.category, b.category) || localeSort(a.name, b.name);
      if (state.sort === "duration") return (b.duration || 0) - (a.duration || 0);
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
}

async function handleAction(action, id) {
  const sound = state.sounds.find((item) => item.id === id);
  if (!sound) return;
  if (action === "play") return playSound(sound);
  if (action === "favorite") {
    await updateSound(sound, { favorite: !sound.favorite });
  }
  if (action === "edit") openEdit(sound);
  if (action === "download") {
    const url = await signedUrlFor(sound);
    if (url) downloadUrl(url, sound.originalName || `${sound.name}.audio`);
  }
  if (action === "delete") {
    if (!confirm(`删除“${sound.name}”？`)) return;
    await deleteSound(sound);
  }
}

async function updateSound(sound, patch) {
  const { error } = await sb.from("sounds").update(toDbPatch(patch)).eq("id", sound.id);
  if (error) showToast(error.message);
  else await loadSounds();
}

function autoCategoryForSound(sound) {
  const duration = Number(sound.duration || 0);
  const label = [sound.name, sound.originalName].filter(Boolean).join(" ");
  if (duration > MUSIC_SECONDS) return "音乐";
  if (duration >= 10 && isMusicName(label)) return "音乐";

  const guessed = smartCategoryForName(label);
  if (guessed) return guessed;
  if ((sound.category || "") === "音乐") return "未分类";

  return sound.category || "未分类";
}

function isMusicName(name) {
  const value = normalizeName(name);
  return ["bgm", "music", "ost", "loop", "配乐", "背景音乐"].some((keyword) => value.includes(normalizeName(keyword)));
}

async function autoClassifyAll() {
  if (!state.user) {
    showToast("请先登录");
    return;
  }

  const updates = state.sounds
    .map((sound) => ({ sound, category: autoCategoryForSound(sound) }))
    .filter(({ sound, category }) => category && category !== (sound.category || "未分类"));

  if (!updates.length) {
    showToast("已经分类好了");
    return;
  }

  el.autoClassifyBtn.disabled = true;
  el.autoClassifyBtn.textContent = "分类中...";

  let success = 0;
  let failed = 0;
  for (const { sound, category } of updates) {
    const { error } = await sb.from("sounds").update({ category }).eq("id", sound.id);
    if (error) failed += 1;
    else success += 1;
  }

  el.autoClassifyBtn.disabled = false;
  el.autoClassifyBtn.textContent = "一键分类";
  await loadSounds();

  showToast(failed ? `已更新 ${success} 个，失败 ${failed} 个` : `一键分类完成：更新 ${success} 个`);
}

async function deleteSound(sound) {
  if (!sound.audioBase64 && sound.storagePath) await sb.storage.from(BUCKET).remove([sound.storagePath]);
  const { error } = await sb.from("sounds").delete().eq("id", sound.id);
  if (error) showToast(error.message);
  else {
    if (state.playingId === sound.id) stopPlayback();
    state.urls.delete(sound.id);
    await loadSounds();
  }
}

function openEdit(sound) {
  el.editId.value = sound.id;
  el.editName.value = sound.name || "";
  el.editCategory.value = sound.category || "";
  el.editProject.value = sound.project || "";
  el.editTags.value = (sound.tags || []).join(", ");
  el.editNotes.value = sound.notes || "";
  el.editDialog.showModal();
}

async function saveEdit(event) {
  event.preventDefault();
  const sound = state.sounds.find((item) => item.id === el.editId.value);
  if (!sound) return;
  await updateSound(sound, {
    name: el.editName.value.trim() || sound.name,
    category: el.editCategory.value.trim() || "未分类",
    project: el.editProject.value.trim() || "未标注来源",
    tags: parseTags(el.editTags.value),
    notes: el.editNotes.value.trim()
  });
  el.editDialog.close();
}

function toDbPatch(patch) {
  const mapped = {};
  if ("name" in patch) mapped.name = patch.name;
  if ("category" in patch) mapped.category = patch.category;
  if ("project" in patch) mapped.project = patch.project;
  if ("tags" in patch) mapped.tags = patch.tags;
  if ("notes" in patch) mapped.notes = patch.notes;
  if ("favorite" in patch) mapped.favorite = patch.favorite;
  return mapped;
}

function bindWaveformInteractions(sounds) {
  const byId = new Map(sounds.map((sound) => [sound.id, sound]));
  el.list.querySelectorAll("[data-wave-id]").forEach((canvas) => {
    const sound = byId.get(canvas.dataset.waveId);
    const wrap = canvas.closest(".waveform-wrap");
    const cursor = wrap?.querySelector(".waveform-cursor");
    if (!sound || !wrap || !cursor) return;
    const updateCursor = (event) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = event.touches?.[0]?.clientX ?? event.clientX;
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
      cursor.style.left = `${x}px`;
      wrap.classList.add("active");
      return rect.width ? x / rect.width : 0;
    };
    canvas.addEventListener("mousemove", updateCursor);
    canvas.addEventListener("mouseenter", updateCursor);
    canvas.addEventListener("mouseleave", () => wrap.classList.remove("active"));
    canvas.addEventListener("touchstart", (event) => updateCursor(event), { passive: true });
    canvas.addEventListener("click", (event) => {
      const ratio = updateCursor(event);
      state.pendingProgress.set(sound.id, ratio);
      playSound(sound, sound.duration ? ratio * sound.duration : 0);
    });
  });
}

async function drawWaveforms(sounds) {
  for (const sound of sounds.slice(0, 80)) {
    const canvas = el.list.querySelector(`[data-wave-id="${CSS.escape(sound.id)}"]`);
    if (!canvas) continue;
    drawWaveformPlaceholder(canvas);
    const peaks = sound.waveform || await createWaveformPeaks(sound).catch(() => null);
    if (!peaks) continue;
    sound.waveform = peaks;
    drawWaveform(canvas, peaks, playbackProgressFor(sound));
  }
}

async function createWaveformPeaks(sound) {
  const url = await signedUrlFor(sound);
  if (!url) return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  const context = new AudioCtx();
  try {
    const response = await window.fetch(url);
    const buffer = await response.arrayBuffer();
    const audioBuffer = await context.decodeAudioData(buffer.slice(0));
    const channel = audioBuffer.getChannelData(0);
    const bars = 96;
    const blockSize = Math.max(1, Math.floor(channel.length / bars));
    const peaks = [];
    for (let index = 0; index < bars; index += 1) {
      let peak = 0;
      const start = index * blockSize;
      const end = Math.min(channel.length, start + blockSize);
      for (let sample = start; sample < end; sample += 1) peak = Math.max(peak, Math.abs(channel[sample]));
      peaks.push(Math.min(1, peak * 1.35));
    }
    return peaks;
  } finally {
    if (context.close) context.close();
  }
}

function drawWaveformPlaceholder(canvas) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const baseline = height - 8;
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = "#d7dadd";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, baseline + 0.5);
  ctx.lineTo(width, baseline + 0.5);
  ctx.stroke();
  ctx.strokeStyle = "#c1c5c8";
  ctx.lineWidth = 2;
  for (let x = 10; x < width - 8; x += 5) {
    const barHeight = 6 + (x % 38);
    ctx.beginPath();
    ctx.moveTo(x, baseline);
    ctx.lineTo(x, baseline - barHeight);
    ctx.stroke();
  }
}

function drawWaveform(canvas, peaks, progress = 0) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const baseline = height - 8;
  const step = width / Math.max(1, peaks.length - 1);
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = "#d7dadd";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, baseline + 0.5);
  ctx.lineTo(width, baseline + 0.5);
  ctx.stroke();
  drawWaveformBars(ctx, peaks, width, height, baseline, step, "#b9bec3");
  const playedWidth = Math.max(0, Math.min(width, width * progress));
  if (playedWidth > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, playedWidth, height);
    ctx.clip();
    drawWaveformBars(ctx, peaks, width, height, baseline, step, "#1d74ff");
    ctx.restore();
  }
}

function drawWaveformBars(ctx, peaks, width, height, baseline, step, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  peaks.forEach((peak, index) => {
    const barHeight = Math.max(3, peak * (height - 14));
    const x = Math.round(index * step) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, baseline);
    ctx.lineTo(x, baseline - barHeight);
    ctx.stroke();
  });
}

async function playSound(sound, startAt = null) {
  const shouldSeek = Number.isFinite(startAt);
  if (state.playingId === sound.id && !shouldSeek) {
    stopPlayback();
    renderList();
    return;
  }
  const url = await signedUrlFor(sound);
  if (!url) return;
  if (state.playingId !== sound.id) {
    stopPlayback();
    el.player.src = url;
  } else {
    el.player.pause();
  }
  state.playingId = sound.id;
  const play = () => {
    if (shouldSeek) el.player.currentTime = Math.max(0, Math.min(startAt, sound.duration || startAt));
    el.player.play()
      .then(() => {
        state.pendingProgress.delete(sound.id);
        updatePlayingWaveform();
        startProgressLoop();
      })
      .catch(() => showToast("浏览器暂时不能播放这个文件"));
  };
  if (el.player.readyState >= 1) play();
  else el.player.addEventListener("loadedmetadata", play, { once: true });
  renderList();
}

function stopPlayback() {
  cancelProgressLoop();
  el.player.pause();
  el.player.removeAttribute("src");
  state.pendingProgress.clear();
  state.playingId = null;
}

function playbackProgressFor(sound) {
  if (state.pendingProgress.has(sound.id)) return state.pendingProgress.get(sound.id);
  if (sound.id !== state.playingId) return 0;
  const duration = sound.duration || el.player.duration || 0;
  if (!duration) return 0;
  return Math.max(0, Math.min(1, el.player.currentTime / duration));
}

function updatePlayingWaveform() {
  if (!state.playingId) return;
  const sound = state.sounds.find((item) => item.id === state.playingId);
  if (!sound?.waveform) return;
  const canvas = el.list.querySelector(`[data-wave-id="${CSS.escape(sound.id)}"]`);
  if (canvas) drawWaveform(canvas, sound.waveform, playbackProgressFor(sound));
}

function startProgressLoop() {
  cancelProgressLoop();
  const tick = () => {
    updatePlayingWaveform();
    if (state.playingId && !el.player.paused && !el.player.ended) state.progressFrame = requestAnimationFrame(tick);
  };
  state.progressFrame = requestAnimationFrame(tick);
}

function cancelProgressLoop() {
  if (state.progressFrame) {
    cancelAnimationFrame(state.progressFrame);
    state.progressFrame = 0;
  }
}

async function signedUrlFor(sound) {
  if (state.urls.has(sound.id)) return state.urls.get(sound.id);
  if (sound.audioBase64) {
    const url = `data:${sound.type || "audio/mpeg"};base64,${sound.audioBase64}`;
    state.urls.set(sound.id, url);
    return url;
  }
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(sound.storagePath, 3600);
  if (error) {
    showToast(error.message);
    return "";
  }
  state.urls.set(sound.id, data.signedUrl);
  return data.signedUrl;
}

function probeDuration(file) {
  return new Promise((resolve) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      URL.revokeObjectURL(url);
      resolve(duration);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
    audio.src = url;
  });
}

function smartCategoryForName(name) {
  const value = normalizeName(name);
  const match = SMART_CATEGORY_RULES.find(([, keywords]) => keywords.some((keyword) => value.includes(normalizeName(keyword))));
  return match ? match[0] : "";
}

function normalizeName(value) {
  return String(value || "").toLowerCase().replace(/\.[^.]+$/, "").replace(/[_\-()[\]{}【】（）]/g, " ");
}

function parseTags(value) {
  return unique(value.split(/[，,]/).map((tag) => tag.trim()).filter(Boolean));
}

function stripExtension(name) {
  return name.replace(/\.[^.]+$/, "");
}

function safeFileName(name) {
  return name.replace(/[\\/:*?"<>|]+/g, "_");
}

function safeExtension(name) {
  const match = String(name || "").toLowerCase().match(/\.(mp3|wav|ogg|flac|m4a|aac)$/);
  return match ? `.${match[1]}` : "";
}

function downloadUrl(url, filename) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function formatBytes(bytes) {
  if (!bytes) return "0 MB";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatDuration(seconds) {
  if (!seconds) return "--:--";
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function formatDateTime(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function localeSort(a = "", b = "") {
  return String(a).localeCompare(String(b), "zh-Hans-CN", { numeric: true, sensitivity: "base" });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

let toastTimer = 0;
function showToast(message) {
  clearTimeout(toastTimer);
  el.toast.textContent = message;
  el.toast.classList.add("show");
  toastTimer = setTimeout(() => el.toast.classList.remove("show"), 2400);
}
