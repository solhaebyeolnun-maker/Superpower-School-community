/* =========================
   SRT Community Frontend
   - Static (GitHub Pages)
   - API: Cloudflare Workers
   ========================= */

/** ✅ 여기에 네 API 주소 */
const API_BASE = "https://srt-community-api.yekong0728.workers.dev";

/* ---------- State ---------- */
const LS_TOKEN = "srt_token";
const LS_USER = "srt_user";
const LS_DRAFT = "srt_draft_v1";

const state = {
  token: localStorage.getItem(LS_TOKEN) || "",
  user: safeJson(localStorage.getItem(LS_USER)) || null,

  category: "all",
  q: "",
  sort: "latest",
  cursor: "",

  view: "feed",       // feed | post
  postId: "",

  ws: null,
  wsOk: false,
  loading: false,
};

function safeJson(s){
  try { return JSON.parse(s); } catch { return null; }
}

/* ---------- DOM ---------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const viewEl = $("#view");
const btnMore = $("#btnMore");
const btnNew = $("#btnNew");
const btnAuth = $("#btnAuth");
const userChip = $("#userChip");
const userNick = $("#userNick");
const userRole = $("#userRole");
const btnLogout = $("#btnLogout");

const rtBadge = $("#rtBadge");
const rtText = $("#rtText");

const qInput = $("#q");
const sortSel = $("#sort");
const btnSearch = $("#btnSearch");

const modalRoot = $("#modalRoot");
const modalTitle = $("#modalTitle");
const modalBody = $("#modalBody");

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons();
  setupMarked();
  bindEvents();
  refreshAuthUI();
  applyDraftIfAny();
  routeFromHash();
  connectRealtime();
});

/* ---------- Markdown ---------- */
function setupMarked(){
  marked.setOptions({
    gfm: true,
    breaks: true,
    headerIds: false,
    mangle: false,
  });
}
function mdToHtml(md){
  const raw = marked.parse(md || "");
  // ✅ XSS 방지
  return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
}

/* ---------- Toast ---------- */
function toast(msg, kind="info"){
  const host = $("#toastHost");
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  host.appendChild(el);

  // Motion One fade
  if (window.motion?.animate){
    window.motion.animate(el, { opacity: [0,1], transform: ["translateY(6px)","translateY(0px)"] }, { duration: .18 });
  }

  setTimeout(() => {
    if (window.motion?.animate){
      window.motion.animate(el, { opacity: [1,0], transform: ["translateY(0px)","translateY(6px)"] }, { duration: .18 })
        .finished.then(() => el.remove()).catch(()=>el.remove());
    } else el.remove();
  }, kind==="error" ? 4200 : 2600);
}

/* ---------- Modal ---------- */
function openModal(title, bodyNode){
  modalTitle.textContent = title;
  modalBody.innerHTML = "";
  modalBody.appendChild(bodyNode);
  modalRoot.classList.remove("hidden");
  modalRoot.setAttribute("aria-hidden", "false");
  lucide.createIcons();
  if (window.motion?.animate){
    const panel = modalRoot.querySelector(".modal-panel");
    window.motion.animate(panel, { opacity:[0,1], transform:["translateY(10px)","translateY(0px)"] }, { duration:.18 });
  }
}
function closeModal(){
  modalRoot.classList.add("hidden");
  modalRoot.setAttribute("aria-hidden", "true");
  modalBody.innerHTML = "";
}

/* ---------- Events ---------- */
function bindEvents(){
  // Category
  $$(".seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      $$(".seg-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.category = btn.dataset.cat;
      state.cursor = "";
      goFeed();
    });
  });

  // Search
  btnSearch.addEventListener("click", () => {
    state.q = (qInput.value || "").trim();
    state.cursor = "";
    goFeed();
  });
  qInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") btnSearch.click();
  });

  // Sort
  sortSel.addEventListener("change", () => {
    state.sort = sortSel.value;
    state.cursor = "";
    goFeed();
  });

  // More
  btnMore.addEventListener("click", async () => {
    if (state.loading) return;
    await loadFeed({ append:true });
  });

  // New post
  btnNew.addEventListener("click", () => {
    if (!state.token) return openAuthModal("login");
    openComposerModal();
  });

  // Auth
  btnAuth.addEventListener("click", () => openAuthModal("login"));
  btnLogout.addEventListener("click", async () => {
    await api("/auth/logout", { method:"POST" }).catch(()=>{});
    setAuth(null, "");
    toast("로그아웃 완료");
    goFeed();
  });

  // Modal close
  modalRoot.addEventListener("click", (e) => {
    const t = e.target;
    if (t?.dataset?.close === "1") closeModal();
    if (t?.classList?.contains("modal-backdrop")) closeModal();
  });

  // Routing
  window.addEventListener("hashchange", routeFromHash);
}

