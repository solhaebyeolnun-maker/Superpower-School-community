/* ===============================
   SRT Community - app.js
   =============================== */

/** ✅ API BASE */
const API_BASE = "https://srt-community-api.yekong0728.workers.dev";

/** LocalStorage keys */
const LS = {
  token: "srt_token",
  user: "srt_user",
  theme: "srt_theme",
  bookmarks: "srt_bookmarks_v1", // { [postId]: {id,title,category,createdAt,pinned} }
  lastSort: "srt_sort",
  lastCat: "srt_cat",
  lastQ: "srt_q",
};

const el = (id) => document.getElementById(id);
const qs = (sel, root = document) => root.querySelector(sel);
const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** UI nodes */
const $boot = el("boot");
const $bootBar = el("bootBar");
const $bootPct = el("bootPct");
const $bootTask = el("bootTask");

const $rtDot = el("rtDot");
const $rtLabel = el("rtLabel");
const $rtMeta = el("rtMeta");

const $themeBtn = el("themeBtn");
const $bookmarksBtn = el("bookmarksBtn");

const $homeBtn = el("homeBtn");
const $loginBtn = el("loginBtn");
const $userBox = el("userBox");

const $segFeed = el("segFeed");
const $segMy = el("segMy");
const $segAdmin = el("segAdmin");
const $meMini = el("meMini");

const $banner = el("banner");

const $feedView = el("feedView");
const $postView = el("postView");
const $myView = el("myView");
const $adminView = el("adminView");

const $list = el("list");
const $loadMoreBtn = el("loadMoreBtn");
const $loadMoreMeta = el("loadMoreMeta");
const $pillCount = el("pillCount");
const $feedTitle = el("feedTitle");
const $feedSub = el("feedSub");

const $qInput = el("qInput");
const $searchBtn = el("searchBtn");
const $refreshBtn = el("refreshBtn");
const $sortSel = el("sortSel");
const $newPostBtn = el("newPostBtn");
const $fabBtn = el("fabBtn");

const $backBtn = el("backBtn");
const $postCat = el("postCat");
const $postAuthor = el("postAuthor");
const $postTime = el("postTime");
const $postTitle = el("postTitle");
const $postBody = el("postBody");
const $postLikeBtn = el("postLikeBtn");
const $postReportBtn = el("postReportBtn");
const $postEditBtn = el("postEditBtn");
const $postDeleteBtn = el("postDeleteBtn");
const $postPinBtn = el("postPinBtn");
const $postBookmarkBtn = el("postBookmarkBtn");
const $postLikeCount = el("postLikeCount");
const $postCommentCount = el("postCommentCount");

const $commentMeta = el("commentMeta");
const $commentAnon = el("commentAnon");
const $commentInput = el("commentInput");
const $commentPreviewBtn = el("commentPreviewBtn");
const $commentPreview = el("commentPreview");
const $commentSendBtn = el("commentSendBtn");
const $commentList = el("commentList");

const $modalRoot = el("modalRoot");
const $toastRoot = el("toastRoot");

/** My view */
const $myPostsBtn = el("myPostsBtn");
const $myCommentsBtn = el("myCommentsBtn");
const $myReloadBtn = el("myReloadBtn");
const $myList = el("myList");

/** Admin view */
const $reportStatusSel = el("reportStatusSel");
const $adminLoadReportsBtn = el("adminLoadReportsBtn");
const $adminReloadBtn = el("adminReloadBtn");
const $reportList = el("reportList");

/** State */
const state = {
  cat: localStorage.getItem(LS.lastCat) || "all",
  q: localStorage.getItem(LS.lastQ) || "",
  sort: localStorage.getItem(LS.lastSort) || "latest",
  cursor: "",
  loading: false,
  posts: [],
  currentPost: null,
  comments: [],
  ws: null,
  wsConnected: false,
  me: null,
  view: "feed", // feed|post|my|admin
  myTab: "posts", // posts|comments
};

/* -----------------------
   Markdown setup
------------------------ */
function setupMarkdown() {
  if (window.marked) {
    marked.setOptions({
      gfm: true,
      breaks: true,
      headerIds: false,
      mangle: false,
    });
  }
}
function renderMarkdown(md) {
  const raw = (md ?? "").toString();
  const html = window.marked ? marked.parse(raw) : raw.replaceAll("\n", "<br/>");
  return window.DOMPurify ? DOMPurify.sanitize(html) : html;
}

/* -----------------------
   Lucide icons
------------------------ */
function renderIcons() {
  try {
    if (window.lucide && lucide.createIcons) lucide.createIcons();
  } catch {}
}

/* -----------------------
   Time formatting
------------------------ */
function fmtTime(ms) {
  const d = new Date(ms);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yy}.${mm}.${dd} ${hh}:${mi}`;
}
function relTime(ms) {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  return `${d}일 전`;
}

/* -----------------------
   Toast + Banner
------------------------ */
function toast(title, msg, ms = 2600) {
  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = `
    <div class="toast__top">
      <div class="toast__title">${escapeHtml(title)}</div>
      <button class="btn btn--ghost" type="button" aria-label="닫기">닫기</button>
    </div>
    <div class="toast__msg">${escapeHtml(msg)}</div>
  `;
  const closeBtn = qs("button", t);
  closeBtn.addEventListener("click", () => t.remove());
  $toastRoot.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

let bannerTimer = null;
function banner(msg) {
  $banner.textContent = msg;
  $banner.classList.remove("is-hidden");
  if (bannerTimer) clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => $banner.classList.add("is-hidden"), 4200);
}

/* -----------------------
   Modal helpers
------------------------ */
function openModal({ title, bodyHtml, footHtml, onMount }) {
  $modalRoot.classList.remove("is-hidden");
  $modalRoot.setAttribute("aria-hidden", "false");

  $modalRoot.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal__head">
        <div class="modal__title">${escapeHtml(title || "")}</div>
        <button class="btn btn--ghost" id="modalCloseBtn" type="button">닫기</button>
      </div>
      <div class="modal__body">${bodyHtml || ""}</div>
      <div class="modal__foot">${footHtml || ""}</div>
    </div>
  `;

  const close = () => closeModal();
  el("modalCloseBtn")?.addEventListener("click", close);
  $modalRoot.addEventListener("click", (e) => {
    if (e.target === $modalRoot) close();
  }, { once: true });

  document.addEventListener("keydown", function esc(e) {
    if (e.key === "Escape") {
      close();
      document.removeEventListener("keydown", esc);
    }
  });

  if (typeof onMount === "function") onMount();
}
function closeModal() {
  $modalRoot.classList.add("is-hidden");
  $modalRoot.setAttribute("aria-hidden", "true");
  $modalRoot.innerHTML = "";
}

