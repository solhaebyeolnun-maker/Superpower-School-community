/* ==========================
   SRT Community - Beta Front
   ========================== */

const API_BASE = "https://srt-community-api.yekong0728.workers.dev"; // 너가 말한 그대로 맞음
const WS_BASE  = API_BASE.replace(/^http/, "ws");

const LS = {
  theme: "srt_theme",
  token: "srt_token",
  bookmarks: "srt_bookmarks_v1",
  drafts: "srt_drafts_v1"
};

const state = {
  me: null,
  token: localStorage.getItem(LS.token) || "",
  cat: "all",
  q: "",
  sort: "latest",
  tab: "feed", // feed | bookmarks | mine
  cursor: "",
  posts: [],
  currentPost: null,
  ws: null,
  wsOk: false,
  caps: {
    sorts: new Set(["latest", "hot"]), // 서버 기능감지 후 확장
    admin: false,
    reports: false,
    pin: false,
    sort_comments: false,
    sort_likes: false
  }
};

/* -------------------- DOM -------------------- */
const $ = (id) => document.getElementById(id);

const el = {
  boot: $("boot"),
  bootFill: $("bootBarFill"),
  bootPct: $("bootPct"),
  bootStep: $("bootStep"),

  rtDot: $("rtDot"),
  rtLabel: $("rtLabel"),
  rtMeta: $("rtMeta"),

  themeBtn: $("themeBtn"),
  userBox: $("userBox"),
  loginBtn: $("loginBtn"),
  homeBtn: $("homeBtn"),

  qInput: $("qInput"),
  searchBtn: $("searchBtn"),
  sortSel: $("sortSel"),
  tabSel: $("tabSel"),

  refreshBtn: $("refreshBtn"),
  newPostBtn: $("newPostBtn"),

  feedView: $("feedView"),
  postView: $("postView"),

  feedTitle: $("feedTitle"),
  feedSub: $("feedSub"),
  pillCount: $("pillCount"),
  banner: $("banner"),
  list: $("list"),
  loadMoreBtn: $("loadMoreBtn"),
  loadMoreMeta: $("loadMoreMeta"),

  backBtn: $("backBtn"),
  postCat: $("postCat"),
  postAuthor: $("postAuthor"),
  postTime: $("postTime"),
  postTitle: $("postTitle"),
  postBody: $("postBody"),
  postLikeCount: $("postLikeCount"),
  postCommentCount: $("postCommentCount"),

  postBookmarkBtn: $("postBookmarkBtn"),
  postLikeBtn: $("postLikeBtn"),
  postReportBtn: $("postReportBtn"),
  postEditBtn: $("postEditBtn"),
  postDeleteBtn: $("postDeleteBtn"),
  postPinBtn: $("postPinBtn"),
  adminReportsBtn: $("adminReportsBtn"),

  commentMeta: $("commentMeta"),
  commentAnon: $("commentAnon"),
  commentPreviewBtn: $("commentPreviewBtn"),
  commentInput: $("commentInput"),
  commentSendBtn: $("commentSendBtn"),
  commentPreview: $("commentPreview"),
  commentList: $("commentList"),

  modalRoot: $("modalRoot"),
  toastRoot: $("toastRoot"),

  fabBtn: $("fabBtn"),
};

/* -------------------- Boot Loader -------------------- */
const boot = {
  pct: 0,
  alive: true,
  wheelTimer: null,
  barTimer: null,
  steps: [
    "테마/설정 불러오는 중…",
    "세션 복원 시도…",
    "기능 감지 중…",
    "피드 데이터 요청…",
    "실시간 연결 준비…",
    "UI 렌더링…",
    "…뭔가 멋진걸 하는 중…"
  ],
  idx: 0
};

function bootSetStep(text){
  if (!el.bootStep) return;
  el.bootStep.textContent = text;
}
function bootSetPct(p){
  boot.pct = Math.max(0, Math.min(100, p));
  if (el.bootFill) el.bootFill.style.width = `${boot.pct}%`;
  if (el.bootPct) el.bootPct.textContent = `${Math.round(boot.pct)}%`;
}
function bootRandomAdvance(min=2, max=9){
  const add = min + Math.random()*(max-min);
  bootSetPct(boot.pct + add);
}
function bootStart(){
  boot.alive = true;
  bootSetPct(0);
  bootSetStep(boot.steps[0]);

  // progress bar random speed, with occasional stalls
  boot.barTimer = setInterval(() => {
    if (!boot.alive) return;
    const r = Math.random();
    if (r < 0.12) return;                 // stall
    if (r < 0.22) bootRandomAdvance(0.2, 1.2); // slow
    else if (r < 0.85) bootRandomAdvance(1.0, 3.6);
    else bootRandomAdvance(3.0, 7.0);     // fast
    if (boot.pct > 95) bootSetPct(95);    // keep some room for "real finish"
  }, 220);

  // wheel random pause by toggling animation-play-state
  boot.wheelTimer = setInterval(() => {
    const wheel = document.querySelector(".boot__wheel");
    if (!wheel) return;
    const r = Math.random();
    if (r < 0.12) wheel.style.animationPlayState = "paused";
    else wheel.style.animationPlayState = "running";
    if (r > 0.88) wheel.style.animationDuration = "0.65s";
    else if (r > 0.70) wheel.style.animationDuration = "1.2s";
    else wheel.style.animationDuration = "1.65s";
  }, 420);
}

