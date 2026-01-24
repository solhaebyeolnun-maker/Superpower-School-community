/* =========================
   SRT Community Frontend
   - Static HTML/CSS/JS for GitHub Pages
   - Works with your Cloudflare Worker API
========================= */

const API_BASE = "https://srt-community-api.yekong0728.workers.dev";
const WS_BASE = API_BASE.replace(/^http/, "ws");

const LS_TOKEN = "srt_token";
const LS_USER  = "srt_user";

const state = {
  me: null,           // {id,nickname,studentId,role}
  token: null,
  feed: {
    category: "all",
    sort: "latest",   // latest|hot
    q: "",
    cursor: "",
    loading: false,
    ended: false,
    items: []         // posts
  },
  viewingPostId: null,
  ws: null,
  wsConnected: false,
  wsLastMsgAt: 0,
};

function $(sel, root=document) { return root.querySelector(sel); }
function $all(sel, root=document) { return [...root.querySelectorAll(sel)]; }

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

function formatTime(ms){
  const d = new Date(ms);
  const pad = (n)=> String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* =========================
   API helper
========================= */
async function api(path, { method="GET", body=null, auth=true, headers={} } = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const h = { ...headers };

  if (auth && state.token) h["Authorization"] = `Bearer ${state.token}`;
  if (body && !(body instanceof FormData)) h["content-type"] = "application/json";

  const res = await fetch(url, {
    method,
    headers: h,
    body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : null,
  });

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { ok:false, raw:text }; }

  if (!res.ok) {
    const msg = (data && data.error) ? data.error : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

/* =========================
   Toast
========================= */
function toast(msg, kind="info") {
  const host = $("#toast-host") || (() => {
    const d = document.createElement("div");
    d.id = "toast-host";
    d.className = "fixed bottom-4 right-4 z-[9999] flex flex-col gap-2";
    document.body.appendChild(d);
    return d;
  })();

  const el = document.createElement("div");
  el.className = `glass px-4 py-3 rounded-2xl text-sm text-white/90 border border-white/10 max-w-[360px]`;
  el.style.boxShadow = "0 18px 50px rgba(0,0,0,.35)";
  el.innerHTML = `
    <div class="flex items-start gap-3">
      <div class="mt-0.5 opacity-90">${iconSvg(kind)}</div>
      <div class="flex-1">
        <div class="font-semibold">${kind === "error" ? "에러" : kind === "success" ? "완료" : "알림"}</div>
        <div class="text-white/70 mt-0.5 break-words">${escapeHtml(msg)}</div>
      </div>
      <button class="btn !py-1 !px-2 text-xs">닫기</button>
    </div>
  `;
  host.appendChild(el);

  $("button", el).onclick = () => el.remove();
  setTimeout(() => { if (el.isConnected) el.remove(); }, kind === "error" ? 6500 : 3500);
}

function iconSvg(kind){
  const map = {
    info: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" stroke="currentColor" opacity=".8"/><path d="M12 16v-5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 8h.01" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>`,
    success: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M20 6 9 17l-5-5" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    error: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 9v4" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/><path d="M12 17h.01" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M10.3 3.4h3.4L22 21H2L10.3 3.4Z" stroke="currentColor" opacity=".85"/></svg>`
  };
  return map[kind] || map.info;
}

/* =========================
   Markdown
========================= */
function renderMarkdown(md) {
  const raw = marked.parse(md || "", { breaks: true, gfm: true });
  return DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true },
    ALLOWED_TAGS: [
      "p","br","hr","h1","h2","h3","h4","h5","h6",
      "strong","em","del","blockquote","code","pre",
      "ul","ol","li",
      "a","img",
      "table","thead","tbody","tr","th","td"
    ],
    ALLOWED_ATTR: ["href","target","rel","src","alt","title"]
  });
}

/* =========================
   Storage
========================= */
function loadSession() {
  try {
    state.token = localStorage.getItem(LS_TOKEN) || null;
    const u = localStorage.getItem(LS_USER);
    state.me = u ? JSON.parse(u) : null;
  } catch {
    state.token = null;
    state.me = null;
  }
}

function saveSession(token, user) {
  state.token = token;
  state.me = user;
  localStorage.setItem(LS_TOKEN, token);
  localStorage.setItem(LS_USER, JSON.stringify(user));
}

function clearSession() {
  state.token = null;
  state.me = null;
  localStorage.removeItem(LS_TOKEN);
  localStorage.removeItem(LS_USER);
}

/* =========================
   UI Render
========================= */
function mount() {
  const root = document.getElementById("app");
  root.innerHTML = layoutHtml();
  lucide.createIcons();

  bindHeader();
  bindComposer();
  bindFeedControls();
  bindInfiniteScroll();
  refreshMe().then(() => {
    loadFeed(true);
    connectWS();
  });
}