/* -----------------------
   Safe HTML
------------------------ */
function escapeHtml(s) {
  return (s ?? "").toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* -----------------------
   Local user/session
------------------------ */
function loadSession() {
  const token = localStorage.getItem(LS.token) || "";
  const u = localStorage.getItem(LS.user);
  state.me = u ? safeJson(u) : null;
  return token;
}
function setSession(token, user) {
  localStorage.setItem(LS.token, token);
  localStorage.setItem(LS.user, JSON.stringify(user));
  state.me = user;
  renderUserBox();
}
function clearSession() {
  localStorage.removeItem(LS.token);
  localStorage.removeItem(LS.user);
  state.me = null;
  renderUserBox();
}
function safeJson(str) {
  try { return JSON.parse(str); } catch { return null; }
}

/* -----------------------
   Bookmarks
------------------------ */
function getBookmarks() {
  const raw = localStorage.getItem(LS.bookmarks);
  const obj = raw ? safeJson(raw) : null;
  return obj && typeof obj === "object" ? obj : {};
}
function setBookmarks(obj) {
  localStorage.setItem(LS.bookmarks, JSON.stringify(obj));
}
function isBookmarked(postId) {
  const b = getBookmarks();
  return !!b[postId];
}
function toggleBookmark(post) {
  const b = getBookmarks();
  if (b[post.id]) {
    delete b[post.id];
    setBookmarks(b);
    toast("북마크", "북마크에서 제거했어요.");
    return false;
  } else {
    b[post.id] = {
      id: post.id,
      title: post.title,
      category: post.category,
      createdAt: post.createdAt,
      pinned: !!post.pinned
    };
    setBookmarks(b);
    toast("북마크", "북마크에 저장했어요.");
    return true;
  }
}

/* -----------------------
   API wrapper
------------------------ */
async function api(path, { method = "GET", body, token, qsObj } = {}) {
  const url = new URL(API_BASE + path);
  if (qsObj) {
    for (const [k, v] of Object.entries(qsObj)) {
      if (v === undefined || v === null || v === "") continue;
      url.searchParams.set(k, String(v));
    }
  }

  const headers = { "content-type": "application/json" };
  const t = token ?? localStorage.getItem(LS.token) ?? "";
  if (t) headers["Authorization"] = `Bearer ${t}`;

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) data = await res.json().catch(() => null);
  else data = await res.text().catch(() => null);

  if (!res.ok) {
    const msg = (data && data.message) || (data && data.error) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

/* -----------------------
   Boot loader animation
------------------------ */
function bootSet(pct, task) {
  const clamped = Math.max(0, Math.min(100, pct));
  $bootBar.style.width = `${clamped}%`;
  $bootPct.textContent = String(Math.floor(clamped));
  if (task) $bootTask.textContent = task;
}
function bootRandomizer() {
  // 로딩바/스피너 속도를 “가끔 멈춤/느림/빠름”처럼 보이게 만드는 랜덤 템포
  let pct = 0;
  let alive = true;

  const tasksFake = [
    "UI 컴포넌트 로딩…",
    "글래스 렌더링 최적화…",
    "Markdown 파서 준비…",
    "북마크 인덱스 생성…",
    "실시간 채널 핸드셰이크…",
    "캐시 워밍업…",
  ];
  const tasksReal = [
    "서버 연결 확인…",
    "세션 확인…",
    "피드 불러오는 중…",
  ];

  let taskIndex = 0;

  const tick = () => {
    if (!alive) return;

    // 랜덤한 속도/정지 느낌
    const r = Math.random();
    let delta = 0;
    if (r < 0.08) delta = 0;          // 잠깐 멈춤
    else if (r < 0.22) delta = 0.3;   // 매우 느림
    else if (r < 0.70) delta = 1.2;   // 보통
    else delta = 2.2;                 // 빠름

    // 0~82까지만 자동 진행, 이후는 실데이터 완료시 마무리
    pct = Math.min(82, pct + delta);

    // task는 real/fake 섞어서 보여줌
    let task = tasksReal[Math.min(tasksReal.length - 1, taskIndex)] || "초기화 중…";
    if (pct > 30 && Math.random() < 0.25) {
      task = tasksFake[Math.floor(Math.random() * tasksFake.length)];
    }
    bootSet(pct, task);

    setTimeout(tick, 120 + Math.random() * 260);
  };

  tick();

  return {
    setRealStep(i) { taskIndex = i; },
    async finish(finalTask = "완료!") {
      // 82 → 100 부드럽게
      bootSet(Math.max(pct, 82), finalTask);
      await sleep(180);
      for (let i = Math.max(pct, 82); i <= 100; i += 2.6) {
        bootSet(i, finalTask);
        await sleep(28 + Math.random() * 24);
      }
      alive = false;
      $boot.classList.add("is-hidden");
      $boot.setAttribute("aria-hidden", "true");
    }
  };
}
function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

/* -----------------------
   Theme
------------------------ */
function initTheme() {
  const saved = localStorage.getItem(LS.theme);
  if (saved === "light" || saved === "dark") {
    document.documentElement.setAttribute("data-theme", saved);
  } else {
    // 기본: 다크
    document.documentElement.setAttribute("data-theme", "dark");
  }
}
function toggleTheme() {
  const cur = document.documentElement.getAttribute("data-theme") || "dark";
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem(LS.theme, next);
  toast("테마", next === "dark" ? "다크 테마" : "라이트 테마");
}

/* -----------------------
   Realtime WS
------------------------ */
function connectWS() {
  const wsUrl = API_BASE.replace(/^http/, "ws") + "/realtime?channel=feed";
  if (state.ws) {
    try { state.ws.close(); } catch {}
    state.ws = null;
  }

  $rtLabel.textContent = "실시간: 연결 시도";
  $rtMeta.textContent = "—";
  setRtDot("pending");

  const ws = new WebSocket(wsUrl);
  state.ws = ws;

  let lastEventAt = 0;
  let pingTimer = null;

  ws.onopen = () => {
    state.wsConnected = true;
    setRtDot("ok");
    $rtLabel.textContent = "실시간: 연결됨";
    $rtMeta.textContent = "LIVE";
    pingTimer = setInterval(() => {
      try { ws.send("ping"); } catch {}
    }, 12000);
  };

  ws.onmessage = (e) => {
    const s = typeof e.data === "string" ? e.data : "";
    if (s === "pong") return;

    lastEventAt = Date.now();
    // feed 이벤트면 현재 화면을 “필요시” 갱신
    try {
      const msg = JSON.parse(s);
      if (msg?.type === "event" && msg?.payload?.kind) {
        // 너무 과한 자동 갱신은 UX 나쁨 → 배너만 띄우고 새로고침 유도
        banner(`새 이벤트: ${msg.payload.kind} · 새로고침하면 반영돼요`);
      }
    } catch {}
  };

  ws.onclose = () => {
    state.wsConnected = false;
    setRtDot("bad");
    $rtLabel.textContent = "실시간: 끊김";
    $rtMeta.textContent = "OFF";
    if (pingTimer) clearInterval(pingTimer);
    // 자동 재연결
    setTimeout(() => {
      if (document.visibilityState === "visible") connectWS();
    }, 1500 + Math.random() * 1200);
  };

  ws.onerror = () => {
    // close로 이어질 것
  };

  // 상태 텍스트: 마지막 이벤트 시간
  setInterval(() => {
    if (!state.wsConnected) return;
    if (!lastEventAt) {
      $rtMeta.textContent = "LIVE";
    } else {
      $rtMeta.textContent = relTime(lastEventAt);
    }
  }, 1000);
}
function setRtDot(mode) {
  // ok/pending/bad
  if (mode === "ok") {
    $rtDot.style.background = "rgba(46,229,157,.9)";
    $rtDot.style.boxShadow = "0 0 0 6px rgba(46,229,157,.18)";
  } else if (mode === "pending") {
    $rtDot.style.background = "rgba(255,176,32,.85)";
    $rtDot.style.boxShadow = "0 0 0 6px rgba(255,176,32,.14)";
  } else {
    $rtDot.style.background = "rgba(255,77,109,.85)";
    $rtDot.style.boxShadow = "0 0 0 6px rgba(255,77,109,.14)";
  }
}

/* -----------------------
   Views
------------------------ */
function showView(name) {
  state.view = name;
  $feedView.classList.toggle("is-hidden", name !== "feed");
  $postView.classList.toggle("is-hidden", name !== "post");
  $myView.classList.toggle("is-hidden", name !== "my");
  $adminView.classList.toggle("is-hidden", name !== "admin");

  $segFeed.classList.toggle("is-active", name === "feed");
  $segMy.classList.toggle("is-active", name === "my");
  $segAdmin.classList.toggle("is-active", name === "admin");

  // FAB는 피드/내활동에서만
  $fabBtn.style.display = (name === "feed" || name === "my") ? "" : "none";
}

/* -----------------------
   User UI
------------------------ */
function renderUserBox() {
  const me = state.me;
  if (!me) {
    $userBox.innerHTML = `<button class="btn btn--primary" id="loginBtn" type="button">로그인</button>`;
    qs("#loginBtn", $userBox).addEventListener("click", () => openLoginModal());
    $segMy.title = "로그인 필요";
    $segAdmin.title = "관리자 전용";
    $meMini.textContent = "";
    return;
  }

  const role = me.role || "student";
  const roleBadge = role === "admin" ? "ADMIN" : role === "mod" ? "MOD" : "USER";

  $userBox.innerHTML = `
    <button class="btn btn--ghost" id="accountBtn" type="button">
      <span class="icon" data-lucide="user"></span>
      <span>${escapeHtml(me.nickname)}</span>
      <span class="pill">${roleBadge}</span>
    </button>
  `;
  qs("#accountBtn", $userBox).addEventListener("click", () => openAccountModal());
  renderIcons();

  $meMini.innerHTML = `<span class="pill">${escapeHtml(me.nickname)}</span> <span class="muted">(${escapeHtml(me.studentId || "—")})</span>`;
}

function openAccountModal() {
  const me = state.me;
  openModal({
    title: "계정",
    bodyHtml: `
      <div class="field">
        <div class="label">닉네임</div>
        <div><b>${escapeHtml(me.nickname)}</b> <span class="pill">${escapeHtml(me.role || "student")}</span></div>
      </div>
      <div class="field">
        <div class="label">학번</div>
        <div>${escapeHtml(me.studentId || "—")}</div>
      </div>
      <div class="hr"></div>
      <div class="field">
        <div class="label">비밀번호 변경</div>
        <div class="help">현재 비밀번호를 알고 있을 때만 변경 가능</div>
        <input id="oldPw" class="input" type="password" placeholder="현재 비밀번호" />
        <input id="newPw" class="input" type="password" placeholder="새 비밀번호 (4자 이상)" />
      </div>
      <div class="small">비밀번호 찾기는 “재설정 토큰” 방식입니다. (운영진에게 요청)</div>
    `,
    footHtml: `
      <button class="btn btn--ghost" id="logoutBtn" type="button">로그아웃</button>
      <button class="btn btn--primary" id="changePwBtn" type="button">비밀번호 변경</button>
    `,
    onMount() {
      el("logoutBtn").addEventListener("click", async () => {
        try { await api("/auth/logout", { method: "POST" }); } catch {}
        clearSession();
        closeModal();
        toast("로그아웃", "안전하게 로그아웃했어요.");
      });

      el("changePwBtn").addEventListener("click", async () => {
        const oldPassword = el("oldPw").value.trim();
        const newPassword = el("newPw").value.trim();
        if (!oldPassword || !newPassword) return toast("오류", "비밀번호를 입력해 주세요.");
        try {
          await api("/auth/change-password", { method: "POST", body: { oldPassword, newPassword } });
          toast("완료", "비밀번호를 변경했어요.");
          closeModal();
        } catch (e) {
          toast("실패", e.message || "비밀번호 변경 실패");
        }
      });
    }
  });
}

/* -----------------------
   Auth modals
------------------------ */
function openLoginModal() {
  openModal({
    title: "로그인 / 회원가입",
    bodyHtml: `
      <div class="field">
        <div class="label">로그인</div>
        <input id="loginId" class="input" placeholder="닉네임 또는 학번" />
        <input id="loginPw" class="input" type="password" placeholder="비밀번호" />
        <div class="row">
          <button class="btn btn--primary" id="doLogin" type="button">로그인</button>
          <button class="btn btn--ghost" id="openReset" type="button">비밀번호 찾기</button>
        </div>
      </div>

      <div class="hr"></div>

      <div class="field">
        <div class="label">회원가입</div>
        <input id="regNick" class="input" placeholder="닉네임 (2~16, 영문/숫자/한글/_)" />
        <input id="regSid" class="input" placeholder="학번 (선택)" />
        <input id="regPw" class="input" type="password" placeholder="비밀번호 (4자 이상)" />
        <div class="row">
          <button class="btn btn--primary" id="doReg" type="button">가입하기</button>
        </div>
      </div>
    `,
    footHtml: `<button class="btn btn--ghost" type="button" id="closeAuth">닫기</button>`,
    onMount() {
      el("closeAuth").addEventListener("click", closeModal);

      el("doLogin").addEventListener("click", async () => {
        const identifier = el("loginId").value.trim();
        const password = el("loginPw").value.trim();
        if (!identifier || !password) return toast("오류", "아이디/비밀번호를 입력해 주세요.");
        try {
          const r = await api("/auth/login", { method: "POST", body: { identifier, password } });
          setSession(r.token, r.user);
          closeModal();
          toast("환영합니다", `${r.user.nickname}님 로그인 완료`);
          // 갱신
          await refreshFeed(true);
          renderAdminSeg();
        } catch (e) {
          toast("로그인 실패", e.message || "다시 시도해 주세요");
        }
      });

      el("doReg").addEventListener("click", async () => {
        const nickname = el("regNick").value.trim();
        const studentId = el("regSid").value.trim();
        const password = el("regPw").value.trim();
        if (!nickname || !password) return toast("오류", "닉네임/비밀번호를 입력해 주세요.");
        try {
          await api("/auth/register", { method: "POST", body: { nickname, studentId, password } });
          toast("가입 완료", "이제 로그인해 주세요.");
          el("loginId").value = nickname;
        } catch (e) {
          toast("가입 실패", e.message || "이미 사용 중일 수 있어요");
        }
      });

      el("openReset").addEventListener("click", () => openResetModal());
    }
  });
}

function openResetModal() {
  openModal({
    title: "비밀번호 찾기(재설정 요청)",
    bodyHtml: `
      <div class="field">
        <div class="label">식별자</div>
        <input id="resetIdentifier" class="input" placeholder="닉네임 또는 학번" />
        <div class="help">요청 접수 후 운영진이 “재설정 토큰”을 발급해 줍니다.</div>
      </div>
      <div class="row">
        <button class="btn btn--primary" id="requestResetBtn" type="button">요청 보내기</button>
      </div>

      <div class="hr"></div>

      <div class="field">
        <div class="label">토큰으로 재설정</div>
        <input id="resetToken" class="input" placeholder="운영진이 준 resetToken" />
        <input id="resetNewPw" class="input" type="password" placeholder="새 비밀번호 (4자 이상)" />
        <button class="btn btn--primary" id="applyResetBtn" type="button">비밀번호 재설정</button>
      </div>
      <div class="small">
        보안상 토큰은 1회용이며 만료가 있어요. 재설정하면 기존 로그인 세션은 종료됩니다.
      </div>
    `,
    footHtml: `<button class="btn btn--ghost" type="button" id="closeReset">닫기</button>`,
    onMount() {
      el("closeReset").addEventListener("click", closeModal);

      el("requestResetBtn").addEventListener("click", async () => {
        const identifier = el("resetIdentifier").value.trim();
        if (!identifier) return toast("오류", "식별자를 입력해 주세요.");
        try {
          const r = await api("/auth/request-reset", { method: "POST", body: { identifier } });
          toast("요청 완료", r.message || "운영진에게 문의해 주세요.");
        } catch (e) {
          toast("실패", e.message || "요청 실패");
        }
      });

      el("applyResetBtn").addEventListener("click", async () => {
        const resetToken = el("resetToken").value.trim();
        const newPassword = el("resetNewPw").value.trim();
        if (!resetToken || !newPassword) return toast("오류", "토큰/새 비밀번호를 입력해 주세요.");
        try {
          await api("/auth/reset-password", { method: "POST", body: { resetToken, newPassword } });
          toast("완료", "비밀번호를 재설정했어요. 다시 로그인해 주세요.");
          closeModal();
          openLoginModal();
        } catch (e) {
          toast("실패", e.message || "재설정 실패");
        }
      });
    }
  });
}

/* -----------------------
   Feed actions
------------------------ */
function catName(cat) {
  if (cat === "free") return "자유";
  if (cat === "notice") return "공지";
  if (cat === "qna") return "Q&A";
  if (cat === "study") return "스터디";
  if (cat === "all") return "전체";
  return cat;
}

function setCat(cat) {
  state.cat = cat;
  localStorage.setItem(LS.lastCat, cat);
  qsa(".chip").forEach((b) => b.classList.toggle("is-active", b.dataset.cat === cat));
  state.cursor = "";
  refreshFeed(true);
}

function setSort(sort) {
  state.sort = sort;
  localStorage.setItem(LS.lastSort, sort);
  state.cursor = "";
  refreshFeed(true);
}

function setQ(q) {
  state.q = q;
  localStorage.setItem(LS.lastQ, q);
  state.cursor = "";
  refreshFeed(true);
}

function renderFeedHead() {
  $feedTitle.textContent = state.cat === "all" ? "게시판" : `${catName(state.cat)} 게시판`;
  const qtxt = state.q ? ` · 검색: "${state.q}"` : "";
  const sortTxt = {
    latest: "최신",
    hot: "핫",
    comments: "댓글 많은",
    likes: "좋아요 많은",
  }[state.sort] || state.sort;

  $feedSub.textContent = `${sortTxt} 정렬${qtxt}`;
  $pillCount.textContent = String(state.posts.length);
}

function postCard(post) {
  const tagClass = post.category === "notice" ? "tag tag--notice" : "tag";
  const pinned = post.pinned ? `<span class="pin"><span class="icon" data-lucide="pin"></span>고정</span>` : "";
  const bmOn = isBookmarked(post.id);

  const right = `
    <div class="item__right">
      <button class="starBtn ${bmOn ? "is-on" : ""}" type="button" data-bm="${post.id}" aria-label="북마크">
        <span class="icon" data-lucide="star"></span>
      </button>
      <span class="pill">👍 ${post.likes}</span>
      <span class="pill">💬 ${post.comments}</span>
    </div>
  `;

  const meta = `
    <div class="item__meta">
      <span>${escapeHtml(post.authorName)}</span>
      <span class="dot">•</span>
      <span title="${fmtTime(post.createdAt)}">${relTime(post.createdAt)}</span>
      ${post.canPin ? `<span class="dot">•</span><span class="muted">관리자</span>` : ""}
    </div>
  `;

  return `
    <div class="item" tabindex="0" data-open="${post.id}">
      <div class="item__top">
        <span class="${tagClass}">${escapeHtml(catName(post.category))}</span>
        ${pinned}
        ${right}
      </div>
      <div class="item__title">${escapeHtml(post.title)}</div>
      ${meta}
    </div>
  `;
}

function renderFeedList() {
  renderFeedHead();
  $list.innerHTML = state.posts.map(postCard).join("");

  // bind open + bookmark
  qsa("[data-open]", $list).forEach((node) => {
    const id = node.getAttribute("data-open");
    node.addEventListener("click", () => openPost(id));
    node.addEventListener("keydown", (e) => {
      if (e.key === "Enter") openPost(id);
    });
  });

  qsa("[data-bm]", $list).forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-bm");
      const p = state.posts.find(x => x.id === id);
      if (!p) return;
      const on = toggleBookmark(p);
      btn.classList.toggle("is-on", on);
      renderIcons();
    });
  });

  renderIcons();
}