/* ---------- Routing ---------- */
function routeFromHash(){
  const h = location.hash.replace(/^#\/?/, "");
  if (!h){
    state.view = "feed";
    state.postId = "";
    loadFeed({ append:false });
    return;
  }
  const parts = h.split("/");
  if (parts[0] === "post" && parts[1]){
    state.view = "post";
    state.postId = parts[1];
    loadPost(state.postId);
    return;
  }
  // fallback
  state.view = "feed";
  state.postId = "";
  loadFeed({ append:false });
}

function goFeed(){
  location.hash = "#/";
}
function goPost(id){
  location.hash = `#/post/${encodeURIComponent(id)}`;
}

/* ---------- Auth helpers ---------- */
function setAuth(user, token){
  state.user = user;
  state.token = token || "";
  if (token) localStorage.setItem(LS_TOKEN, token); else localStorage.removeItem(LS_TOKEN);
  if (user) localStorage.setItem(LS_USER, JSON.stringify(user)); else localStorage.removeItem(LS_USER);
  refreshAuthUI();
}

function refreshAuthUI(){
  const logged = !!state.token && !!state.user;
  if (logged){
    btnAuth.classList.add("hidden");
    userChip.classList.remove("hidden");
    userChip.classList.add("flex");
    userNick.textContent = state.user.nickname || "user";
    userRole.textContent = state.user.role ? `(${state.user.role})` : "";
  } else {
    btnAuth.classList.remove("hidden");
    userChip.classList.add("hidden");
    userChip.classList.remove("flex");
  }
}

async function refreshMe(){
  if (!state.token) return;
  const r = await api("/auth/me").catch(()=>null);
  if (r?.ok && r.user){
    setAuth(r.user, state.token);
  } else {
    setAuth(null, "");
  }
}

/* ---------- API ---------- */
async function api(path, opt={}){
  const url = API_BASE + path;
  const headers = Object.assign({ "content-type":"application/json" }, opt.headers || {});
  if (state.token) headers["Authorization"] = "Bearer " + state.token;

  const res = await fetch(url, Object.assign({}, opt, { headers }));
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { ok:false, raw:text }; }

  if (!res.ok){
    const msg = data?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

/* ---------- Realtime (WebSocket) ---------- */
function setRealtimeStatus(ok, msg){
  state.wsOk = !!ok;
  rtBadge.classList.toggle("ok", !!ok);
  rtBadge.classList.toggle("bad", !ok);
  rtText.textContent = msg;
}

function connectRealtime(){
  // pages에서 ws 연결: wss + same host, but we use API_BASE
  // API_BASE: https://... => wss://...
  const wsUrl = API_BASE.replace(/^https:/, "wss:").replace(/^http:/, "ws:") + "/realtime?channel=feed";

  try{
    if (state.ws) state.ws.close();
    const ws = new WebSocket(wsUrl);
    state.ws = ws;

    setRealtimeStatus(false, "실시간 연결중…");

    ws.onopen = () => setRealtimeStatus(true, "실시간 연결중");
    ws.onerror = () => setRealtimeStatus(false, "실시간 오류");
    ws.onclose = () => setRealtimeStatus(false, "실시간 끊김(재시도중)");

    ws.onmessage = (e) => {
      let payload = null;
      try{ payload = JSON.parse(e.data)?.payload; } catch {}
      if (!payload?.kind) return;

      // ✅ UI를 “진짜”로 실시간처럼: 필요한 경우만 새로고침
      if (state.view === "feed"){
        if (["post_created","post_updated","post_removed","comment_created"].includes(payload.kind)){
          // 너무 잦은 전체 리렌더 방지: 살짝 딜레이로 합치기
          scheduleFeedRefresh();
        }
      } else if (state.view === "post" && state.postId){
        if (payload.postId === state.postId && ["post_updated","post_removed","comment_created"].includes(payload.kind)){
          schedulePostRefresh(state.postId);
        }
      }
    };

    // keepalive ping
    const ping = setInterval(() => {
      if (ws.readyState === 1) ws.send("ping");
    }, 25000);

    ws.addEventListener("close", () => {
      clearInterval(ping);
      // auto reconnect
      setTimeout(connectRealtime, 1200);
    });

  } catch {
    setRealtimeStatus(false, "실시간 실패");
    setTimeout(connectRealtime, 1500);
  }
}

let feedRefreshT = null;
function scheduleFeedRefresh(){
  if (feedRefreshT) return;
  feedRefreshT = setTimeout(async () => {
    feedRefreshT = null;
    // 현재 스크롤/더보기 상태 크게 깨지지 않게: 첫 페이지 갱신
    state.cursor = "";
    await loadFeed({ append:false, silent:true });
  }, 450);
}

let postRefreshT = null;
function schedulePostRefresh(postId){
  if (postRefreshT) return;
  postRefreshT = setTimeout(async () => {
    postRefreshT = null;
    await loadPost(postId, { silent:true });
  }, 350);
}

/* ---------- Feed ---------- */
async function loadFeed({ append=false, silent=false }={}){
  state.loading = true;

  if (!append){
    viewEl.innerHTML = "";
    renderFeedSkeleton();
  }

  const params = new URLSearchParams();
  params.set("category", state.category);
  params.set("sort", state.sort);
  if (state.q) params.set("q", state.q);
  if (append && state.cursor) params.set("cursor", state.cursor);
  params.set("pageSize", "50");

  try{
    await refreshMe(); // 토큰 유효하면 사용자 정보 갱신
    const r = await api("/posts?" + params.toString(), { method:"GET", headers:{} });
    if (!r?.ok) throw new Error("불러오기 실패");

    if (!append) viewEl.innerHTML = "";
    const posts = r.posts || [];
    if (!append && posts.length === 0){
      viewEl.appendChild(emptyStateCard());
    } else {
      posts.forEach(p => viewEl.appendChild(postCard(p)));
    }

    state.cursor = r.nextCursor || "";
    btnMore.classList.toggle("hidden", !state.cursor);

    if (!silent) toast("피드 업데이트");
  } catch (e){
    if (!append) viewEl.innerHTML = "";
    viewEl.appendChild(errorCard(
      "피드를 불러오지 못했어요.",
      String(e?.message || e),
      () => loadFeed({ append:false })
    ));
    btnMore.classList.add("hidden");
  } finally {
    state.loading = false;
  }
}

function renderFeedSkeleton(){
  const wrap = document.createElement("div");
  wrap.className = "card p-4";
  wrap.innerHTML = `
    <div class="text-sm font-semibold">불러오는 중…</div>
    <div class="mt-2 text-xs text-slate-300/80">API 연결 확인 중</div>
  `;
  viewEl.appendChild(wrap);
}

function emptyStateCard(){
  const el = document.createElement("div");
  el.className = "card p-6";
  el.innerHTML = `
    <div class="flex items-start gap-3">
      <div class="h-10 w-10 rounded-2xl bg-white/10 border border-white/10 grid place-items-center">
        <i data-lucide="inbox" class="w-5 h-5"></i>
      </div>
      <div>
        <div class="text-base font-semibold">아직 글이 없어요</div>
        <div class="mt-1 text-sm text-slate-300/80">첫 글을 써서 커뮤니티를 시작해봐!</div>
        <div class="mt-4 flex gap-2">
          <button class="btn-primary" id="emptyWrite">
            <i data-lucide="pen-line" class="w-4 h-4"></i><span>새 글 쓰기</span>
          </button>
          <button class="btn-ghost" id="emptyRefresh">
            <i data-lucide="refresh-cw" class="w-4 h-4"></i><span>새로고침</span>
          </button>
        </div>
      </div>
    </div>
  `;
  setTimeout(() => {
    lucide.createIcons();
    el.querySelector("#emptyWrite").onclick = () => btnNew.click();
    el.querySelector("#emptyRefresh").onclick = () => loadFeed({ append:false });
  }, 0);
  return el;
}

function postCard(p){
  const el = document.createElement("div");
  el.className = "card p-4 hover:border-white/20 transition";
  el.style.cursor = "pointer";

  const catName = categoryLabel(p.category);
  const when = timeAgo(p.createdAt);
  const author = p.authorName || "익명";
  const pin = p.pinned ? `<span class="ml-2 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-white/10 border border-white/10">📌</span>` : "";

  // 미리보기(너무 길면 자르기)
  const preview = (p.bodyMd || "").slice(0, 180);
  const previewHtml = mdToHtml(preview);

  el.innerHTML = `
    <div class="flex items-start gap-3">
      <div class="h-10 w-10 rounded-2xl bg-white/10 border border-white/10 grid place-items-center">
        <i data-lucide="message-square" class="w-5 h-5"></i>
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs px-2 py-0.5 rounded-full bg-white/10 border border-white/10">${catName}</span>
          <span class="text-xs text-slate-300/80">${author} · ${when}</span>
          ${pin}
          <div class="ml-auto flex items-center gap-3 text-xs text-slate-300/80">
            <span class="inline-flex items-center gap-1"><i data-lucide="thumbs-up" class="w-4 h-4"></i>${p.likes||0}</span>
            <span class="inline-flex items-center gap-1"><i data-lucide="message-circle" class="w-4 h-4"></i>${p.comments||0}</span>
          </div>
        </div>

        <div class="mt-2 text-base font-semibold break-words">${escapeHtml(p.title || "")}</div>
        <div class="mt-2 md text-sm text-slate-100/90 line-clamp-3">${previewHtml}</div>
      </div>
    </div>
  `;

  el.addEventListener("click", () => goPost(p.id));
  setTimeout(() => lucide.createIcons(), 0);
  return el;
}

/* ---------- Post detail ---------- */
async function loadPost(postId, { silent=false }={}){
  viewEl.innerHTML = "";
  viewEl.appendChild(skeletonPost());

  try{
    await refreshMe();
    const r = await api(`/posts/${encodeURIComponent(postId)}`, { method:"GET" });
    if (!r?.ok || !r.post) throw new Error("게시글 없음");

    const post = r.post;
    viewEl.innerHTML = "";
    viewEl.appendChild(postDetail(post));

    // comments
    const c = await api(`/posts/${encodeURIComponent(postId)}/comments`, { method:"GET" });
    if (!c?.ok) throw new Error("댓글 불러오기 실패");
    renderComments(postId, c.comments || []);

    if (!silent) toast("게시글 업데이트");
  } catch (e){
    viewEl.innerHTML = "";
    viewEl.appendChild(errorCard("게시글을 불러오지 못했어요.", String(e?.message||e), () => loadPost(postId)));
  } finally {
    btnMore.classList.add("hidden");
  }
}

function skeletonPost(){
  const el = document.createElement("div");
  el.className = "card p-6";
  el.innerHTML = `
    <div class="text-sm font-semibold">불러오는 중…</div>
    <div class="mt-2 text-xs text-slate-300/80">게시글/댓글 로딩</div>
  `;
  return el;
}

function postDetail(p){
  const wrap = document.createElement("div");
  wrap.className = "grid gap-4";

  const author = p.authorName || "익명";
  const when = timeAgo(p.createdAt);
  const cat = categoryLabel(p.category);

  const bodyHtml = mdToHtml(p.bodyMd || "");

  const canEdit = !!p.canEdit;
  const canDelete = !!p.canDelete;

  const top = document.createElement("div");
  top.className = "card p-5";
  top.innerHTML = `
    <div class="flex items-start gap-3">
      <div class="h-10 w-10 rounded-2xl bg-white/10 border border-white/10 grid place-items-center">
        <i data-lucide="file-text" class="w-5 h-5"></i>
      </div>

      <div class="flex-1 min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs px-2 py-0.5 rounded-full bg-white/10 border border-white/10">${cat}</span>
          <span class="text-xs text-slate-300/80">${author} · ${when}</span>

          <div class="ml-auto flex items-center gap-2">
            <button class="btn-ghost" id="btnLike"><i data-lucide="thumbs-up" class="w-4 h-4"></i><span>좋아요</span></button>
            <button class="btn-ghost" id="btnReport"><i data-lucide="flag" class="w-4 h-4"></i><span>신고</span></button>
            ${canEdit ? `<button class="btn-ghost" id="btnEdit"><i data-lucide="pencil" class="w-4 h-4"></i><span>수정</span></button>` : ``}
            ${canDelete ? `<button class="btn-ghost" id="btnDel"><i data-lucide="trash-2" class="w-4 h-4"></i><span>삭제(관리자)</span></button>` : ``}
            <button class="btn-ghost" id="btnBack"><i data-lucide="arrow-left" class="w-4 h-4"></i><span>목록</span></button>
          </div>
        </div>

        <div class="mt-2 text-xl font-extrabold break-words">${escapeHtml(p.title || "")}</div>
        <div class="mt-4 md text-sm md">${bodyHtml}</div>

        <div class="mt-4 flex items-center justify-between text-xs text-slate-300/80">
          <div>좋아요 ${p.likes||0} · 댓글 ${p.comments||0}</div>
          <div class="font-mono">${p.id}</div>
        </div>
      </div>
    </div>
  `;

  wrap.appendChild(top);

  const commentsBlock = document.createElement("div");
  commentsBlock.className = "card p-5";
  commentsBlock.innerHTML = `
    <div class="flex items-center justify-between">
      <div class="text-base font-semibold">댓글</div>
      <div class="text-xs text-slate-300/80">Shift+Enter 줄바꿈 · Enter 전송</div>
    </div>

    <div class="mt-3 grid gap-3">
      <label class="flex items-center gap-2 text-sm text-slate-200">
        <input id="cAnon" type="checkbox" class="accent-slate-200" />
        익명
      </label>

      <div class="grid md:grid-cols-2 gap-3">
        <textarea id="cBody" rows="6" class="w-full rounded-2xl border border-white/10 bg-white/5 p-3 outline-none"
          placeholder="Markdown 지원: **굵게**, # 제목, > 인용, ![](이미지링크)"></textarea>

        <div class="rounded-2xl border border-white/10 bg-white/5 p-3 overflow-auto">
          <div class="text-xs text-slate-300/80 mb-2">미리보기</div>
          <div id="cPreview" class="md text-sm md"></div>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button class="btn-primary" id="btnCSubmit">
          <i data-lucide="send" class="w-4 h-4"></i><span>댓글 등록</span>
        </button>
        <button class="btn-ghost" id="btnCFormat">
          <i data-lucide="wand-2" class="w-4 h-4"></i><span>마크다운 도움말</span>
        </button>
      </div>

      <div id="commentsList" class="mt-2 grid gap-3"></div>
    </div>
  `;
  wrap.appendChild(commentsBlock);

  setTimeout(() => {
    lucide.createIcons();

    top.querySelector("#btnBack").onclick = () => goFeed();

    top.querySelector("#btnLike").onclick = async () => {
      if (!state.token) return openAuthModal("login");
      try{
        const r = await api("/likes/toggle", {
          method:"POST",
          body: JSON.stringify({ targetType:"post", targetId:p.id })
        });
        toast(r.liked ? "좋아요!" : "좋아요 취소");
        await loadPost(p.id, { silent:true });
      } catch(e){
        toast("좋아요 실패: " + (e.message||e), "error");
      }
    };

    top.querySelector("#btnReport").onclick = () => openReportModal("post", p.id);

    if (canEdit){
      top.querySelector("#btnEdit").onclick = () => openComposerModal({ mode:"edit", post:p });
    }
    if (canDelete){
      top.querySelector("#btnDel").onclick = async () => {
        if (!confirm("관리자 삭제(복구 불가). 진행할까?")) return;
        try{
          await api(`/posts/${encodeURIComponent(p.id)}`, { method:"DELETE" });
          toast("삭제 완료");
          goFeed();
        } catch(e){
          toast("삭제 실패: " + (e.message||e), "error");
        }
      };
    }

    // comment preview live
    const cBody = commentsBlock.querySelector("#cBody");
    const cPrev = commentsBlock.querySelector("#cPreview");
    const renderPrev = () => { cPrev.innerHTML = mdToHtml(cBody.value); };
    cBody.addEventListener("input", renderPrev);
    renderPrev();

    cBody.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey){
        e.preventDefault();
        commentsBlock.querySelector("#btnCSubmit").click();
      }
    });

    commentsBlock.querySelector("#btnCFormat").onclick = () => {
      toast("예) #제목, ##제목, ###제목 / **굵게** / > 인용 / ![](이미지링크)");
    };

    commentsBlock.querySelector("#btnCSubmit").onclick = async () => {
      if (!state.token) return openAuthModal("login");
      const anon = commentsBlock.querySelector("#cAnon").checked;
      const bodyMd = (cBody.value || "").trim();
      if (!bodyMd) return toast("내용을 입력해줘", "error");

      try{
        await api(`/posts/${encodeURIComponent(p.id)}/comments`, {
          method:"POST",
          body: JSON.stringify({ bodyMd, anonymous: anon })
        });
        cBody.value = "";
        renderPrev();
        toast("댓글 등록 완료");
        await loadPost(p.id, { silent:true });
      } catch(e){
        toast("댓글 등록 실패: " + (e.message||e), "error");
      }
    };
  }, 0);

  return wrap;
}

