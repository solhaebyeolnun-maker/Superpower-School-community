import React, { useEffect, useMemo, useRef, useState } from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";
import { motion, AnimatePresence } from "https://esm.sh/framer-motion@11.3.30";
import ReactMarkdown from "https://esm.sh/react-markdown@9.0.1";
import remarkGfm from "https://esm.sh/remark-gfm@4.0.0";
import {
  Heart, MessageCircle, Send, ShieldAlert, Trash2, Pencil, LogIn, LogOut, UserPlus, Hash, Flame, Clock, Search, X
} from "https://esm.sh/lucide-react@0.451.0";

// ===================== CONFIG =====================
const API_BASE = "https://srt-community-api.yekong0728.workers.dev"; // 너 Workers API
const WS_BASE = API_BASE.replace("https://", "wss://").replace("http://", "ws://");

// 페이지 사이즈 (서버 보호용 상한이 있어도, 커서로 계속 불러오면 "개수 제한 없음"처럼 동작)
const PAGE_SIZE = 50;

// ===================== tiny utilities =====================
const cls = (...a) => a.filter(Boolean).join(" ");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function formatTime(ms) {
  const d = new Date(ms);
  const now = Date.now();
  const diff = now - ms;
  if (diff < 60_000) return "방금";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function getToken() {
  return localStorage.getItem("SRT_TOKEN") || "";
}
function setToken(t) {
  if (!t) localStorage.removeItem("SRT_TOKEN");
  else localStorage.setItem("SRT_TOKEN", t);
}

// ===================== API helpers =====================
async function apiFetch(path, { method="GET", token="", jsonBody=null } = {}) {
  const headers = {};
  if (jsonBody) headers["content-type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: jsonBody ? JSON.stringify(jsonBody) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = (data && data.error) ? data.error : `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// ===================== UI primitives (shadcn-ish) =====================
function Card({ className, children }) {
  return (
    <div className={cls("bg-white border border-zinc-200 rounded-2xl shadow-soft", className)}>
      {children}
    </div>
  );
}
function CardHeader({ className, children }) {
  return <div className={cls("p-4 pb-2", className)}>{children}</div>;
}
function CardContent({ className, children }) {
  return <div className={cls("p-4 pt-2", className)}>{children}</div>;
}
function Button({ className, variant="default", size="md", disabled, onClick, children, title }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none";
  const sizes = {
    sm: "h-9 px-3 text-sm",
    md: "h-10 px-4 text-sm",
    lg: "h-11 px-5 text-base"
  };
  const variants = {
    default: "bg-zinc-900 text-white hover:bg-zinc-800",
    secondary: "bg-zinc-100 text-zinc-900 hover:bg-zinc-200",
    outline: "border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-900",
    danger: "bg-red-600 text-white hover:bg-red-500",
    ghost: "bg-transparent hover:bg-zinc-100 text-zinc-900"
  };
  return (
    <button title={title} disabled={disabled} onClick={onClick} className={cls(base, sizes[size], variants[variant], className)}>
      {children}
    </button>
  );
}
function Input({ className, ...props }) {
  return (
    <input
      className={cls(
        "h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none",
        "focus:ring-2 focus:ring-zinc-200",
        className
      )}
      {...props}
    />
  );
}
function Textarea({ className, ...props }) {
  return (
    <textarea
      className={cls(
        "min-h-[120px] w-full rounded-xl border border-zinc-200 bg-white p-3 text-sm outline-none",
        "focus:ring-2 focus:ring-zinc-200",
        className
      )}
      {...props}
    />
  );
}
function Switch({ checked, onChange, label }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cls(
        "relative inline-flex h-6 w-11 items-center rounded-full border transition",
        checked ? "bg-zinc-900 border-zinc-900" : "bg-white border-zinc-200"
      )}
      aria-label={label}
      title={label}
      type="button"
    >
      <span
        className={cls(
          "inline-block h-5 w-5 transform rounded-full bg-white shadow transition",
          checked ? "translate-x-5" : "translate-x-1",
          !checked && "bg-zinc-200"
        )}
      />
    </button>
  );
}
function Badge({ children, className }) {
  return (
    <span className={cls("inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700", className)}>
      {children}
    </span>
  );
}
function Divider() {
  return <div className="h-px w-full bg-zinc-200" />;
}

// ===================== Modal =====================
function Modal({ open, onClose, title, children, footer }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <motion.div
            className="relative w-full max-w-lg rounded-2xl bg-white shadow-soft border border-zinc-200"
            initial={{ scale: 0.98, y: 8, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.98, y: 8, opacity: 0 }}
          >
            <div className="flex items-center justify-between p-4 border-b border-zinc-200">
              <div className="text-base font-extrabold">{title}</div>
              <Button variant="ghost" size="sm" onClick={onClose}><X size={18} /></Button>
            </div>
            <div className="p-4">{children}</div>
            {footer && <div className="p-4 pt-0">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ===================== Toasts =====================
function useToasts() {
  const [items, setItems] = useState([]);
  const push = (type, text) => {
    const id = Math.random().toString(36).slice(2);
    setItems((x) => [...x, { id, type, text }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 3000);
  };
  const node = (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className={cls(
              "rounded-2xl px-4 py-3 shadow-soft border text-sm font-semibold",
              t.type === "error" ? "bg-red-50 border-red-200 text-red-700" :
              t.type === "ok" ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
              "bg-white border-zinc-200 text-zinc-800"
            )}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
  return { push, node };
}

// ===================== Markdown renderer =====================
function Md({ text }) {
  return (
    <div className="prose-like text-sm text-zinc-800">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {text || ""}
      </ReactMarkdown>
    </div>
  );
}

// ===================== App =====================
function App() {
  const { push, node: toastNode } = useToasts();

  // session
  const [token, setTokenState] = useState(getToken());
  const [me, setMe] = useState(null);

  // feed
  const [posts, setPosts] = useState([]);
  const [nextCursor, setNextCursor] = useState("");
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // UI state
  const [sort, setSort] = useState("latest"); // latest | hot
  const [category, setCategory] = useState("all");
  const [q, setQ] = useState("");

  // modals
  const [openAuth, setOpenAuth] = useState(false);
  const [authTab, setAuthTab] = useState("login"); // login|register
  const [openComposer, setOpenComposer] = useState(false);
  const [openPost, setOpenPost] = useState(false);
  const [activePostId, setActivePostId] = useState("");
  const [activePost, setActivePost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loadingPost, setLoadingPost] = useState(false);

  // realtime WS
  const wsRef = useRef(null);
  const wsConnectedRef = useRef(false);

  // composer
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newAnonymous, setNewAnonymous] = useState(false);
  const [newCategory, setNewCategory] = useState("free");

  // comment composer
  const [cBody, setCBody] = useState("");
  const [cAnonymous, setCAnonymous] = useState(false);

  // edit post
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editAnonymous, setEditAnonymous] = useState(false);

  // ---------------- load me ----------------
  useEffect(() => {
    (async () => {
      if (!token) { setMe(null); return; }
      try {
        const data = await apiFetch("/auth/me", { token });
        if (data?.ok) setMe(data.user);
      } catch (e) {
        setToken("");
      }
    })();
  }, [token]);

  function setToken(t) {
    setTokenState(t);
    setToken(t);
  }
  function setToken(t) {
    setTokenState(t);
    setTokenState(t);
    if (!t) localStorage.removeItem("SRT_TOKEN");
    else localStorage.setItem("SRT_TOKEN", t);
  }

  // ---------------- feed load ----------------
  async function loadFeed({ reset=false } = {}) {
    if (loadingFeed) return;
    setLoadingFeed(true);
    try {
      const cursor = reset ? "" : nextCursor;
      const params = new URLSearchParams();
      params.set("sort", sort);
      params.set("category", category);
      if (q.trim()) params.set("q", q.trim());
      params.set("pageSize", String(PAGE_SIZE));
      if (cursor) params.set("cursor", cursor);

      const data = await apiFetch(`/posts?${params.toString()}`);
      if (reset) setPosts(data.posts || []);
      else setPosts((p) => [...p, ...(data.posts || [])]);
      setNextCursor(data.nextCursor || "");
      setHasMore(!!(data.nextCursor && (data.posts || []).length));
    } catch (e) {
      push("error", e.message || "피드 불러오기 실패");
    } finally {
      setLoadingFeed(false);
    }
  }

  useEffect(() => {
    // 초기/필터 변경 시 리셋
    setPosts([]);
    setNextCursor("");
    setHasMore(true);
    loadFeed({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, category]);

  // 검색은 타이핑 끝나고 살짝 딜레이
  useEffect(() => {
    const t = setTimeout(() => {
      setPosts([]);
      setNextCursor("");
      setHasMore(true);
      loadFeed({ reset: true });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // infinite scroll sentinel
  const sentinelRef = useRef(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(async (entries) => {
      if (!entries[0].isIntersecting) return;
      if (!hasMore || loadingFeed) return;
      await loadFeed({ reset: false });
    }, { rootMargin: "800px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadingFeed, nextCursor, sort, category, q]);

  // ---------------- realtime ----------------
  useEffect(() => {
    // WS는 실제 페이지(예: github.io)에서만 정상 테스트 가능.
    // chrome devtools 콘솔에서 example.com/확장페이지/새탭 등은 CSP로 막힘.
    connectWS();
    return () => disconnectWS();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function connectWS() {
    disconnectWS();
    const ws = new WebSocket(`${WS_BASE}/realtime?channel=feed`);
    wsRef.current = ws;

    ws.onopen = () => {
      wsConnectedRef.current = true;
    };
    ws.onclose = () => {
      wsConnectedRef.current = false;
      // 약간 쉬고 재연결
      setTimeout(() => connectWS(), 1200);
    };
    ws.onerror = () => {
      wsConnectedRef.current = false;
    };
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg?.type !== "event") return;
        const p = msg.payload || {};
        // 최근 24h 범위만 publish되지만, 여기서도 보수적으로 처리
        if (p.kind === "post_created") {
          // 새 글은 상단 prepend(정렬 latest일 때)
          if (sort === "latest" && (category === "all" || category === "free" || category === p.category)) {
            // 실제 내용은 listPosts에서 다시 받아오고 싶지만,
            // 과도한 fetch를 피하려고 "새 글 있음" UX만 제공하는 것도 가능.
            // 여기서는 간단히 리프레시 유도.
            push("info", "새 글이 올라왔어요. 위로 스크롤 후 새로고침/검색을 눌러 확인!");
          }
        }
        if (p.kind === "post_updated" || p.kind === "post_removed" || p.kind === "comment_created") {
          // 현재 보고 있는 글이 관련이면 재로딩
          if (openPost && activePostId && (p.postId === activePostId)) {
            openPostDetail(activePostId, { silent: true });
          }
        }
      } catch {
        // ignore
      }
    };
  }

  function disconnectWS() {
    const ws = wsRef.current;
    wsRef.current = null;
    try { ws?.close(); } catch {}
  }

  // ---------------- auth actions ----------------
  async function doRegister({ nickname, studentId, password }) {
    const body = { nickname, studentId: studentId || "", password };
    await apiFetch("/auth/register", { method: "POST", jsonBody: body });
    push("ok", "회원가입 완료! 로그인 해주세요.");
    setAuthTab("login");
  }

  async function doLogin({ identifier, password }) {
    const data = await apiFetch("/auth/login", { method: "POST", jsonBody: { identifier, password } });
    if (data?.ok) {
      setToken(data.token);
      setMe(data.user);
      setOpenAuth(false);
      push("ok", `환영합니다, ${data.user.nickname}!`);
    }
  }

  async function doLogout() {
    try { await apiFetch("/auth/logout", { method: "POST", token }); } catch {}
    setToken("");
    setMe(null);
    push("ok", "로그아웃 완료");
  }

  // ---------------- posts actions ----------------
  async function createNewPost() {
    if (!me) { push("error", "로그인이 필요해요"); setOpenAuth(true); return; }
    if (!newTitle.trim() || !newBody.trim()) { push("error", "제목/내용을 입력해줘"); return; }

    try {
      await apiFetch("/posts", {
        method: "POST",
        token,
        jsonBody: { category: newCategory, title: newTitle.trim(), bodyMd: newBody, anonymous: newAnonymous },
      });
      push("ok", "게시글 등록 완료");
      setOpenComposer(false);
      setNewTitle(""); setNewBody(""); setNewAnonymous(false); setNewCategory("free");
      // 새로고침
      await loadFeed({ reset: true });
    } catch (e) {
      push("error", e.message || "게시글 등록 실패");
    }
  }

  async function toggleLike(targetType, targetId) {
    if (!me) { push("error", "로그인이 필요해요"); setOpenAuth(true); return; }
    try {
      const data = await apiFetch("/likes/toggle", { method: "POST", token, jsonBody: { targetType, targetId } });
      if (targetType === "post") {
        // 낙관적 업데이트
        setPosts((p) => p.map((x) => x.id === targetId ? { ...x, likes: Math.max(0, (x.likes || 0) + (data.liked ? 1 : -1)) } : x));
        if (activePost?.id === targetId) setActivePost((x) => x ? { ...x, likes: Math.max(0, (x.likes || 0) + (data.liked ? 1 : -1)) } : x);
      }
      push("ok", data.liked ? "좋아요!" : "좋아요 취소");
    } catch (e) {
      push("error", e.message || "좋아요 실패");
    }
  }

  async function report(targetType, targetId) {
    if (!me) { push("error", "로그인이 필요해요"); setOpenAuth(true); return; }
    const reason = prompt("신고 사유(짧게)", "기타") || "기타";
    const detail = prompt("상세 내용(선택)", "") || "";
    try {
      await apiFetch("/reports", { method: "POST", token, jsonBody: { targetType, targetId, reason, detail } });
      push("ok", "신고 접수 완료");
    } catch (e) {
      push("error", e.message || "신고 실패");
    }
  }

  async function openPostDetail(postId, { silent=false } = {}) {
    setActivePostId(postId);
    setOpenPost(true);
    setLoadingPost(true);
    try {
      // post는 /posts list에 상세 endpoint가 없어서:
      // 1) 현재 posts에서 찾고,
      // 2) comments는 /posts/:id/comments로 불러옴
      const p = posts.find((x) => x.id === postId) || activePost;
      if (p) setActivePost(p);

      const data = await apiFetch(`/posts/${postId}/comments`);
      setComments(data.comments || []);
      if (!silent) push("info", "댓글 로드 완료");
    } catch (e) {
      push("error", e.message || "게시물 로드 실패");
    } finally {
      setLoadingPost(false);
    }
  }

  async function submitComment() {
    if (!me) { push("error", "로그인이 필요해요"); setOpenAuth(true); return; }
    if (!activePostId) return;
    if (!cBody.trim()) { push("error", "댓글 내용을 입력해줘"); return; }

    try {
      await apiFetch(`/posts/${activePostId}/comments`, {
        method: "POST",
        token,
        jsonBody: { bodyMd: cBody, anonymous: cAnonymous },
      });
      setCBody("");
      setCAnonymous(false);
      await openPostDetail(activePostId, { silent: true });
      push("ok", "댓글 등록 완료");
    } catch (e) {
      push("error", e.message || "댓글 등록 실패");
    }
  }

  function canEditPost(p) {
    return me && p && !p.anonymous && me.nickname && p.authorName === me.nickname; // 비익명일 때만 이름으로 비교됨
  }
  // 서버는 author_id로 권한 체크하므로 프론트의 canEdit은 UX용일 뿐
  // 익명글도 작성자면 수정 가능하지만, API에서 처리됨. 여기서는 "내 글인지"를 정확히 알기 어려움.
  // 그래서 편의상 "수정 버튼은 로그인 상태에서만" + "시도는 허용"으로.
  function canTryEdit() {
    return !!me;
  }
  function canDeleteAdmin() {
    return me && (me.role === "admin" || me.role === "mod");
  }

  async function startEditPost() {
    if (!activePost) return;
    if (!canTryEdit()) { push("error", "로그인이 필요해요"); setOpenAuth(true); return; }
    setEditing(true);
    setEditTitle(activePost.title || "");
    setEditBody(activePost.bodyMd || "");
    setEditAnonymous(!!activePost.anonymous);
  }

  async function saveEditPost() {
    if (!activePostId) return;
    try {
      await apiFetch(`/posts/${activePostId}`, {
        method: "PATCH",
        token,
        jsonBody: {
          title: editTitle.trim(),
          bodyMd: editBody,
          anonymous: editAnonymous,
        },
      });
      push("ok", "수정 완료");
      setEditing(false);
      await loadFeed({ reset: true });
      await openPostDetail(activePostId, { silent: true });
    } catch (e) {
      push("error", e.message || "수정 실패(작성자만 가능)");
    }
  }

  async function deletePost() {
    if (!activePostId) return;
    if (!canDeleteAdmin()) { push("error", "관리자만 삭제 가능"); return; }
    if (!confirm("이 게시글을 삭제할까요? (관리자만 가능)")) return;
    try {
      await apiFetch(`/posts/${activePostId}`, { method: "DELETE", token });
      push("ok", "삭제 완료");
      setOpenPost(false);
      setActivePost(null);
      setComments([]);
      await loadFeed({ reset: true });
    } catch (e) {
      push("error", e.message || "삭제 실패");
    }
  }

  // ---------------- UI ----------------
  const wsBadge = wsConnectedRef.current ? "LIVE" : "OFF";

  return (
    <div className="min-h-screen">
      {toastNode}

      <TopBar
        me={me}
        wsBadge={wsBadge}
        onLogin={() => { setAuthTab("login"); setOpenAuth(true); }}
        onRegister={() => { setAuthTab("register"); setOpenAuth(true); }}
        onLogout={doLogout}
        sort={sort} setSort={setSort}
        category={category} setCategory={setCategory}
        q={q} setQ={setQ}
        onNewPost={() => setOpenComposer(true)}
      />

      <div className="mx-auto w-full max-w-3xl px-4 pb-16">
        <div className="mt-4 grid gap-3">
          {posts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              onOpen={() => openPostDetail(p.id)}
              onLike={() => toggleLike("post", p.id)}
              onReport={() => report("post", p.id)}
            />
          ))}

          <div ref={sentinelRef} />

          {loadingFeed && (
            <Card className="p-4">
              <div className="text-sm text-zinc-600">불러오는 중...</div>
            </Card>
          )}

          {!loadingFeed && posts.length === 0 && (
            <Card className="p-6">
              <div className="text-sm text-zinc-600">아직 글이 없어요. 첫 글을 작성해보세요.</div>
            </Card>
          )}

          {!loadingFeed && !hasMore && posts.length > 0 && (
            <div className="text-center text-xs text-zinc-500 py-6">끝!</div>
          )}
        </div>
      </div>

      {/* Auth modal */}
      <AuthModal
        open={openAuth}
        onClose={() => setOpenAuth(false)}
        tab={authTab}
        setTab={setAuthTab}
        onLogin={doLogin}
        onRegister={doRegister}
      />

      {/* Composer */}
      <Modal
        open={openComposer}
        onClose={() => setOpenComposer(false)}
        title="새 글 작성"
        footer={
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-zinc-600">
              <span className="font-bold">익명</span>
              <Switch checked={newAnonymous} onChange={setNewAnonymous} label="익명 토글" />
              <span className="ml-2 text-zinc-500">이미지/영상은 링크를 마크다운으로: <code>![](링크)</code></span>
            </div>
            <Button onClick={createNewPost}><Send size={16} />등록</Button>
          </div>
        }
      >
        <div className="grid gap-3">
          <div className="grid gap-2">
            <label className="text-xs font-bold text-zinc-700">카테고리</label>
            <div className="flex gap-2 flex-wrap">
              {["free","notice","question","lost","market"].map((c) => (
                <Button
                  key={c}
                  variant={newCategory === c ? "default" : "outline"}
                  size="sm"
                  onClick={() => setNewCategory(c)}
                >
                  {c}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid gap-2">
            <label className="text-xs font-bold text-zinc-700">제목</label>
            <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="제목" />
          </div>
          <div className="grid gap-2">
            <label className="text-xs font-bold text-zinc-700">내용 (Markdown 지원)</label>
            <Textarea value={newBody} onChange={(e) => setNewBody(e.target.value)} placeholder={"예)\n# 제목\n**굵게**\n> 인용\n![](https://...)\n"} />
          </div>
          <Divider />
          <div className="grid gap-2">
            <div className="text-xs font-bold text-zinc-700">미리보기</div>
            <Card className="p-3 bg-zinc-50">
              <Md text={newBody} />
            </Card>
          </div>
        </div>
      </Modal>

      {/* Post detail */}
      <Modal
        open={openPost}
        onClose={() => { setOpenPost(false); setActivePost(null); setComments([]); setEditing(false); }}
        title="게시글"
        footer={activePost && (
          <div className="grid gap-3">
            {editing ? (
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setEditing(false)}>취소</Button>
                <Button onClick={saveEditPost}><Pencil size={16}/>저장</Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => toggleLike("post", activePost.id)} title="좋아요">
                    <Heart size={16}/> {activePost.likes || 0}
                  </Button>
                  <Button variant="outline" onClick={() => report("post", activePost.id)} title="신고">
                    <ShieldAlert size={16}/> 신고
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={startEditPost} title="수정(작성자만)">
                    <Pencil size={16}/> 수정
                  </Button>
                  <Button variant="danger" onClick={deletePost} disabled={!canDeleteAdmin()} title="삭제(관리자만)">
                    <Trash2 size={16}/> 삭제
                  </Button>
                </div>
              </div>
            )}

            <Divider />

            <div className="grid gap-2">
              <div className="text-xs font-bold text-zinc-700">댓글 작성</div>
              <Textarea value={cBody} onChange={(e) => setCBody(e.target.value)} placeholder="댓글 (Markdown 지원)" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-zinc-600">
                  <span className="font-bold">익명</span>
                  <Switch checked={cAnonymous} onChange={setCAnonymous} label="댓글 익명 토글" />
                </div>
                <Button onClick={submitComment}><Send size={16}/>댓글 등록</Button>
              </div>
            </div>
          </div>
        )}
      >
        {loadingPost && <div className="text-sm text-zinc-600">불러오는 중...</div>}

        {!loadingPost && activePost && (
          <div className="grid gap-4">
            {!editing ? (
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="grid gap-1">
                    <div className="text-lg font-extrabold">{activePost.title}</div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-600">
                      <Badge>{activePost.category}</Badge>
                      <span>{activePost.authorName}</span>
                      <span className="text-zinc-400">·</span>
                      <span>{formatTime(activePost.createdAt)}</span>
                      {activePost.anonymous ? <Badge className="bg-zinc-900 text-white">익명</Badge> : null}
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <Md text={activePost.bodyMd} />
                </div>
              </div>
            ) : (
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <label className="text-xs font-bold text-zinc-700">제목</label>
                  <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs font-bold text-zinc-700">내용(Markdown)</label>
                  <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} />
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-600">
                  <span className="font-bold">익명</span>
                  <Switch checked={editAnonymous} onChange={setEditAnonymous} label="익명 토글" />
                </div>
                <Divider />
                <div className="grid gap-2">
                  <div className="text-xs font-bold text-zinc-700">미리보기</div>
                  <Card className="p-3 bg-zinc-50"><Md text={editBody} /></Card>
                </div>
              </div>
            )}

            <Divider />

            <div className="grid gap-3">
              <div className="flex items-center gap-2">
                <MessageCircle size={18} />
                <div className="font-extrabold">댓글</div>
                <Badge>{comments.length}</Badge>
              </div>

              {comments.length === 0 && (
                <div className="text-sm text-zinc-600">아직 댓글이 없어요.</div>
              )}

              <div className="grid gap-2">
                {comments.map((c) => (
                  <Card key={c.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-zinc-600 flex items-center gap-2">
                        <span className="font-bold">{c.authorName}</span>
                        {c.anonymous ? <Badge className="bg-zinc-900 text-white">익명</Badge> : null}
                        <span className="text-zinc-400">·</span>
                        <span>{formatTime(c.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => toggleLike("comment", c.id)} title="댓글 좋아요">
                          <Heart size={16} />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => report("comment", c.id)} title="댓글 신고">
                          <ShieldAlert size={16} />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2">
                      <Md text={c.bodyMd} />
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ===================== TopBar =====================
function TopBar({
  me, wsBadge,
  onLogin, onRegister, onLogout,
  sort, setSort,
  category, setCategory,
  q, setQ,
  onNewPost
}) {
  return (
    <div className="sticky top-0 z-40 border-b border-zinc-200 bg-white/80 backdrop-blur">
      <div className="mx-auto w-full max-w-3xl px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-2xl bg-zinc-900 text-white flex items-center justify-center font-black">S</div>
              <div className="leading-tight">
                <div className="font-extrabold">SRT Community</div>
                <div className="text-xs text-zinc-500 flex items-center gap-2">
                  <span className={cls("px-2 py-0.5 rounded-full border text-[11px] font-bold",
                    wsBadge === "LIVE" ? "border-emerald-200 text-emerald-700 bg-emerald-50" : "border-zinc-200 text-zinc-600 bg-zinc-50"
                  )}>
                    {wsBadge}
                  </span>
                  <span className="hidden sm:inline">피드/댓글 · Markdown · 익명</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={onNewPost}><Send size={16}/>글쓰기</Button>
            {me ? (
              <>
                <Button variant="secondary" className="hidden sm:inline-flex">
                  <Hash size={16} /> {me.nickname} {me.role !== "student" ? `(${me.role})` : ""}
                </Button>
                <Button variant="outline" onClick={onLogout}><LogOut size={16}/>로그아웃</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={onLogin}><LogIn size={16}/>로그인</Button>
                <Button variant="secondary" onClick={onRegister}><UserPlus size={16}/>회원가입</Button>
              </>
            )}
          </div>
        </div>

        <div className="mt-3 grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={sort === "latest" ? "default" : "outline"}
              size="sm"
              onClick={() => setSort("latest")}
              title="최신순"
            >
              <Clock size={16}/> 최신
            </Button>
            <Button
              variant={sort === "hot" ? "default" : "outline"}
              size="sm"
              onClick={() => setSort("hot")}
              title="인기순"
            >
              <Flame size={16}/> 인기
            </Button>

            <div className="h-6 w-px bg-zinc-200 mx-1" />

            {["all","free","notice","question","lost","market"].map((c) => (
              <Button
                key={c}
                variant={category === c ? "secondary" : "outline"}
                size="sm"
                onClick={() => setCategory(c)}
              >
                {c}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="검색 (제목/본문)" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===================== PostCard =====================
function PostCard({ post, onOpen, onLike, onReport }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="cursor-pointer"
      onClick={onOpen}
    >
      <Card className="hover:shadow-soft transition">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="grid gap-1">
              <div className="text-base font-extrabold">{post.title}</div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-600">
                <Badge>{post.category}</Badge>
                <span className="font-bold">{post.authorName}</span>
                {post.anonymous ? <Badge className="bg-zinc-900 text-white">익명</Badge> : null}
                <span className="text-zinc-400">·</span>
                <span>{formatTime(post.createdAt)}</span>
                {post.pinned ? <Badge className="bg-amber-100 text-amber-800">고정</Badge> : null}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="line-clamp-3 text-sm text-zinc-700">
            {post.bodyMd?.slice(0, 180) || ""}
            {(post.bodyMd?.length || 0) > 180 ? "…" : ""}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); onLike(); }}>
                <Heart size={16}/> {post.likes || 0}
              </Button>
              <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onReport(); }}>
                <ShieldAlert size={16}/> 신고
              </Button>
            </div>
            <div className="text-xs text-zinc-600 flex items-center gap-1">
              <MessageCircle size={16}/> {post.comments || 0}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ===================== AuthModal =====================
function AuthModal({ open, onClose, tab, setTab, onLogin, onRegister }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const [nickname, setNickname] = useState("");
  const [studentId, setStudentId] = useState("");
  const [password2, setPassword2] = useState("");

  useEffect(() => {
    if (!open) {
      setIdentifier(""); setPassword("");
      setNickname(""); setStudentId(""); setPassword2("");
    }
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={tab === "login" ? "로그인" : "회원가입"}
      footer={
        <div className="flex items-center justify-between">
          <div className="text-xs text-zinc-600">
            {tab === "login" ? (
              <button className="underline" onClick={() => setTab("register")}>회원가입으로</button>
            ) : (
              <button className="underline" onClick={() => setTab("login")}>로그인으로</button>
            )}
          </div>
          <Button
            onClick={async () => {
              try {
                if (tab === "login") {
                  await onLogin({ identifier, password });
                } else {
                  if (!nickname.trim()) return alert("닉네임 입력");
                  if ((password2 || "").length < 4) return alert("비번 4자 이상");
                  await onRegister({ nickname: nickname.trim(), studentId: studentId.trim(), password: password2 });
                }
              } catch (e) {
                alert(e.message || "실패");
              }
            }}
          >
            {tab === "login" ? <><LogIn size={16}/> 로그인</> : <><UserPlus size={16}/> 가입</>}
          </Button>
        </div>
      }
    >
      {tab === "login" ? (
        <div className="grid gap-3">
          <div className="grid gap-2">
            <label className="text-xs font-bold text-zinc-700">닉네임 또는 학번</label>
            <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="예: yekong0728 또는 20251234" />
          </div>
          <div className="grid gap-2">
            <label className="text-xs font-bold text-zinc-700">비밀번호</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호" />
          </div>
          <div className="text-xs text-zinc-600">
            - 읽기는 누구나 가능, 쓰기는 로그인 필요<br/>
            - 익명 토글은 글/댓글에서 가능
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          <div className="grid gap-2">
            <label className="text-xs font-bold text-zinc-700">닉네임(2~16)</label>
            <Input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="한/영/숫자/_" />
          </div>
          <div className="grid gap-2">
            <label className="text-xs font-bold text-zinc-700">학번(옵션)</label>
            <Input value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="없으면 비워도 됨" />
          </div>
          <div className="grid gap-2">
            <label className="text-xs font-bold text-zinc-700">비밀번호(4자 이상)</label>
            <Input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="비밀번호" />
          </div>
          <div className="text-xs text-zinc-600">
            - 로그인은 “닉네임 또는 학번 + 비밀번호”<br/>
            - 운영 중엔 비번을 더 강하게 제한하는 걸 추천
          </div>
        </div>
      )}
    </Modal>
  );
}

// ===================== Mount =====================
createRoot(document.getElementById("root")).render(<App />);