async function refreshFeed(reset = false) {
  if (state.loading) return;
  state.loading = true;

  try {
    if (reset) {
      state.cursor = "";
      state.posts = [];
      $loadMoreMeta.textContent = "불러오는 중…";
    }

    const r = await api("/posts", {
      qsObj: {
        category: state.cat,
        q: state.q,
        sort: state.sort,
        cursor: state.cursor,
        pageSize: 50
      }
    });

    const posts = r.posts || [];
    state.cursor = r.nextCursor || "";
    state.posts = reset ? posts : state.posts.concat(posts);

    $loadMoreBtn.disabled = !state.cursor;
    $loadMoreMeta.textContent = state.cursor ? `다음 커서: ${state.cursor}` : "마지막 페이지";
    renderFeedList();

  } catch (e) {
    banner(`불러오기 실패: ${e.message || "네트워크 오류"}`);
    $loadMoreMeta.textContent = "오류 발생 (새로고침 시도)";
  } finally {
    state.loading = false;
  }
}

/* -----------------------
   Post detail
------------------------ */
async function openPost(postId) {
  showView("post");
  location.hash = `#post=${encodeURIComponent(postId)}`;

  $postBody.innerHTML = "";
  $commentList.innerHTML = "";
  $commentPreview.classList.add("is-hidden");
  $commentInput.value = "";
  $commentMeta.textContent = "불러오는 중…";

  try {
    const r = await api(`/posts/${postId}`);
    state.currentPost = r.post;

    renderPost(state.currentPost);
    await loadComments(postId);
  } catch (e) {
    toast("오류", e.message || "글 불러오기 실패");
    showView("feed");
  }
}

