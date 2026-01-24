/* ===========================
   SRT Community Front (Static)
   - GitHub Pages용 순수 HTML/CSS/JS
   - API: Cloudflare Workers + D1 + DO
   =========================== */

const API_BASE = "https://srt-community-api.yekong0728.workers.dev";
const TOKEN_KEY = "srt_token_v1";
const THEME_KEY = "srt_theme_v1";

/* ---------- State ---------- */
const state = {
  token: localStorage.getItem(TOKEN_KEY) || "",
  user: null,

  category: "all",
  sort: "latest",
  q: "",

  loading: false,
  cursor: "",
  posts: [],

  view: "feed", // feed | post
  post: null,
  comments: [],
  ws: null,
  wsOnline: false,
  lastEventAt: 0,

  lastListFetchAt: 0,
};

/* ---------- DOM ---------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const el = {
  // realtime badge
  rtDot: $("#rtDot"),
  rtLabel: $("#rtLabel"),
  rtMeta: $("#rtMeta"),

  // user
  userBox: $("#userBox"),
  loginBtn: $("#loginBtn"),

  // toolbar
  chips: $$(".chip"),
  qInput: $("#qInput"),
  searchBtn: $("#searchBtn"),
  sortSel: $("#sortSel"),
  refreshBtn: $("#refreshBtn"),
  newPostBtn: $("#newPostBtn"),
  fabBtn: $("#fabBtn"),

  // feed
  feedView: $("#feedView"),
  postView: $("#postView"),
  list: $("#list"),
  banner: $("#banner"),
  feedTitle: $("#feedTitle"),
  feedSub: $("#feedSub"),
  pillCount: $("#pillCount"),
  loadMoreBtn: $("#loadMoreBtn"),
  loadMoreMeta: $("#loadMoreMeta"),

  // post view
  backBtn: $("#backBtn"),
  postCat: $("#postCat"),
  postAuthor: $("#postAuthor"),
  postTime: $("#postTime"),
  postTitle: $("#postTitle"),
  postBody: $("#postBody"),
  postLikeBtn: $("#postLikeBtn"),
  postReportBtn: $("#postReportBtn"),
  postEditBtn: $("#postEditBtn"),
  postDeleteBtn: $("#postDeleteBtn"),
  postLikeCount: $("#postLikeCount"),
  postCommentCount: $("#postCommentCount"),

  // comments
  commentMeta: $("#commentMeta"),
  commentAnon: $("#commentAnon"),
  commentPreviewBtn: $("#commentPreviewBtn"),
  commentInput: $("#commentInput"),
  commentSendBtn: $("#commentSendBtn"),
  commentPreview: $("#commentPreview"),
  commentList: $("#commentList"),

  // modal & toast
  modalRoot: $("#modalRoot"),
  toastRoot: $("#toastRoot"),

  themeBtn: $("#themeBtn"),
};

/* ---------- Helpers ---------- */
function setBanner(type, msg) {
  if (!msg) {
    el.banner.classList.add("is-hidden");
    el.banner.textContent = "";
    el.banner.style.borderColor = "";
    el.banner.style.background = "";
    return;
  }
  el.banner.classList.remove("is-hidden");
  el.banner.textContent = msg;

  // simple color tweaks
  if (type === "err") {
    el.banner.style.borderColor = "rgba(239,68,68,.35)";
    el.banner.style.background = "rgba(239,68,68,.12)";
  } else if (type === "ok") {
    el.banner.style.borderColor = "rgba(34,197,94,.35)";
    el.banner.style.background = "rgba(34,197,94,.10)";
  } else {
    el.banner.style.borderColor = "rgba(245,158,11,.35)";
    el.banner.style.background = "rgba(245,158,11,.12)";
  }
}

function toast(type, msg, ms = 2600) {
  const div = document.createElement("div");
  div.className = `toast toast--${type || "ok"}`;
  div.textContent = msg;
  el.toastRoot.appendChild(div);
  setTimeout(() => {
    div.style.opacity = "0";
    div.style.transform = "translateY(6px)";
    div.style.transition = "all .18s ease";
    setTimeout(() => div.remove(), 220);
  }, ms);
}

function fmtTime(ms) {
  const d = new Date(ms);
  const now = Date.now();
  const diff = now - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const dd = Math.floor(h / 24);
  if (dd < 7) return `${dd}일 전`;
  return d.toLocaleString();
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function mdToHtml(md) {
  // marked + DOMPurify
  const raw = marked.parse(md || "", { breaks: true, gfm: true });
  return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
}

function setTheme(theme) {
  if (!theme) theme = "dark";
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
}

function getTheme() {
  return localStorage.getItem(THEME_KEY) || "dark";
}

/* ---------- API ---------- */
async function apiFetch(path, { method = "GET", body, auth = true, timeoutMs = 12000, headers = {} } = {}) {
  const url = API_BASE + path;
  const h = new Headers(headers);
  if (body !== undefined) h.set("content-type", "application/json");
  if (auth && state.token) h.set("Authorization", `Bearer ${state.token}`);

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method,
      headers: h,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });

    const ct = res.headers.get("content-type") || "";
    const text = await res.text();
    const data = ct.includes("application/json") ? safeJson(text) : { ok: res.ok, text };

    if (!res.ok) {
      const msg = data?.error || data?.message || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  } catch (e) {
    throw e;
  } finally {
    clearTimeout(t);
  }
}

