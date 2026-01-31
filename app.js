/* ===========================
   SRT Community - app.js
   Static (GitHub Pages) + Cloudflare Worker API + D1
=========================== */

const API_BASE = "https://srt-community-api.yekong0728.workers.dev";

// ===== role helpers (MUST be defined before use) =====
function isAdminRole(user) {
  const role = (user && user.role) ? String(user.role).toLowerCase() : "";
  return role === "admin" || role === "mod";
}

function isLoggedIn(user) {
  return !!(user && user.id);
}

/* ---------- DOM helpers ---------- */
const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

/* ---------- State / Storage ---------- */
const LS = {
  theme: "srt.theme",
  token: "srt.token",
  me: "srt.me",
  bookmarks: "srt.bookmarks" // { [postId]: postSummary }
};

const state = {
  category: "all",
  sort: "latest",
  q: "",
  cursor: "",
  loading: false,
  list: [],
  me: null,
  token: localStorage.getItem(LS.token) || "",
  bookmarks: loadBookmarks(),
  ws: { ok:false, lastTs:0 }
};

function loadBookmarks(){
  try { return JSON.parse(localStorage.getItem(LS.bookmarks) || "{}") || {}; }
  catch { return {}; }
}
function saveBookmarks(){
  localStorage.setItem(LS.bookmarks, JSON.stringify(state.bookmarks));
}
function isBookmarked(id){ return !!state.bookmarks[id]; }
function toggleBookmark(post){
  if (!post?.id) return false;
  if (state.bookmarks[post.id]) {
    delete state.bookmarks[post.id];
    saveBookmarks();
    toast("북마크 제거");
    return false;
  }
  state.bookmarks[post.id] = {
    id: post.id,
    title: post.title,
    category: post.category,
    authorName: post.authorName,
    createdAt: post.createdAt,
    pinned: !!post.pinned
  };
  saveBookmarks();
  toast("북마크 추가");
  return true;
}

/* ---------- UI Refs ---------- */
const $boot = $("#boot");
const $bootFill = $("#bootFill");
const $bootPct = $("#bootPct");
const $bootLog = $("#bootLog");
const $bootBubbles = $("#bootBubbles");

const $rtDot = $("#rtDot");
const $rtLabel = $("#rtLabel");
const $rtMeta = $("#rtMeta");

const $themeBtn = $("#themeBtn");
const $bookmarksBtn = $("#bookmarksBtn");
const $activityBtn = $("#activityBtn");

const $loginBtn = $("#loginBtn");
const $userBox = $("#userBox");

const $qInput = $("#qInput");
const $searchBtn = $("#searchBtn");
const $sortSel = $("#sortSel");
const $refreshBtn = $("#refreshBtn");

const $chips = $$(".chip");
const $newPostBtn = $("#newPostBtn");
const $fabBtn = $("#fabBtn");
const $homeBtn = $("#homeBtn");

const $banner = $("#banner");

const $feedView = $("#feedView");
const $postView = $("#postView");
const $list = $("#list");
const $loadMoreBtn = $("#loadMoreBtn");
const $loadMoreMeta = $("#loadMoreMeta");
const $pillCount = $("#pillCount");
const $feedTitle = $("#feedTitle");
const $feedSub = $("#feedSub");

const $backBtn = $("#backBtn");
const $postCat = $("#postCat");
const $postAuthor = $("#postAuthor");
const $postTime = $("#postTime");
const $postTitle = $("#postTitle");
const $postBody = $("#postBody");
const $postLikeCount = $("#postLikeCount");
const $postCommentCount = $("#postCommentCount");
const $postLikeBtn = $("#postLikeBtn");
const $postReportBtn = $("#postReportBtn");
const $postBookmarkBtn = $("#postBookmarkBtn");
const $postPinBtn = $("#postPinBtn");
const $postEditBtn = $("#postEditBtn");
const $postDeleteBtn = $("#postDeleteBtn");

const $commentMeta = $("#commentMeta");
const $commentAnon = $("#commentAnon");
const $commentPreviewBtn = $("#commentPreviewBtn");
const $commentInput = $("#commentInput");
const $commentSendBtn = $("#commentSendBtn");
const $commentPreview = $("#commentPreview");
const $commentList = $("#commentList");

const $modalRoot = $("#modalRoot");
const $toastRoot = $("#toastRoot");

/* ---------- Markdown config ---------- */
marked.setOptions({
  gfm: true,
  breaks: true,
  headerIds: false,
  mangle: false
});
function md(htmlMd){
  const raw = marked.parse(String(htmlMd || ""));
  return DOMPurify.sanitize(raw, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["target", "rel"]
  });
}

/* ---------- Icons ---------- */
function renderIcons(){
  try {
    if (window.lucide && typeof lucide.createIcons === "function") {
      lucide.createIcons();
    }
  } catch {}
}

/* ---------- Banner / Toast ---------- */
function banner(msg, type="info"){
  $banner.classList.remove("is-hidden");
  $banner.textContent = msg;
  $banner.dataset.type = type;
  clearTimeout(banner._t);
  banner._t = setTimeout(()=>{ $banner.classList.add("is-hidden"); }, 4500);
}
function toast(msg){
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  $toastRoot.appendChild(el);
  setTimeout(()=>{ el.style.opacity = "0"; el.style.transform = "translateY(6px)"; }, 2200);
  setTimeout(()=>{ el.remove(); }, 2800);
}