function renderPost(post) {
  $postCat.textContent = catName(post.category);
  $postCat.className = post.category === "notice" ? "tag tag--notice" : "tag";
  $postAuthor.textContent = post.authorName;
  $postTime.textContent = `${fmtTime(post.createdAt)} · ${relTime(post.createdAt)}`;
  $postTitle.textContent = post.title;
  $postBody.innerHTML = renderMarkdown(post.bodyMd);

  $postLikeCount.textContent = `👍 ${post.likes}`;
  $postCommentCount.textContent = `💬 ${post.comments}`;

  // 권한 버튼
  $postEditBtn.classList.toggle("is-hidden", !post.canEdit);
  $postDeleteBtn.classList.toggle("is-hidden", !post.canDelete);

  // admin pin
  const canPin = !!post.canPin;
  $postPinBtn.classList.toggle("is-hidden", !canPin);

  // bookmark btn 상태
  const on = isBookmarked(post.id);
  $postBookmarkBtn.classList.toggle("is-on", on);
  $postBookmarkBtn.title = on ? "북마크 해제" : "북마크";

  // 이벤트 바인딩
  $postBookmarkBtn.onclick = () => {
    const on2 = toggleBookmark(post);
    $postBookmarkBtn.classList.toggle("is-on", on2);
    renderIcons();
  };

  $postEditBtn.onclick = () => openEditPostModal(post);
  $postDeleteBtn.onclick = () => confirmDeletePost(post);
  $postReportBtn.onclick = () => openReportModal({ type: "post", id: post.id });
  $postLikeBtn.onclick = () => toggleLike("post", post.id);

  $postPinBtn.onclick = () => togglePin(post.id);

  renderIcons();
}