function layoutHtml() {
  return `
  <div class="mx-auto max-w-6xl px-4 py-5">
    <!-- Header -->
    <div class="glass rounded-[22px] px-4 py-3 flex items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <div class="h-10 w-10 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
          <i data-lucide="train-front" class="w-5 h-5 text-white/80"></i>
        </div>
        <div>
          <div class="text-white/90 font-extrabold leading-tight">SRT Community</div>
          <div class="text-white/55 text-xs -mt-0.5">읽기는 누구나 · 쓰기는 로그인 필요</div>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <div class="hidden md:flex items-center gap-2 px-3 py-2 rounded-2xl border border-white/10 bg-white/5">
          <i data-lucide="search" class="w-4 h-4 text-white/60"></i>
          <input id="q" class="bg-transparent outline-none text-sm text-white/85 placeholder:text-white/35 w-[260px]" placeholder="검색(제목/내용)" />
        </div>
        <button id="btn-search" class="btn hidden md:inline-flex items-center gap-2">
          <i data-lucide="arrow-right" class="w-4 h-4"></i><span class="text-sm">검색</span>
        </button>

        <div class="hidden md:flex items-center gap-2">
          <span id="ws-badge" class="badge"><span class="inline-block w-2 h-2 rounded-full bg-white/25"></span>실시간 연결중…</span>
        </div>

        <div id="auth-area"></div>
      </div>
    </div>

    <!-- Body -->
    <div class="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-4">
      <!-- Feed -->
      <div class="lg:col-span-8 space-y-3">
        <div class="card p-3">
          <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div class="flex flex-wrap gap-2">
              ${categoryPills()}
            </div>
            <div class="flex items-center gap-2 justify-between md:justify-end">
              <div class="md:hidden flex-1 flex items-center gap-2 px-3 py-2 rounded-2xl border border-white/10 bg-white/5">
                <i data-lucide="search" class="w-4 h-4 text-white/60"></i>
                <input id="q2" class="bg-transparent outline-none text-sm text-white/85 placeholder:text-white/35 w-full" placeholder="검색(제목/내용)" />
              </div>
              <button id="btn-search2" class="btn md:hidden">
                <i data-lucide="arrow-right" class="w-4 h-4"></i>
              </button>

              <select id="sort" class="input !w-auto text-sm">
                <option value="latest">최신</option>
                <option value="hot">핫</option>
              </select>
            </div>
          </div>
        </div>

        <div id="feed" class="space-y-3"></div>

        <div id="feed-footer" class="text-center text-white/55 text-sm py-6">
          <span class="opacity-80">불러오는 중…</span>
        </div>
      </div>

      <!-- Sidebar -->
      <div class="lg:col-span-4 space-y-3">
        <div class="card p-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-white/90 font-bold">빠른 작성</div>
              <div class="text-white/55 text-xs mt-1">마크다운 지원 · 이미지 링크는 <span class="text-white/75">![](링크)</span></div>
            </div>
            <i data-lucide="sparkles" class="w-5 h-5 text-white/60"></i>
          </div>
          <button id="btn-compose" class="btn btn-primary w-full mt-3 flex items-center justify-center gap-2">
            <i data-lucide="square-pen" class="w-4 h-4"></i> 새 글 쓰기
          </button>

          <hr class="soft my-4" />

          <div class="text-xs text-white/55 space-y-2">
            <div class="flex items-center justify-between">
              <span>API</span>
              <span class="text-white/70">${escapeHtml(API_BASE)}</span>
            </div>
            <div class="flex items-center justify-between">
              <span>권한</span>
              <span class="text-white/70">수정=작성자 · 삭제=관리자</span>
            </div>
            <div class="flex items-center justify-between">
              <span>실시간</span>
              <span class="text-white/70">최근 24시간 글만</span>
            </div>
          </div>
        </div>

        <div class="card p-4">
          <div class="flex items-center justify-between">
            <div class="text-white/90 font-bold">가이드</div>
            <i data-lucide="shield" class="w-5 h-5 text-white/60"></i>
          </div>
          <ul class="mt-3 text-sm text-white/70 space-y-2">
            <li class="flex gap-2"><span class="text-white/40">•</span> 욕설/개인정보/도배는 신고 대상</li>
            <li class="flex gap-2"><span class="text-white/40">•</span> 이미지/영상은 외부 링크로</li>
            <li class="flex gap-2"><span class="text-white/40">•</span> 익명 토글로 안전하게</li>
          </ul>
        </div>
      </div>
    </div>
  </div>

  <!-- Modals -->
  <div id="modal-root"></div>
  `;
}