/* ---------- Time ---------- */
function relTime(ms){
  const t = Number(ms||0);
  if (!t) return "-";
  const d = Date.now() - t;
  const s = Math.floor(d/1000);
  if (s < 60) return `${s}초 전`;
  const m = Math.floor(s/60);
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m/60);
  if (h < 24) return `${h}시간 전`;
  const day = Math.floor(h/24);
  return `${day}일 전`;
}
function fmtDate(ms){
  const d = new Date(Number(ms||0));
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

/* ---------- API ---------- */
async function api(path, { method="GET", body=null, qsObj=null } = {}){
  const u = new URL(API_BASE + path);
  if (qsObj) Object.entries(qsObj).forEach(([k,v])=> v!==undefined && v!==null && u.searchParams.set(k,String(v)));
  const headers = { "content-type":"application/json" };
  if (state.token) headers["Authorization"] = `Bearer ${state.token}`;

  const res = await fetch(u.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });

  let data = null;
  try { data = await res.json(); } catch { data = null; }

  if (!res.ok || (data && data.ok === false)) {
    const msg = (data && (data.message || data.error)) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

/* ---------- Theme ---------- */
function applyTheme(theme){
  if (theme === "light") document.documentElement.dataset.theme = "light";
  else document.documentElement.dataset.theme = "dark";
  localStorage.setItem(LS.theme, theme);
  renderIcons();
}
function initTheme(){
  const saved = localStorage.getItem(LS.theme);
  if (saved) return applyTheme(saved);
  // default: dark
  applyTheme("dark");
}

/* ---------- Boot loading animation ---------- */
function boot(){
  let pct = 0;
  const tasks = [
    "UI 구성 요소 준비…",
    "테마/아이콘 로딩…",
    "세션 확인…",
    "피드 데이터 요청…",
    "실시간 채널 연결…",
    "마크다운 렌더러 준비…",
    "북마크 불러오기…",
    "마무리 중…"
  ];
  let i = 0;

  function addBubble(){
    const b = document.createElement("span");
    b.className = "bubble";
    const left = Math.random()*100;
    const size = 4 + Math.random()*10;
    const dur = 900 + Math.random()*1400;
    b.style.left = left + "%";
    b.style.width = size + "px";
    b.style.height = size + "px";
    b.style.position = "absolute";
    b.style.bottom = "-10px";
    b.style.borderRadius = "999px";
    b.style.background = "rgba(255,255,255,.55)";
    b.style.filter = "blur(.2px)";
    b.style.opacity = ".85";
    b.style.transform = "translateY(0)";
    b.style.transition = `transform ${dur}ms ease, opacity ${dur}ms ease`;
    $bootBubbles.appendChild(b);
    requestAnimationFrame(()=>{
      b.style.transform = "translateY(-26px)";
      b.style.opacity = "0";
    });
    setTimeout(()=> b.remove(), dur+80);
  }
  const bubbleTimer = setInterval(()=>{ if (Math.random()<0.55) addBubble(); }, 180);

  return new Promise((resolve)=>{
    const tick = async ()=>{
      const step = 2 + Math.random()*10;          // random speed
      const jitter = Math.random() < 0.08 ? -10 : 0; // sometimes slow/back
      pct = clamp(pct + step + jitter, 0, 100);
      $bootFill.style.width = pct + "%";
      $bootPct.textContent = String(Math.floor(pct));

      if (Math.random()<0.25){
        $bootLog.textContent = tasks[i % tasks.length];
        i++;
      }

      if (pct >= 100){
        clearInterval(bubbleTimer);
        setTimeout(()=>{
          $boot.style.opacity = "0";
          $boot.style.transition = "opacity .28s ease";
          setTimeout(()=>{ $boot.remove(); resolve(); }, 320);
        }, 180);
        return;
      }

      const wait = 60 + Math.random()*180 + (Math.random()<0.12 ? 260 : 0); // sometimes pause
      setTimeout(tick, wait);
    };
    tick();
  });
}

/* ---------- Auth UI ---------- */
function renderUserBox(){
  if (!state.me) {
    $userBox.innerHTML = `<button class="btn btn--primary" id="loginBtn2" type="button">로그인</button>`;
    $("#loginBtn2").addEventListener("click", openLogin);
    return;
  }

  const roleBadge = state.me.role === "admin" ? "ADMIN" : (state.me.role === "mod" ? "MOD" : "STUDENT");

  $userBox.innerHTML = `
    <div class="pill">
      <span class="icon" data-lucide="user"></span>
      ${escapeHtml(state.me.nickname)}
      <span style="opacity:.65">(${roleBadge})</span>
    </div>
    <button class="btn btn--ghost" id="logoutBtn" type="button">
      <span class="icon" data-lucide="log-out"></span> 로그아웃
    </button>
    ${isAdminRole(state.me.role) ? `
      <button class="btn btn--ghost" id="adminReportsBtn" type="button">
        <span class="icon" data-lucide="flag"></span> 신고함
      </button>
    ` : ""}
  `;

  $("#logoutBtn").addEventListener("click", logout);
  if (isAdminRole(state.me.role)) $("#adminReportsBtn").addEventListener("click", openAdminReports);

  renderIcons();
}

function escapeHtml(s){
  return String(s||"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

async function refreshMe(){
  if (!state.token) { state.me = null; renderUserBox(); return; }
  try {
    const r = await api("/auth/me");
    state.me = r.user;
    localStorage.setItem(LS.me, JSON.stringify(state.me));
    renderUserBox();
  } catch {
    state.me = null;
    state.token = "";
    localStorage.removeItem(LS.token);
    renderUserBox();
  }
}

async function logout(){
  try { await api("/auth/logout", { method:"POST" }); } catch {}
  state.token = "";
  state.me = null;
  localStorage.removeItem(LS.token);
  localStorage.removeItem(LS.me);
  renderUserBox();
  banner("로그아웃 되었어요.");
}

/* ---------- Modal ---------- */
function closeModal(){
  $modalRoot.classList.add("is-hidden");
  $modalRoot.setAttribute("aria-hidden", "true");
  $modalRoot.innerHTML = "";
}
function openModal(title, bodyHtml, actionsHtml){
  $modalRoot.classList.remove("is-hidden");
  $modalRoot.setAttribute("aria-hidden", "false");

  $modalRoot.innerHTML = `
    <div class="modalBackdrop" data-close="1"></div>
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal__head">
        <div class="modal__title">${escapeHtml(title)}</div>
        <button class="btn btn--ghost" data-close="1" type="button">닫기</button>
      </div>
      <div class="modal__body">${bodyHtml}</div>
      <div class="modal__actions">${actionsHtml || ""}</div>
    </div>
  `;

  $$("[data-close]", $modalRoot).forEach(el => el.addEventListener("click", closeModal));
  renderIcons();
}

function openLogin(){
  openModal("로그인 / 회원가입",
    `
      <div class="card" style="padding:12px">
        <div class="muted" style="margin-bottom:10px">
          로그인: 닉네임 또는 학번 + 비밀번호<br/>
          회원가입: 닉네임 + 비밀번호 + 학번(선택)
        </div>

        <div class="row" style="gap:10px; flex-wrap:wrap">
          <input id="liId" class="input" placeholder="닉네임 또는 학번" style="flex:1; min-width:220px" />
          <input id="liPw" class="input" placeholder="비밀번호" type="password" style="flex:1; min-width:220px" />
        </div>
        <div class="row" style="justify-content:flex-end; margin-top:10px">
          <button class="btn btn--primary" id="doLogin" type="button">로그인</button>
        </div>

        <hr style="border:none; border-top:1px solid var(--stroke); margin:14px 0"/>

        <div class="row" style="gap:10px; flex-wrap:wrap">
          <input id="reNick" class="input" placeholder="닉네임(2~16)" style="flex:1; min-width:220px" />
          <input id="rePw" class="input" placeholder="비밀번호(4+)" type="password" style="flex:1; min-width:220px" />
          <input id="reSid" class="input" placeholder="학번(선택)" style="flex:1; min-width:220px" />
        </div>
        <div class="row" style="justify-content:flex-end; margin-top:10px">
          <button class="btn btn--ghost" id="doRegister" type="button">회원가입</button>
        </div>
      </div>
    `,
    ``
  );

  $("#doLogin").addEventListener("click", async ()=>{
    const identifier = $("#liId").value.trim();
    const password = $("#liPw").value.trim();
    if (!identifier || !password) return toast("아이디/비밀번호를 입력해줘");
    try {
      const r = await api("/auth/login", { method:"POST", body:{ identifier, password } });
      state.token = r.token;
      localStorage.setItem(LS.token, state.token);
      state.me = r.user;
      localStorage.setItem(LS.me, JSON.stringify(state.me));
      closeModal();
      renderUserBox();
      banner(`어서와요, ${state.me.nickname}!`);
      await loadFeed(true);
    } catch(e){
      toast("로그인 실패: " + e.message);
    }
  });

  $("#doRegister").addEventListener("click", async ()=>{
    const nickname = $("#reNick").value.trim();
    const password = $("#rePw").value.trim();
    const studentId = $("#reSid").value.trim();
    if (!nickname || !password) return toast("닉네임/비밀번호를 입력해줘");
    try {
      await api("/auth/register", { method:"POST", body:{ nickname, password, studentId: studentId || undefined } });
      toast("회원가입 성공! 이제 로그인해줘.");
      $("#liId").value = nickname;
      $("#liPw").focus();
    } catch(e){
      toast("회원가입 실패: " + e.message);
    }
  });
}

/* ---------- Feed rendering ---------- */
function catLabel(c){
  if (c==="free") return "자유";
  if (c==="notice") return "공지";
  if (c==="qna") return "Q&A";
  if (c==="study") return "스터디";
  return "전체";
}
function postCard(p){
  const bm = isBookmarked(p.id);
  return `
    <div class="item" data-open="${p.id}" tabindex="0">
      <div class="item__top">
        <span class="tag">${escapeHtml(catLabel(p.category))}</span>
        ${p.pinned ? `<span class="pin"><span class="icon" data-lucide="pin"></span>고정</span>` : ""}
        <span class="pill">${escapeHtml(p.authorName)}</span>
        <span class="pill">${escapeHtml(relTime(p.createdAt))}</span>
        <div class="item__right">
          <span class="pill">👍 ${p.likes}</span>
          <span class="pill">💬 ${p.comments}</span>
          <button class="btn btn--ghost" data-bm="${p.id}" type="button" title="북마크">
            <span class="icon" data-lucide="bookmark" style="opacity:${bm?1:0.55}"></span>
          </button>
        </div>
      </div>
      <div class="item__title">${escapeHtml(p.title)}</div>
      <div class="item__meta">
        <span>정렬: ${escapeHtml(state.sort)}</span>
        <span>•</span>
        <span>${escapeHtml(fmtDate(p.createdAt))}</span>
      </div>
    </div>
  `;
}

function bindListClicks(posts){
  $$("[data-open]", $list).forEach(el=>{
    el.addEventListener("click", ()=>{
      const id = el.getAttribute("data-open");
      openPost(id);
    });
  });
  $$("[data-bm]", $list).forEach(btn=>{
    btn.addEventListener("click", (e)=>{
      e.stopPropagation();
      const id = btn.getAttribute("data-bm");
      const p = posts.find(x=>x.id===id);
      if (!p) return;
      const on = toggleBookmark(p);
      btn.querySelector(".icon")?.style && (btn.querySelector(".icon").style.opacity = on ? "1" : "0.55");
      renderIcons();
    });
  });
}

/* ---------- Feed load ---------- */
async function loadFeed(reset=false){
  if (state.loading) return;
  state.loading = true;

  try{
    if (reset){
      state.cursor = "";
      state.list = [];
      $list.innerHTML = "";
      $loadMoreMeta.textContent = "";
    }

    $loadMoreBtn.disabled = true;
    $loadMoreBtn.textContent = "불러오는 중…";

    const r = await api("/posts", {
      qsObj: {
        category: state.category,
        q: state.q || undefined,
        sort: state.sort,
        cursor: state.cursor || undefined,
        pageSize: 50
      }
    });

    const posts = r.posts || [];
    state.cursor = r.nextCursor || "";
    state.list = state.list.concat(posts);

    $pillCount.textContent = String(state.list.length);
    $feedTitle.textContent = state.category==="all" ? "게시판" : catLabel(state.category);
    $feedSub.textContent = `${state.q ? `검색: "${state.q}" · ` : ""}정렬: ${state.sort}`;

    if (reset && posts.length === 0){
      $list.innerHTML = `<div class="card" style="padding:14px">아직 글이 없어요. <b>+ 새 글</b>로 첫 글을 올려보세요!</div>`;
    } else {
      const html = posts.map(postCard).join("");
      $list.insertAdjacentHTML("beforeend", html);
    }

    bindListClicks(state.list);
    renderIcons();

    $loadMoreBtn.disabled = !state.cursor;
    $loadMoreBtn.textContent = state.cursor ? "더 보기" : "끝!";
    $loadMoreMeta.textContent = state.cursor ? "더 오래된 글을 불러올 수 있어요." : "더 이상 불러올 글이 없어요.";
  } catch(e){
    banner("피드 로드 실패: " + e.message, "error");
    $loadMoreBtn.disabled = false;
    $loadMoreBtn.textContent = "다시 시도";
  } finally{
    state.loading = false;
  }
}

/* ---------- Post view ---------- */
function showFeed(){
  $postView.classList.add("is-hidden");
  $feedView.classList.remove("is-hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function showPost(){
  $feedView.classList.add("is-hidden");
  $postView.classList.remove("is-hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

let currentPost = null;

async function openPost(postId){
  try{
    showPost();
    $postTitle.textContent = "불러오는 중…";
    $postBody.innerHTML = "";
    $commentList.innerHTML = "";
    $commentMeta.textContent = "댓글 불러오는 중…";

    const r = await api(`/posts/${postId}`);
    currentPost = r.post;

    $postCat.textContent = catLabel(currentPost.category);
    $postAuthor.textContent = currentPost.authorName + (currentPost.anonymous ? " (익명)" : "");
    $postTime.textContent = fmtDate(currentPost.createdAt);
    $postTitle.textContent = currentPost.title;
    $postBody.innerHTML = md(currentPost.bodyMd);
    $postLikeCount.textContent = `👍 ${currentPost.likes}`;
    $postCommentCount.textContent = `💬 ${currentPost.comments}`;

    // bookmark btn state
    const bmOn = isBookmarked(currentPost.id);
    $postBookmarkBtn.querySelector(".icon")?.style && ($postBookmarkBtn.querySelector(".icon").style.opacity = bmOn ? "1" : "0.55");

    // permissions
    $postEditBtn.classList.toggle("is-hidden", !currentPost.canEdit);
    $postDeleteBtn.classList.toggle("is-hidden", !currentPost.canDelete);
    $postPinBtn.classList.toggle("is-hidden", !currentPost.canPin);
    $postPinBtn.textContent = currentPost.pinned ? "📌 고정 해제" : "📌 고정";

    renderIcons();

    // comments
    const cr = await api(`/posts/${postId}/comments`);
    const comments = cr.comments || [];
    $commentMeta.textContent = `${comments.length}개 댓글`;
    $commentList.innerHTML = comments.map(c=>`
      <div class="comment">
        <div class="comment__meta">
          <span class="pill">${escapeHtml(c.authorName)}</span>
          <span class="pill">${escapeHtml(relTime(c.createdAt))}</span>
        </div>
        <div class="comment__body md">${md(c.bodyMd)}</div>
      </div>
    `).join("");

  } catch(e){
    banner("글 불러오기 실패: " + e.message, "error");
    showFeed();
  }
}

/* ---------- Create/Edit Post ---------- */
function requireLogin(){
  if (!state.me) { openLogin(); return false; }
  return true;
}

function openWriteModal(edit=false){
  if (!requireLogin()) return;

  const p = currentPost;
  const title = edit ? "글 수정" : "새 글 작성";
  const initCat = edit ? p.category : "free";
  const initTitle = edit ? p.title : "";
  const initBody = edit ? p.bodyMd : "";
  const initAnon = edit ? !!p.anonymous : false;

  openModal(title, `
    <div class="row" style="gap:10px; flex-wrap:wrap">
      <div class="select" style="min-width:220px; flex:1">
        <label class="select__label" for="wCat">카테고리</label>
        <select id="wCat" class="select__box">
          <option value="free">자유</option>
          <option value="notice">공지</option>
          <option value="qna">Q&A</option>
          <option value="study">스터디</option>
        </select>
      </div>
      <label class="toggle" style="margin-left:auto">
        <input id="wAnon" type="checkbox" />
        <span>익명</span>
      </label>
    </div>

    <input id="wTitle" class="input" placeholder="제목" />
    <textarea id="wBody" class="textarea" rows="10" placeholder="본문 (Markdown 지원)"></textarea>

    <div class="row">
      <div class="muted">#~###### 제목 지원 / 테이블 / 체크박스 / 코드블럭 지원</div>
      <div class="spacer"></div>
      <button class="btn btn--ghost" id="wPreviewBtn" type="button">미리보기</button>
    </div>
    <div id="wPreview" class="md is-hidden"></div>
  `, `
    <button class="btn btn--ghost" type="button" data-close="1">취소</button>
    <button class="btn btn--primary" id="wSubmit" type="button">${edit ? "수정 저장" : "등록"}</button>
  `);

  $("#wCat").value = initCat;
  $("#wTitle").value = initTitle;
  $("#wBody").value = initBody;
  $("#wAnon").checked = initAnon;

  $("#wPreviewBtn").addEventListener("click", ()=>{
    const box = $("#wPreview");
    const on = box.classList.toggle("is-hidden") === false;
    if (on) box.innerHTML = md($("#wBody").value);
  });

  $("#wSubmit").addEventListener("click", async ()=>{
    const category = $("#wCat").value;
    const title = $("#wTitle").value.trim();
    const bodyMd = $("#wBody").value.trim();
    const anonymous = $("#wAnon").checked;

    if (!title || !bodyMd) return toast("제목/본문을 입력해줘");

    try{
      if (!edit){
        const r = await api("/posts", { method:"POST", body:{ category, title, bodyMd, anonymous } });
        closeModal();
        toast("글 등록 완료!");
        await loadFeed(true);
        await openPost(r.postId);
      } else {
        await api(`/posts/${p.id}`, { method:"PATCH", body:{ category, title, bodyMd, anonymous } });
        closeModal();
        toast("수정 완료!");
        await openPost(p.id);
        await loadFeed(true);
      }
    } catch(e){
      toast("실패: " + e.message);
    }
  });
}

/* ---------- Post actions ---------- */
$postLikeBtn.addEventListener("click", async ()=>{
  if (!requireLogin()) return;
  if (!currentPost) return;
  try{
    const r = await api("/likes/toggle", { method:"POST", body:{ targetType:"post", targetId: currentPost.id } });
    toast(r.liked ? "좋아요!" : "좋아요 취소");
    await openPost(currentPost.id);
    await loadFeed(true);
  } catch(e){
    toast("실패: " + e.message);
  }
});

$postReportBtn.addEventListener("click", ()=>{
  if (!requireLogin()) return;
  if (!currentPost) return;

  openModal("신고하기", `
    <div class="muted">운영 규칙 위반/스팸/괴롭힘/불법 등 신고 사유를 선택하고 상세를 적어주세요.</div>
    <div class="select">
      <label class="select__label" for="rpReason">사유</label>
      <select id="rpReason" class="select__box">
        <option>스팸/광고</option>
        <option>욕설/혐오</option>
        <option>불법/위험</option>
        <option>개인정보 노출</option>
        <option>기타</option>
      </select>
    </div>
    <textarea id="rpDetail" class="textarea" rows="5" placeholder="상세 내용"></textarea>
  `, `
    <button class="btn btn--ghost" data-close="1" type="button">취소</button>
    <button class="btn btn--primary" id="rpSubmit" type="button">신고 제출</button>
  `);

  $("#rpSubmit").addEventListener("click", async ()=>{
    try{
      await api("/reports", { method:"POST", body:{
        targetType:"post",
        targetId: currentPost.id,
        reason: $("#rpReason").value,
        detail: $("#rpDetail").value.trim()
      }});
      closeModal();
      toast("신고가 접수됐어요.");
    } catch(e){
      toast("신고 실패: " + e.message);
    }
  });
});

$postBookmarkBtn.addEventListener("click", ()=>{
  if (!currentPost) return;
  const on = toggleBookmark(currentPost);
  $postBookmarkBtn.querySelector(".icon")?.style && ($postBookmarkBtn.querySelector(".icon").style.opacity = on ? "1":"0.55");
  renderIcons();
});

$postPinBtn.addEventListener("click", async ()=>{
  if (!requireLogin()) return;
  if (!currentPost) return;
  try{
    const r = await api(`/posts/${currentPost.id}/pin`, { method:"POST" });
    toast(r.pinned ? "고정됨" : "고정 해제됨");
    await openPost(currentPost.id);
    await loadFeed(true);
  } catch(e){
    toast("실패: " + e.message);
  }
});

$postEditBtn.addEventListener("click", ()=> openWriteModal(true));

$postDeleteBtn.addEventListener("click", ()=>{
  if (!requireLogin()) return;
  if (!currentPost) return;

  openModal("삭제 확인", `
    <div class="muted">이 글을 삭제하면 피드에서 제거됩니다. (관리자/모더레이터만)</div>
  `, `
    <button class="btn btn--ghost" data-close="1" type="button">취소</button>
    <button class="btn btn--danger" id="doDelete" type="button">삭제</button>
  `);

  $("#doDelete").addEventListener("click", async ()=>{
    try{
      await api(`/posts/${currentPost.id}`, { method:"DELETE" });
      closeModal();
      toast("삭제 완료");
      showFeed();
      await loadFeed(true);
    } catch(e){
      toast("삭제 실패: " + e.message);
    }
  });
});

/* ---------- Comment composer ---------- */
$commentPreviewBtn.addEventListener("click", ()=>{
  const on = $commentPreview.classList.toggle("is-hidden") === false;
  if (on) $commentPreview.innerHTML = md($commentInput.value);
});
$commentInput.addEventListener("keydown", (e)=>{
  if (e.key === "Enter" && !e.shiftKey){
    e.preventDefault();
    $commentSendBtn.click();
  }
});
$commentSendBtn.addEventListener("click", async ()=>{
  if (!requireLogin()) return;
  if (!currentPost) return;
  const bodyMd = $commentInput.value.trim();
  const anonymous = $commentAnon.checked;
  if (!bodyMd) return toast("댓글 내용을 입력해줘");
  try{
    await api(`/posts/${currentPost.id}/comments`, { method:"POST", body:{ bodyMd, anonymous } });
    $commentInput.value = "";
    $commentPreview.classList.add("is-hidden");
    toast("댓글 등록!");
    await openPost(currentPost.id);
    await loadFeed(true);
  } catch(e){
    toast("댓글 실패: " + e.message);
  }
});

/* ---------- Bookmarks view ---------- */
function openBookmarks(){
  const items = Object.values(state.bookmarks).sort((a,b)=> (b.createdAt||0)-(a.createdAt||0));
  openModal("북마크", `
    <div class="muted">기기(localStorage)에 저장됩니다.</div>
    <div style="margin-top:10px; display:flex; flex-direction:column; gap:10px">
      ${items.length ? items.map(p=>`
        <div class="item" data-bmopen="${p.id}" tabindex="0">
          <div class="item__top">
            <span class="tag">${escapeHtml(catLabel(p.category))}</span>
            ${p.pinned ? `<span class="pin"><span class="icon" data-lucide="pin"></span>고정</span>`:""}
            <span class="pill">${escapeHtml(p.authorName||"")}</span>
            <span class="pill">${escapeHtml(relTime(p.createdAt))}</span>
            <div class="item__right">
              <button class="btn btn--danger" data-bmremove="${p.id}" type="button">삭제</button>
            </div>
          </div>
          <div class="item__title">${escapeHtml(p.title||"")}</div>
        </div>
      `).join("") : `<div class="card" style="padding:14px">북마크가 비어있어요.</div>`}
    </div>
  `, `
    <button class="btn btn--ghost" data-close="1" type="button">닫기</button>
  `);

  $$("[data-bmopen]").forEach(el=>{
    el.addEventListener("click", ()=>{
      const id = el.getAttribute("data-bmopen");
      closeModal();
      openPost(id);
    });
  });
  $$("[data-bmremove]").forEach(btn=>{
    btn.addEventListener("click", (e)=>{
      e.stopPropagation();
      const id = btn.getAttribute("data-bmremove");
      delete state.bookmarks[id];
      saveBookmarks();
      toast("삭제됨");
      closeModal();
      openBookmarks();
    });
  });

  renderIcons();
}

/* ---------- Activity (me posts/comments) ---------- */
async function openActivity(){
  if (!requireLogin()) return;

  openModal("내 활동", `
    <div class="row" style="gap:10px; flex-wrap:wrap">
      <button class="btn btn--ghost" id="tabMyPosts" type="button">내 글</button>
      <button class="btn btn--ghost" id="tabMyComments" type="button">내 댓글</button>
      <div class="spacer"></div>
      <span class="muted">API: /me/posts, /me/comments</span>
    </div>
    <div id="actList" style="margin-top:12px; display:flex; flex-direction:column; gap:10px">
      <div class="muted">불러오는 중…</div>
    </div>
  `, `<button class="btn btn--ghost" data-close="1" type="button">닫기</button>`);

  const $actList = $("#actList");

  async function loadMyPosts(){
    $actList.innerHTML = `<div class="muted">내 글 불러오는 중…</div>`;
    try{
      const r = await api("/me/posts", { qsObj:{ sort:"latest", pageSize:100 }});
      const posts = r.posts || [];
      if (!posts.length) { $actList.innerHTML = `<div class="card" style="padding:14px">내 글이 아직 없어요.</div>`; return; }
      $actList.innerHTML = posts.map(postCard).join("");
      $$("[data-open]", $actList).forEach(el=> el.addEventListener("click", ()=>{ closeModal(); openPost(el.getAttribute("data-open")); }));
      $$("[data-bm]", $actList).forEach(btn=>{
        btn.addEventListener("click",(e)=>{
          e.stopPropagation();
          const id = btn.getAttribute("data-bm");
          const p = posts.find(x=>x.id===id);
          if(!p) return;
          const on = toggleBookmark(p);
          btn.querySelector(".icon").style.opacity = on ? "1":"0.55";
          renderIcons();
        });
      });
      renderIcons();
    } catch(e){
      $actList.innerHTML = `<div class="card" style="padding:14px">실패: ${escapeHtml(e.message)}</div>`;
    }
  }

  async function loadMyComments(){
    $actList.innerHTML = `<div class="muted">내 댓글 불러오는 중…</div>`;
    try{
      const r = await api("/me/comments", { qsObj:{ pageSize:100 }});
      const cs = r.comments || [];
      if (!cs.length) { $actList.innerHTML = `<div class="card" style="padding:14px">내 댓글이 아직 없어요.</div>`; return; }
      $actList.innerHTML = cs.map(c=>`
        <div class="item" data-open="${c.postId}" tabindex="0">
          <div class="item__top">
            <span class="tag">댓글</span>
            ${c.post?.pinned ? `<span class="pin"><span class="icon" data-lucide="pin"></span>고정</span>`:""}
            <span class="pill">${escapeHtml(catLabel(c.post?.category))}</span>
            <span class="pill">${escapeHtml(relTime(c.createdAt))}</span>
          </div>
          <div class="item__title">${escapeHtml(c.post?.title || "글로 이동")}</div>
          <div class="item__meta">${escapeHtml((c.bodyMd||"").slice(0,120))}${(c.bodyMd||"").length>120?"…":""}</div>
        </div>
      `).join("");
      $$("[data-open]", $actList).forEach(el=> el.addEventListener("click", ()=>{ closeModal(); openPost(el.getAttribute("data-open")); }));
      renderIcons();
    } catch(e){
      $actList.innerHTML = `<div class="card" style="padding:14px">실패: ${escapeHtml(e.message)}</div>`;
    }
  }

  $("#tabMyPosts").addEventListener("click", loadMyPosts);
  $("#tabMyComments").addEventListener("click", loadMyComments);

  loadMyPosts();
}

/* ---------- Admin Reports ---------- */
async function openAdminReports(){
  if (!requireLogin()) return;
  if (!isAdminRole(state.me?.role)) return toast("관리자/모더레이터만 가능");

  openModal("신고함(관리자)", `
    <div class="row" style="gap:10px; flex-wrap:wrap">
      <button class="btn btn--ghost" id="rpOpen" type="button">미처리</button>
      <button class="btn btn--ghost" id="rpClosed" type="button">처리됨</button>
      <button class="btn btn--ghost" id="rpAll" type="button">전체</button>
      <div class="spacer"></div>
      <span class="muted">/admin/reports</span>
    </div>
    <div id="rpList" style="margin-top:12px; display:flex; flex-direction:column; gap:10px">
      <div class="muted">불러오는 중…</div>
    </div>
  `, `<button class="btn btn--ghost" data-close="1" type="button">닫기</button>`);

  const $rpList = $("#rpList");

  async function load(status){
    $rpList.innerHTML = `<div class="muted">불러오는 중…</div>`;
    try{
      const r = await api("/admin/reports", { qsObj:{ status, pageSize:200 }});
      const rs = r.reports || [];
      if (!rs.length) { $rpList.innerHTML = `<div class="card" style="padding:14px">신고가 없어요.</div>`; return; }

      $rpList.innerHTML = rs.map(x=>`
        <div class="comment">
          <div class="comment__meta">
            <span class="pill">${escapeHtml(x.status)}</span>
            <span class="pill">${escapeHtml(x.target_type)}:${escapeHtml(x.target_id)}</span>
            <span class="pill">신고자: ${escapeHtml(x.reporter_nick)}</span>
            <span class="pill">${escapeHtml(relTime(x.created_at))}</span>
            <div class="spacer"></div>
            ${x.status==="open" ? `<button class="btn btn--primary" data-closeReport="${x.id}" type="button">처리</button>` : ``}
            <button class="btn btn--ghost" data-openTarget="${x.target_type}:${x.target_id}" type="button">대상 열기</button>
          </div>
          <div style="margin-top:8px"><b>${escapeHtml(x.reason)}</b></div>
          <div class="muted" style="margin-top:6px; white-space:pre-wrap">${escapeHtml(x.detail)}</div>
        </div>
      `).join("");

      $$("[data-openTarget]", $rpList).forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const v = btn.getAttribute("data-openTarget");
          const [t,id] = v.split(":");
          if (t==="post") { closeModal(); openPost(id); }
          else toast("comment 대상 열기는 현재 버전에서 post로 이동만 지원");
        });
      });

      $$("[data-closeReport]", $rpList).forEach(btn=>{
        btn.addEventListener("click", async ()=>{
          const id = btn.getAttribute("data-closeReport");
          try{
            await api(`/admin/reports/${id}/close`, { method:"POST" });
            toast("처리됨");
            load(status);
          } catch(e){
            toast("실패: " + e.message);
          }
        });
      });

    } catch(e){
      $rpList.innerHTML = `<div class="card" style="padding:14px">실패: ${escapeHtml(e.message)}</div>`;
    }
  }

  $("#rpOpen").addEventListener("click", ()=>load("open"));
  $("#rpClosed").addEventListener("click", ()=>load("closed"));
  $("#rpAll").addEventListener("click", ()=>load("all"));

  load("open");
}

/* ---------- Realtime (WebSocket) ---------- */
let ws = null;
function connectRealtime(){
  try{
    if (ws) { ws.close(); ws = null; }
    const u = new URL(API_BASE + "/realtime");
    u.searchParams.set("channel","feed");
    const wsu = u.toString().replace("https://","wss://").replace("http://","ws://");

    ws = new WebSocket(wsu);

    ws.onopen = ()=>{
      state.ws.ok = true;
      $rtLabel.textContent = "실시간: 연결됨";
      $rtMeta.textContent = "—";
      $rtDot.parentElement.classList.add("is-on");
    };

    ws.onmessage = (evt)=>{
      state.ws.lastTs = Date.now();
      try{
        const msg = JSON.parse(evt.data);
        if (msg?.payload?.kind) {
          // lightweight: refresh feed if on feed view
          if (!$feedView.classList.contains("is-hidden")) {
            loadFeed(true);
          }
        }
      } catch {}
    };

    ws.onclose = ()=>{
      state.ws.ok = false;
      $rtLabel.textContent = "실시간: 연결 끊김";
      $rtMeta.textContent = "재연결 시도…";
      $rtDot.parentElement.classList.remove("is-on");
      setTimeout(connectRealtime, 1200 + Math.random()*900);
    };
    ws.onerror = ()=>{
      try{ ws.close(); }catch{}
    };

    // ping
    setInterval(()=>{ try{ if (ws && ws.readyState===1) ws.send("ping"); }catch{} }, 8000);
  } catch {
    $rtLabel.textContent = "실시간: 실패";
    $rtMeta.textContent = "—";
  }
}

/* ---------- Events ---------- */
$themeBtn.addEventListener("click", ()=>{
  const cur = document.documentElement.dataset.theme || "dark";
  applyTheme(cur === "dark" ? "light" : "dark");
});
$bookmarksBtn.addEventListener("click", openBookmarks);
$activityBtn.addEventListener("click", openActivity);

$searchBtn.addEventListener("click", ()=>{
  state.q = $qInput.value.trim();
  loadFeed(true);
});
$qInput.addEventListener("keydown", (e)=>{
  if (e.key==="Enter") $searchBtn.click();
});

$sortSel.addEventListener("change", ()=>{
  state.sort = $sortSel.value;
  loadFeed(true);
});

$chips.forEach(btn=>{
  btn.addEventListener("click", ()=>{
    $chips.forEach(x=>x.classList.remove("is-active"));
    btn.classList.add("is-active");
    state.category = btn.dataset.cat;
    loadFeed(true);
  });
});

$refreshBtn.addEventListener("click", ()=> loadFeed(true));
$loadMoreBtn.addEventListener("click", ()=> loadFeed(false));
$newPostBtn.addEventListener("click", ()=> openWriteModal(false));
$fabBtn.addEventListener("click", ()=> openWriteModal(false));
$backBtn.addEventListener("click", showFeed);
$homeBtn.addEventListener("click", ()=>{ showFeed(); loadFeed(true); });

/* ---------- Init ---------- */
(async function init(){
  initTheme();
  renderIcons();
  await boot();

  // restore me if exists
  try { state.me = JSON.parse(localStorage.getItem(LS.me) || "null"); } catch { state.me = null; }
  renderUserBox();

  await refreshMe();

  // init sort selector
  $sortSel.value = state.sort;

  // realtime
  connectRealtime();

  // first load
  await loadFeed(true);

  banner("베타 테스트 오픈! 불편/버그는 신고 또는 공지 댓글로 알려줘요.");
})();