async function togglePin(postId) {
  try {
    const r = await api(`/posts/${postId}/pin`, { method: "POST" });
    toast("핀", r.pinned ? "공지 고정됨" : "고정 해제됨");
    // 다시 로드
    await openPost(postId);
    // 피드도 갱신 (고정순 정렬 영향)
    await refreshFeed(true);
  } catch (e) {
    toast("실패", e.message || "핀 토글 실패");
  }
}

async function toggleLike(targetType, targetId) {
  try {
    const r = await api("/likes/toggle", { method: "POST", body: { targetType, targetId } });
    toast("좋아요", r.liked ? "좋아요!" : "좋아요 취소");
    // 숫자 갱신은 서버 재조회가 확실
    if (state.currentPost?.id) await openPost(state.currentPost.id);
  } catch (e) {
    toast("실패", e.message || "좋아요 실패");
  }
}

function openReportModal({ type, id }) {
  if (!state.me) return toast("로그인 필요", "신고는 로그인 후 가능해요.");
  openModal({
    title: "신고",
    bodyHtml: `
      <div class="field">
        <div class="label">사유</div>
        <input id="rpReason" class="input" placeholder="예) 스팸, 욕설, 도배" />
      </div>
      <div class="field">
        <div class="label">상세</div>
        <textarea id="rpDetail" class="textarea" rows="4" placeholder="상세 내용을 적어 주세요"></textarea>
      </div>
      <div class="small">운영진이 확인 후 조치합니다.</div>
    `,
    footHtml: `
      <button class="btn btn--ghost" type="button" id="rpCancel">취소</button>
      <button class="btn btn--primary" type="button" id="rpSend">신고하기</button>
    `,
    onMount() {
      el("rpCancel").addEventListener("click", closeModal);
      el("rpSend").addEventListener("click", async () => {
        const reason = el("rpReason").value.trim() || "기타";
        const detail = el("rpDetail").value.trim();
        try {
          await api("/reports", { method: "POST", body: { targetType: type, targetId: id, reason, detail } });
          toast("접수 완료", "신고가 접수됐어요.");
          closeModal();
        } catch (e) {
          toast("실패", e.message || "신고 실패");
        }
      });
    }
  });
}

function openEditPostModal(post) {
  openModal({
    title: "글 수정",
    bodyHtml: `
      <div class="field">
        <div class="label">카테고리</div>
        <select id="epCat" class="select__box">
          <option value="free">자유</option>
          <option value="notice">공지</option>
          <option value="qna">Q&A</option>
          <option value="study">스터디</option>
        </select>
      </div>
      <div class="field">
        <div class="label">제목</div>
        <input id="epTitle" class="input" placeholder="제목" />
      </div>
      <div class="field">
        <div class="label">본문 (Markdown)</div>
        <textarea id="epBody" class="textarea" rows="10" placeholder="본문"></textarea>
        <div class="help"># ~ ###### 제목, 코드블럭, 표, 인용 등 지원</div>
      </div>
      <div class="field">
        <label class="toggle">
          <input id="epAnon" type="checkbox" />
          <span>익명</span>
        </label>
      </div>
      <div class="field">
        <div class="label">미리보기</div>
        <div id="epPreview" class="md" style="border:1px solid var(--stroke);border-radius:14px;padding:12px;background:rgba(255,255,255,.04)"></div>
      </div>
    `,
    footHtml: `
      <button class="btn btn--ghost" type="button" id="epCancel">취소</button>
      <button class="btn btn--primary" type="button" id="epSave">저장</button>
    `,
    onMount() {
      el("epCat").value = post.category;
      el("epTitle").value = post.title;
      el("epBody").value = post.bodyMd;
      el("epAnon").checked = !!post.anonymous;

      const renderPrev = () => {
        el("epPreview").innerHTML = renderMarkdown(el("epBody").value);
      };
      el("epBody").addEventListener("input", renderPrev);
      renderPrev();

      el("epCancel").addEventListener("click", closeModal);

      el("epSave").addEventListener("click", async () => {
        const category = el("epCat").value;
        const title = el("epTitle").value.trim();
        const bodyMd = el("epBody").value.trim();
        const anonymous = el("epAnon").checked;

        if (!title || !bodyMd) return toast("오류", "제목/본문을 입력해 주세요.");
        try {
          await api(`/posts/${post.id}`, { method: "PATCH", body: { category, title, bodyMd, anonymous } });
          toast("완료", "수정했어요.");
          closeModal();
          await openPost(post.id);
          await refreshFeed(true);
        } catch (e) {
          toast("실패", e.message || "수정 실패");
        }
      });
    }
  });
}

function confirmDeletePost(post) {
  openModal({
    title: "삭제 확인",
    bodyHtml: `<div>정말 이 글을 삭제할까요?</div><div class="small">삭제 후 복구는 어려워요.</div>`,
    footHtml: `
      <button class="btn btn--ghost" type="button" id="dpCancel">취소</button>
      <button class="btn btn--danger" type="button" id="dpOk">삭제</button>
    `,
    onMount() {
      el("dpCancel").addEventListener("click", closeModal);
      el("dpOk").addEventListener("click", async () => {
        try {
          await api(`/posts/${post.id}`, { method: "DELETE" });
          toast("삭제됨", "글을 삭제했어요.");
          closeModal();
          showView("feed");
          location.hash = "";
          await refreshFeed(true);
        } catch (e) {
          toast("실패", e.message || "삭제 실패");
        }
      });
    }
  });
}

/* -----------------------
   Comments
------------------------ */
async function loadComments(postId) {
  try {
    const r = await api(`/posts/${postId}/comments`);
    state.comments = r.comments || [];
    renderComments();
  } catch (e) {
    $commentMeta.textContent = "댓글 불러오기 실패";
    toast("오류", e.message || "댓글 로드 실패");
  }
}

function renderComments() {
  $commentMeta.textContent = `${state.comments.length}개`;
  $commentList.innerHTML = state.comments.map(commentCard).join("");
  renderIcons();

  // bind edit/delete/report/like
  qsa("[data-cmt-edit]", $commentList).forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-cmt-edit");
      const c = state.comments.find(x => x.id === id);
      if (!c) return;
      openEditCommentModal(c);
    });
  });
  qsa("[data-cmt-del]", $commentList).forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-cmt-del");
      const c = state.comments.find(x => x.id === id);
      if (!c) return;
      confirmDeleteComment(c);
    });
  });
  qsa("[data-cmt-report]", $commentList).forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-cmt-report");
      openReportModal({ type: "comment", id });
    });
  });
}