function categoryPills() {
  const cats = [
    ["all", "전체"],
    ["free", "자유"],
    ["notice", "공지"],
    ["qna", "Q&A"],
    ["study", "스터디"],
  ];
  return cats.map(([k, label]) => `
    <button class="btn pill" data-cat="${k}">
      <i data-lucide="${k==="notice" ? "megaphone" : k==="qna" ? "help-circle" : k==="study" ? "graduation-cap" : k==="free" ? "smile" : "layout-list"}" class="w-4 h-4"></i>
      <span class="text-sm">${label}</span>
    </button>
  `).join("");
}

function renderAuthArea() {
  const host = $("#auth-area");
  if (!host) return;

  if (!state.me) {
    host.innerHTML = `
      <button id="btn-login" class="btn inline-flex items-center gap-2">
        <i data-lucide="log-in" class="w-4 h-4"></i><span class="text-sm">로그인</span>
      </button>
      <button id="btn-register" class="btn btn-primary inline-flex items-center gap-2">
        <i data-lucide="user-plus" class="w-4 h-4"></i><span class="text-sm">회원가입</span>
      </button>
    `;
    lucide.createIcons();
    $("#btn-login").onclick = () => openAuthModal("login");
    $("#btn-register").onclick = () => openAuthModal("register");
  } else {
    const roleBadge = state.me.role === "admin" ? `<span class="badge">ADMIN</span>` : (state.me.role === "mod" ? `<span class="badge">MOD</span>` : "");
    host.innerHTML = `
      <div class="flex items-center gap-2">
        ${roleBadge}
        <div class="px-3 py-2 rounded-2xl border border-white/10 bg-white/5">
          <div class="text-white/85 text-sm font-semibold">${escapeHtml(state.me.nickname)}</div>
          <div class="text-white/45 text-xs -mt-0.5">${escapeHtml(state.me.studentId || "학번 없음")}</div>
        </div>
        <button id="btn-logout" class="btn inline-flex items-center gap-2">
          <i data-lucide="log-out" class="w-4 h-4"></i><span class="text-sm">로그아웃</span>
        </button>
      </div>
    `;
    lucide.createIcons();
    $("#btn-logout").onclick = async () => {
      try { await api("/auth/logout", { method:"POST" }); } catch {}
      clearSession();
      renderAuthArea();
      toast("로그아웃 완료", "success");
    };
  }
}

/* =========================
   Auth
========================= */
async function refreshMe() {
  renderAuthArea();
  if (!state.token) return;

  try {
    const r = await api("/auth/me", { method:"GET" });
    if (r && r.ok && r.user) {
      state.me = r.user;
      localStorage.setItem(LS_USER, JSON.stringify(r.user));
    }
  } catch {
    // token invalid
    clearSession();
  }
  renderAuthArea();
}

function openAuthModal(mode="login") {
  const root = $("#modal-root");
  root.innerHTML = authModalHtml(mode);
  lucide.createIcons();

  $("#modal-close").onclick = closeModal;
  $("#modal-backdrop").onclick = (e) => { if (e.target.id === "modal-backdrop") closeModal(); };

  $("#switch-auth").onclick = () => openAuthModal(mode === "login" ? "register" : "login");

  $("#auth-form").onsubmit = async (e) => {
    e.preventDefault();
    const identifier = $("#identifier")?.value?.trim() || "";
    const nickname = $("#nickname")?.value?.trim() || "";
    const studentId = $("#studentId")?.value?.trim() || "";
    const password = $("#password")?.value || "";

    try {
      if (mode === "register") {
        if (!nickname) throw new Error("닉네임을 입력해줘");
        if (!password) throw new Error("비밀번호를 입력해줘");
        await api("/auth/register", { method:"POST", body:{ nickname, password, studentId: studentId || "" }, auth:false });
        toast("회원가입 완료! 로그인해줘", "success");
        openAuthModal("login");
        return;
      }

      // login
      if (!identifier) throw new Error("닉네임 또는 학번을 입력해줘");
      const r = await api("/auth/login", { method:"POST", body:{ identifier, password }, auth:false });
      saveSession(r.token, r.user);
      closeModal();
      renderAuthArea();
      toast("로그인 완료", "success");
      loadFeed(true);
      connectWS(true);
    } catch (err) {
      toast(err.message || "실패", "error");
    }
  };
}