function safeJson(s) {
  try { return JSON.parse(s); } catch { return { ok: false, raw: s }; }
}

/* ---------- Auth UI ---------- */
function renderUserBox() {
  el.userBox.innerHTML = "";
  if (!state.user) {
    const b = document.createElement("button");
    b.className = "btn btn--primary";
    b.textContent = "로그인";
    b.onclick = openAuthModal;
    el.userBox.appendChild(b);
    return;
  }

  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.alignItems = "center";
  wrap.style.gap = "10px";

  const pill = document.createElement("div");
  pill.className = "pill";
  pill.title = "로그인됨";
  pill.textContent = state.user.nickname + (state.user.role === "admin" ? " (admin)" : "");
  wrap.appendChild(pill);

  const logout = document.createElement("button");
  logout.className = "btn btn--ghost";
  logout.textContent = "로그아웃";
  logout.onclick = async () => {
    try { await apiFetch("/auth/logout", { method: "POST" }); } catch {}
    state.token = "";
    state.user = null;
    localStorage.removeItem(TOKEN_KEY);
    toast("ok", "로그아웃 완료");
    renderUserBox();
    rerenderPerms();
  };
  wrap.appendChild(logout);

  el.userBox.appendChild(wrap);
}

async function bootstrapMe() {
  if (!state.token) return;
  try {
    const r = await apiFetch("/auth/me", { method: "GET" });
    if (r?.ok) state.user = r.user;
  } catch {
    // token invalid
    state.token = "";
    localStorage.removeItem(TOKEN_KEY);
  }
}

function openAuthModal() {
  openModal({
    title: "로그인 / 회원가입",
    body: authModalBody(),
    foot: authModalFoot(),
    onMount: () => {
      setupAuthModal();
    }
  });
}

function authModalBody() {
  return `
    <div class="tabs">
      <button class="tab is-active" data-tab="login" type="button">로그인</button>
      <button class="tab" data-tab="register" type="button">회원가입</button>
    </div>

    <div id="authLogin" class="authPane">
      <div class="grid2">
        <div>
          <div class="muted" style="font-size:12px;margin:6px 0 6px">닉네임 또는 학번</div>
          <input id="loginId" class="input" placeholder="예: admin 또는 2035-101" />
        </div>
        <div>
          <div class="muted" style="font-size:12px;margin:6px 0 6px">비밀번호</div>
          <input id="loginPw" class="input" type="password" placeholder="비밀번호" />
        </div>
      </div>
      <div class="muted" style="font-size:12px">※ 읽기는 누구나 가능 · 글/댓글/좋아요는 로그인 필요</div>
    </div>

    <div id="authRegister" class="authPane is-hidden">
      <div class="grid2">
        <div>
          <div class="muted" style="font-size:12px;margin:6px 0 6px">닉네임 (2~16자)</div>
          <input id="regNick" class="input" placeholder="한글/영문/숫자/_" />
        </div>
        <div>
          <div class="muted" style="font-size:12px;margin:6px 0 6px">학번 (선택)</div>
          <input id="regStudent" class="input" placeholder="예: 2035-101" />
        </div>
      </div>

      <div class="grid2">
        <div>
          <div class="muted" style="font-size:12px;margin:6px 0 6px">비밀번호</div>
          <input id="regPw" class="input" type="password" placeholder="최소 4자" />
          <div class="muted" id="pwStrength" style="font-size:12px;margin-top:6px">강도: —</div>
        </div>
        <div>
          <div class="muted" style="font-size:12px;margin:6px 0 6px">비밀번호 확인</div>
          <input id="regPw2" class="input" type="password" placeholder="한 번 더" />
        </div>
      </div>

      <div class="muted" style="font-size:12px">
        ※ 이메일 인증은 미구현(정적 MVP). 대신 비밀번호 확인/강도 표시로 UX 보완.
      </div>
    </div>
  `;
}

function authModalFoot() {
  return `
    <button class="btn btn--ghost" data-close type="button">닫기</button>
    <button class="btn btn--primary" id="authSubmitBtn" type="button">로그인</button>
  `;
}