function commentCard(c) {
  // edit/delete 버튼 노출 기준: 서버가 댓글에 canEdit을 주지 않기 때문에
  // “내 닉네임과 동일 + 비익명”인 경우에만 버튼 제공 (익명은 본인여부 판별 불가)
  const meNick = state.me?.nickname || "";
  const canMaybeEdit = !!state.me && !c.anonymous && c.authorName === meNick;

  return `
    <div class="cmt">
      <div class="cmt__top">
        <div class="cmt__meta">
          <span><b>${escapeHtml(c.authorName)}</b></span>
          <span class="dot">•</span>
          <span title="${fmtTime(c.createdAt)}">${relTime(c.createdAt)}</span>
        </div>
        <div class="cmt__actions">
          <button class="iconBtn" type="button" data-cmt-report="${c.id}">🚩 신고</button>
          ${canMaybeEdit ? `<button class="iconBtn" type="button" data-cmt-edit="${c.id}">수정</button>` : ""}
          ${canMaybeEdit ? `<button class="iconBtn" type="button" data-cmt-del="${c.id}">삭제</button>` : ""}
        </div>
      </div>
      <div class="md">${renderMarkdown(c.bodyMd)}</div>
    </div>
  `;
}

function openEditCommentModal(c) {
  openModal({
    title: "댓글 수정",
    bodyHtml: `
      <div class="field">
        <div class="label">본문 (Markdown)</div>
        <textarea id="ecBody" class="textarea" rows="6"></textarea>
      </div>
      <div class="field">
        <label class="toggle">
          <input id="ecAnon" type="checkbox" />
          <span>익명</span>
        </label>
      </div>
      <div class="field">
        <div class="label">미리보기</div>
        <div id="ecPreview" class="md" style="border:1px solid var(--stroke);border-radius:14px;padding:12px;background:rgba(255,255,255,.04)"></div>
      </div>
      <div class="small">※ 익명 댓글은 본인 판별이 어려워 UI에서 수정 버튼이 제한될 수 있어요.</div>
    `,
    footHtml: `
      <button class="btn btn--ghost" type="button" id="ecCancel">취소</button>
      <button class="btn btn--primary" type="button" id="ecSave">저장</button>
    `,
    onMount() {
      el("ecBody").value = c.bodyMd || "";
      el("ecAnon").checked = !!c.anonymous;
      const renderPrev = () => el("ecPreview").innerHTML = renderMarkdown(el("ecBody").value);
      el("ecBody").addEventListener("input", renderPrev);
      renderPrev();

      el("ecCancel").addEventListener("click", closeModal);
      el("ecSave").addEventListener("click", async () => {
        const bodyMd = el("ecBody").value.trim();
        const anonymous = el("ecAnon").checked;
        if (!bodyMd) return toast("오류", "본문을 입력해 주세요.");
        try {
          await api(`/comments/${c.id}`, { method: "PATCH", body: { bodyMd, anonymous } });
          toast("완료", "댓글을 수정했어요.");
          closeModal();
          if (state.currentPost?.id) await loadComments(state.currentPost.id);
        } catch (e) {
          toast("실패", e.message || "댓글 수정 실패");
        }
      });
    }
  });
}

function confirmDeleteComment(c) {
  openModal({
    title: "댓글 삭제",
    bodyHtml: `<div>이 댓글을 삭제할까요?</div>`,
    footHtml: `
      <button class="btn btn--ghost" type="button" id="cdCancel">취소</button>
      <button class="btn btn--danger" type="button" id="cdOk">삭제</button>
    `,
    onMount() {
      el("cdCancel").addEventListener("click", closeModal);
      el("cdOk").addEventListener("click", async () => {
        try {
          await api(`/comments/${c.id}`, { method: "DELETE" });
          toast("삭제됨", "댓글을 삭제했어요.");
          closeModal();
          if (state.currentPost?.id) await loadComments(state.currentPost.id);
        } catch (e) {
          toast("실패", e.message || "댓글 삭제 실패");
        }
      });
    }
  });
}

/* 댓글 작성: Enter 전송 */
function bindCommentEnter() {
  $commentInput.addEventListener("keydown", async (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      await sendComment();
    }
  });
}

async function sendComment() {
  if (!state.currentPost?.id) return;
  if (!state.me) return toast("로그인 필요", "댓글은 로그인 후 작성할 수 있어요.");

  const bodyMd = $commentInput.value.trim();
  if (!bodyMd) return toast("오류", "댓글 내용을 입력해 주세요.");

  const anonymous = $commentAnon.checked;
  try {
    await api(`/posts/${state.currentPost.id}/comments`, { method: "POST", body: { bodyMd, anonymous } });
    $commentInput.value = "";
    $commentPreview.classList.add("is-hidden");
    toast("등록됨", "댓글을 등록했어요.");
    await loadComments(state.currentPost.id);
    // post counts 갱신
    await openPost(state.currentPost.id);
  } catch (e) {
    toast("실패", e.message || "댓글 등록 실패");
  }
}

/* -----------------------
   Create post modal
------------------------ */
function openNewPostModal() {
  if (!state.me) return toast("로그인 필요", "글 작성은 로그인 후 가능해요.");

  openModal({
    title: "새 글 작성",
    bodyHtml: `
      <div class="field">
        <div class="label">카테고리</div>
        <select id="npCat" class="select__box">
          <option value="free">자유</option>
          <option value="notice">공지</option>
          <option value="qna">Q&A</option>
          <option value="study">스터디</option>
        </select>
        <div class="help">공지 작성은 가능하지만, 고정(pinned)은 관리자만 가능</div>
      </div>
      <div class="field">
        <div class="label">제목</div>
        <input id="npTitle" class="input" placeholder="제목" />
      </div>
      <div class="field">
        <div class="label">본문 (Markdown)</div>
        <textarea id="npBody" class="textarea" rows="10" placeholder="# 제목부터 ### 소제목까지, 코드블럭, 표, 이미지 등"></textarea>
        <div class="help">이미지: <span class="kbd">![](https://...)</span></div>
      </div>
      <div class="field">
        <label class="toggle">
          <input id="npAnon" type="checkbox" />
          <span>익명</span>
        </label>
      </div>
      <div class="field">
        <div class="label">미리보기</div>
        <div id="npPreview" class="md" style="border:1px solid var(--stroke);border-radius:14px;padding:12px;background:rgba(255,255,255,.04)"></div>
      </div>
    `,
    footHtml: `
      <button class="btn btn--ghost" type="button" id="npCancel">취소</button>
      <button class="btn btn--primary" type="button" id="npPost">등록</button>
    `,
    onMount() {
      el("npCat").value = state.cat !== "all" ? state.cat : "free";

      const renderPrev = () => el("npPreview").innerHTML = renderMarkdown(el("npBody").value);
      el("npBody").addEventListener("input", renderPrev);
      renderPrev();

      el("npCancel").addEventListener("click", closeModal);
      el("npPost").addEventListener("click", async () => {
        const category = el("npCat").value;
        const title = el("npTitle").value.trim();
        const bodyMd = el("npBody").value.trim();
        const anonymous = el("npAnon").checked;

        if (!title || !bodyMd) return toast("오류", "제목/본문을 입력해 주세요.");

        try {
          const r = await api("/posts", { method: "POST", body: { category, title, bodyMd, anonymous } });
          toast("완료", "글을 올렸어요!");
          closeModal();
          await refreshFeed(true);
          await openPost(r.postId);
        } catch (e) {
          toast("실패", e.message || "글 작성 실패");
        }
      });
    }
  });
}