function bootNextStep(){
  boot.idx = Math.min(boot.steps.length-1, boot.idx+1);
  bootSetStep(boot.steps[boot.idx]);
  bootRandomAdvance(2, 6);
}

function bootDone(){
  boot.alive = false;
  clearInterval(boot.barTimer);
  clearInterval(boot.wheelTimer);
  bootSetPct(100);

  setTimeout(() => {
    el.boot.classList.add("is-hide");
    setTimeout(() => {
      el.boot.style.display = "none";
      el.boot.setAttribute("aria-hidden", "true");
    }, 380);
  }, 250);
}

/* -------------------- Toast -------------------- */
function toast(msg){
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  el.toastRoot.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

/* -------------------- Banner -------------------- */
function banner(msg, kind="info"){
  el.banner.textContent = msg;
  el.banner.classList.remove("is-hidden");
  el.banner.style.background =
    kind === "error"
      ? "color-mix(in oklab, var(--danger) 12%, var(--card2))"
      : "color-mix(in oklab, var(--accent2) 10%, var(--card2))";
}
function bannerHide(){
  el.banner.classList.add("is-hidden");
}

/* -------------------- Theme -------------------- */
function applyTheme(theme){
  if (theme === "light") document.documentElement.setAttribute("data-theme","light");
  else document.documentElement.removeAttribute("data-theme");
}
function initTheme(){
  const t = localStorage.getItem(LS.theme);
  if (t === "light") applyTheme("light");
}
function toggleTheme(){
  const now = document.documentElement.getAttribute("data-theme")==="light" ? "light" : "dark";
  const next = now === "light" ? "dark" : "light";
  if (next === "light") {
    localStorage.setItem(LS.theme, "light");
    applyTheme("light");
  } else {
    localStorage.removeItem(LS.theme);
    applyTheme("dark");
  }
}

/* -------------------- Markdown (H1~H6 + 댓글 포함) -------------------- */
function initMarkdown(){
  marked.setOptions({
    gfm: true,
    breaks: true,
    headerIds: false,     // id 자동 주입은 XSS/충돌 위험 줄이기
    mangle: false
  });

  // link target + rel
  const renderer = new marked.Renderer();
  renderer.link = (href, title, text) => {
    const t = title ? ` title="${escapeHtml(title)}"` : "";
    const safe = safeUrl(href);
    if (!safe) return text;
    return `<a href="${safe}" target="_blank" rel="noopener noreferrer"${t}>${text}</a>`;
  };
  renderer.image = (href, title, text) => {
    const safe = safeUrl(href);
    if (!safe) return "";
    const t = title ? ` title="${escapeHtml(title)}"` : "";
    const alt = escapeHtml(text || "");
    return `<img src="${safe}" alt="${alt}" loading="lazy"${t} />`;
  };

  marked.use({ renderer });
}

function renderMd(md){
  const raw = marked.parse(String(md || ""));
  const clean = DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true },
    ALLOWED_TAGS: [
      "h1","h2","h3","h4","h5","h6","p","br","hr",
      "a","strong","em","del","code","pre",
      "blockquote",
      "ul","ol","li",
      "table","thead","tbody","tr","th","td",
      "img"
    ],
    ALLOWED_ATTR: ["href","title","target","rel","src","alt","loading"]
  });
  return clean;
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, (m)=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

function safeUrl(url){
  try{
    const u = new URL(url, location.href);
    if (!["http:","https:"].includes(u.protocol)) return "";
    return u.toString();
  }catch{ return ""; }
}

