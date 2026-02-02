// app.js
const API_BASE = "https://srt-community-api.yekong0728.workers.dev"; // ✅ 여기 맞춰!

/* ------------------------ DOM helpers ------------------------ */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k === "html") n.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  for (const c of children) {
    if (c == null) continue;
    if (typeof c === "string") n.appendChild(document.createTextNode(c));
    else n.appendChild(c);
  }
  return n;
}

/* ------------------------ Toast ------------------------ */
function toast(msg, type = "ok") {
  const root = $("#toastRoot");
  const t = el("div", { class: `toast toast--${type === "bad" ? "bad" : type === "ok" ? "ok" : ""}` }, msg);
  root.appendChild(t);
  setTimeout(() => t.classList.add("is-out"), 2600);
  setTimeout(() => t.remove(), 3200);
}

/* ------------------------ Modal ------------------------ */
function openModal(title, bodyNode, actions = []) {
  const root = $("#modalRoot");
  root.classList.remove("is-hidden");
  root.setAttribute("aria-hidden", "false");

  const modal = el("div", { class: "modal", role: "dialog", "aria-modal": "true" });
  const head = el("div", { class: "modal__head" },
    el("div", { class: "modal__title" }, title),
    el("button", { class: "btn btn--ghost", type: "button", onclick: closeModal }, "닫기")
  );
  const body = el("div", { class: "modal__body" }, bodyNode);
  const foot = el("div", { class: "modal__foot" }, ...actions);

  modal.append(head, body, foot);
  root.innerHTML = "";
  root.appendChild(modal);

  root.addEventListener("click", (e) => {
    if (e.target === root) closeModal();
  }, { once: true });
}

function closeModal() {
  const root = $("#modalRoot");
  root.classList.add("is-hidden");
  root.setAttribute("aria-hidden", "true");
  root.innerHTML = "";
}

/* ------------------------ Markdown ------------------------ */
marked.setOptions({
  gfm: true,
  breaks: true,
  headerIds: false,
  mangle: false,
});

function renderMd(md) {
  const raw = marked.parse(md || "");
  // DOMPurify로 XSS 방지
  return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
}

/* ------------------------ Storage ------------------------ */
const LS = {
  token: "srt_token",
  theme: "srt_theme",
  bookmarks: "srt_bookmarks", // { [postId]: { id,title,createdAt } }
};

function getToken() {
  return localStorage.getItem(LS.token) || "";
}
function setToken(t) {
  if (!t) localStorage.removeItem(LS.token);
  else localStorage.setItem(LS.token, t);
}
function loadBookmarks() {
  try { return JSON.parse(localStorage.getItem(LS.bookmarks) || "{}") || {}; } catch { return {}; }
}
function saveBookmarks(obj) {
  localStorage.setItem(LS.bookmarks, JSON.stringify(obj || {}));
}