function setupAuthModal() {
  const tabs = $$(".tab");
  const loginPane = $("#authLogin");
  const regPane = $("#authRegister");
  const submitBtn = $("#authSubmitBtn");

  function setTab(name) {
    tabs.forEach(t => t.classList.toggle("is-active", t.dataset.tab === name));
    loginPane.classList.toggle("is-hidden", name !== "login");
    regPane.classList.toggle("is-hidden", name !== "register");
    submitBtn.textContent = name === "login" ? "로그인" : "회원가입";
    submitBtn.dataset.mode = name;
  }

  tabs.forEach(t => t.onclick = () => setTab(t.dataset.tab));

  const pw = $("#regPw");
  const pw2 = $("#regPw2");
  const strength = $("#pwStrength");
  if (pw) {
    pw.addEventListener("input", () => {
      const s = pw.value || "";
      const score =
        (s.length >= 8) + /[A-Z]/.test(s) + /[a-z]/.test(s) + /\d/.test(s) + /[^a-zA-Z0-9]/.test(s);
      const label = score <= 1 ? "약함" : score <= 3 ? "보통" : "강함";
      strength.textContent = `강도: ${label}`;
    });
  }

  submitBtn.onclick = async () => {
    const mode = submitBtn.dataset.mode || "login";
    try {
      if (mode === "login") {
        const identifier = ($("#loginId").value || "").trim();
        const password = ($("#loginPw").value || "").trim();
        if (!identifier || !password) return toast("warn", "아이디/비번을 입력해줘");

        const r = await apiFetch("/auth/login", { method: "POST", body: { identifier, password }, auth: false });
        state.token = r.token;
        localStorage.setItem(TOKEN_KEY, state.token);
        state.user = r.user;
        toast("ok", `환영해요, ${state.user.nickname}!`);
        closeModal();
        renderUserBox();
        rerenderPerms();
      } else {
        const nickname = ($("#regNick").value || "").trim();
        const studentId = ($("#regStudent").value || "").trim();
        const password = ($("#regPw").value || "").trim();
        const password2 = ($("#regPw2").value || "").trim();
        if (!nickname || !password) return toast("warn", "닉네임/비번을 입력해줘");
        if (password !== password2) return toast("err", "비밀번호 확인이 일치하지 않아");
        if (password.length < 4) return toast("warn", "비밀번호는 최소 4자");
        await apiFetch("/auth/register", { method: "POST", body: { nickname, studentId: studentId || undefined, password }, auth: false });
        toast("ok", "회원가입 완료! 이제 로그인해줘");
        // switch to login
        $$(".tab").find(t => t.dataset.tab === "login")?.click();
        $("#loginId").value = nickname;
        $("#loginPw").focus();
      }
    } catch (e) {
      toast("err", `실패: ${e.message || e}`);
    }
  };

  setTab("login");
}