/* -----------------------
   Bookmarks modal
------------------------ */
function openBookmarksModal() {
  const b = getBookmarks();
  const items = Object.values(b).sort((a, c) => (c.pinned - a.pinned) || (c.createdAt - a.createdAt));
  const html = items.length
    ? items.map((x) => `
      <div class="item" tabindex="0" data-bm-open="${x.id}">
        <div class="item__top">
          <span class="tag">${escapeHtml(catName(x.category))}</span>
          ${x.pinned ? `<span class="pin"><span class="icon" data-lucide="pin"></span>고정</span>` : ""}
          <div class="item__right">
            <button class="btn btn--ghost" type="button" data-bm-del="${x.id}">제거</button>
          </div>
        </div>
        <div class="item__title">${escapeHtml(x.title)}</div>
        <div class="item__meta">
          <span>${escapeHtml(fmtTime(x.createdAt))}</span>
          <span class="dot">•</span>
          <span>${escapeHtml(relTime(x.createdAt))}</span>
        </div>
      </div>
    `).join("")
    : `<div class="muted">아직 북마크가 없어요. 피드에서 ★를 눌러 저장해 보세요.</div>`;

  openModal({
    title: "북마크",
    bodyHtml: html,
    footHtml: `<button class="btn btn--ghost" type="button" id="bmClose">닫기</button>`,
    onMount() {
      renderIcons();
      el("bmClose").addEventListener("click", closeModal);

      qsa("[data-bm-open]", $modalRoot).forEach((node) => {
        const id = node.getAttribute("data-bm-open");
        node.addEventListener("click", async () => {
          closeModal();
          await openPost(id);
        });
      });
      qsa("[data-bm-del]", $modalRoot).forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const id = btn.getAttribute("data-bm-del");
          const b2 = getBookmarks();
          delete b2[id];
          setBookmarks(b2);
          toast("북마크", "제거했어요.");
          closeModal();
          openBookmarksModal();
        });
      });
    }
  });
}

/* -----------------------
   My view (best-effort)
------------------------ */
async function loadMyPosts() {
  if (!state.me) return;
  // 일반 유저: listPosts에서 canEdit=true인 것만 추려도 대부분 본인 글
  // 단, admin은 canEdit이 모두 true라서 이 방식이 깨짐 → nickname 기반으로 필터
  const isAdmin = state.me.role === "admin" || state.me.role === "mod";

  $myList.innerHTML = `<div class="muted">불러오는 중…</div>`;
  try {
    const r = await api("/posts", { qsObj: { category: "all", sort: "latest", pageSize: 200 } });
    let posts = r.posts || [];

    if (isAdmin) {
      posts = posts.filter(p => !p.anonymous && p.authorName === state.me.nickname);
    } else {
      posts = posts.filter(p => p.canEdit === true);
    }

    if (!posts.length) {
      $myList.innerHTML = `<div class="muted">내 글이 아직 없어요.</div>`;
      return;
    }
    $myList.innerHTML = posts.map(postCard).join("");
    qsa("[data-open]", $myList).forEach((node) => {
      node.addEventListener("click", () => openPost(node.getAttribute("data-open")));
    });
    qsa("[data-bm]", $myList).forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-bm");
        const p = posts.find(x => x.id === id);
        if (!p) return;
        const on = toggleBookmark(p);
        btn.classList.toggle("is-on", on);
        renderIcons();
      });
    });
    renderIcons();
  } catch (e) {
    $myList.innerHTML = `<div class="muted">불러오기 실패: ${escapeHtml(e.message || "")}</div>`;
  }
}

async function loadMyComments() {
  if (!state.me) return;

  // 서버에 “내 댓글” 전용 API가 없어서
  // (현재 스펙상) 댓글을 전체 수집할 방법이 없음.
  // => “현재 열어본 글들에서 내가 남긴 댓글”만이라도 보여주는 방식으로, 기능을 ‘있는 척’ 하지 않게 명확히 표시.
  const note = `
    <div class="muted" style="margin-bottom:10px">
      현재 서버 API에 “내 댓글 전체 조회” 엔드포인트가 없어, <b>내가 최근 열어본 글에서 남긴 댓글</b>만 모아 보여줘요.
      (원하면 서버에 /me/comments 를 추가하면 100% 완벽하게 가능)
    </div>
  `;

  const cache = safeJson(sessionStorage.getItem("srt_seen_posts") || "{}") || {};
  const ids = Object.keys(cache).slice(0, 20);

  if (!ids.length) {
    $myList.innerHTML = note + `<div class="muted">아직 열어본 글이 없어요. 글을 몇 개 열어본 뒤 다시 확인해 보세요.</div>`;
    return;
  }

  $myList.innerHTML = note + `<div class="muted">불러오는 중…</div>`;

  try {
    const out = [];
    for (const pid of ids) {
      const r = await api(`/posts/${pid}/comments`);
      const cs = r.comments || [];
      // 내 닉네임 & 비익명 기준
      const mine = cs.filter(c => !c.anonymous && c.authorName === state.me.nickname);
      for (const c of mine) out.push({ ...c, _postId: pid, _postTitle: cache[pid]?.title || pid });
    }

    if (!out.length) {
      $myList.innerHTML = note + `<div class="muted">최근 열어본 글에서 내 댓글을 찾지 못했어요.</div>`;
      return;
    }

    $myList.innerHTML = note + out.map((c) => `
      <div class="item" tabindex="0" data-open="${c._postId}">
        <div class="item__top">
          <span class="tag">댓글</span>
          <span class="pill">${escapeHtml(c._postTitle)}</span>
          <div class="item__right">
            <span class="pill">${escapeHtml(relTime(c.createdAt))}</span>
          </div>
        </div>
        <div class="item__title">${escapeHtml((c.bodyMd || "").slice(0, 80))}${(c.bodyMd || "").length > 80 ? "…" : ""}</div>
        <div class="muted" style="font-size:12px">클릭하면 해당 글로 이동</div>
      </div>
    `).join("");

    qsa("[data-open]", $myList).forEach((node) => {
      node.addEventListener("click", () => openPost(node.getAttribute("data-open")));
    });
  } catch (e) {
    $myList.innerHTML = note + `<div class="muted">불러오기 실패: ${escapeHtml(e.message || "")}</div>`;
  }
}

function saveSeenPost(post) {
  const raw = sessionStorage.getItem("srt_seen_posts");
  const obj = raw ? safeJson(raw) : {};
  obj[post.id] = { title: post.title, at: Date.now() };
  // 최신순 20개만 유지
  const entries = Object.entries(obj).sort((a,b) => b[1].at - a[1].at).slice(0, 20);
  const next = {};
  for (const [k,v] of entries) next[k]=v;
  sessionStorage.setItem("srt_seen_posts", JSON.stringify(next));
}