/* -------------------- API -------------------- */
async function api(path, opts={}){
  const headers = Object.assign(
    { "content-type": "application/json" },
    opts.headers || {}
  );
  if (state.token) headers["Authorization"] = `Bearer ${state.token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  let data = null;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) data = await res.json().catch(()=>null);
  else data = await res.text().catch(()=>null);
  if (!res.ok){
    const msg = (data && data.error) ? `${data.error}` : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

/* -------------------- Capabilities (기능 있는 척 제거 핵심) -------------------- */
/**
 * 서버가 아직 /caps 없을 수도 있어서:
 * - 없으면 기본 latest/hot만 노출
 * - 있으면 sort/어드민/핀/신고함 활성화
 */
async function detectCaps(){
  bootNextStep();

  // 기본값
  state.caps = {
    sorts: new Set(["latest","hot"]),
    admin: false,
    reports: false,
    pin: false,
    sort_comments: false,
    sort_likes: false
  };

  // 로그인 상태면 me로 role 판단
  if (state.token){
    try{
      const meRes = await api("/auth/me");
      state.me = meRes.user || null;
    }catch{
      state.me = null;
      state.token = "";
      localStorage.removeItem(LS.token);
    }
  }

  // 서버에 /caps가 없을 수 있으니 실패해도 조용히 넘어감
  try{
    const caps = await api("/caps");
    // 기대 형태: { ok:true, sorts:["latest","hot","comments","likes"], adminEndpoints:true, pin:true, reports:true }
    if (caps && caps.ok){
      const sorts = Array.isArray(caps.sorts) ? caps.sorts : ["latest","hot"];
      state.caps.sorts = new Set(sorts);
      state.caps.sort_comments = state.caps.sorts.has("comments");
      state.caps.sort_likes = state.caps.sorts.has("likes");
      state.caps.pin = !!caps.pin;
      state.caps.reports = !!caps.reports;
    }
  }catch{}

  // me 기반 어드민 표시
  state.caps.admin = !!state.me && (state.me.role === "admin" || state.me.role === "mod");

  applyCapsToUI();
}

function applyCapsToUI(){
  // sort select: 서버가 지원하는 것만 남김
  const allOptions = [
    {v:"latest", t:"최신"},
    {v:"hot", t:"핫(Hot)"},
    {v:"comments", t:"댓글 많은"},
    {v:"likes", t:"좋아요 많은"},
  ];
  el.sortSel.innerHTML = "";
  for (const o of allOptions){
    if (state.caps.sorts.has(o.v)){
      const opt = document.createElement("option");
      opt.value = o.v; opt.textContent = o.t;
      el.sortSel.appendChild(opt);
    }
  }
  if (!state.caps.sorts.has(state.sort)) state.sort = "latest";
  el.sortSel.value = state.sort;

  // 어드민 버튼(핀/신고함)은 “API 준비 + admin”일 때만
  if (state.caps.admin && state.caps.pin) el.postPinBtn.classList.remove("is-hidden");
  else el.postPinBtn.classList.add("is-hidden");

  if (state.caps.admin && state.caps.reports) el.adminReportsBtn.classList.remove("is-hidden");
  else el.adminReportsBtn.classList.add("is-hidden");
}

/* -------------------- Bookmarks -------------------- */
function getBookmarks(){
  try{
    const raw = localStorage.getItem(LS.bookmarks) || "[]";
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  }catch{ return new Set(); }
}
function setBookmarks(set){
  localStorage.setItem(LS.bookmarks, JSON.stringify([...set]));
}
function isBookmarked(postId){
  return getBookmarks().has(postId);
}
function toggleBookmark(postId){
  const set = getBookmarks();
  if (set.has(postId)) set.delete(postId);
  else set.add(postId);
  setBookmarks(set);
  return set.has(postId);
}

/* -------------------- UI: Auth Box -------------------- */
function renderUserBox(){
  el.userBox.innerHTML = "";
  if (!state.me){
    const btn = document.createElement("button");
    btn.className = "btn btn--primary";
    btn.id = "loginBtn";
    btn.type = "button";
    btn.textContent = "로그인";
    btn.onclick = () => openAuthModal();
    el.userBox.appendChild(btn);
    return;
  }

  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.gap = "10px";
  wrap.style.alignItems = "center";

  const chip = document.createElement("div");
  chip.className = "pill";
  chip.textContent = `${state.me.nickname} (${state.me.role})`;

  const out = document.createElement("button");
  out.className = "btn btn--ghost";
  out.textContent = "로그아웃";
  out.onclick = async () => {
    try{ await api("/auth/logout", { method:"POST", body:"{}" }); }catch{}
    state.token = "";
    state.me = null;
    localStorage.removeItem(LS.token);
    toast("로그아웃 완료");
    renderUserBox();
    applyCapsToUI();
    // 글 권한 표시가 달라질 수 있으니 새로고침
    await refreshFeed(true);
  };

  wrap.appendChild(chip);
  wrap.appendChild(out);
  el.userBox.appendChild(wrap);
}

/* -------------------- Modal -------------------- */
function modalOpen(title, bodyNode, actions=[]){
  el.modalRoot.innerHTML = "";
  el.modalRoot.classList.remove("is-hidden");
  el.modalRoot.setAttribute("aria-hidden","false");

  const m = document.createElement("div");
  m.className = "modal";
  m.addEventListener("click", (e)=>e.stopPropagation());

  const head = document.createElement("div");
  head.className = "modal__head";
  const h = document.createElement("div");
  h.style.fontWeight = "900";
  h.textContent = title;

  const x = document.createElement("button");
  x.className = "btn btn--ghost";
  x.textContent = "닫기";
  x.onclick = modalClose;

  head.appendChild(h);
  head.appendChild(x);

  const body = document.createElement("div");
  body.className = "modal__body";
  body.appendChild(bodyNode);

  const foot = document.createElement("div");
  foot.className = "modal__foot";
  for (const a of actions) foot.appendChild(a);

  m.appendChild(head);
  m.appendChild(body);
  if (actions.length) m.appendChild(foot);

  el.modalRoot.appendChild(m);
  el.modalRoot.onclick = modalClose;
}

function modalClose(){
  el.modalRoot.classList.add("is-hidden");
  el.modalRoot.setAttribute("aria-hidden","true");
  el.modalRoot.innerHTML = "";
}

function openAuthModal(){
  const wrap = document.createElement("div");

  wrap.innerHTML = `
    <div class="muted" style="margin-bottom:10px">읽기는 누구나 · 쓰기는 로그인 필요</div>
    <div style="display:grid; gap:10px">
      <div>
        <div class="muted" style="font-size:12px;margin-bottom:6px">로그인 (닉네임 또는 학번)</div>
        <input id="a_id" class="input" style="width:100%" placeholder="admin 또는 2035-101" />
      </div>
      <div>
        <div class="muted" style="font-size:12px;margin-bottom:6px">비밀번호</div>
        <input id="a_pw" class="input" style="width:100%" type="password" placeholder="****" />
      </div>
      <div style="display:flex; gap:10px; flex-wrap:wrap">
        <button class="btn btn--primary" id="a_login" type="button">로그인</button>
        <button class="btn btn--ghost" id="a_register" type="button">회원가입</button>
        <button class="btn btn--ghost" id="a_makeAdmin" type="button">관리자 승격</button>
      </div>
      <div class="muted" style="font-size:12px">※ 관리자 승격은 운영자 비밀코드 필요</div>
    </div>
  `;

  const btnLogin = wrap.querySelector("#a_login");
  const btnReg = wrap.querySelector("#a_register");
  const btnMake = wrap.querySelector("#a_makeAdmin");

  btnLogin.onclick = async () => {
    const identifier = wrap.querySelector("#a_id").value.trim();
    const password = wrap.querySelector("#a_pw").value.trim();
    try{
      const r = await api("/auth/login", { method:"POST", body: JSON.stringify({ identifier, password }) });
      state.token = r.token;
      localStorage.setItem(LS.token, state.token);
      state.me = r.user;
      toast("로그인 완료");
      modalClose();
      renderUserBox();
      await detectCaps();
      await refreshFeed(true);
    }catch(e){
      toast("로그인 실패: " + e.message);
    }
  };

  btnReg.onclick = async () => {
    const node = document.createElement("div");
    node.innerHTML = `
      <div style="display:grid; gap:10px">
        <div>
          <div class="muted" style="font-size:12px;margin-bottom:6px">닉네임(2~16)</div>
          <input id="r_nick" class="input" style="width:100%" placeholder="닉네임" />
        </div>
        <div>
          <div class="muted" style="font-size:12px;margin-bottom:6px">학번(선택)</div>
          <input id="r_sid" class="input" style="width:100%" placeholder="2035-101" />
        </div>
        <div>
          <div class="muted" style="font-size:12px;margin-bottom:6px">비밀번호(4자 이상)</div>
          <input id="r_pw" class="input" style="width:100%" type="password" placeholder="****" />
        </div>
      </div>
    `;
    const ok = document.createElement("button");
    ok.className = "btn btn--primary";
    ok.textContent = "가입";
    ok.onclick = async () => {
      const nickname = node.querySelector("#r_nick").value.trim();
      const studentId = node.querySelector("#r_sid").value.trim();
      const password = node.querySelector("#r_pw").value.trim();
      try{
        await api("/auth/register", { method:"POST", body: JSON.stringify({ nickname, studentId, password }) });
        toast("가입 완료! 이제 로그인 해줘");
        modalClose();
        openAuthModal();
      }catch(e){
        toast("가입 실패: " + e.message);
      }
    };
    modalOpen("회원가입", node, [ok]);
  };

  btnMake.onclick = async () => {
    const node = document.createElement("div");
    node.innerHTML = `
      <div class="muted" style="margin-bottom:8px;font-size:12px">운영자 비밀코드(ADMIN_SECRET)를 입력하면 해당 닉네임을 admin으로 승격합니다.</div>
      <div style="display:grid; gap:10px">
        <div>
          <div class="muted" style="font-size:12px;margin-bottom:6px">닉네임</div>
          <input id="m_nick" class="input" style="width:100%" placeholder="admin" />
        </div>
        <div>
          <div class="muted" style="font-size:12px;margin-bottom:6px">비밀코드</div>
          <input id="m_sec" class="input" style="width:100%" type="password" placeholder="0728" />
        </div>
      </div>
    `;
    const ok = document.createElement("button");
    ok.className = "btn btn--primary";
    ok.textContent = "승격";
    ok.onclick = async () => {
      const nickname = node.querySelector("#m_nick").value.trim();
      const secret = node.querySelector("#m_sec").value.trim();
      try{
        await api("/auth/make-admin", { method:"POST", body: JSON.stringify({ nickname, secret }) });
        toast("승격 완료! 다시 로그인하면 role이 바뀝니다.");
        modalClose();
      }catch(e){
        toast("승격 실패: " + e.message);
      }
    };
    modalOpen("관리자 승격", node, [ok]);
  };

  modalOpen("로그인", wrap, []);
}

/* -------------------- Feed / List Rendering -------------------- */
function fmtTime(ms){
  const d = new Date(Number(ms));
  const now = Date.now();
  const diff = now - d.getTime();
  const min = Math.floor(diff/60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min/60);
  if (hr < 24) return `${hr}시간 전`;
  return d.toLocaleString("ko-KR", { year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit" });
}

function setView(name){
  if (name === "feed"){
    el.feedView.classList.remove("is-hidden");
    el.postView.classList.add("is-hidden");
  } else {
    el.feedView.classList.add("is-hidden");
    el.postView.classList.remove("is-hidden");
  }
}

function updateFeedHeader(){
  const catMap = { all:"전체", free:"자유", notice:"공지", qna:"Q&A", study:"스터디" };
  const tabMap = { feed:"전체 피드", bookmarks:"북마크", mine:"내 글" };
  el.feedTitle.textContent = `${catMap[state.cat] || "게시판"} · ${tabMap[state.tab] || "피드"}`;
  el.feedSub.textContent = state.q ? `검색: "${state.q}" · 정렬: ${state.sort}` : `정렬: ${state.sort}`;
  el.pillCount.textContent = String(state.posts.length);
}

function renderList(){
  el.list.innerHTML = "";

  // 탭 필터링
  let rows = [...state.posts];

  if (state.tab === "bookmarks"){
    const bm = getBookmarks();
    rows = rows.filter(p => bm.has(p.id));
  } else if (state.tab === "mine"){
    rows = rows.filter(p => p.canEdit === true);
  }

  if (rows.length === 0){
    const empty = document.createElement("div");
    empty.className = "card";
    empty.style.padding = "18px";
    empty.innerHTML = `
      <div style="font-weight:900;margin-bottom:6px">아직 표시할 글이 없어요</div>
      <div class="muted" style="font-size:13px">
        ${state.tab === "bookmarks" ? "⭐ 북마크한 글이 없습니다." :
          state.tab === "mine" ? "내가 작성한 글이 없습니다." :
          "첫 글을 작성해보세요!"}
      </div>
    `;
    el.list.appendChild(empty);
    return;
  }

  for (const p of rows){
    const item = document.createElement("div");
    item.className = "item";
    item.tabIndex = 0;

    const starOn = isBookmarked(p.id);

    item.innerHTML = `
      <div class="item__top">
        <span class="tag">${escapeHtml(p.category)}</span>
        ${p.pinned ? `<span class="tag" style="border-color:color-mix(in oklab,var(--accent) 40%, var(--border)); background:color-mix(in oklab,var(--accent) 12%, var(--card2));">📌 고정</span>` : ""}
        <div class="item__title">${escapeHtml(p.title)}</div>
        <div class="item__right">
          <button class="star ${starOn ? "is-on":""}" title="북마크" aria-label="북마크">⭐</button>
          <span class="pill" title="좋아요">👍 ${Number(p.likes||0)}</span>
          <span class="pill" title="댓글">💬 ${Number(p.comments||0)}</span>
        </div>
      </div>
      <div class="item__meta">
        <span>${escapeHtml(p.authorName)}</span>
        <span class="dot">•</span>
        <span>${fmtTime(p.createdAt)}</span>
        <span class="dot">•</span>
        <span class="muted">ID: ${escapeHtml(p.id.slice(-8))}</span>
      </div>
    `;

    const starBtn = item.querySelector(".star");
    starBtn.onclick = (e) => {
      e.stopPropagation();
      const on = toggleBookmark(p.id);
      starBtn.classList.toggle("is-on", on);
      toast(on ? "북마크 저장" : "북마크 해제");
      if (state.tab === "bookmarks") renderList();
    };

    item.onclick = () => openPost(p.id);
    item.onkeydown = (e) => { if (e.key==="Enter") openPost(p.id); };

    el.list.appendChild(item);
  }
}

/* -------------------- Fetch Posts -------------------- */
async function fetchPosts({ reset=false }={}){
  if (reset){
    state.cursor = "";
    state.posts = [];
  }

  updateFeedHeader();
  bannerHide();
  el.loadMoreMeta.textContent = "불러오는 중…";

  // 서버 sort 미지원이면 자동 fallback
  const sort = state.caps.sorts.has(state.sort) ? state.sort : "latest";

  const params = new URLSearchParams();
  params.set("category", state.cat);
  if (state.q) params.set("q", state.q);
  params.set("sort", sort);
  params.set("pageSize", "50");
  if (!reset && state.cursor) params.set("cursor", state.cursor);

  try{
    const r = await api(`/posts?${params.toString()}`, { method:"GET" });
    const arr = r.posts || [];
    state.cursor = r.nextCursor || "";
    if (reset) state.posts = arr;
    else state.posts = state.posts.concat(arr);

    updateFeedHeader();
    renderList();

    el.loadMoreMeta.textContent = state.cursor ? "더 불러올 수 있어요" : "마지막입니다";
  }catch(e){
    el.loadMoreMeta.textContent = "";
    banner("피드를 불러오지 못했어요. API 연결/권한/CORS를 확인하세요. ("+e.message+")", "error");
  }
}

async function refreshFeed(reset=true){
  await fetchPosts({ reset });
}

/* -------------------- Post Detail -------------------- */
async function openPost(postId){
  setView("post");
  bannerHide();
  el.postBody.innerHTML = "";
  el.commentList.innerHTML = "";
  el.commentPreview.classList.add("is-hidden");
  el.commentMeta.textContent = "불러오는 중…";

  try{
    const r = await api(`/posts/${postId}`, { method:"GET" });
    const p = r.post;

    state.currentPost = p;

    el.postCat.textContent = p.category;
    el.postAuthor.textContent = p.authorName + (p.anonymous ? " (익명)" : "");
    el.postTime.textContent = fmtTime(p.createdAt);
    el.postTitle.textContent = p.title;
    el.postBody.innerHTML = renderMd(p.bodyMd);

    el.postLikeCount.textContent = `👍 ${p.likes}`;
    el.postCommentCount.textContent = `💬 ${p.comments}`;

    // bookmark button
    const bOn = isBookmarked(p.id);
    el.postBookmarkBtn.textContent = bOn ? "⭐ 북마크됨" : "⭐ 북마크";
    el.postBookmarkBtn.onclick = () => {
      const on = toggleBookmark(p.id);
      el.postBookmarkBtn.textContent = on ? "⭐ 북마크됨" : "⭐ 북마크";
      toast(on ? "북마크 저장" : "북마크 해제");
    };

    // edit/delete visibility
    const canEdit = !!p.canEdit || (state.me && state.caps.admin); // 어드민이면 가능(서버도 허용해야 함)
    const canDelete = !!p.canDelete || (state.me && state.caps.admin);

    el.postEditBtn.classList.toggle("is-hidden", !canEdit);
    el.postDeleteBtn.classList.toggle("is-hidden", !canDelete);

    el.postEditBtn.onclick = () => openEditModal(p);
    el.postDeleteBtn.onclick = () => confirmDelete(p.id);

    // admin pin/reports are shown by applyCapsToUI()
    // like/report
    el.postLikeBtn.onclick = () => toast("좋아요는 댓글/게시글 토글 API에 연결 예정");
    el.postReportBtn.onclick = () => openReportModal("post", p.id);

    await loadComments(postId);

  }catch(e){
    banner("글을 불러오지 못했어요. ("+e.message+")", "error");
  }
}

function backToList(){
  setView("feed");
  state.currentPost = null;
}

async function loadComments(postId){
  try{
    const r = await api(`/posts/${postId}/comments`, { method:"GET" });
    const arr = r.comments || [];
    el.commentMeta.textContent = `${arr.length}개 댓글`;
    renderComments(arr);
  }catch(e){
    el.commentMeta.textContent = "댓글을 불러오지 못했어요.";
  }
}

function renderComments(arr){
  el.commentList.innerHTML = "";
  if (!arr.length){
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.style.padding = "8px 2px";
    empty.textContent = "첫 댓글을 남겨보세요.";
    el.commentList.appendChild(empty);
    return;
  }

  for (const c of arr){
    const div = document.createElement("div");
    div.className = "comment";
    div.innerHTML = `
      <div class="comment__meta">
        <span>${escapeHtml(c.authorName)}</span>
        <span class="dot">•</span>
        <span>${fmtTime(c.createdAt)}</span>
      </div>
      <div class="md">${renderMd(c.bodyMd)}</div>
    `;
    el.commentList.appendChild(div);
  }
}

/* -------------------- Post Create/Edit -------------------- */
function openNewPostModal(){
  if (!state.me){
    toast("글 작성은 로그인 필요");
    openAuthModal();
    return;
  }

  const node = document.createElement("div");
  node.innerHTML = `
    <div style="display:grid; gap:10px">
      <div>
        <div class="muted" style="font-size:12px;margin-bottom:6px">카테고리</div>
        <select id="p_cat" class="select__box" style="width:100%">
          <option value="free">자유</option>
          <option value="notice">공지</option>
          <option value="qna">Q&A</option>
          <option value="study">스터디</option>
        </select>
      </div>
      <div>
        <div class="muted" style="font-size:12px;margin-bottom:6px">제목</div>
        <input id="p_title" class="input" style="width:100%" placeholder="제목" />
      </div>
      <div>
        <div class="muted" style="font-size:12px;margin-bottom:6px">본문(Markdown)</div>
        <textarea id="p_body" class="textarea" rows="10" placeholder="# 제목부터 ######까지 지원"></textarea>
        <div class="muted" style="font-size:12px;margin-top:6px">드래프트는 자동 저장됩니다.</div>
      </div>
      <label class="toggle"><input id="p_anon" type="checkbox" /> <span>익명</span></label>
      <div>
        <button class="btn btn--ghost" id="p_previewBtn" type="button">미리보기</button>
      </div>
      <div id="p_preview" class="md is-hidden" style="border:1px solid var(--border); border-radius:16px; padding:12px; background:var(--card2)"></div>
    </div>
  `;

  const key = `draft_new_${state.me.id}`;
  const draft = loadDraft(key);
  if (draft){
    node.querySelector("#p_cat").value = draft.category || "free";
    node.querySelector("#p_title").value = draft.title || "";
    node.querySelector("#p_body").value = draft.bodyMd || "";
    node.querySelector("#p_anon").checked = !!draft.anonymous;
  }

  const saveDraftNow = () => {
    saveDraft(key, {
      category: node.querySelector("#p_cat").value,
      title: node.querySelector("#p_title").value,
      bodyMd: node.querySelector("#p_body").value,
      anonymous: node.querySelector("#p_anon").checked
    });
  };
  node.querySelector("#p_title").addEventListener("input", saveDraftNow);
  node.querySelector("#p_body").addEventListener("input", saveDraftNow);
  node.querySelector("#p_cat").addEventListener("change", saveDraftNow);
  node.querySelector("#p_anon").addEventListener("change", saveDraftNow);

  const previewBtn = node.querySelector("#p_previewBtn");
  const preview = node.querySelector("#p_preview");
  previewBtn.onclick = () => {
    const md = node.querySelector("#p_body").value;
    preview.innerHTML = renderMd(md);
    preview.classList.toggle("is-hidden");
  };

  const ok = document.createElement("button");
  ok.className = "btn btn--primary";
  ok.textContent = "등록";
  ok.onclick = async () => {
    const category = node.querySelector("#p_cat").value;
    const title = node.querySelector("#p_title").value.trim();
    const bodyMd = node.querySelector("#p_body").value.trim();
    const anonymous = node.querySelector("#p_anon").checked;
    if (!title || !bodyMd){ toast("제목/본문을 입력하세요"); return; }
    try{
      const r = await api("/posts", { method:"POST", body: JSON.stringify({ category, title, bodyMd, anonymous }) });
      clearDraft(key);
      toast("작성 완료!");
      modalClose();
      await refreshFeed(true);
      await openPost(r.postId);
    }catch(e){
      toast("작성 실패: " + e.message);
    }
  };

  modalOpen("새 글", node, [ok]);
}

function openEditModal(p){
  if (!state.me){
    toast("로그인 필요");
    return;
  }
  const node = document.createElement("div");
  node.innerHTML = `
    <div style="display:grid; gap:10px">
      <div class="muted" style="font-size:12px">수정은 Markdown 그대로 반영됩니다.</div>
      <div>
        <div class="muted" style="font-size:12px;margin-bottom:6px">제목</div>
        <input id="e_title" class="input" style="width:100%" />
      </div>
      <div>
        <div class="muted" style="font-size:12px;margin-bottom:6px">본문</div>
        <textarea id="e_body" class="textarea" rows="10"></textarea>
      </div>
      <label class="toggle"><input id="e_anon" type="checkbox" /> <span>익명</span></label>
      <div>
        <button class="btn btn--ghost" id="e_previewBtn" type="button">미리보기</button>
      </div>
      <div id="e_preview" class="md is-hidden" style="border:1px solid var(--border); border-radius:16px; padding:12px; background:var(--card2)"></div>
    </div>
  `;
  node.querySelector("#e_title").value = p.title || "";
  node.querySelector("#e_body").value = p.bodyMd || "";
  node.querySelector("#e_anon").checked = !!p.anonymous;

  const prevBtn = node.querySelector("#e_previewBtn");
  const prev = node.querySelector("#e_preview");
  prevBtn.onclick = () => {
    prev.innerHTML = renderMd(node.querySelector("#e_body").value);
    prev.classList.toggle("is-hidden");
  };

  const ok = document.createElement("button");
  ok.className = "btn btn--primary";
  ok.textContent = "저장";
  ok.onclick = async () => {
    const title = node.querySelector("#e_title").value.trim();
    const bodyMd = node.querySelector("#e_body").value.trim();
    const anonymous = node.querySelector("#e_anon").checked;
    try{
      await api(`/posts/${p.id}`, { method:"PATCH", body: JSON.stringify({ title, bodyMd, anonymous }) });
      toast("수정 완료");
      modalClose();
      await openPost(p.id);
      await refreshFeed(true);
    }catch(e){
      toast("수정 실패: " + e.message);
    }
  };
  modalOpen("글 수정", node, [ok]);
}

function confirmDelete(postId){
  const node = document.createElement("div");
  node.innerHTML = `<div style="font-weight:900;margin-bottom:6px">정말 삭제할까요?</div><div class="muted">삭제하면 복구가 어렵습니다.</div>`;
  const del = document.createElement("button");
  del.className = "btn btn--danger";
  del.textContent = "삭제";
  del.onclick = async () => {
    try{
      await api(`/posts/${postId}`, { method:"DELETE" });
      toast("삭제 완료");
      modalClose();
      backToList();
      await refreshFeed(true);
    }catch(e){
      toast("삭제 실패: " + e.message);
    }
  };
  modalOpen("삭제 확인", node, [del]);
}

/* -------------------- Comment Send + Preview -------------------- */
async function sendComment(){
  if (!state.currentPost){ return; }
  if (!state.me){
    toast("댓글은 로그인 필요");
    openAuthModal();
    return;
  }
  const bodyMd = el.commentInput.value.trim();
  if (!bodyMd){ toast("댓글 내용을 입력하세요"); return; }
  const anonymous = el.commentAnon.checked;

  try{
    await api(`/posts/${state.currentPost.id}/comments`, { method:"POST", body: JSON.stringify({ bodyMd, anonymous }) });
    el.commentInput.value = "";
    el.commentPreview.classList.add("is-hidden");
    toast("댓글 등록!");
    await loadComments(state.currentPost.id);
    await refreshFeed(true);
  }catch(e){
    toast("댓글 실패: " + e.message);
  }
}

function toggleCommentPreview(){
  const md = el.commentInput.value;
  el.commentPreview.innerHTML = renderMd(md);
  el.commentPreview.classList.toggle("is-hidden");
}

/* -------------------- Report Modal -------------------- */
function openReportModal(targetType, targetId){
  if (!state.me){
    toast("신고는 로그인 필요");
    openAuthModal();
    return;
  }
  const node = document.createElement("div");
  node.innerHTML = `
    <div style="display:grid; gap:10px">
      <div class="muted" style="font-size:12px">신고는 운영진 검토 후 조치됩니다.</div>
      <div>
        <div class="muted" style="font-size:12px;margin-bottom:6px">사유</div>
        <select id="rp_reason" class="select__box" style="width:100%">
          <option value="욕설/비하">욕설/비하</option>
          <option value="혐오/차별">혐오/차별</option>
          <option value="광고/도배">광고/도배</option>
          <option value="개인정보">개인정보</option>
          <option value="기타">기타</option>
        </select>
      </div>
      <div>
        <div class="muted" style="font-size:12px;margin-bottom:6px">상세</div>
        <textarea id="rp_detail" class="textarea" rows="5" placeholder="상세 내용을 적어주세요"></textarea>
      </div>
    </div>
  `;
  const ok = document.createElement("button");
  ok.className = "btn btn--primary";
  ok.textContent = "신고 제출";
  ok.onclick = async () => {
    const reason = node.querySelector("#rp_reason").value;
    const detail = node.querySelector("#rp_detail").value.trim();
    try{
      await api(`/reports`, { method:"POST", body: JSON.stringify({ targetType, targetId, reason, detail }) });
      toast("신고 접수 완료");
      modalClose();
    }catch(e){
      toast("신고 실패: " + e.message);
    }
  };
  modalOpen("신고", node, [ok]);
}

/* -------------------- Drafts -------------------- */
function loadDraft(key){
  try{
    const raw = localStorage.getItem(LS.drafts) || "{}";
    const obj = JSON.parse(raw);
    return obj[key] || null;
  }catch{ return null; }
}
function saveDraft(key, val){
  try{
    const raw = localStorage.getItem(LS.drafts) || "{}";
    const obj = JSON.parse(raw);
    obj[key] = { ...val, savedAt: Date.now() };
    localStorage.setItem(LS.drafts, JSON.stringify(obj));
  }catch{}
}
function clearDraft(key){
  try{
    const raw = localStorage.getItem(LS.drafts) || "{}";
    const obj = JSON.parse(raw);
    delete obj[key];
    localStorage.setItem(LS.drafts, JSON.stringify(obj));
  }catch{}
}

/* -------------------- Realtime WS -------------------- */
function rtSet(status, label, meta="—"){
  el.rtLabel.textContent = label;
  el.rtMeta.textContent = meta;
  const rt = el.rtDot.closest(".rt");
  rt.classList.remove("is-on","is-off");
  if (status === "on") rt.classList.add("is-on");
  if (status === "off") rt.classList.add("is-off");
}

function connectWS(){
  // GitHub Pages에서도 WS는 가능 (CORS랑 별개)
  const url = `${WS_BASE}/realtime?channel=feed`;
  try{
    if (state.ws) state.ws.close();
    rtSet("","실시간: 연결 시도중","—");
    const ws = new WebSocket(url);
    state.ws = ws;

    ws.onopen = () => {
      state.wsOk = true;
      rtSet("on","실시간: 연결됨","feed");
      // keepalive ping
      ws.send("ping");
    };
    ws.onmessage = (e) => {
      // 이벤트 오면 새로고침(가볍게)
      try{
        const msg = JSON.parse(e.data);
        if (msg && msg.type === "event"){
          // 여기서 “대충 새로고침” 하지 않고, UX 좋은 방식:
          // 현재가 feedView일 때만 배너로 알려주고, 클릭시 refresh
          banner("새 이벤트가 있어요! ‘새로고침’하면 최신 글/댓글이 반영됩니다.");
        }
      }catch{
        if (String(e.data).trim() === "pong") el.rtMeta.textContent = "pong";
      }
    };
    ws.onclose = () => {
      state.wsOk = false;
      rtSet("off","실시간: 연결 끊김","재시도");
      // 자동 재시도
      setTimeout(()=>connectWS(), 1500 + Math.random()*1200);
    };
    ws.onerror = () => {
      state.wsOk = false;
      rtSet("off","실시간: 오류","재시도");
    };
  }catch{
    rtSet("off","실시간: 불가","브라우저/네트워크");
  }
}

/* -------------------- Events -------------------- */
function bindEvents(){
  el.themeBtn.onclick = toggleTheme;
  el.searchBtn.onclick = async () => {
    state.q = el.qInput.value.trim();
    await refreshFeed(true);
  };
  el.qInput.addEventListener("keydown", async (e)=>{
    if (e.key === "Enter"){
      state.q = el.qInput.value.trim();
      await refreshFeed(true);
    }
  });

  el.sortSel.onchange = async () => {
    state.sort = el.sortSel.value;
    await refreshFeed(true);
  };

  el.tabSel.onchange = async () => {
    state.tab = el.tabSel.value;
    updateFeedHeader();
    renderList();
  };

  document.querySelectorAll(".chip").forEach(btn=>{
    btn.onclick = async () => {
      document.querySelectorAll(".chip").forEach(x=>x.classList.remove("is-active"));
      btn.classList.add("is-active");
      state.cat = btn.dataset.cat;
      await refreshFeed(true);
    };
  });

  el.refreshBtn.onclick = async () => refreshFeed(true);
  el.newPostBtn.onclick = openNewPostModal;
  el.fabBtn.onclick = openNewPostModal;

  el.backBtn.onclick = backToList;
  el.homeBtn.onclick = () => { backToList(); };

  el.commentSendBtn.onclick = sendComment;
  el.commentPreviewBtn.onclick = toggleCommentPreview;

  // Ctrl+Enter submit comment
  el.commentInput.addEventListener("keydown", (e)=>{
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter"){
      e.preventDefault();
      sendComment();
    }
  });

  el.loadMoreBtn.onclick = async () => {
    if (!state.cursor){ toast("마지막입니다"); return; }
    await fetchPosts({ reset:false });
  };
}

/* -------------------- Boot sequence -------------------- */
async function bootstrap(){
  bootStart();
  initTheme();
  initMarkdown();
  bootNextStep();

  bindEvents();
  bootNextStep();

  // health check (진짜 로딩)
  try{
    await api("/health");
  }catch{
    // health 실패해도 UI는 뜨게. 대신 배너로 알려줌.
  }
  bootNextStep();

  await detectCaps();
  renderUserBox();
  bootNextStep();

  await refreshFeed(true);
  bootNextStep();

  connectWS();
  bootNextStep();

  // finish
  setTimeout(()=>bootDone(), 250);
}

document.addEventListener("DOMContentLoaded", bootstrap);