/* ---------- Modal ---------- */
function openModal({ title, body, foot, onMount }) {
  el.modalRoot.classList.remove("is-hidden");
  el.modalRoot.setAttribute("aria-hidden", "false");
  el.modalRoot.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal__head">
        <div class="modal__title">${escapeHtml(title)}</div>
        <button class="btn btn--ghost" data-close type="button" aria-label="닫기">✕</button>
      </div>
      <div class="modal__body">${body || ""}</div>
      <div class="modal__foot">${foot || ""}</div>
    </div>
  `;

  el.modalRoot.querySelectorAll("[data-close]").forEach(b => b.onclick = closeModal);
  el.modalRoot.onclick = (e) => { if (e.target === el.modalRoot) closeModal(); };

  onMount && onMount();
}

function closeModal() {
  el.modalRoot.classList.add("is-hidden");
  el.modalRoot.setAttribute("aria-hidden", "true");
  el.modalRoot.innerHTML = "";
}

/* ---------- Feed Rendering ---------- */
function catLabel(cat){
  return cat === "all" ? "전체" :
         cat === "free" ? "자유" :
         cat === "notice" ? "공지" :
         cat === "qna" ? "Q&A" :
         cat === "study" ? "스터디" : cat;
}

function setActiveChip(cat) {
  el.chips.forEach(c => c.classList.toggle("is-active", c.dataset.cat === cat));
}

function renderFeedMeta() {
  el.feedTitle.textContent = `게시판 · ${catLabel(state.category)}`;
  const q = state.q ? `검색: "${state.q}"` : "검색 없음";
  const sort = state.sort === "hot" ? "정렬: 핫" : "정렬: 최신";
  el.feedSub.textContent = `${q} · ${sort}`;
  el.pillCount.textContent = String(state.posts.length || 0);
}

function renderList() {
  el.list.innerHTML = "";
  renderFeedMeta();

  if (state.loading && state.posts.length === 0) {
    el.list.innerHTML = skeletonList();
    return;
  }

  if (!state.loading && state.posts.length === 0) {
    el.list.innerHTML = `
      <div class="card" style="padding:16px">
        <div style="font-weight:1000;font-size:16px;margin-bottom:6px">아직 글이 없어요.</div>
        <div class="muted" style="line-height:1.5">
          첫 글을 작성해보자! (이미지/동영상은 링크를 Markdown으로 붙여넣기: <code>![](링크)</code>)
        </div>
        <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn--primary" id="emptyWriteBtn" type="button">+ 새 글 쓰기</button>
          <button class="btn btn--ghost" id="emptyRefreshBtn" type="button">새로고침</button>
        </div>
      </div>
    `;
    $("#emptyWriteBtn").onclick = () => openComposeModal();
    $("#emptyRefreshBtn").onclick = () => reloadFeed(true);
    return;
  }

  for (const p of state.posts) {
    const div = document.createElement("div");
    div.className = "item";
    div.tabIndex = 0;
    div.role = "button";

    const snippet = (p.bodyMd || "").replace(/\s+/g, " ").trim().slice(0, 160);
    div.innerHTML = `
      <div class="item__top">
        <span class="tag">${escapeHtml(catLabel(p.category))}</span>
        ${p.pinned ? `<span class="pill" title="고정">📌</span>` : ``}
        <span class="dot">•</span>
        <span class="muted">${escapeHtml(p.authorName || "—")}</span>
        <span class="dot">•</span>
        <span class="muted">${fmtTime(p.createdAt)}</span>
        <span class="spacer"></span>
        <span class="kpi">
          <span class="pill" title="좋아요">👍 ${Number(p.likes||0)}</span>
          <span class="pill" title="댓글">💬 ${Number(p.comments||0)}</span>
        </span>
      </div>
      <div class="item__title">${escapeHtml(p.title)}</div>
      <div class="item__snippet">${escapeHtml(snippet || "…")}</div>
    `;

    div.onclick = () => openPost(p.id);
    div.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPost(p.id); } };

    el.list.appendChild(div);
  }
}

function skeletonList() {
  const row = (i) => `
    <div class="item" style="cursor:default">
      <div class="item__top">
        <span class="tag" style="opacity:.45">—</span>
        <span class="dot">•</span>
        <span class="muted" style="opacity:.45">불러오는 중…</span>
      </div>
      <div class="item__title" style="opacity:.35">██████████████████</div>
      <div class="item__snippet" style="opacity:.25">████████████████████████████████████████</div>
    </div>
  `;
  return [row(1), row(2), row(3)].join("");
}

/* ---------- Feed Loading ---------- */
let searchDebounce = null;

async function reloadFeed(reset = false) {
  if (state.loading) return;
  state.loading = true;
  setBanner("", "");
  if (reset) {
    state.cursor = "";
    state.posts = [];
  }
  renderList();
  el.loadMoreMeta.textContent = "불러오는 중…";

  try {
    const qs = new URLSearchParams();
    qs.set("category", state.category);
    if (state.q) qs.set("q", state.q);
    qs.set("sort", state.sort);
    if (state.cursor) qs.set("cursor", state.cursor);
    qs.set("pageSize", "50");

    const r = await apiFetch(`/posts?${qs.toString()}`, { method: "GET", auth: false });
    if (!r.ok) throw new Error(r.error || "불러오기 실패");

    const next = r.posts || [];
    state.posts = reset ? next : state.posts.concat(next);
    state.cursor = r.nextCursor || "";
    state.lastListFetchAt = Date.now();

    if (reset) toast("ok", "새로고침 완료");
    setBanner("", "");
  } catch (e) {
    setBanner("err", `불러오기 실패: ${e.message || e} (API 연결/CORS/DB 상태 확인)`);
  } finally {
    state.loading = false;
    renderList();
    el.loadMoreMeta.textContent = state.cursor ? "더 불러올 수 있어요" : "끝";
  }
}

/* ---------- Post View ---------- */
async function openPost(postId) {
  // route hash
  location.hash = `#post/${encodeURIComponent(postId)}`;
}

function setView(name) {
  state.view = name;
  el.feedView.classList.toggle("is-hidden", name !== "feed");
  el.postView.classList.toggle("is-hidden", name !== "post");
}

async function loadPost(postId) {
  setView("post");
  setBanner("", "");
  el.postTitle.textContent = "불러오는 중…";
  el.postBody.innerHTML = "";
  el.commentList.innerHTML = "";
  el.commentMeta.textContent = "불러오는 중…";
  el.postEditBtn.classList.add("is-hidden");
  el.postDeleteBtn.classList.add("is-hidden");

  try {
    const r = await apiFetch(`/posts/${encodeURIComponent(postId)}`, { method: "GET", auth: false });
    if (!r.ok) throw new Error(r.error || "게시글 불러오기 실패");

    state.post = r.post;
    renderPost();

    await loadComments(postId);
  } catch (e) {
    toast("err", `게시글 로드 실패: ${e.message || e}`);
    setView("feed");
  }
}