function authModalHtml(mode) {
  const isLogin = mode === "login";
  return `
  <div id="modal-backdrop" class="fixed inset-0 z-[9998] modal-backdrop flex items-center justify-center p-4">
    <div class="glass w-full max-w-lg rounded-[22px] p-5">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-white/90 font-extrabold text-lg">${isLogin ? "로그인" : "회원가입"}</div>
          <div class="text-white/60 text-sm mt-1">${isLogin ? "닉네임/학번 + 비밀번호" : "닉네임 + 비밀번호 + (학번 옵션)"}</div>
        </div>
        <button id="modal-close" class="btn"><i data-lucide="x" class="w-4 h-4"></i></button>
      </div>

      <form id="auth-form" class="mt-4 space-y-3">
        ${isLogin ? `
          <div>
            <label class="text-xs text-white/55">닉네임 또는 학번</label>
            <input id="identifier" class="input mt-1" placeholder="ex) admin 또는 2035-101" />
          </div>
        ` : `
          <div>
            <label class="text-xs text-white/55">닉네임 (2~16 / 영문,숫자,한글,_)</label>
            <input id="nickname" class="input mt-1" placeholder="ex) superpower" />
          </div>
          <div>
            <label class="text-xs text-white/55">학번 (옵션)</label>
            <input id="studentId" class="input mt-1" placeholder="ex) 2035-101" />
          </div>
        `}

        <div>
          <label class="text-xs text-white/55">비밀번호</label>
          <input id="password" type="password" class="input mt-1" placeholder="4자 이상" />
        </div>

        <button class="btn btn-primary w-full flex items-center justify-center gap-2" type="submit">
          <i data-lucide="${isLogin ? "log-in" : "user-plus"}" class="w-4 h-4"></i>
          ${isLogin ? "로그인" : "가입하기"}
        </button>

        <button id="switch-auth" class="btn w-full" type="button">
          ${isLogin ? "처음이야? 회원가입" : "이미 계정 있어? 로그인"}
        </button>
      </form>

      <div class="mt-3 text-xs text-white/50">
        * 관리자 승격은 API <span class="text-white/75">/auth/make-admin</span> 으로 가능 (secret=0728)
      </div>
    </div>
  </div>
  `;
}

function closeModal() {
  const root = $("#modal-root");
  root.innerHTML = "";
}

/* =========================
   Feed
========================= */
function bindFeedControls() {
  // category pills
  $all(".pill").forEach(btn => {
    btn.onclick = () => {
      state.feed.category = btn.dataset.cat;
      $all(".pill").forEach(b => b.classList.remove("btn-primary"));
      btn.classList.add("btn-primary");
      loadFeed(true);
    };
  });

  // default selected
  const first = $(`.pill[data-cat="${state.feed.category}"]`);
  if (first) first.classList.add("btn-primary");

  $("#sort").onchange = () => {
    state.feed.sort = $("#sort").value;
    loadFeed(true);
  };

  $("#btn-search")?.addEventListener("click", () => {
    state.feed.q = ($("#q")?.value || "").trim();
    loadFeed(true);
  });
  $("#btn-search2")?.addEventListener("click", () => {
    state.feed.q = ($("#q2")?.value || "").trim();
    loadFeed(true);
  });

  $("#q")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { state.feed.q = ($("#q")?.value||"").trim(); loadFeed(true); }
  });
  $("#q2")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { state.feed.q = ($("#q2")?.value||"").trim(); loadFeed(true); }
  });
}

async function loadFeed(reset=false) {
  if (state.feed.loading) return;
  state.feed.loading = true;

  if (reset) {
    state.feed.cursor = "";
    state.feed.ended = false;
    state.feed.items = [];
    $("#feed").innerHTML = "";
    $("#feed-footer").innerHTML = `<span class="opacity-80">불러오는 중…</span>`;
  }

  try {
    const qs = new URLSearchParams();
    qs.set("category", state.feed.category);
    qs.set("sort", state.feed.sort);
    if (state.feed.q) qs.set("q", state.feed.q);
    if (state.feed.cursor) qs.set("cursor", state.feed.cursor);
    qs.set("pageSize", "50");

    const r = await api(`/posts?${qs.toString()}`, { method:"GET", auth:false }); // 읽기는 누구나
    const posts = r.posts || [];
    state.feed.items.push(...posts);
    state.feed.cursor = r.nextCursor || "";
    if (!state.feed.cursor || posts.length === 0) state.feed.ended = true;

    renderFeedAppend(posts);

    $("#feed-footer").innerHTML = state.feed.ended
      ? `<span class="opacity-70">끝!</span>`
      : `<span class="opacity-80">스크롤하면 더 불러와요</span>`;
  } catch (err) {
    toast(err.message || "피드 로딩 실패", "error");
    $("#feed-footer").innerHTML = `<span class="opacity-70">불러오기 실패</span>`;
  } finally {
    state.feed.loading = false;
  }
}