function renderComments(postId, comments){
  const host = $("#commentsList");
  host.innerHTML = "";

  if (!comments.length){
    const el = document.createElement("div");
    el.className = "text-sm text-slate-300/80";
    el.textContent = "첫 댓글을 남겨보자!";
    host.appendChild(el);
    return;
  }

  comments.forEach(c => {
    const el = document.createElement("div");
    el.className = "p-4 rounded-2xl border border-white/10 bg-white/5";
    el.innerHTML = `
      <div class="flex items-center justify-between gap-2">
        <div class="text-xs text-slate-300/80">${escapeHtml(c.authorName || "익명")} · ${timeAgo(c.createdAt)}</div>
        <button class="btn-ghost" data-like="1"><i data-lucide="thumbs-up" class="w-4 h-4"></i><span>좋아요</span></button>
      </div>
      <div class="mt-2 md text-sm md">${mdToHtml(c.bodyMd || "")}</div>
    `;

    el.querySelector('[data-like="1"]').onclick = async () => {
      if (!state.token) return openAuthModal("login");
      try{
        const r = await api("/likes/toggle", {
          method:"POST",
          body: JSON.stringify({ targetType:"comment", targetId:c.id })
        });
        toast(r.liked ? "댓글 좋아요!" : "댓글 좋아요 취소");
      } catch(e){
        toast("좋아요 실패: " + (e.message||e), "error");
      }
    };

    host.appendChild(el);
  });

  setTimeout(() => lucide.createIcons(), 0);
}