function renderPost() {
  const p = state.post;
  if (!p) return;

  el.postCat.textContent = catLabel(p.category);
  el.postAuthor.textContent = p.authorName || "—";
  el.postTime.textContent = fmtTime(p.createdAt);
  el.postTitle.textContent = p.title || "";
  el.postBody.innerHTML = mdToHtml(p.bodyMd || "");

  el.postLikeCount.textContent = `👍 ${Number(p.likes||0)}`;
  el.postCommentCount.textContent = `💬 ${Number(p.comments||0)}`;

  // 권한 UI
  const canEdit = !!(state.user && p.canEdit);
  const canDelete = !!(state.user && p.canDelete);

  el.postEditBtn.classList.toggle("is-hidden", !canEdit);
  el.postDeleteBtn.classList.toggle("is-hidden", !canDelete);

  el.postLikeBtn.onclick = () => like("post", p.id);
  el.postReportBtn.onclick = () => openReportModal("post", p.id);
  el.postEditBtn.onclick = () => openComposeModal(p);
  el.postDeleteBtn.onclick = () => deletePost(p.id);
}

async function loadComments(postId) {
  try {
    const r = await apiFetch(`/posts/${encodeURIComponent(postId)}/comments`, { method: "GET", auth: false });
    if (!r.ok) throw new Error(r.error || "댓글 실패");
    state.comments = r.comments || [];
    renderComments();
  } catch (e) {
    el.commentMeta.textContent = `댓글 불러오기 실패: ${e.message || e}`;
  }
}

function renderComments() {
  el.commentList.innerHTML = "";
  el.commentMeta.textContent = `${state.comments.length}개`;

  for (const c of state.comments) {
    const div = document.createElement("div");
    div.className = "comment";
    div.innerHTML = `
      <div class="comment__meta">
        <span>${escapeHtml(c.authorName || "—")}</span>
        <span class="dot">•</span>
        <span>${fmtTime(c.createdAt)}</span>
        <span class="spacer"></span>
        <button class="btn btn--ghost" data-like type="button" style="padding:8px 10px">👍</button>
        <button class="btn btn--ghost" data-report type="button" style="padding:8px 10px">🚩</button>
      </div>
      <div class="comment__body md">${mdToHtml(c.bodyMd || "")}</div>
    `;

    div.querySelector("[data-like]").onclick = () => like("comment", c.id);
    div.querySelector("[data-report]").onclick = () => openReportModal("comment", c.id);
    el.commentList.appendChild(div);
  }
}

/* ---------- Actions ---------- */
function requireLoginOr(openFn) {
  if (!state.user) {
    toast("warn", "로그인이 필요해요");
    openAuthModal();
    return;
  }
  openFn();
}

async function like(targetType, targetId) {
  requireLoginOr(async () => {
    try {
      const r = await apiFetch("/likes/toggle", { method: "POST", body: { targetType, targetId } });
      toast("ok", r.liked ? "좋아요!" : "좋아요 취소");
      // 카운트 즉시 반영(정확도는 다음 fetch에서 동기화)
      if (state.view === "post" && state.post) {
        if (targetType === "post" && state.post.id === targetId) {
          state.post.likes = Math.max(0, Number(state.post.likes || 0) + (r.liked ? 1 : -1));
          renderPost();
        }
      }
    } catch (e) {
      toast("err", `좋아요 실패: ${e.message || e}`);
    }
  });
}

async function deletePost(postId) {
  requireLoginOr(async () => {
    if (!confirm("관리자 삭제: 정말 삭제(removed) 처리할까요?")) return;
    try {
      await apiFetch(`/posts/${encodeURIComponent(postId)}`, { method: "DELETE" });
      toast("ok", "삭제 처리 완료");
      // 목록으로 돌아가고 refresh
      location.hash = "";
      await reloadFeed(true);
    } catch (e) {
      toast("err", `삭제 실패: ${e.message || e}`);
    }
  });
}