function renderFeedAppend(posts) {
  const host = $("#feed");
  const frag = document.createDocumentFragment();

  posts.forEach(p => {
    const el = document.createElement("div");
    el.className = "card p-4 hover:bg-white/5 transition cursor-pointer";
    el.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            ${p.pinned ? `<span class="badge">PIN</span>` : ""}
            <span class="badge">${escapeHtml(p.category)}</span>
            <span class="text-white/50 text-xs">${formatTime(p.createdAt)}</span>
          </div>
          <div class="mt-2 text-white/90 font-extrabold text-lg truncate">${escapeHtml(p.title)}</div>
          <div class="mt-2 text-white/65 text-sm line-clamp-2">
            ${escapeHtml((p.bodyMd || "").slice(0, 160))}
          </div>
          <div class="mt-3 flex items-center gap-3 text-xs text-white/55">
            <span class="inline-flex items-center gap-1"><i data-lucide="user" class="w-3.5 h-3.5"></i>${escapeHtml(p.authorName)}</span>
            <span class="inline-flex items-center gap-1"><i data-lucide="message-circle" class="w-3.5 h-3.5"></i>${p.comments}</span>
            <span class="inline-flex items-center gap-1"><i data-lucide="heart" class="w-3.5 h-3.5"></i>${p.likes}</span>
          </div>
        </div>

        <button class="btn shrink-0" data-open="${p.id}">
          <i data-lucide="arrow-up-right" class="w-4 h-4"></i>
        </button>
      </div>
    `;
    frag.appendChild(el);

    el.onclick = (e) => {
      // open post
      if (e.target.closest("button")) return;
      openPost(p.id);
    };
    el.querySelector(`[data-open="${p.id}"]`).onclick = () => openPost(p.id);
  });

  host.appendChild(frag);
  lucide.createIcons();
}

function bindInfiniteScroll() {
  window.addEventListener("scroll", () => {
    if (state.feed.loading || state.feed.ended) return;
    const nearBottom = (window.innerHeight + window.scrollY) > (document.body.offsetHeight - 900);
    if (nearBottom) loadFeed(false);
  });
}

/* =========================
   Post detail + Comments
========================= */
async function openPost(postId) {
  state.viewingPostId = postId;

  const root = $("#modal-root");
  root.innerHTML = postModalHtml();
  lucide.createIcons();

  $("#modal-close").onclick = closeModal;
  $("#modal-backdrop").onclick = (e) => { if (e.target.id === "modal-backdrop") closeModal(); };

  await renderPostDetail(postId);
}

function postModalHtml() {
  return `
  <div id="modal-backdrop" class="fixed inset-0 z-[9998] modal-backdrop flex items-center justify-center p-3">
    <div class="glass w-full max-w-4xl rounded-[22px] overflow-hidden">
      <div class="p-4 flex items-center justify-between gap-3 border-b border-white/10">
        <div class="flex items-center gap-2">
          <i data-lucide="file-text" class="w-5 h-5 text-white/70"></i>
          <div class="text-white/90 font-extrabold">게시물</div>
        </div>
        <button id="modal-close" class="btn"><i data-lucide="x" class="w-4 h-4"></i></button>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12">
        <div class="lg:col-span-7 p-4 border-b lg:border-b-0 lg:border-r border-white/10">
          <div id="post-area" class="min-h-[240px] text-white/70">불러오는 중…</div>
        </div>

        <div class="lg:col-span-5 p-4">
          <div class="flex items-center justify-between">
            <div class="text-white/90 font-bold">댓글</div>
            <span class="text-xs text-white/50" id="comment-count"></span>
          </div>

          <div id="comments" class="mt-3 space-y-3 max-h-[52vh] overflow-auto pr-1"></div>

          <hr class="soft my-4" />

          <form id="comment-form" class="space-y-2">
            <textarea id="comment-body" class="input min-h-[90px]" placeholder="댓글 (마크다운 가능)"></textarea>
            <div class="flex items-center justify-between gap-2">
              <label class="text-xs text-white/60 inline-flex items-center gap-2">
                <input id="comment-anon" type="checkbox" class="accent-indigo-500" />
                익명
              </label>
              <button class="btn btn-primary inline-flex items-center gap-2" type="submit">
                <i data-lucide="send" class="w-4 h-4"></i> 등록
              </button>
            </div>
            <div class="text-xs text-white/45">* 댓글 작성은 로그인 필요</div>
          </form>
        </div>
      </div>
    </div>
  </div>
  `;
}

async function renderPostDetail(postId) {
  const postArea = $("#post-area");
  postArea.innerHTML = "불러오는 중…";

  try {
    const r = await api(`/posts/${postId}`, { method:"GET", auth:false });
    const p = r.post;

    postArea.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="flex items-center gap-2 flex-wrap">
            ${p.pinned ? `<span class="badge">PIN</span>` : ""}
            <span class="badge">${escapeHtml(p.category)}</span>
            <span class="text-white/50 text-xs">${formatTime(p.createdAt)}</span>
          </div>
          <div class="mt-2 text-white/90 font-extrabold text-2xl">${escapeHtml(p.title)}</div>
          <div class="mt-2 text-xs text-white/55">
            작성자: <span class="text-white/75">${escapeHtml(p.authorName)}</span>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          ${p.canEdit ? `<button id="btn-edit-post" class="btn inline-flex items-center gap-2"><i data-lucide="square-pen" class="w-4 h-4"></i>수정</button>` : ""}
          ${p.canDelete ? `<button id="btn-delete-post" class="btn btn-danger inline-flex items-center gap-2"><i data-lucide="trash-2" class="w-4 h-4"></i>삭제</button>` : ""}
        </div>
      </div>

      <hr class="soft my-4" />

      <div class="md md:prose-invert md:max-w-none md text-white/80">
        <div class="md md:prose-invert md:max-w-none md">
          <div class="md">${""}</div>
        </div>
      </div>

      <div class="md mt-4 card p-3">
        <div class="flex items-center justify-between">
          <div class="text-sm text-white/80 font-semibold">반응</div>
          <div class="flex items-center gap-2">
            <button id="btn-like" class="btn inline-flex items-center gap-2">
              <i data-lucide="heart" class="w-4 h-4"></i> 좋아요
            </button>
            <button id="btn-report" class="btn inline-flex items-center gap-2">
              <i data-lucide="flag" class="w-4 h-4"></i> 신고
            </button>
          </div>
        </div>
        <div class="mt-2 text-xs text-white/55">좋아요 ${p.likes} · 댓글 ${p.comments}</div>
      </div>
    `;

    // inject markdown
    const mdHtml = renderMarkdown(p.bodyMd || "");
    // put into dedicated container
    const holder = document.createElement("div");
    holder.className = "md";
    holder.innerHTML = mdHtml;

    // replace the weird placeholder block
    const blocks = postArea.querySelectorAll(".md");
    const target = blocks[blocks.length - 1];
    target.replaceWith(holder);

    lucide.createIcons();

    // actions
    if ($("#btn-edit-post")) $("#btn-edit-post").onclick = () => openCompose({ mode:"edit", post:p });
    if ($("#btn-delete-post")) $("#btn-delete-post").onclick = async () => {
      if (!confirm("관리자 권한으로 삭제할까요?")) return;
      try {
        await api(`/posts/${p.id}`, { method:"DELETE" });
        toast("삭제 완료", "success");
        closeModal();
        loadFeed(true);
      } catch (e) {
        toast(e.message || "삭제 실패", "error");
      }
    };

    $("#btn-like").onclick = async () => {
      try {
        await api(`/likes/toggle`, { method:"POST", body:{ targetType:"post", targetId:p.id }});
        toast("좋아요 토글!", "success");
        // refresh just this post
        await renderPostDetail(postId);
      } catch (e) {
        toast(e.message || "좋아요 실패(로그인 필요)", "error");
      }
    };

    $("#btn-report").onclick = async () => {
      const reason = prompt("신고 사유(짧게)", "기타");
      if (reason === null) return;
      const detail = prompt("상세 내용(선택)", "") || "";
      try {
        await api(`/reports`, { method:"POST", body:{ targetType:"post", targetId:p.id, reason, detail }});
        toast("신고 접수됨", "success");
      } catch (e) {
        toast(e.message || "신고 실패(로그인 필요)", "error");
      }
    };

    // comments
    await loadComments(postId);
    bindCommentForm(postId);

  } catch (err) {
    postArea.innerHTML = `<div class="text-red-200">불러오기 실패: ${escapeHtml(err.message || String(err))}</div>`;
  }
}

async function loadComments(postId) {
  const host = $("#comments");
  host.innerHTML = `<div class="text-white/55 text-sm">불러오는 중…</div>`;
  try {
    const r = await api(`/posts/${postId}/comments`, { method:"GET", auth:false });
    const comments = r.comments || [];
    $("#comment-count").textContent = `${comments.length}개`;

    host.innerHTML = comments.length ? "" : `<div class="text-white/55 text-sm">아직 댓글이 없어요</div>`;
    for (const c of comments) {
      const el = document.createElement("div");
      el.className = "card p-3";
      el.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <div class="text-xs text-white/60">
            <span class="text-white/80 font-semibold">${escapeHtml(c.authorName)}</span>
            <span class="opacity-60">·</span>
            <span>${formatTime(c.createdAt)}</span>
          </div>
          <div class="flex items-center gap-2 text-xs text-white/55">
            <button class="btn !py-1 !px-2" data-like="${c.id}">
              <i data-lucide="heart" class="w-3.5 h-3.5"></i>
            </button>
            <button class="btn !py-1 !px-2" data-report="${c.id}">
              <i data-lucide="flag" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
        <div class="mt-2 md">${renderMarkdown(c.bodyMd || "")}</div>
      `;
      host.appendChild(el);

      el.querySelector(`[data-like="${c.id}"]`).onclick = async () => {
        try {
          await api(`/likes/toggle`, { method:"POST", body:{ targetType:"comment", targetId:c.id }});
          toast("댓글 좋아요 토글!", "success");
        } catch (e) {
          toast(e.message || "로그인 필요", "error");
        }
      };

      el.querySelector(`[data-report="${c.id}"]`).onclick = async () => {
        const reason = prompt("신고 사유(짧게)", "기타");
        if (reason === null) return;
        const detail = prompt("상세 내용(선택)", "") || "";
        try {
          await api(`/reports`, { method:"POST", body:{ targetType:"comment", targetId:c.id, reason, detail }});
          toast("신고 접수됨", "success");
        } catch (e) {
          toast(e.message || "로그인 필요", "error");
        }
      };
    }
    lucide.createIcons();
  } catch (err) {
    host.innerHTML = `<div class="text-red-200 text-sm">댓글 로딩 실패: ${escapeHtml(err.message || String(err))}</div>`;
  }
}

function bindCommentForm(postId) {
  const form = $("#comment-form");
  form.onsubmit = async (e) => {
    e.preventDefault();
    const bodyMd = ($("#comment-body").value || "").trim();
    const anonymous = $("#comment-anon").checked;

    if (!state.token) { toast("댓글 작성은 로그인 필요", "error"); return; }
    if (!bodyMd) { toast("댓글 내용을 입력해줘", "error"); return; }

    try {
      await api(`/posts/${postId}/comments`, { method:"POST", body:{ bodyMd, anonymous }});
      $("#comment-body").value = "";
      toast("댓글 등록 완료", "success");
      await loadComments(postId);
    } catch (err) {
      toast(err.message || "댓글 등록 실패", "error");
    }
  };
}

/* =========================
   Composer (Create/Edit)
========================= */
function bindComposer() {
  $("#btn-compose").onclick = () => openCompose({ mode:"create" });
}

function openCompose({ mode="create", post=null } = {}) {
  if (!state.token) { toast("글 작성은 로그인 필요", "error"); openAuthModal("login"); return; }

  const root = $("#modal-root");
  root.innerHTML = composeModalHtml(mode, post);
  lucide.createIcons();

  $("#modal-close").onclick = closeModal;
  $("#modal-backdrop").onclick = (e) => { if (e.target.id === "modal-backdrop") closeModal(); };

  const ta = $("#compose-body");
  const preview = $("#compose-preview");
  const toggle = $("#toggle-preview");

  const updatePreview = () => {
    preview.innerHTML = `<div class="md">${renderMarkdown(ta.value || "")}</div>`;
  };

  ta.addEventListener("input", () => {
    // light debounce
    window.clearTimeout(ta._t);
    ta._t = window.setTimeout(updatePreview, 160);
  });

  toggle.onclick = () => {
    const on = toggle.dataset.on === "1";
    toggle.dataset.on = on ? "0" : "1";
    $("#compose-left").classList.toggle("hidden", !on);
    $("#compose-right").classList.toggle("hidden", on);
    toggle.innerHTML = on
      ? `<i data-lucide="eye" class="w-4 h-4"></i> 미리보기`
      : `<i data-lucide="edit-3" class="w-4 h-4"></i> 편집`;
    lucide.createIcons();
    updatePreview();
  };

  // initial preview
  updatePreview();

  $("#compose-form").onsubmit = async (e) => {
    e.preventDefault();

    const category = $("#compose-category").value;
    const title = ($("#compose-title").value || "").trim();
    const bodyMd = (ta.value || "").trim();
    const anonymous = $("#compose-anon").checked;

    if (!title || !bodyMd) { toast("제목/내용을 입력해줘", "error"); return; }

    try {
      if (mode === "create") {
        await api("/posts", { method:"POST", body:{ category, title, bodyMd, anonymous }});
        toast("게시물 작성 완료", "success");
      } else {
        await api(`/posts/${post.id}`, { method:"PATCH", body:{ category, title, bodyMd, anonymous }});
        toast("수정 완료", "success");
      }
      closeModal();
      loadFeed(true);
    } catch (err) {
      toast(err.message || "저장 실패", "error");
    }
  };
}

function composeModalHtml(mode, post) {
  const isEdit = mode === "edit";
  const category = post?.category || "free";
  const title = post?.title || "";
  const bodyMd = post?.bodyMd || "";
  const anon = !!post?.anonymous;

  return `
  <div id="modal-backdrop" class="fixed inset-0 z-[9998] modal-backdrop flex items-center justify-center p-3">
    <div class="glass w-full max-w-5xl rounded-[22px] overflow-hidden">
      <div class="p-4 flex items-center justify-between gap-3 border-b border-white/10">
        <div class="flex items-center gap-2">
          <i data-lucide="square-pen" class="w-5 h-5 text-white/70"></i>
          <div class="text-white/90 font-extrabold">${isEdit ? "게시물 수정" : "새 게시물"}</div>
        </div>
        <div class="flex items-center gap-2">
          <button id="toggle-preview" data-on="1" class="btn inline-flex items-center gap-2">
            <i data-lucide="eye" class="w-4 h-4"></i> 미리보기
          </button>
          <button id="modal-close" class="btn"><i data-lucide="x" class="w-4 h-4"></i></button>
        </div>
      </div>

      <form id="compose-form" class="p-4 space-y-3">
        <div class="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div class="md:col-span-3">
            <label class="text-xs text-white/55">카테고리</label>
            <select id="compose-category" class="input mt-1">
              ${["free","notice","qna","study"].map(c => `<option value="${c}" ${c===category?"selected":""}>${c}</option>`).join("")}
            </select>
          </div>
          <div class="md:col-span-9">
            <label class="text-xs text-white/55">제목</label>
            <input id="compose-title" class="input mt-1" value="${escapeAttr(title)}" placeholder="제목" />
          </div>
        </div>

        <div class="flex items-center justify-between">
          <label class="text-xs text-white/60 inline-flex items-center gap-2">
            <input id="compose-anon" type="checkbox" class="accent-indigo-500" ${anon?"checked":""} />
            익명으로 작성
          </label>
          <div class="text-xs text-white/50">
            이미지/영상 링크: <span class="text-white/75">![](링크)</span>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div id="compose-left" class="">
            <label class="text-xs text-white/55">내용 (마크다운)</label>
            <textarea id="compose-body" class="input mt-1 min-h-[360px]" placeholder="# 제목&#10;**굵게**&#10;> 인용&#10;![](이미지링크)">${escapeTextarea(bodyMd)}</textarea>
          </div>

          <div id="compose-right" class="hidden">
            <label class="text-xs text-white/55">미리보기</label>
            <div id="compose-preview" class="card mt-1 p-3 min-h-[360px] overflow-auto"></div>
          </div>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2">
          <button type="button" class="btn" onclick="document.getElementById('modal-root').innerHTML=''">취소</button>
          <button class="btn btn-primary inline-flex items-center gap-2" type="submit">
            <i data-lucide="save" class="w-4 h-4"></i> ${isEdit ? "수정 저장" : "작성 완료"}
          </button>
        </div>
      </form>
    </div>
  </div>
  `;
}

/* =========================
   WebSocket Realtime (24h posts only)
========================= */
function connectWS(force=false) {
  if (state.ws && !force) return;
  if (state.ws) try { state.ws.close(); } catch {}

  const url = `${WS_BASE}/realtime?channel=feed`;
  const ws = new WebSocket(url);
  state.ws = ws;

  ws.onopen = () => {
    state.wsConnected = true;
    updateWSBadge();
    // keepalive ping
    try { ws.send("ping"); } catch {}
  };

  ws.onclose = () => {
    state.wsConnected = false;
    updateWSBadge();
    // reconnect
    setTimeout(() => connectWS(true), 1200);
  };

  ws.onerror = () => {
    state.wsConnected = false;
    updateWSBadge();
  };

  ws.onmessage = async (evt) => {
    state.wsLastMsgAt = Date.now();
    updateWSBadge();

    let msg = null;
    try { msg = JSON.parse(evt.data); } catch { return; }
    if (!msg || msg.type !== "event") return;

    const p = msg.payload || {};
    const kind = p.kind || "";

    // 최신 24시간 글 이벤트만 오게 worker에서 이미 필터하지만
    // 여기서는 안전하게 UI만 업데이트
    if (["post_created","post_updated","post_removed","comment_created"].includes(kind)) {
      // 열람 중인 글이 있으면 해당 글/댓글만 새로고침
      if (state.viewingPostId && (p.postId === state.viewingPostId)) {
        if (kind === "comment_created") await loadComments(state.viewingPostId);
        else await renderPostDetail(state.viewingPostId);
      }
      // 피드는 맨 위만 갱신(가장 안전)
      // (완전 실시간처럼 보이게 하려면 특정 postId만 찾아서 업데이트하는 로직을 더 붙일 수 있음)
      await loadFeed(true);
      toast("새 업데이트가 반영됐어", "info");
    }
  };
}

function updateWSBadge() {
  const el = $("#ws-badge");
  if (!el) return;

  const dot = state.wsConnected ? "bg-emerald-400" : "bg-white/25";
  const label = state.wsConnected ? "실시간 연결됨" : "연결 재시도…";
  el.innerHTML = `<span class="inline-block w-2 h-2 rounded-full ${dot}"></span>${label}`;
}

/* =========================
   Header binding
========================= */
function bindHeader() {
  renderAuthArea();
}

function bindComposer() {
  // replaced by the real function above, but keep safe
}

/* =========================
   Security helpers
========================= */
function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function escapeAttr(s){ return escapeHtml(s).replaceAll("\n"," "); }
function escapeTextarea(s){ return String(s ?? "").replaceAll("</textarea>","&lt;/textarea&gt;"); }

/* =========================
   Init
========================= */
loadSession();
mount();