/* ---------- Composer (New/Edit post) ---------- */
function openComposerModal({ mode="new", post=null }={}){
  const node = document.createElement("div");
  node.className = "grid gap-3";

  const draft = safeJson(localStorage.getItem(LS_DRAFT)) || {};
  const initCategory = post?.category || draft.category || state.category || "free";
  const initTitle = post?.title || draft.title || "";
  const initBody = post?.bodyMd || draft.bodyMd || "";
  const initAnon = post ? false : !!draft.anonymous;

  node.innerHTML = `
    <div class="grid md:grid-cols-3 gap-3">
      <label class="grid gap-1">
        <div class="text-xs text-slate-300/80">카테고리</div>
        <select id="pCat" class="select">
          <option value="free">자유</option>
          <option value="notice">공지</option>
          <option value="qna">Q&A</option>
          <option value="study">스터디</option>
        </select>
      </label>

      <label class="md:col-span-2 grid gap-1">
        <div class="text-xs text-slate-300/80">제목</div>
        <input id="pTitle" class="w-full rounded-2xl border border-white/10 bg-white/5 p-3 outline-none"
          placeholder="제목을 입력" />
      </label>
    </div>

    <label class="flex items-center gap-2 text-sm text-slate-200">
      <input id="pAnon" type="checkbox" class="accent-slate-200" />
      익명
    </label>

    <div class="grid md:grid-cols-2 gap-3">
      <textarea id="pBody" rows="12" class="w-full rounded-2xl border border-white/10 bg-white/5 p-3 outline-none"
        placeholder="Markdown 지원: #제목, **굵게**, >인용, ![](이미지링크)"></textarea>

      <div class="rounded-2xl border border-white/10 bg-white/5 p-3 overflow-auto">
        <div class="text-xs text-slate-300/80 mb-2">미리보기</div>
        <div id="pPreview" class="md text-sm md"></div>
      </div>
    </div>

    <div class="flex items-center justify-between gap-2">
      <div class="text-xs text-slate-300/80">
        이미지/동영상: catbox 링크를 <span class="font-mono">![](링크)</span>로 붙여넣기
      </div>
      <div class="flex gap-2">
        <button class="btn-ghost" id="pSaveDraft"><i data-lucide="save" class="w-4 h-4"></i><span>임시저장</span></button>
        <button class="btn-primary" id="pSubmit"><i data-lucide="send" class="w-4 h-4"></i><span>${mode==="edit"?"수정":"등록"}</span></button>
      </div>
    </div>
  `;

  openModal(mode==="edit" ? "게시글 수정" : "새 글쓰기", node);

  const pCat = node.querySelector("#pCat");
  const pTitle = node.querySelector("#pTitle");
  const pBody = node.querySelector("#pBody");
  const pPrev = node.querySelector("#pPreview");
  const pAnon = node.querySelector("#pAnon");

  pCat.value = initCategory;
  pTitle.value = initTitle;
  pBody.value = initBody;
  pAnon.checked = initAnon;

  const renderPrev = () => { pPrev.innerHTML = mdToHtml(pBody.value); };
  renderPrev();
  pBody.addEventListener("input", renderPrev);

  node.querySelector("#pSaveDraft").onclick = () => {
    const d = {
      category: pCat.value,
      title: pTitle.value,
      bodyMd: pBody.value,
      anonymous: pAnon.checked,
      at: Date.now()
    };
    localStorage.setItem(LS_DRAFT, JSON.stringify(d));
    toast("임시저장 완료");
  };

  node.querySelector("#pSubmit").onclick = async () => {
    const payload = {
      category: pCat.value,
      title: (pTitle.value || "").trim(),
      bodyMd: (pBody.value || "").trim(),
      anonymous: pAnon.checked
    };
    if (!payload.title || !payload.bodyMd) return toast("제목/내용을 입력해줘", "error");

    try{
      if (mode === "edit" && post?.id){
        await api(`/posts/${encodeURIComponent(post.id)}`, {
          method:"PATCH",
          body: JSON.stringify(payload)
        });
        toast("수정 완료");
        closeModal();
        await loadPost(post.id);
      } else {
        const r = await api("/posts", { method:"POST", body: JSON.stringify(payload) });
        toast("등록 완료");
        localStorage.removeItem(LS_DRAFT);
        closeModal();
        goPost(r.postId);
      }
    } catch(e){
      toast((mode==="edit"?"수정":"등록") + " 실패: " + (e.message||e), "error");
    }
  };
}