function openReportModal(targetType, targetId) {
  requireLoginOr(() => {
    openModal({
      title: "신고하기",
      body: `
        <div class="muted" style="font-size:12px">대상: ${escapeHtml(targetType)} / ${escapeHtml(targetId)}</div>
        <div class="grid2">
          <div>
            <div class="muted" style="font-size:12px;margin:6px 0 6px">사유</div>
            <select id="repReason" class="select__box" style="width:100%">
              <option value="스팸">스팸</option>
              <option value="욕설/혐오">욕설/혐오</option>
              <option value="개인정보">개인정보</option>
              <option value="불법/위험">불법/위험</option>
              <option value="기타">기타</option>
            </select>
          </div>
          <div>
            <div class="muted" style="font-size:12px;margin:6px 0 6px">상세(선택)</div>
            <input id="repDetail" class="input" placeholder="짧게 적어줘" />
          </div>
        </div>
      `,
      foot: `
        <button class="btn btn--ghost" data-close type="button">취소</button>
        <button class="btn btn--primary" id="repSend" type="button">신고 제출</button>
      `,
      onMount: () => {
        $("#repSend").onclick = async () => {
          try {
            const reason = $("#repReason").value;
            const detail = ($("#repDetail").value || "").trim();
            await apiFetch("/reports", { method: "POST", body: { targetType, targetId, reason, detail } });
            toast("ok", "신고 접수 완료");
            closeModal();
          } catch (e) {
            toast("err", `신고 실패: ${e.message || e}`);
          }
        };
      }
    });
  });
}

/* ---------- Compose (New/Edit) ---------- */
function openComposeModal(editPost = null) {
  requireLoginOr(() => {
    const isEdit = !!editPost;
    openModal({
      title: isEdit ? "글 수정" : "새 글 작성",
      body: composeBody(editPost),
      foot: `
        <button class="btn btn--ghost" data-close type="button">닫기</button>
        <button class="btn btn--primary" id="composeSubmit" type="button">${isEdit ? "수정 저장" : "게시"}</button>
      `,
      onMount: () => setupComposeModal(editPost),
    });
  });
}

function composeBody(p) {
  const cat = p?.category || "free";
  const title = p?.title || "";
  const body = p?.bodyMd || "";
  const anon = !!p?.anonymous;

  return `
    <div class="grid2">
      <div>
        <div class="muted" style="font-size:12px;margin:6px 0 6px">카테고리</div>
        <select id="composeCat" class="select__box" style="width:100%">
          <option value="free" ${cat==="free"?"selected":""}>자유</option>
          <option value="notice" ${cat==="notice"?"selected":""}>공지</option>
          <option value="qna" ${cat==="qna"?"selected":""}>Q&A</option>
          <option value="study" ${cat==="study"?"selected":""}>스터디</option>
        </select>
      </div>
      <div style="display:flex;align-items:flex-end;gap:10px;justify-content:flex-end">
        <label class="toggle" title="작성자 표시를 익명으로">
          <input id="composeAnon" type="checkbox" ${anon?"checked":""}/>
          <span>익명</span>
        </label>
      </div>
    </div>

    <div>
      <div class="muted" style="font-size:12px;margin:6px 0 6px">제목</div>
      <input id="composeTitle" class="input" style="width:100%" maxlength="120" value="${escapeHtml(title)}" placeholder="제목을 입력" />
    </div>

    <div class="tabs">
      <button class="tab is-active" data-mode="write" type="button">작성</button>
      <button class="tab" data-mode="preview" type="button">미리보기</button>
      <div class="spacer"></div>
      <button class="btn btn--ghost" id="mdBold" type="button">**</button>
      <button class="btn btn--ghost" id="mdH1" type="button">#</button>
      <button class="btn btn--ghost" id="mdH2" type="button">##</button>
      <button class="btn btn--ghost" id="mdQuote" type="button">&gt;</button>
      <button class="btn btn--ghost" id="mdLink" type="button">🔗</button>
      <button class="btn btn--ghost" id="mdImage" type="button">🖼️</button>
    </div>

    <textarea id="composeBody" class="textarea" rows="10" placeholder="Markdown 지원: #, ##, **굵게**, > 인용, ![](이미지링크)">${escapeHtml(body)}</textarea>
    <div id="composePreview" class="md is-hidden" style="padding:12px;border-radius:16px;border:1px solid rgba(255,255,255,.10);background:rgba(0,0,0,.12)"></div>

    <div class="muted" style="font-size:12px">
      이미지/동영상은 링크를 받아서 <code>![](링크)</code> 형태로 넣어줘. (예: catbox)
    </div>
  `;
}