/* ------------------------ API ------------------------ */
async function api(path, { method = "GET", body, auth = false } = {}) {
  const headers = { "content-type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const r = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await r.text();
  let data = null;
  try { data = JSON.parse(txt); } catch { data = { ok: false, raw: txt }; }
  if (!r.ok) throw Object.assign(new Error(data?.error || "request_failed"), { status: r.status, data });
  return data;
}

/* ------------------------ App state ------------------------ */
const state = {
  me: null,
  cat: "all",
  sort: "latest",
  q: "",
  cursor: "",
  loading: false,
  currentPostId: "",
  rt: { ws: null, status: "connecting", lastEventAt: 0 },
  admin: { reportCursor: "", reportStatus: "open" },
};

/* ------------------------ Boot loader ------------------------ */
function boot() {
  const bootEl = $("#boot");
  const bar = $("#bootBar");
  const pct = $("#bootPct");
  const hint = $("#bootHint");
  const ring = $("#bootRing");

  const hints = [
    "환경 설정 불러오는 중…",
    "세션 확인 중…",
    "게시판 초기화…",
    "실시간 채널 연결 준비…",
    "렌더링 최적화…",
    "마크다운 렌더러 준비…",
    "거의 다 됐어요…",
  ];
  let p = 0;

  function randStep() {
    // 가끔 멈추고, 가끔 빨라지고, 가끔 느려지는 느낌
    const r = Math.random();
    if (r < 0.10) return 0;          // 멈춤
    if (r < 0.40) return 1 + Math.random() * 3;
    if (r < 0.85) return 3 + Math.random() * 6;
    return 7 + Math.random() * 10;  // 빨라짐
  }
  function randSpeed() {
    // 링도 속도 랜덤
    const r = 0.7 + Math.random() * 1.4;
    ring.style.animationDuration = `${r}s`;
  }

  const timer = setInterval(() => {
    randSpeed();
    p = Math.min(100, p + randStep());
    bar.style.width = `${p}%`;
    pct.textContent = `${Math.floor(p)}%`;
    hint.textContent = hints[Math.min(hints.length - 1, Math.floor((p / 100) * hints.length))];

    if (p >= 100) {
      clearInterval(timer);
      setTimeout(() => {
        bootEl.classList.add("is-hidden");
      }, 280);
    }
  }, 180);
}

/* ------------------------ Theme ------------------------ */
function applyTheme(t) {
  if (t) document.documentElement.setAttribute("data-theme", t);
  else document.documentElement.removeAttribute("data-theme");
}
function initTheme() {
  const t = localStorage.getItem(LS.theme) || "";
  applyTheme(t);
}

/* ------------------------ Lucide ------------------------ */
function refreshIcons() {
  try {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
  } catch {}
}

/* ------------------------ UI helpers ------------------------ */
function setBanner(msg, kind = "ok") {
  const b = $("#banner");
  if (!msg) {
    b.classList.add("is-hidden");
    b.textContent = "";
    b.classList.remove("is-bad");
    return;
  }
  b.classList.remove("is-hidden");
  b.textContent = msg;
  b.classList.toggle("is-bad", kind === "bad");
}

function formatTime(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function catLabel(cat) {
  if (cat === "free") return "자유";
  if (cat === "notice") return "공지";
  if (cat === "qna") return "Q&A";
  if (cat === "study") return "스터디";
  if (cat === "all") return "전체";
  return cat;
}

function ensureLoginOrWarn() {
  if (state.me) return true;
  toast("로그인이 필요합니다.", "bad");
  openLoginModal();
  return false;
}

/* ------------------------ Realtime ------------------------ */
function setRtStatus(kind, meta = "—") {
  const rt = $(".rt");
  const label = $("#rtLabel");
  const metaEl = $("#rtMeta");

  rt.classList.remove("is-on", "is-bad");
  if (kind === "on") {
    rt.classList.add("is-on");
    label.textContent = "실시간: 연결됨";
  } else if (kind === "bad") {
    rt.classList.add("is-bad");
    label.textContent = "실시간: 연결 실패";
  } else {
    label.textContent = "실시간: 연결 중…";
  }
  metaEl.textContent = meta;
}

function connectRealtime() {
  try {
    if (state.rt.ws) {
      state.rt.ws.close();
      state.rt.ws = null;
    }
  } catch {}

  setRtStatus("connecting");
  const wsUrl = `${API_BASE.replace(/^http/, "ws")}/realtime?channel=feed`;
  const ws = new WebSocket(wsUrl);
  state.rt.ws = ws;

  ws.onopen = () => {
    state.rt.status = "on";
    setRtStatus("on", "feed");
    // ping
    try { ws.send("ping"); } catch {}
  };
  ws.onclose = () => {
    state.rt.status = "bad";
    setRtStatus("bad", "재연결 시도…");
    setTimeout(connectRealtime, 1200);
  };
  ws.onerror = () => {
    state.rt.status = "bad";
    setRtStatus("bad", "오류");
  };
  ws.onmessage = (e) => {
    let data = null;
    try { data = JSON.parse(e.data); } catch { return; }
    if (data?.type !== "event") return;
    state.rt.lastEventAt = Date.now();

    const payload = data.payload || {};
    if (payload.kind === "post_created") {
      toast("새 글이 올라왔어요. 새로고침하면 보입니다.", "ok");
      // 목록 화면이면 자동으로 살짝 표시
      if (!$("#feedView").classList.contains("is-hidden")) {
        $("#rtMeta").textContent = "새 글!";
      }
    }
    if (payload.kind === "comment_created") {
      toast("새 댓글이 달렸어요.", "ok");
    }
    if (payload.kind === "post_pinned") {
      toast(payload.pinned ? "공지 고정됨" : "공지 고정 해제됨", "ok");
    }
  };
}

/* ------------------------ Auth UI ------------------------ */
async function refreshMe() {
  const token = getToken();
  if (!token) {
    state.me = null;
    renderUserBox();
    return;
  }
  try {
    const me = await api("/auth/me", { auth: true });
    state.me = me.user;
  } catch {
    state.me = null;
    setToken("");
  }
  renderUserBox();
}

function renderUserBox() {
  const box = $("#userBox");
  box.innerHTML = "";

  const adminBtn = $("#adminBtn");
  if (state.me && (state.me.role === "admin" || state.me.role === "mod")) adminBtn.classList.remove("is-hidden");
  else adminBtn.classList.add("is-hidden");

  if (!state.me) {
    box.appendChild(el("button", { class: "btn btn--primary", id: "loginBtn2", type: "button", onclick: openLoginModal }, "로그인"));
    return;
  }

  const pill = el("span", { class: "pill" }, state.me.nickname);
  const role = (state.me.role === "admin" || state.me.role === "mod")
    ? el("span", { class: "badge badge--pin" }, state.me.role.toUpperCase())
    : null;

  const my = el("button", { class: "btn btn--ghost", type: "button", onclick: () => openMyActivity() },
    "내 활동"
  );
  const logout = el("button", { class: "btn btn--ghost", type: "button", onclick: doLogout }, "로그아웃");

  box.append(pill);
  if (role) box.append(role);
  box.append(my, logout);
}

function openLoginModal() {
  const id = el("input", { class: "input", placeholder: "닉네임 또는 학번", autocomplete: "username" });
  const pw = el("input", { class: "input", placeholder: "비밀번호", type: "password", autocomplete: "current-password" });

  const form = el("div", {},
    el("div", { class: "muted" }, "읽기는 누구나 · 쓰기는 로그인 필요"),
    el("div", { style: "height:10px" }),
    el("div", {}, el("div", { class: "muted" }, "아이디"), id),
    el("div", { style: "height:10px" }),
    el("div", {}, el("div", { class: "muted" }, "비밀번호"), pw),
  );

  openModal("로그인", form, [
    el("button", { class: "btn btn--ghost", type: "button", onclick: () => { closeModal(); openRegisterModal(); } }, "회원가입"),
    el("button", { class: "btn btn--primary", type: "button", onclick: async () => {
      try {
        const res = await api("/auth/login", { method: "POST", body: { identifier: id.value.trim(), password: pw.value } });
        setToken(res.token);
        closeModal();
        toast("로그인 성공", "ok");
        await refreshMe();
        await loadFeed(true);
      } catch (e) {
        toast("로그인 실패", "bad");
      }
    }}, "로그인"),
  ]);
}

function openRegisterModal() {
  const nick = el("input", { class: "input", placeholder: "닉네임(2~16)", autocomplete: "nickname" });
  const sid = el("input", { class: "input", placeholder: "학번(선택)", autocomplete: "off" });
  const pw = el("input", { class: "input", placeholder: "비밀번호(4자 이상)", type: "password", autocomplete: "new-password" });
  const pw2 = el("input", { class: "input", placeholder: "비밀번호 확인", type: "password", autocomplete: "new-password" });

  const body = el("div", {},
    el("div", { class: "muted" }, "닉네임은 영문/숫자/한글/_ 만 가능"),
    el("div", { style: "height:10px" }),
    el("div", {}, el("div", { class: "muted" }, "닉네임"), nick),
    el("div", { style: "height:10px" }),
    el("div", {}, el("div", { class: "muted" }, "학번(선택)"), sid),
    el("div", { style: "height:10px" }),
    el("div", {}, el("div", { class: "muted" }, "비밀번호"), pw),
    el("div", { style: "height:10px" }),
    el("div", {}, el("div", { class: "muted" }, "비밀번호 확인"), pw2),
  );

  openModal("회원가입", body, [
    el("button", { class: "btn btn--ghost", type: "button", onclick: closeModal }, "취소"),
    el("button", { class: "btn btn--primary", type: "button", onclick: async () => {
      if (pw.value !== pw2.value) { toast("비밀번호가 다릅니다.", "bad"); return; }
      try {
        await api("/auth/register", { method: "POST", body: { nickname: nick.value.trim(), studentId: sid.value.trim(), password: pw.value } });
        toast("가입 완료! 로그인 해주세요.", "ok");
        closeModal();
        openLoginModal();
      } catch (e) {
        toast("가입 실패(닉네임/학번 중복 또는 규칙 위반)", "bad");
      }
    }}, "가입하기"),
  ]);
}

async function doLogout() {
  try { await api("/auth/logout", { method: "POST", auth: true }); } catch {}
  setToken("");
  state.me = null;
  renderUserBox();
  toast("로그아웃", "ok");
  await loadFeed(true);
}

/* ------------------------ Feed / Routing ------------------------ */
function showView(name) {
  $("#feedView").classList.toggle("is-hidden", name !== "feed");
  $("#postView").classList.toggle("is-hidden", name !== "post");
  $("#adminView").classList.toggle("is-hidden", name !== "admin");
}

function setActiveCat(cat) {
  $$(".chip").forEach((c) => c.classList.toggle("is-active", c.dataset.cat === cat));
}

async function loadFeed(reset = false) {
  if (state.loading) return;
  state.loading = true;

  try {
    if (reset) {
      state.cursor = "";
      $("#list").innerHTML = "";
      $("#loadMoreMeta").textContent = "";
      setBanner("불러오는 중…");
    }

    if (state.cat === "me") {
      if (!ensureLoginOrWarn()) { setBanner(""); state.loading = false; return; }
      await openMyActivity(true);
      state.loading = false;
      return;
    }

    const qs = new URLSearchParams();
    qs.set("category", state.cat);
    qs.set("sort", state.sort);
    qs.set("pageSize", "30");
    if (state.q) qs.set("q", state.q);
    if (state.cursor) qs.set("cursor", state.cursor);

    const res = await api(`/posts?${qs.toString()}`, { auth: false });
    setBanner("");

    const items = res.posts || [];
    $("#pillCount").textContent = String(items.length + (reset ? 0 : 0));
    renderPostList(items, reset);

    state.cursor = res.nextCursor || "";
    $("#loadMoreMeta").textContent = state.cursor ? "더 불러올 수 있어요" : "끝!";
    $("#loadMoreBtn").style.display = state.cursor ? "inline-flex" : "none";
  } catch (e) {
    setBanner("서버 연결 실패. API 주소/CORS를 확인해 주세요.", "bad");
  } finally {
    state.loading = false;
    refreshIcons();
  }
}

function renderPostList(posts, reset) {
  const list = $("#list");

  if (reset && (!posts || posts.length === 0)) {
    list.appendChild(el("div", { class: "item" },
      el("div", { class: "item__title" }, "아직 글이 없어요."),
      el("div", { class: "item__meta" }, "첫 글을 작성해 커뮤니티를 시작해보세요!")
    ));
    return;
  }

  for (const p of posts) {
    const badges = el("div", { class: "item__badges" });
    if (p.pinned) badges.appendChild(el("span", { class: "badge badge--pin" }, "PIN"));
    badges.appendChild(el("span", { class: "badge" }, `👍 ${p.likes}`));
    badges.appendChild(el("span", { class: "badge" }, `💬 ${p.comments}`));

    const item = el("div", { class: "item", onclick: () => openPost(p.id) },
      el("div", { class: "item__top" },
        el("span", { class: "tag" }, catLabel(p.category)),
        el("div", { class: "item__title" }, p.title),
        badges
      ),
      el("div", { class: "item__meta" },
        el("span", {}, p.authorName),
        el("span", {}, "•"),
        el("span", {}, formatTime(p.createdAt))
      )
    );
    list.appendChild(item);
  }
}

async function openPost(postId) {
  showView("post");
  state.currentPostId = postId;
  $("#postBody").innerHTML = "";
  $("#postTitle").textContent = "불러오는 중…";
  $("#commentList").innerHTML = "";
  $("#commentPreview").classList.add("is-hidden");
  $("#commentInput").value = "";
  $("#postEditBtn").classList.add("is-hidden");
  $("#postDeleteBtn").classList.add("is-hidden");
  $("#postPinBtn").classList.add("is-hidden");
  $("#postPinned").classList.add("is-hidden");

  try {
    const res = await api(`/posts/${postId}`, { auth: true }); // auth 있으면 canEdit/canDelete 정확
    if (!res.ok) throw new Error("fail");

    const p = res.post;
    $("#postCat").textContent = catLabel(p.category);
    $("#postAuthor").textContent = p.authorName;
    $("#postTime").textContent = formatTime(p.createdAt);
    $("#postTitle").textContent = p.title;
    $("#postBody").innerHTML = renderMd(p.bodyMd);
    $("#postLikeCount").textContent = `👍 ${p.likes}`;
    $("#postCommentCount").textContent = `💬 ${p.comments}`;

    if (p.pinned) $("#postPinned").classList.remove("is-hidden");
    else $("#postPinned").classList.add("is-hidden");

    // Buttons
    if (p.canEdit) $("#postEditBtn").classList.remove("is-hidden");
    if (p.canDelete) $("#postDeleteBtn").classList.remove("is-hidden");
    if (state.me && (state.me.role === "admin" || state.me.role === "mod")) {
      $("#postPinBtn").classList.remove("is-hidden");
    }

    // comments
    await loadComments(postId);

    // bookmark UI
    syncBookmarkBtn(postId, p.title, p.createdAt);

  } catch (e) {
    toast("글 불러오기 실패", "bad");
    showView("feed");
  } finally {
    refreshIcons();
  }
}

async function loadComments(postId) {
  try {
    const res = await api(`/posts/${postId}/comments`, { auth: true });
    const list = $("#commentList");
    list.innerHTML = "";
    const cs = res.comments || [];
    $("#commentMeta").textContent = `총 ${cs.length}개`;

    if (cs.length === 0) {
      list.appendChild(el("div", { class: "comment" },
        el("div", { class: "muted" }, "아직 댓글이 없어요. 첫 댓글을 남겨보세요!")
      ));
      return;
    }

    for (const c of cs) {
      const head = el("div", { class: "comment__head" },
        el("span", { class: "tag" }, c.authorName),
        el("span", { class: "muted" }, formatTime(c.createdAt)),
      );

      const actions = el("div", { class: "comment__actions" });
      if (c.canDelete) {
        actions.appendChild(el("button", { class: "btn btn--danger", type: "button", onclick: async (ev) => {
          ev.stopPropagation();
          if (!confirm("댓글을 삭제할까요?")) return;
          try {
            await api(`/comments/${c.id}`, { method: "DELETE", auth: true });
            toast("댓글 삭제됨", "ok");
            await loadComments(postId);
          } catch {
            toast("삭제 실패", "bad");
          }
        }}, "삭제"));
      }
      head.appendChild(actions);

      const body = el("div", { class: "comment__body md", html: renderMd(c.bodyMd) });
      list.appendChild(el("div", { class: "comment" }, head, body));
    }
  } catch {
    $("#commentMeta").textContent = "댓글 불러오기 실패";
  } finally {
    refreshIcons();
  }
}

/* ------------------------ Post actions ------------------------ */
function openEditorModal({ mode, postId, initial }) {
  const title = el("input", { class: "input", placeholder: "제목", value: initial?.title || "" });
  const category = el("select", { class: "select__box" },
    el("option", { value: "free" }, "자유"),
    el("option", { value: "notice" }, "공지"),
    el("option", { value: "qna" }, "Q&A"),
    el("option", { value: "study" }, "스터디"),
  );
  category.value = initial?.category || "free";

  const anon = el("input", { type: "checkbox" });
  anon.checked = !!initial?.anonymous;

  const body = el("textarea", { class: "textarea", rows: "10" }, initial?.bodyMd || "");
  body.value = initial?.bodyMd || "";

  const preview = el("div", { class: "md", style: "display:none; margin-top:10px" });

  const form = el("div", {},
    el("div", { class: "row" },
      el("div", { style: "flex:1" }, el("div", { class: "muted" }, "제목"), title),
      el("div", { style: "width:200px" }, el("div", { class: "muted" }, "카테고리"), category),
    ),
    el("div", { class: "row" },
      el("label", { class: "toggle" }, anon, el("span", {}, "익명")),
      el("div", { class: "muted" }, "이미지: ![](링크) / 코드: ```lang"),
    ),
    el("div", {}, el("div", { class: "muted" }, "본문(Markdown)"), body),
    preview
  );

  const btnPreview = el("button", { class: "btn btn--ghost", type: "button", onclick: () => {
    preview.style.display = preview.style.display === "none" ? "block" : "none";
    preview.innerHTML = renderMd(body.value);
    refreshIcons();
  }}, "미리보기");

  const btnSave = el("button", { class: "btn btn--primary", type: "button", onclick: async () => {
    if (!ensureLoginOrWarn()) return;
    const payload = {
      title: title.value.trim(),
      category: category.value,
      bodyMd: body.value,
      anonymous: anon.checked,
    };
    try {
      if (mode === "new") {
        const res = await api("/posts", { method: "POST", body: payload, auth: true });
        toast("작성 완료", "ok");
        closeModal();
        await loadFeed(true);
        await openPost(res.postId);
      } else {
        await api(`/posts/${postId}`, { method: "PATCH", body: payload, auth: true });
        toast("수정 완료", "ok");
        closeModal();
        await openPost(postId);
      }
    } catch {
      toast("저장 실패", "bad");
    }
  }}, mode === "new" ? "작성" : "저장");

  openModal(mode === "new" ? "새 글 작성" : "글 수정", form, [btnPreview, btnSave]);
}

async function openEditCurrentPost() {
  const pid = state.currentPostId;
  const res = await api(`/posts/${pid}`, { auth: true });
  const p = res.post;
  openEditorModal({ mode: "edit", postId: pid, initial: { title: p.title, category: p.category, bodyMd: p.bodyMd, anonymous: p.anonymous } });
}

async function deleteCurrentPost() {
  if (!confirm("정말 삭제할까요?")) return;
  try {
    await api(`/posts/${state.currentPostId}`, { method: "DELETE", auth: true });
    toast("삭제 완료", "ok");
    showView("feed");
    await loadFeed(true);
  } catch {
    toast("삭제 실패", "bad");
  }
}

async function togglePinCurrentPost() {
  try {
    const res = await api(`/admin/posts/${state.currentPostId}/pin`, { method: "POST", auth: true });
    toast(res.pinned ? "공지 고정됨" : "공지 고정 해제됨", "ok");
    await openPost(state.currentPostId);
    await loadFeed(true);
  } catch {
    toast("핀 변경 실패(관리자 권한 필요)", "bad");
  }
}

/* ------------------------ Like / Report ------------------------ */
async function likeCurrentPost() {
  if (!ensureLoginOrWarn()) return;
  try {
    // 토글Like는 post/comment 둘 다 가능
    await api("/likes/toggle", { method: "POST", auth: true, body: { targetType: "post", targetId: state.currentPostId } });
    toast("좋아요 반영됨", "ok");
    await openPost(state.currentPostId);
  } catch {
    toast("좋아요 실패", "bad");
  }
}

function openReportModal(targetType, targetId) {
  if (!ensureLoginOrWarn()) return;

  const reason = el("select", { class: "select__box" },
    el("option", { value: "스팸/광고" }, "스팸/광고"),
    el("option", { value: "욕설/비방" }, "욕설/비방"),
    el("option", { value: "개인정보" }, "개인정보"),
    el("option", { value: "불쾌한 콘텐츠" }, "불쾌한 콘텐츠"),
    el("option", { value: "기타" }, "기타"),
  );
  const detail = el("textarea", { class: "textarea", rows: "5", placeholder: "상세 사유(선택)" });

  const body = el("div", {},
    el("div", { class: "muted" }, "신고는 관리자에게 전달되며, 허위 신고는 제재될 수 있습니다."),
    el("div", { style: "height:10px" }),
    el("div", {}, el("div", { class: "muted" }, "사유"), reason),
    el("div", { style: "height:10px" }),
    el("div", {}, el("div", { class: "muted" }, "상세"), detail),
  );

  openModal("신고하기", body, [
    el("button", { class: "btn btn--ghost", type: "button", onclick: closeModal }, "취소"),
    el("button", { class: "btn btn--danger", type: "button", onclick: async () => {
      try {
        await api("/reports", { method: "POST", auth: true, body: { targetType, targetId, reason: reason.value, detail: detail.value } });
        toast("신고가 접수되었습니다.", "ok");
        closeModal();
      } catch {
        toast("신고 실패", "bad");
      }
    }}, "신고 접수"),
  ]);
}

/* ------------------------ Comments composer ------------------------ */
function initCommentComposer() {
  const input = $("#commentInput");
  const previewBtn = $("#commentPreviewBtn");
  const preview = $("#commentPreview");

  previewBtn.addEventListener("click", () => {
    const on = preview.classList.toggle("is-hidden");
    if (!on) preview.innerHTML = renderMd(input.value);
  });

  input.addEventListener("keydown", async (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      await sendComment();
    }
  });

  $("#commentSendBtn").addEventListener("click", sendComment);
}

async function sendComment() {
  if (!ensureLoginOrWarn()) return;
  const pid = state.currentPostId;
  const bodyMd = $("#commentInput").value.trim();
  if (!bodyMd) { toast("댓글 내용을 입력하세요.", "bad"); return; }

  try {
    await api(`/posts/${pid}/comments`, {
      method: "POST",
      auth: true,
      body: { bodyMd, anonymous: $("#commentAnon").checked }
    });
    $("#commentInput").value = "";
    $("#commentPreview").classList.add("is-hidden");
    toast("댓글 등록됨", "ok");
    await loadComments(pid);
    await openPost(pid);
  } catch {
    toast("댓글 등록 실패", "bad");
  }
}

/* ------------------------ Bookmarks ------------------------ */
function syncBookmarkBtn(postId, title, createdAt) {
  const btn = $("#postBookmarkBtn");
  const bm = loadBookmarks();
  const on = !!bm[postId];
  btn.innerHTML = on
    ? `<i data-lucide="bookmark-check" class="i"></i> 북마크됨`
    : `<i data-lucide="bookmark" class="i"></i> 북마크`;
  btn.onclick = () => {
    const cur = loadBookmarks();
    if (cur[postId]) {
      delete cur[postId];
      toast("북마크 제거", "ok");
    } else {
      cur[postId] = { id: postId, title, createdAt };
      toast("북마크 저장", "ok");
    }
    saveBookmarks(cur);
    syncBookmarkBtn(postId, title, createdAt);
    refreshIcons();
  };
  refreshIcons();
}

function openBookmarkList() {
  const bm = loadBookmarks();
  const items = Object.values(bm).sort((a,b)=> (b.createdAt||0)-(a.createdAt||0));
  const wrap = el("div", {});
  if (items.length === 0) {
    wrap.appendChild(el("div", { class: "muted" }, "북마크가 비어있어요."));
  } else {
    for (const it of items) {
      wrap.appendChild(el("div", { class: "item", onclick: () => { closeModal(); openPost(it.id); } },
        el("div", { class: "item__top" },
          el("div", { class: "item__title" }, it.title || it.id),
          el("div", { class: "item__badges" }, el("span", { class: "badge" }, formatTime(it.createdAt || 0)))
        )
      ));
    }
  }
  openModal("북마크", wrap, [
    el("button", { class: "btn btn--danger", type: "button", onclick: () => {
      if (!confirm("북마크를 전부 지울까요?")) return;
      saveBookmarks({});
      closeModal();
      toast("북마크 초기화", "ok");
    }}, "전체 삭제"),
  ]);
}

/* ------------------------ My Activity ------------------------ */
async function openMyActivity(inline = false) {
  if (!ensureLoginOrWarn()) return;

  const tab = el("div", { class: "chips" },
    el("button", { class: "chip is-active", type: "button" }, "내 글"),
    el("button", { class: "chip", type: "button" }, "내 댓글")
  );
  const content = el("div", { style: "margin-top:10px" }, el("div", { class: "muted" }, "불러오는 중…"));

  const body = el("div", {}, tab, content);

  async function load(kind) {
    content.innerHTML = "";
    content.appendChild(el("div", { class: "muted" }, "불러오는 중…"));
    try {
      if (kind === "posts") {
        const res = await api(`/me/posts?limit=100`, { auth: true });
        content.innerHTML = "";
        const posts = res.posts || [];
        if (!posts.length) content.appendChild(el("div", { class: "muted" }, "작성한 글이 없어요."));
        for (const p of posts) {
          content.appendChild(el("div", { class: "item", onclick: () => { if (!inline) closeModal(); openPost(p.id); } },
            el("div", { class: "item__top" },
              el("span", { class: "tag" }, catLabel(p.category)),
              el("div", { class: "item__title" }, p.title),
              el("div", { class: "item__badges" }, p.pinned ? el("span", { class: "badge badge--pin" }, "PIN") : null)
            ),
            el("div", { class: "item__meta" }, formatTime(p.createdAt))
          ));
        }
      } else {
        const res = await api(`/me/comments?limit=100`, { auth: true });
        content.innerHTML = "";
        const cs = res.comments || [];
        if (!cs.length) content.appendChild(el("div", { class: "muted" }, "작성한 댓글이 없어요."));
        for (const c of cs) {
          content.appendChild(el("div", { class: "item", onclick: () => { if (!inline) closeModal(); openPost(c.postId); } },
            el("div", { class: "item__top" },
              el("span", { class: "tag" }, "댓글"),
              el("div", { class: "item__title" }, c.postTitle || "(게시물)"),
              el("div", { class: "item__badges" }, el("span", { class: "badge" }, formatTime(c.createdAt)))
            ),
            el("div", { class: "item__meta" }, el("span", { class: "muted" }, "내용(요약): "), el("span", {}, (c.bodyMd||"").slice(0,80)))
          ));
        }
      }
    } catch {
      content.innerHTML = "";
      content.appendChild(el("div", { class: "muted" }, "불러오기 실패"));
    }
    refreshIcons();
  }

  const [btnPosts, btnComments] = tab.querySelectorAll(".chip");
  btnPosts.onclick = () => {
    btnPosts.classList.add("is-active"); btnComments.classList.remove("is-active");
    load("posts");
  };
  btnComments.onclick = () => {
    btnComments.classList.add("is-active"); btnPosts.classList.remove("is-active");
    load("comments");
  };

  await load("posts");

  if (inline) {
    // "내 활동" 탭으로 눌렀을 때: 모달 대신 feed 영역에 표시하고 싶으면 확장 가능
    openModal("내 활동", body, []);
  } else {
    openModal("내 활동", body, []);
  }
}

/* ------------------------ Admin Reports UI ------------------------ */
async function openAdmin() {
  showView("admin");
  state.admin.reportCursor = "";
  $("#reportList").innerHTML = "";
  $("#reportMoreMeta").textContent = "";
  await loadReports(true);
}

async function loadReports(reset = false) {
  try {
    if (reset) {
      state.admin.reportCursor = "";
      $("#reportList").innerHTML = "";
      $("#reportMoreMeta").textContent = "불러오는 중…";
    }
    const qs = new URLSearchParams();
    qs.set("status", state.admin.reportStatus);
    qs.set("limit", "30");
    if (state.admin.reportCursor) qs.set("cursor", state.admin.reportCursor);

    const res = await api(`/admin/reports?${qs.toString()}`, { auth: true });
    const list = $("#reportList");
    const items = res.reports || [];

    for (const r of items) {
      const item = el("div", { class: "item" },
        el("div", { class: "item__top" },
          el("span", { class: "tag" }, `신고:${r.targetType}`),
          el("div", { class: "item__title" }, r.postTitle || r.targetId),
          el("div", { class: "item__badges" },
            el("span", { class: "badge" }, r.status),
            el("span", { class: "badge" }, r.reason)
          )
        ),
        el("div", { class: "item__meta" },
          el("span", {}, `신고자: ${r.reporter}`),
          el("span", {}, "•"),
          el("span", {}, formatTime(r.createdAt))
        ),
        el("div", { class: "row" },
          el("div", { class: "muted", style: "flex:1" }, r.detail || ""),
          el("button", { class: "btn btn--ghost", type: "button", onclick: async () => {
            // 해당 글로 이동
            if (r.targetType === "post") openPost(r.targetId);
            else toast("댓글 신고 상세 이동은 (postId 필요) 확장 가능", "bad");
          }}, "열기"),
          el("button", { class: "btn btn--primary", type: "button", onclick: async () => {
            try {
              await api(`/admin/reports/${r.id}/resolve`, { method: "POST", auth: true });
              toast("처리완료", "ok");
              await loadReports(true);
            } catch { toast("처리 실패", "bad"); }
          }}, "완료"),
        )
      );
      list.appendChild(item);
    }

    state.admin.reportCursor = res.nextCursor || "";
    $("#reportMoreBtn").style.display = state.admin.reportCursor ? "inline-flex" : "none";
    $("#reportMoreMeta").textContent = state.admin.reportCursor ? "더 불러올 수 있어요" : "끝!";
    refreshIcons();
  } catch {
    toast("신고함 불러오기 실패(권한/토큰 확인)", "bad");
    $("#reportMoreMeta").textContent = "불러오기 실패";
  }
}

/* ------------------------ Wiring ------------------------ */
function bindEvents() {
  $("#themeBtn").addEventListener("click", () => {
    const cur = localStorage.getItem(LS.theme) || "";
    const next = cur === "light" ? "" : "light";
    localStorage.setItem(LS.theme, next);
    applyTheme(next);
  });

  $("#homeBtn").addEventListener("click", async () => {
    showView("feed");
    await loadFeed(true);
  });

  $("#adminBtn").addEventListener("click", openAdmin);
  $("#reportStatusSel").addEventListener("change", async (e) => {
    state.admin.reportStatus = e.target.value;
    await loadReports(true);
  });
  $("#reportMoreBtn").addEventListener("click", () => loadReports(false));

  $$(".chip").forEach((btn) => {
    btn.addEventListener("click", async () => {
      state.cat = btn.dataset.cat;
      setActiveCat(state.cat);
      showView("feed");
      await loadFeed(true);
    });
  });

  $("#sortSel").addEventListener("change", async (e) => {
    state.sort = e.target.value;
    await loadFeed(true);
  });

  $("#searchBtn").addEventListener("click", async () => {
    state.q = $("#qInput").value.trim();
    await loadFeed(true);
  });

  $("#qInput").addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      state.q = $("#qInput").value.trim();
      await loadFeed(true);
    }
  });

  $("#refreshBtn").addEventListener("click", () => loadFeed(true));
  $("#loadMoreBtn").addEventListener("click", () => loadFeed(false));

  $("#newPostBtn").addEventListener("click", () => {
    if (!ensureLoginOrWarn()) return;
    openEditorModal({ mode: "new", initial: { category: state.cat === "all" ? "free" : state.cat } });
  });
  $("#fabBtn").addEventListener("click", () => {
    if (!ensureLoginOrWarn()) return;
    openEditorModal({ mode: "new", initial: { category: state.cat === "all" ? "free" : state.cat } });
  });

  $("#bookmarkBtn").addEventListener("click", openBookmarkList);

  $("#backBtn").addEventListener("click", async () => {
    showView("feed");
    await loadFeed(false);
  });

  $("#postEditBtn").addEventListener("click", openEditCurrentPost);
  $("#postDeleteBtn").addEventListener("click", deleteCurrentPost);
  $("#postPinBtn").addEventListener("click", togglePinCurrentPost);

  $("#postLikeBtn").addEventListener("click", likeCurrentPost);
  $("#postReportBtn").addEventListener("click", () => openReportModal("post", state.currentPostId));

  initCommentComposer();
}

/* ------------------------ Init ------------------------ */
(async function init() {
  boot();
  initTheme();
  bindEvents();

  // icons first
  refreshIcons();

  await refreshMe();
  await loadFeed(true);

  connectRealtime();

  // prevent UI shift: keep rt width stable already in CSS
})();