function applyDraftIfAny(){
  // 그냥 UX용: 로그인 후 새 글 누르면 draft 자동 적용됨 (composer에서 사용)
}

/* ---------- Auth modal ---------- */
function openAuthModal(mode="login"){
  const node = document.createElement("div");
  node.className = "grid gap-4";

  node.innerHTML = `
    <div class="grid md:grid-cols-2 gap-3">
      <button class="btn-ghost" id="tabLogin">로그인</button>
      <button class="btn-ghost" id="tabRegister">회원가입</button>
    </div>

    <div id="pane"></div>

    <div class="text-xs text-slate-300/80">
      학번은 옵션. 로그인은 <b>닉네임 또는 학번</b> + 비밀번호로 가능.
    </div>
  `;

  const pane = node.querySelector("#pane");

  const renderLogin = () => {
    pane.innerHTML = `
      <div class="grid gap-3">
        <label class="grid gap-1">
          <div class="text-xs text-slate-300/80">닉네임 또는 학번</div>
          <input id="id" class="w-full rounded-2xl border border-white/10 bg-white/5 p-3 outline-none" placeholder="예) solhaebyeolnun / 2035-101" />
        </label>
        <label class="grid gap-1">
          <div class="text-xs text-slate-300/80">비밀번호</div>
          <input id="pw" type="password" class="w-full rounded-2xl border border-white/10 bg-white/5 p-3 outline-none" placeholder="비밀번호" />
        </label>
        <button class="btn-primary" id="doLogin">
          <i data-lucide="log-in" class="w-4 h-4"></i><span>로그인</span>
        </button>
      </div>
    `;
    lucide.createIcons();

    pane.querySelector("#doLogin").onclick = async () => {
      const identifier = (pane.querySelector("#id").value || "").trim();
      const password = (pane.querySelector("#pw").value || "").trim();
      if (!identifier || !password) return toast("입력해줘", "error");
      try{
        const r = await api("/auth/login", { method:"POST", body: JSON.stringify({ identifier, password }) });
        if (r.ok){
          setAuth(r.user, r.token);
          toast("로그인 성공");
          closeModal();
          goFeed();
        }
      } catch(e){
        toast("로그인 실패: " + (e.message||e), "error");
      }
    };
  };

  const renderRegister = () => {
    pane.innerHTML = `
      <div class="grid gap-3">
        <label class="grid gap-1">
          <div class="text-xs text-slate-300/80">닉네임 (2~16, 영/숫/한글/_)</div>
          <input id="nick" class="w-full rounded-2xl border border-white/10 bg-white/5 p-3 outline-none" placeholder="닉네임" />
        </label>
        <label class="grid gap-1">
          <div class="text-xs text-slate-300/80">학번 (옵션)</div>
          <input id="sid" class="w-full rounded-2xl border border-white/10 bg-white/5 p-3 outline-none" placeholder="예) 2035-101" />
        </label>
        <label class="grid gap-1">
          <div class="text-xs text-slate-300/80">비밀번호 (4자 이상)</div>
          <input id="pw" type="password" class="w-full rounded-2xl border border-white/10 bg-white/5 p-3 outline-none" placeholder="비밀번호" />
        </label>
        <label class="grid gap-1">
          <div class="text-xs text-slate-300/80">비밀번호 확인</div>
          <input id="pw2" type="password" class="w-full rounded-2xl border border-white/10 bg-white/5 p-3 outline-none" placeholder="비밀번호 확인" />
        </label>
        <button class="btn-primary" id="doReg">
          <i data-lucide="user-plus" class="w-4 h-4"></i><span>회원가입</span>
        </button>
      </div>
    `;
    lucide.createIcons();

    pane.querySelector("#doReg").onclick = async () => {
      const nickname = (pane.querySelector("#nick").value || "").trim();
      const studentId = (pane.querySelector("#sid").value || "").trim();
      const password = (pane.querySelector("#pw").value || "").trim();
      const password2 = (pane.querySelector("#pw2").value || "").trim();
      if (!nickname || !password) return toast("닉네임/비밀번호 입력", "error");
      if (password !== password2) return toast("비밀번호가 달라", "error");

      try{
        await api("/auth/register", {
          method:"POST",
          body: JSON.stringify({ nickname, password, studentId: studentId || undefined })
        });
        toast("가입 완료! 이제 로그인해줘");
        renderLogin();
      } catch(e){
        toast("가입 실패: " + (e.message||e), "error");
      }
    };
  };

  const tabLogin = node.querySelector("#tabLogin");
  const tabRegister = node.querySelector("#tabRegister");

  tabLogin.onclick = () => { tabLogin.classList.add("btn-primary"); tabRegister.classList.remove("btn-primary"); renderLogin(); };
  tabRegister.onclick = () => { tabRegister.classList.add("btn-primary"); tabLogin.classList.remove("btn-primary"); renderRegister(); };

  openModal("로그인 / 회원가입", node);

  // default
  if (mode === "register"){
    tabRegister.click();
  } else {
    tabLogin.click();
  }
}