function setupComposeModal(editPost) {
  const tabs = $$(".tab");
  const ta = $("#composeBody");
  const pv = $("#composePreview");

  function setMode(mode){
    tabs.forEach(t => t.classList.toggle("is-active", t.dataset.mode === mode));
    ta.classList.toggle("is-hidden", mode !== "write");
    pv.classList.toggle("is-hidden", mode !== "preview");
    if (mode === "preview") {
      pv.innerHTML = mdToHtml(ta.value || "");
    }
  }

  tabs.forEach(t => t.onclick = () => setMode(t.dataset.mode));

  // toolbar helpers
  function wrapSelection(before, after = before) {
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const v = ta.value;
    const sel = v.slice(start, end);
    const next = v.slice(0,start) + before + sel + after + v.slice(end);
    ta.value = next;
    ta.focus();
    ta.setSelectionRange(start + before.length, end + before.length);
  }

  $("#mdBold").onclick = () => wrapSelection("**","**");
  $("#mdH1").onclick = () => insertLinePrefix("# ");
  $("#mdH2").onclick = () => insertLinePrefix("## ");
  $("#mdQuote").onclick = () => insertLinePrefix("> ");
  $("#mdLink").onclick = () => {
    const url = prompt("링크 URL을 입력해줘");
    if (!url) return;
    wrapSelection("[텍스트](", `)`);
    // place cursor in url
    const pos = ta.value.indexOf("(", ta.selectionStart - 5);
    // 그냥 간단히 뒤에 붙이기
    ta.value = ta.value.replace("[텍스트](", `[텍스트](${url}`);
  };
  $("#mdImage").onclick = () => {
    const url = prompt("이미지 링크(URL)를 입력해줘 (catbox 등)");
    if (!url) return;
    const ins = `\n![](${url})\n`;
    const start = ta.selectionStart;
    const v = ta.value;
    ta.value = v.slice(0,start) + ins + v.slice(start);
    ta.focus();
  };

  function insertLinePrefix(prefix){
    const start = ta.selectionStart;
    const v = ta.value;
    const lineStart = v.lastIndexOf("\n", start - 1) + 1;
    ta.value = v.slice(0, lineStart) + prefix + v.slice(lineStart);
    ta.focus();
  }

  // submit
  $("#composeSubmit").onclick = async () => {
    try {
      const category = $("#composeCat").value;
      const title = ($("#composeTitle").value || "").trim();
      const bodyMd = ($("#composeBody").value || "").trim();
      const anonymous = $("#composeAnon").checked;

      if (!title || !bodyMd) return toast("warn", "제목/내용을 입력해줘");

      if (editPost) {
        await apiFetch(`/posts/${encodeURIComponent(editPost.id)}`, {
          method: "PATCH",
          body: { title, bodyMd, category, anonymous },
        });
        toast("ok", "수정 완료");
        closeModal();
        // refresh post view & list
        if (state.view === "post" && state.post?.id === editPost.id) {
          await loadPost(editPost.id);
        }
        await reloadFeed(true);
      } else {
        const r = await apiFetch("/posts", { method: "POST", body: { title, bodyMd, category, anonymous } });
        toast("ok", "게시 완료");
        closeModal();
        await reloadFeed(true);
        if (r.postId) openPost(r.postId);
      }
    } catch (e) {
      toast("err", `저장 실패: ${e.message || e}`);
    }
  };

  setMode("write");
}

/* ---------- Comment composer ---------- */
el.commentPreviewBtn.onclick = () => {
  const on = !el.commentPreview.classList.contains("is-hidden");
  if (on) {
    el.commentPreview.classList.add("is-hidden");
  } else {
    el.commentPreview.innerHTML = mdToHtml(el.commentInput.value || "");
    el.commentPreview.classList.remove("is-hidden");
  }
};

el.commentInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    el.commentSendBtn.click();
  }
});

el.commentSendBtn.onclick = () => {
  requireLoginOr(async () => {
    if (!state.post) return;
    const bodyMd = (el.commentInput.value || "").trim();
    const anonymous = el.commentAnon.checked;
    if (!bodyMd) return toast("warn", "댓글 내용을 입력해줘");
    try {
      await apiFetch(`/posts/${encodeURIComponent(state.post.id)}/comments`, { method: "POST", body: { bodyMd, anonymous } });
      el.commentInput.value = "";
      el.commentPreview.classList.add("is-hidden");
      toast("ok", "댓글 등록");
      await loadComments(state.post.id);
      // comment count optimistic
      state.post.comments = Number(state.post.comments || 0) + 1;
      renderPost();
    } catch (e) {
      toast("err", `댓글 실패: ${e.message || e}`);
    }
  });
};

/* ---------- Router ---------- */
async function handleRoute() {
  const h = location.hash || "";
  if (h.startsWith("#post/")) {
    const postId = decodeURIComponent(h.slice("#post/".length));
    await loadPost(postId);
  } else {
    setView("feed");
  }
}

window.addEventListener("hashchange", handleRoute);