/* -----------------------
   Admin view
------------------------ */
function renderAdminSeg() {
  const me = state.me;
  const isAdmin = me && (me.role === "admin" || me.role === "mod");
  // 관리 탭은 관리자에게만 의미 있음: 일반 유저는 클릭해도 안내
  $segAdmin.disabled = !isAdmin;
}
async function loadReports() {
  const me = state.me;
  if (!me || !(me.role === "admin" || me.role === "mod")) {
    return toast("권한 없음", "관리자만 볼 수 있어요.");
  }
  const status = $reportStatusSel.value || "open";
  $reportList.innerHTML = `<div class="muted">불러오는 중…</div>`;
  try {
    const r = await api("/admin/reports", { qsObj: { status, limit: 200 } });
    const reports = r.reports || [];
    if (!reports.length) {
      $reportList.innerHTML = `<div class="muted">신고가 없어요.</div>`;
      return;
    }
    $reportList.innerHTML = reports.map((x) => `
      <div class="item">
        <div class="item__top">
          <span class="tag">#${escapeHtml(x.status)}</span>
          <span class="pill">${escapeHtml(x.targetType)} · ${escapeHtml(x.targetId)}</span>
          <div class="item__right">
            ${x.status === "open" ? `<button class="btn btn--primary" type="button" data-close="${x.id}">닫기</button>` : ""}
          </div>
        </div>
        <div class="item__title">${escapeHtml(x.reason)}</div>
        <div class="item__meta">
          <span>신고자: ${escapeHtml(x.reporter)}</span>
          <span class="dot">•</span>
          <span>${escapeHtml(relTime(x.createdAt))}</span>
        </div>
        <div class="muted" style="margin-top:8px;white-space:pre-wrap">${escapeHtml(x.detail || "")}</div>
        <div class="row" style="margin-top:10px">
          <button class="btn btn--ghost" type="button" data-open-target="${escapeHtml(x.targetId)}">대상 열기</button>
        </div>
      </div>
    `).join("");

    qsa("[data-close]", $reportList).forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-close");
        try {
          await api(`/admin/reports/${id}/close`, { method: "POST" });
          toast("처리됨", "신고를 closed로 변경했어요.");
          await loadReports();
        } catch (e) {
          toast("실패", e.message || "처리 실패");
        }
      });
    });

    qsa("[data-open-target]", $reportList).forEach((btn) => {
      btn.addEventListener("click", async () => {
        const tid = btn.getAttribute("data-open-target");
        // post id인지 comment id인지 모르므로 우선 post로 시도
        try {
          await openPost(tid);
          showView("post");
        } catch {
          toast("안내", "대상이 글이 아닐 수 있어요 (댓글 신고는 글에서 확인)");
        }
      });
    });

  } catch (e) {
    $reportList.innerHTML = `<div class="muted">불러오기 실패: ${escapeHtml(e.message || "")}</div>`;
  }
}

/* -----------------------
   Navigation / Hash
------------------------ */
function parseHash() {
  const h = (location.hash || "").replace(/^#/, "");
  const p = new URLSearchParams(h);
  const postId = p.get("post");
  return { postId };
}

/* -----------------------
   Bind UI events
------------------------ */
function bindUI() {
  // Chips
  qsa(".chip").forEach((b) => {
    b.addEventListener("click", () => setCat(b.dataset.cat));
  });

  $sortSel.value = state.sort;
  $sortSel.addEventListener("change", () => setSort($sortSel.value));

  $qInput.value = state.q;
  $searchBtn.addEventListener("click", () => setQ($qInput.value.trim()));
  $qInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") setQ($qInput.value.trim());
  });

  $refreshBtn.addEventListener("click", () => refreshFeed(true));
  $loadMoreBtn.addEventListener("click", () => refreshFeed(false));

  $newPostBtn.addEventListener("click", openNewPostModal);
  $fabBtn.addEventListener("click", openNewPostModal);

  $themeBtn.addEventListener("click", () => {
    toggleTheme();
    renderIcons();
  });

  $bookmarksBtn.addEventListener("click", openBookmarksModal);

  $homeBtn.addEventListener("click", () => {
    showView("feed");
    location.hash = "";
  });

  $backBtn.addEventListener("click", () => {
    showView("feed");
    location.hash = "";
  });

  // Seg
  $segFeed.addEventListener("click", () => showView("feed"));
  $segMy.addEventListener("click", async () => {
    if (!state.me) return toast("로그인 필요", "내 활동은 로그인 후 이용할 수 있어요.");
    showView("my");
    state.myTab = "posts";
    setMyTabUI();
    await loadMyPosts();
  });
  $segAdmin.addEventListener("click", async () => {
    const me = state.me;
    if (!me || !(me.role === "admin" || me.role === "mod")) {
      return toast("권한 없음", "관리자만 이용할 수 있어요.");
    }
    showView("admin");
    await loadReports();
  });

  // My view buttons
  $myPostsBtn.addEventListener("click", async () => {
    state.myTab = "posts";
    setMyTabUI();
    await loadMyPosts();
  });
  $myCommentsBtn.addEventListener("click", async () => {
    state.myTab = "comments";
    setMyTabUI();
    await loadMyComments();
  });
  $myReloadBtn.addEventListener("click", async () => {
    if (state.myTab === "posts") await loadMyPosts();
    else await loadMyComments();
  });

  // Admin buttons
  $adminLoadReportsBtn.addEventListener("click", loadReports);
  $adminReloadBtn.addEventListener("click", loadReports);

  // Comment preview
  $commentPreviewBtn.addEventListener("click", () => {
    const on = $commentPreview.classList.contains("is-hidden");
    if (on) {
      $commentPreview.innerHTML = renderMarkdown($commentInput.value);
      $commentPreview.classList.remove("is-hidden");
    } else {
      $commentPreview.classList.add("is-hidden");
    }
  });

  $commentSendBtn.addEventListener("click", sendComment);
  bindCommentEnter();

  // Hash navigation
  window.addEventListener("hashchange", async () => {
    const { postId } = parseHash();
    if (postId) await openPost(postId);
  });

  // prevent “search button shifting” by never animating its width/position
}

/* My tab UI */
function setMyTabUI() {
  $myPostsBtn.classList.toggle("is-active", state.myTab === "posts");
  $myCommentsBtn.classList.toggle("is-active", state.myTab === "comments");
}

/* -----------------------
   Boot: real init flow
------------------------ */
async function init() {
  initTheme();
  setupMarkdown();
  renderIcons();

  const boot = bootRandomizer();

  // Step 1: server health
  boot.setRealStep(0);
  try {
    await api("/health");
  } catch (e) {
    banner("서버 연결 실패: API 주소 또는 네트워크를 확인해 주세요.");
  }

  // Step 2: session check
  boot.setRealStep(1);
  loadSession();
  renderUserBox();

  if (localStorage.getItem(LS.token)) {
    try {
      const me = await api("/auth/me");
      // /auth/me 응답 {ok:true,user:{...}}
      if (me?.user) {
        setSession(localStorage.getItem(LS.token), me.user);
      }
    } catch {
      // 토큰 만료/무효
      clearSession();
    }
  }

  renderAdminSeg();

  // Step 3: feed fetch
  boot.setRealStep(2);
  // 초기 UI 상태 세팅
  $qInput.value = state.q;
  $sortSel.value = state.sort;
  qsa(".chip").forEach((b) => b.classList.toggle("is-active", b.dataset.cat === state.cat));

  // WS
  connectWS();

  // Initial feed load
  await refreshFeed(true);

  // finish boot
  await boot.finish("완료!");
  renderIcons();

  // If hash has post, open
  const { postId } = parseHash();
  if (postId) await openPost(postId);
  else showView("feed");
}

/* -----------------------
   Global click: login button (re-rendered)
------------------------ */
document.addEventListener("click", (e) => {
  const t = e.target;
  if (t && t.id === "loginBtn") openLoginModal();
});

/* -----------------------
   Extra: keep seen post cache
------------------------ */
const _openPostOriginal = openPost;
openPost = async function(postId) {
  await _openPostOriginal(postId);
  if (state.currentPost) saveSeenPost(state.currentPost);
};

/* -----------------------
   Start
------------------------ */
bindUI();
init();