/* ---------- Report modal ---------- */
function openReportModal(targetType, targetId){
  if (!state.token) return openAuthModal("login");

  const node = document.createElement("div");
  node.className = "grid gap-3";
  node.innerHTML = `
    <label class="grid gap-1">
      <div class="text-xs text-slate-300/80">사유</div>
      <select id="reason" class="select">
        <option value="욕설/비하">욕설/비하</option>
        <option value="스팸/광고">스팸/광고</option>
        <option value="개인정보">개인정보</option>
        <option value="기타">기타</option>
      </select>
    </label>

    <label class="grid gap-1">
      <div class="text-xs text-slate-300/80">상세(선택)</div>
      <textarea id="detail" rows="6" class="w-full rounded-2xl border border-white/10 bg-white/5 p-3 outline-none"
        placeholder="상세 내용을 적어줘(선택)"></textarea>
    </label>

    <button class="btn-primary" id="doReport">
      <i data-lucide="flag" class="w-4 h-4"></i><span>신고 제출</span>
    </button>
  `;
  openModal("신고", node);

  node.querySelector("#doReport").onclick = async () => {
    const reason = node.querySelector("#reason").value;
    const detail = (node.querySelector("#detail").value || "").trim();
    try{
      await api("/reports", {
        method:"POST",
        body: JSON.stringify({ targetType, targetId, reason, detail })
      });
      toast("신고 접수 완료");
      closeModal();
    } catch(e){
      toast("신고 실패: " + (e.message||e), "error");
    }
  };
}