/* ---------- Realtime (WebSocket) ---------- */
function apiWsUrl() {
  // https://host -> wss://host
  const u = new URL(API_BASE);
  const proto = u.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${u.host}/realtime?channel=feed`;
}

function setRealtimeStatus(mode, meta = "") {
  const rt = el.rtLabel.parentElement;
  rt.classList.remove("is-online", "is-offline");
  if (mode === "online") {
    rt.classList.add("is-online");
    el.rtLabel.textContent = "실시간: 연결됨";
  } else if (mode === "offline") {
    rt.classList.add("is-offline");
    el.rtLabel.textContent = "실시간: 끊김(재시도 중)";
  } else {
    el.rtLabel.textContent = "실시간: 연결 시도중";
  }
  el.rtMeta.textContent = meta || "—";
}

let wsRetry = 0;
let wsTimer = null;

function connectWs() {
  clearTimeout(wsTimer);
  try { state.ws?.close(); } catch {}
  const url = apiWsUrl();

  setRealtimeStatus("connecting", "API 연결 준비…");

  const ws = new WebSocket(url);
  state.ws = ws;

  ws.onopen = () => {
    wsRetry = 0;
    state.wsOnline = true;
    setRealtimeStatus("online", "이벤트 대기중");
    // ping loop
    wsTimer = setInterval(() => {
      try { ws.send("ping"); } catch {}
    }, 20000);
  };

  ws.onmessage = async (evt) => {
    const raw = String(evt.data || "");
    if (raw === "pong") return;

    const msg = safeJson(raw);
    if (msg?.type === "event") {
      state.lastEventAt = Date.now();
      setRealtimeStatus("online", `최근 이벤트: ${fmtTime(state.lastEventAt)}`);
      handleRealtimeEvent(msg.payload);
    }
  };

  ws.onerror = () => { /* noop */ };

  ws.onclose = () => {
    state.wsOnline = false;
    clearInterval(wsTimer);
    setRealtimeStatus("offline", "재연결 준비…");

    // exponential backoff
    wsRetry++;
    const wait = Math.min(12000, 500 + wsRetry * 900);
    wsTimer = setTimeout(connectWs, wait);
  };
}

function handleRealtimeEvent(payload) {
  if (!payload || !payload.kind) return;

  // 피드 화면이면 즉시 갱신 UX 개선:
  // - 새 글/수정/삭제 발생 시: 상단에 배너 띄우고 자동 새로고침(너무 잦으면 스로틀)
  const kind = payload.kind;

  if (kind === "post_created" || kind === "post_updated" || kind === "post_removed") {
    const now = Date.now();
    if (now - state.lastListFetchAt > 1500 && state.view === "feed") {
      setBanner("ok", "새 글/변경 감지됨 · 자동 새로고침 중…");
      reloadFeed(true);
    }
    if (state.view === "post" && state.post && payload.postId === state.post.id) {
      // 상세 보는 중이면 다시 로드
      loadPost(state.post.id);
    }
  }

  if (kind === "comment_created") {
    if (state.view === "post" && state.post && payload.postId === state.post.id) {
      loadComments(state.post.id);
    }
  }
}

/* ---------- Events ---------- */
el.chips.forEach(btn => {
  btn.onclick = () => {
    state.category = btn.dataset.cat;
    setActiveChip(state.category);
    reloadFeed(true);
  };
});

el.sortSel.onchange = () => {
  state.sort = el.sortSel.value;
  reloadFeed(true);
};

el.searchBtn.onclick = () => {
  state.q = (el.qInput.value || "").trim();
  reloadFeed(true);
};

el.qInput.addEventListener("input", () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    state.q = (el.qInput.value || "").trim();
    reloadFeed(true);
  }, 450);
});

el.refreshBtn.onclick = () => reloadFeed(true);

el.newPostBtn.onclick = () => openComposeModal();
el.fabBtn.onclick = () => openComposeModal();

el.backBtn.onclick = () => { location.hash = ""; };

el.loadMoreBtn.onclick = () => {
  if (!state.cursor) return toast("warn", "더 불러올 글이 없어요");
  reloadFeed(false);
};

// Theme
el.themeBtn.onclick = () => {
  const cur = getTheme();
  setTheme(cur === "dark" ? "light" : "dark");
};

/* ---------- Init ---------- */
async function init() {
  setTheme(getTheme());
  setActiveChip(state.category);

  // API 헬스 체크(친절한 에러)
  try {
    const h = await apiFetch("/health", { method: "GET", auth: false, timeoutMs: 8000 });
    if (!h?.ok) throw new Error("health not ok");
  } catch (e) {
    setBanner("err", `API 서버 연결 실패: ${e.message || e}`);
    toast("err", "API 연결 실패(서버/CORS/경로 확인)");
  }

  await bootstrapMe();
  renderUserBox();

  // 첫 로드: 피드
  await reloadFeed(true);

  // 라우팅
  await handleRoute();

  // 실시간 연결
  connectWs();

  // UX: 스크롤 하단 near -> 자동 더보기
  window.addEventListener("scroll", () => {
    if (state.view !== "feed") return;
    if (!state.cursor || state.loading) return;
    const nearBottom = window.innerHeight + window.scrollY > document.body.offsetHeight - 900;
    if (nearBottom) reloadFeed(false);
  });
}

function rerenderPerms() {
  // 상세에서 권한 버튼 갱신
  if (state.view === "post") renderPost();
}

init();