/* ---------- Error card ---------- */
function errorCard(title, detail, onRetry){
  const el = document.createElement("div");
  el.className = "card p-6";
  el.innerHTML = `
    <div class="flex items-start gap-3">
      <div class="h-10 w-10 rounded-2xl bg-white/10 border border-white/10 grid place-items-center">
        <i data-lucide="triangle-alert" class="w-5 h-5"></i>
      </div>
      <div class="flex-1">
        <div class="text-base font-semibold">${escapeHtml(title)}</div>
        <div class="mt-1 text-sm text-slate-300/80 break-words">${escapeHtml(detail)}</div>
        <div class="mt-4 flex gap-2">
          <button class="btn-primary" id="retry"><i data-lucide="refresh-cw" class="w-4 h-4"></i><span>다시 시도</span></button>
          <button class="btn-ghost" id="home"><i data-lucide="home" class="w-4 h-4"></i><span>피드로</span></button>
        </div>
      </div>
    </div>
  `;
  setTimeout(() => {
    lucide.createIcons();
    el.querySelector("#retry").onclick = onRetry;
    el.querySelector("#home").onclick = () => goFeed();
  }, 0);
  return el;
}

/* ---------- Helpers ---------- */
function categoryLabel(cat){
  switch(cat){
    case "free": return "자유";
    case "notice": return "공지";
    case "qna": return "Q&A";
    case "study": return "스터디";
    default: return "전체";
  }
}

function timeAgo(ms){
  const t = Number(ms || 0);
  if (!t) return "";
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return `${s}초 전`;
  const m = Math.floor(s/60);
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m/60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h/24);
  return `${d}일 전`;
}

function escapeHtml(str){
  return String(str || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
