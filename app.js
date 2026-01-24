import React, { useEffect, useMemo, useRef, useState } from "https://esm.sh/react@18.3.1";
import ReactDOM from "https://esm.sh/react-dom@18.3.1/client";
import { AnimatePresence, motion } from "https://esm.sh/framer-motion@11.3.30";
import { marked } from "https://esm.sh/marked@14.0.0";
import DOMPurify from "https://esm.sh/dompurify@3.1.6";

/** ================== CONFIG ================== **/
const API_BASE = "https://srt-community-api.yekong0728.workers.dev";
const LS_TOKEN = "srt_token";
const LS_USER  = "srt_user";

/** ================== MARKDOWN ================== **/
marked.setOptions({
  gfm: true,
  breaks: true,
});
function renderMarkdown(md){
  const html = marked.parse(md || "");
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}

/** ================== TIME ================== **/
function fmtTime(ts){
  const d = new Date(ts);
  const now = Date.now();
  const diff = Math.floor((now - ts)/1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff/60)}m`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h`;
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

/** ================== API ================== **/
async function apiFetch(path, { method="GET", token=null, body=null, qs=null } = {}){
  const url = new URL(API_BASE + path);
  if (qs){
    Object.entries(qs).forEach(([k,v])=>{
      if (v !== undefined && v !== null && String(v).length) url.searchParams.set(k, String(v));
    });
  }
  const headers = { "content-type":"application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("application/json") ? await res.json().catch(()=>null) : await res.text().catch(()=>null);

  if (!res.ok){
    const msg = (data && data.error) ? data.error : `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/** ================== ICONS (inline) ================== **/
function Icon({name, size=18}){
  const common = { width:size, height:size, viewBox:"0 0 24 24", fill:"none", xmlns:"http://www.w3.org/2000/svg" };
  const stroke = { stroke:"currentColor", strokeWidth:"2", strokeLinecap:"round", strokeLinejoin:"round" };

  if (name==="spark") return (
    <svg {...common}><path {...stroke} d="M12 2l1.5 6L20 12l-6.5 4L12 22l-1.5-6L4 12l6.5-4L12 2z"/></svg>
  );
  if (name==="user") return (
    <svg {...common}><path {...stroke} d="M20 21a8 8 0 0 0-16 0"/><circle {...stroke} cx="12" cy="8" r="4"/></svg>
  );
  if (name==="logIn") return (
    <svg {...common}><path {...stroke} d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path {...stroke} d="M10 17l5-5-5-5"/><path {...stroke} d="M15 12H3"/></svg>
  );
  if (name==="logOut") return (
    <svg {...common}><path {...stroke} d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path {...stroke} d="M16 17l5-5-5-5"/><path {...stroke} d="M21 12H9"/></svg>
  );
  if (name==="plus") return (
    <svg {...common}><path {...stroke} d="M12 5v14"/><path {...stroke} d="M5 12h14"/></svg>
  );
  if (name==="search") return (
    <svg {...common}><circle {...stroke} cx="11" cy="11" r="7"/><path {...stroke} d="M21 21l-4.3-4.3"/></svg>
  );
  if (name==="bolt") return (
    <svg {...common}><path {...stroke} d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/></svg>
  );
  if (name==="heart") return (
    <svg {...common}><path {...stroke} d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>
  );
  if (name==="flag") return (
    <svg {...common}><path {...stroke} d="M4 22V3"/><path {...stroke} d="M4 3h12l-2 5 2 5H4"/></svg>
  );
  if (name==="edit") return (
    <svg {...common}><path {...stroke} d="M12 20h9"/><path {...stroke} d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
  );
  if (name==="trash") return (
    <svg {...common}><path {...stroke} d="M3 6h18"/><path {...stroke} d="M8 6V4h8v2"/><path {...stroke} d="M19 6l-1 14H6L5 6"/><path {...stroke} d="M10 11v6"/><path {...stroke} d="M14 11v6"/></svg>
  );
  if (name==="chat") return (
    <svg {...common}><path {...stroke} d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>
  );
  if (name==="x") return (
    <svg {...common}><path {...stroke} d="M18 6L6 18"/><path {...stroke} d="M6 6l12 12"/></svg>
  );
  if (name==="copy") return (
    <svg {...common}><rect {...stroke} x="9" y="9" width="13" height="13" rx="2"/><rect {...stroke} x="2" y="2" width="13" height="13" rx="2"/></svg>
  );
  if (name==="image") return (
    <svg {...common}><rect {...stroke} x="3" y="4" width="18" height="16" rx="2"/><path {...stroke} d="M8 11l2-2 4 4 2-2 3 3"/><circle {...stroke} cx="8" cy="8" r="1"/></svg>
  );
  return null;
}

/** ================== UI PRIMITIVES (shadcn-ish) ================== **/
function Button({variant="default", size="md", className="", ...props}){
  const v = variant==="primary" ? "btn btn-primary" :
            variant==="danger" ? "btn btn-danger" :
            variant==="ghost" ? "btn btn-ghost" : "btn";
  const s = size==="sm" ? "btn-sm" : "";
  return <button className={`${v} ${s} ${className}`.trim()} {...props} />;
}
function Input(props){ return <input className="input" {...props} />; }
function Select(props){ return <select className="select" {...props} />; }
function Textarea(props){ return <textarea className="textarea" {...props} />; }
function Card({title, right, children}){
  return (
    <div className="card">
      <div className="card-inner">
        {(title || right) && (
          <div className="card-title">
            <h2>{title}</h2>
            <div className="row">{right}</div>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
function Modal({open, title, children, onClose, footer}){
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="backdrop"
          initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
          onMouseDown={(e)=>{ if (e.target === e.currentTarget) onClose?.(); }}
        >
          <motion.div className="modal"
            initial={{opacity:0, y:18, scale:.98}}
            animate={{opacity:1, y:0, scale:1}}
            exit={{opacity:0, y:18, scale:.98}}
            transition={{type:"spring", stiffness:340, damping:26}}
          >
            <div className="modal-header">
              <h2>{title}</h2>
              <Button className="btn-icon" variant="ghost" onClick={onClose} aria-label="close">
                <Icon name="x" />
              </Button>
            </div>
            <div className="modal-body">{children}</div>
            {footer && <div className="modal-footer">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** ================== TOAST ================== **/
function useToasts(){
  const [toasts, setToasts] = useState([]);
  function push({title="알림", message="", kind="info"}){
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [{id, title, message, kind}, ...t].slice(0,5));
    setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)), 3800);
  }
  const node = (
    <div className="toast-wrap">
      <AnimatePresence>
        {toasts.map(t=>(
          <motion.div
            key={t.id}
            className="toast"
            initial={{opacity:0, y:12, scale:.98}}
            animate={{opacity:1, y:0, scale:1}}
            exit={{opacity:0, y:12, scale:.98}}
          >
            <div className="ticon">{t.kind==="ok" ? "✓" : t.kind==="err" ? "!" : "•"}</div>
            <div>
              <b>{t.title}</b>
              <p>{t.message}</p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
  return { push, node };
}

/** ================== AUTH ================== **/
function loadAuth(){
  const token = localStorage.getItem(LS_TOKEN) || "";
  const user = (()=>{ try { return JSON.parse(localStorage.getItem(LS_USER)||"null"); } catch { return null; }})();
  return { token, user };
}
function saveAuth(token, user){
  if (token) localStorage.setItem(LS_TOKEN, token); else localStorage.removeItem(LS_TOKEN);
  if (user) localStorage.setItem(LS_USER, JSON.stringify(user)); else localStorage.removeItem(LS_USER);
}
function useAuth(toast){
  const [{token, user}, setState] = useState(loadAuth());

  async function refreshMe(){
    if (!token) return;
    try{
      const r = await apiFetch("/auth/me", { token });
      setState(s => ({...s, user: r.user}));
      saveAuth(token, r.user);
    }catch(e){
      // 토큰 만료 등
      setState({token:"", user:null});
      saveAuth("", null);
    }
  }

  async function login(identifier, password){
    const r = await apiFetch("/auth/login", { method:"POST", body:{identifier, password} });
    setState({ token:r.token, user:r.user });
    saveAuth(r.token, r.user);
    toast.push({title:"로그인 성공", message:`${r.user.nickname}님 환영해요`, kind:"ok"});
  }

  async function register(nickname, password, studentId){
    await apiFetch("/auth/register", { method:"POST", body:{nickname, password, studentId} });
    toast.push({title:"가입 완료", message:"이제 로그인하면 돼요", kind:"ok"});
  }

  async function logout(){
    try{
      if (token) await apiFetch("/auth/logout", { method:"POST", token });
    }catch{}
    setState({token:"", user:null});
    saveAuth("", null);
    toast.push({title:"로그아웃", message:"안전하게 로그아웃했어요", kind:"ok"});
  }

  useEffect(()=>{ refreshMe(); /* eslint-disable-next-line */ }, []);
  return { token, user, login, register, logout, refreshMe };
}

/** ================== ROUTER (hash) ================== **/
function useRoute(){
  const [route, setRoute] = useState(parseHash());
  function parseHash(){
    const h = (location.hash || "#/").slice(1); // "/"
    const parts = h.split("/").filter(Boolean);
    if (parts[0]==="post" && parts[1]) return { name:"post", id: parts[1] };
    return { name:"feed" };
  }
  useEffect(()=>{
    const on = ()=>setRoute(parseHash());
    window.addEventListener("hashchange", on);
    return ()=>window.removeEventListener("hashchange", on);
  },[]);
  return route;
}

/** ================== REALTIME WS ================== **/
function useRealtime({enabled=true, onEvent, toast}){
  const wsRef = useRef(null);
  const [status, setStatus] = useState("off"); // off|on|err
  useEffect(()=>{
    if (!enabled) return;

    const url = new URL(API_BASE + "/realtime?channel=feed");
    url.protocol = url.protocol.replace("http","ws"); // ws/wss
    const ws = new WebSocket(url.toString());
    wsRef.current = ws;

    let alive = true;
    setStatus("on");

    ws.onopen = ()=>{ if (!alive) return; setStatus("on"); };
    ws.onerror = ()=>{ if (!alive) return; setStatus("err"); };
    ws.onclose = ()=>{ if (!alive) return; setStatus("off"); };

    ws.onmessage = (e)=>{
      try{
        const msg = JSON.parse(e.data);
        if (msg?.type==="event") onEvent?.(msg.payload);
      }catch{}
    };

    const ping = setInterval(()=>{
      try{ ws.send("ping"); }catch{}
    }, 25000);

    return ()=>{
      alive = false;
      clearInterval(ping);
      try{ ws.close(); }catch{}
    };
  }, [enabled]);

  const badge = (
    <span className={`badge ${status==="on" ? "" : status==="err" ? "badge-warn" : "badge-off"}`}>
      <span className="badge-dot"></span>
      {status==="on" ? "Live" : status==="err" ? "Reconnecting" : "Offline"}
    </span>
  );

  return { status, badge };
}

/** ================== FEED ================== **/
function FeedPage({auth, toast}){
  const { token, user } = auth;

  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("latest");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const [posts, setPosts] = useState([]);
  const [cursor, setCursor] = useState("");
  const [hasMore, setHasMore] = useState(true);

  const [openAuth, setOpenAuth] = useState(false);
  const [authTab, setAuthTab] = useState("login"); // login|register
  const [openEditor, setOpenEditor] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  async function load({reset=false}={}){
    if (loading) return;
    setLoading(true);
    try{
      const r = await apiFetch("/posts", {
        token: token || null,
        qs: {
          category, sort, q,
          cursor: reset ? "" : cursor,
          pageSize: 50
        }
      });
      const newPosts = r.posts || [];
      setPosts(prev => reset ? newPosts : [...prev, ...newPosts]);
      setCursor(r.nextCursor || "");
      setHasMore(Boolean(r.nextCursor));
    }catch(e){
      toast.push({title:"불러오기 실패", message:e.message, kind:"err"});
    }finally{
      setLoading(false);
    }
  }

  // initial / filters
  useEffect(()=>{
    setPosts([]); setCursor(""); setHasMore(true);
    load({reset:true});
    // eslint-disable-next-line
  }, [category, sort]);

  // debounced search
  useEffect(()=>{
    const t = setTimeout(()=>{
      setPosts([]); setCursor(""); setHasMore(true);
      load({reset:true});
    }, 350);
    return ()=>clearTimeout(t);
    // eslint-disable-next-line
  }, [q]);

  // infinite scroll
  useEffect(()=>{
    function onScroll(){
      const near = (window.innerHeight + window.scrollY) > (document.body.offsetHeight - 900);
      if (near && hasMore && !loading) load({reset:false});
    }
    window.addEventListener("scroll", onScroll);
    return ()=>window.removeEventListener("scroll", onScroll);
  }, [hasMore, loading, cursor, category, sort, q]);

  // realtime updates
  const rt = useRealtime({
    enabled: true,
    toast,
    onEvent: async (ev)=>{
      if (!ev?.kind) return;
      if (ev.kind==="post_created"){
        // 새 글이면 가장 위로: 해당 글 상세를 한 번 fetch해서 prepend (가벼운 처리)
        try{
          const r = await apiFetch(`/posts/${ev.postId}`, { token: token || null });
          setPosts(prev => [r.post, ...prev].slice(0, 3000)); // 프론트 메모리만 적당히
        }catch{}
        return;
      }
      if (ev.kind==="post_updated"){
        try{
          const r = await apiFetch(`/posts/${ev.postId}`, { token: token || null });
          setPosts(prev => prev.map(p=>p.id===ev.postId ? r.post : p));
        }catch{}
        return;
      }
      if (ev.kind==="post_removed"){
        setPosts(prev => prev.filter(p=>p.id!==ev.postId));
        return;
      }
      if (ev.kind==="comment_created"){
        // 댓글 수만 증가시키기
        setPosts(prev => prev.map(p => p.id===ev.postId ? {...p, comments:(p.comments||0)+1} : p));
        return;
      }
    }
  });

  function openNew(){
    if (!token){
      setAuthTab("login");
      setOpenAuth(true);
      toast.push({title:"로그인 필요", message:"글 작성은 로그인 후 가능해요", kind:"info"});
      return;
    }
    setEditTarget(null);
    setOpenEditor(true);
  }

  async function likePost(postId){
    if (!token){
      setAuthTab("login"); setOpenAuth(true);
      toast.push({title:"로그인 필요", message:"좋아요는 로그인 후 가능해요", kind:"info"});
      return;
    }
    try{
      await apiFetch("/likes/toggle", { method:"POST", token, body:{targetType:"post", targetId:postId} });
      // 서버에서 카운트 반환이 없으니, 낙관적 업데이트(+1/-1) 대신 상세 재조회가 안전.
      const r = await apiFetch(`/posts/${postId}`, { token });
      setPosts(prev => prev.map(p=>p.id===postId ? r.post : p));
    }catch(e){
      toast.push({title:"좋아요 실패", message:e.message, kind:"err"});
    }
  }

  async function report(targetType, targetId){
    if (!token){
      setAuthTab("login"); setOpenAuth(true);
      toast.push({title:"로그인 필요", message:"신고는 로그인 후 가능해요", kind:"info"});
      return;
    }
    const reason = prompt("신고 사유(짧게) ex) 스팸/욕설/도배/기타") || "";
    if (!reason.trim()) return;
    const detail = prompt("추가 설명(선택)") || "";
    try{
      await apiFetch("/reports", { method:"POST", token, body:{targetType, targetId, reason, detail} });
      toast.push({title:"신고 접수", message:"관리자가 확인할게요", kind:"ok"});
    }catch(e){
      toast.push({title:"신고 실패", message:e.message, kind:"err"});
    }
  }

  function openEdit(p){
    setEditTarget(p);
    setOpenEditor(true);
  }

  async function deletePost(p){
    if (!token){ toast.push({title:"불가", message:"로그인이 필요해요", kind:"err"}); return; }
    if (!p.canDelete){ toast.push({title:"권한 없음", message:"관리자만 삭제 가능", kind:"err"}); return; }
    if (!confirm("정말 삭제할까요? (관리자 삭제)")) return;

    try{
      await apiFetch(`/posts/${p.id}`, { method:"DELETE", token });
      setPosts(prev => prev.filter(x=>x.id!==p.id));
      toast.push({title:"삭제 완료", message:"게시물이 제거됐어요", kind:"ok"});
    }catch(e){
      toast.push({title:"삭제 실패", message:e.message, kind:"err"});
    }
  }

  return (
    <>
      <div className="grid">
        <div className="col">
          <Card
            title="피드"
            right={
              <>
                {rt.badge}
                <Button variant="primary" onClick={openNew}>
                  <Icon name="plus" /> 글쓰기
                </Button>
              </>
            }
          >
            <div className="row">
              <Select value={category} onChange={(e)=>setCategory(e.target.value)}>
                <option value="all">전체</option>
                <option value="free">자유</option>
                <option value="qna">Q&A</option>
                <option value="notice">공지(운영)</option>
              </Select>

              <Select value={sort} onChange={(e)=>setSort(e.target.value)}>
                <option value="latest">최신</option>
                <option value="hot">인기</option>
              </Select>

              <div style={{flex:1, minWidth:220}}>
                <div className="row" style={{gap:8}}>
                  <span className="kbd"><Icon name="search" size={14} /> 검색</span>
                  <Input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="제목/내용 검색" />
                </div>
              </div>
            </div>

            <div className="hr"></div>

            <div className="col" style={{gap:10}}>
              <AnimatePresence initial={false}>
                {posts.map(p=>(
                  <motion.div
                    key={p.id}
                    className="post"
                    layout
                    initial={{opacity:0, y:10}}
                    animate={{opacity:1, y:0}}
                    exit={{opacity:0, y:10}}
                    transition={{type:"spring", stiffness:320, damping:24}}
                    onClick={()=>{ location.hash = `#/post/${p.id}`; }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="spread">
                      <div style={{display:"flex", alignItems:"center", gap:8, flexWrap:"wrap"}}>
                        <span className="badge">
                          <span className="badge-dot" style={{background:"rgba(167,139,250,.9)", boxShadow:"0 0 0 3px rgba(167,139,250,.14)"}}></span>
                          {p.category}
                        </span>
                        {p.pinned && <span className="badge"><Icon name="bolt" size={14}/> 고정</span>}
                      </div>
                      <span className="small muted">{fmtTime(p.createdAt)}</span>
                    </div>

                    <h3 style={{marginTop:8}}>{p.title}</h3>

                    <div className="post-meta">
                      <span><Icon name="user" size={14}/> {p.authorName}{p.anonymous ? " (익명)" : ""}</span>
                      <span>·</span>
                      <span><Icon name="chat" size={14}/> {p.comments || 0}</span>
                      <span>·</span>
                      <span><Icon name="heart" size={14}/> {p.likes || 0}</span>
                      {p.canEdit && (
                        <>
                          <span>·</span>
                          <span className="badge">작성자</span>
                        </>
                      )}
                      {user?.role==="admin" && <span className="badge">admin</span>}
                    </div>

                    <div className="post-actions" onClick={(e)=>e.stopPropagation()}>
                      <Button size="sm" onClick={()=>likePost(p.id)}>
                        <Icon name="heart" size={16}/> 좋아요
                      </Button>
                      <Button size="sm" variant="ghost" onClick={()=>report("post", p.id)}>
                        <Icon name="flag" size={16}/> 신고
                      </Button>

                      {p.canEdit && (
                        <Button size="sm" variant="ghost" onClick={()=>openEdit(p)}>
                          <Icon name="edit" size={16}/> 수정
                        </Button>
                      )}
                      {p.canDelete && (
                        <Button size="sm" variant="danger" onClick={()=>deletePost(p)}>
                          <Icon name="trash" size={16}/> 삭제(관리자)
                        </Button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              <div className="center muted small" style={{padding:"12px 0"}}>
                {loading ? "불러오는 중..." : hasMore ? "스크롤하면 더 불러와요" : "마지막 글까지 왔어요"}
              </div>
            </div>
          </Card>
        </div>

        <div className="col">
          <Card title="내 계정" right={<span className="badge"><span className="badge-dot"></span> Online</span>}>
            {!token ? (
              <div className="col">
                <div className="muted small">
                  읽기는 누구나 가능 · 쓰기는 로그인 필요
                </div>
                <div className="row">
                  <Button variant="primary" onClick={()=>{ setAuthTab("login"); setOpenAuth(true); }}>
                    <Icon name="logIn" /> 로그인
                  </Button>
                  <Button onClick={()=>{ setAuthTab("register"); setOpenAuth(true); }}>
                    <Icon name="user" /> 회원가입
                  </Button>
                </div>
                <div className="hr"></div>
                <div className="small muted">
                  이미지/동영상은 catbox 등에서 링크를 받아<br/>
                  마크다운으로 <span className="kbd">![](링크)</span> 형태로 넣으면 돼요.
                </div>
              </div>
            ) : (
              <div className="col">
                <div className="row" style={{justifyContent:"space-between"}}>
                  <div>
                    <div style={{fontSize:14, fontWeight:700}}>{user?.nickname}</div>
                    <div className="small muted">
                      {user?.studentId ? `학번: ${user.studentId}` : "학번 미등록"}
                      {" · "}
                      role: {user?.role || "student"}
                    </div>
                  </div>
                  <Button variant="ghost" onClick={auth.logout}>
                    <Icon name="logOut" /> 로그아웃
                  </Button>
                </div>

                <div className="hr"></div>

                <div className="col" style={{gap:8}}>
                  <div className="small muted">빠른 도구</div>
                  <Button onClick={()=>{
                    const url = prompt("catbox 등 업로드 링크를 붙여넣기") || "";
                    if (!url.trim()) return;
                    const md = `![](${url.trim()})`;
                    navigator.clipboard?.writeText(md);
                    toast.push({title:"복사됨", message: md, kind:"ok"});
                  }}>
                    <Icon name="image" /> 이미지 링크 → 마크다운 복사
                  </Button>

                  <Button variant="ghost" onClick={()=>{
                    navigator.clipboard?.writeText(API_BASE);
                    toast.push({title:"복사됨", message:"API_BASE를 복사했어요", kind:"ok"});
                  }}>
                    <Icon name="copy" /> API 주소 복사
                  </Button>
                </div>
              </div>
            )}
          </Card>

          <Card title="가이드" right={<span className="badge"><span className="badge-dot" style={{background:"rgba(245,158,11,.95)"}}></span> Tips</span>}>
            <div className="small muted">
              <div style={{marginBottom:8}}>마크다운 예시:</div>
              <div className="kbd"># 제목</div>
              <div className="kbd">## 소제목</div>
              <div className="kbd">**굵게**</div>
              <div className="kbd">&gt; 인용</div>
              <div className="kbd">```코드```</div>
              <div className="kbd">![](이미지링크)</div>
              <div style={{marginTop:10}}>
                실시간은 “최근 24시간 글”에 한해 이벤트로 반영돼요.
              </div>
            </div>
          </Card>
        </div>
      </div>

      <AuthModal open={openAuth} tab={authTab} setTab={setAuthTab} onClose={()=>setOpenAuth(false)} auth={auth} />
      <EditorModal
        open={openEditor}
        onClose={()=>setOpenEditor(false)}
        toast={toast}
        auth={auth}
        editTarget={editTarget}
        onSaved={async (postId)=>{
          setOpenEditor(false);
          // 저장 후 즉시 반영: 상세 fetch 후 목록 갱신
          try{
            const r = await apiFetch(`/posts/${postId}`, { token: token || null });
            setPosts(prev => {
              const exist = prev.some(p=>p.id===postId);
              if (exist) return prev.map(p=>p.id===postId ? r.post : p);
              return [r.post, ...prev];
            });
            location.hash = `#/post/${postId}`;
          }catch{}
        }}
      />
    </>
  );
}

/** ================== POST DETAIL ================== **/
function PostPage({auth, toast, postId}){
  const { token, user } = auth;
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [openEditor, setOpenEditor] = useState(false);
  const [openReport, setOpenReport] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentAnon, setCommentAnon] = useState(false);

  async function load(){
    setLoading(true);
    try{
      const r = await apiFetch(`/posts/${postId}`, { token: token || null });
      const c = await apiFetch(`/posts/${postId}/comments`, { token: token || null });
      setPost(r.post);
      setComments(c.comments || []);
    }catch(e){
      toast.push({title:"불러오기 실패", message:e.message, kind:"err"});
      setPost(null);
    }finally{
      setLoading(false);
    }
  }

  useEffect(()=>{ load(); /* eslint-disable-next-line */ }, [postId]);

  // realtime comment updates
  useRealtime({
    enabled: true,
    toast,
    onEvent: async (ev)=>{
      if (!ev?.kind) return;
      if (ev.kind==="post_updated" && ev.postId===postId) load();
      if (ev.kind==="post_removed" && ev.postId===postId){
        toast.push({title:"삭제됨", message:"이 게시물은 제거됐어요", kind:"err"});
        location.hash = "#/";
      }
      if (ev.kind==="comment_created" && ev.postId===postId){
        // 댓글 새로고침
        try{
          const c = await apiFetch(`/posts/${postId}/comments`, { token: token || null });
          setComments(c.comments || []);
        }catch{}
      }
    }
  });

  async function like(targetType, targetId){
    if (!token){
      toast.push({title:"로그인 필요", message:"좋아요는 로그인 후 가능해요", kind:"info"});
      return;
    }
    try{
      await apiFetch("/likes/toggle", { method:"POST", token, body:{targetType, targetId} });
      // 안전하게 새로고침 (정확 카운트)
      await load();
    }catch(e){
      toast.push({title:"좋아요 실패", message:e.message, kind:"err"});
    }
  }

  async function report(targetType, targetId){
    if (!token){
      toast.push({title:"로그인 필요", message:"신고는 로그인 후 가능해요", kind:"info"});
      return;
    }
    const reason = prompt("신고 사유(짧게) ex) 스팸/욕설/도배/기타") || "";
    if (!reason.trim()) return;
    const detail = prompt("추가 설명(선택)") || "";
    try{
      await apiFetch("/reports", { method:"POST", token, body:{targetType, targetId, reason, detail} });
      toast.push({title:"신고 접수", message:"관리자가 확인할게요", kind:"ok"});
    }catch(e){
      toast.push({title:"신고 실패", message:e.message, kind:"err"});
    }
  }

  async function addComment(){
    if (!token){
      toast.push({title:"로그인 필요", message:"댓글 작성은 로그인 후 가능해요", kind:"info"});
      return;
    }
    const bodyMd = commentText.trim();
    if (!bodyMd){
      toast.push({title:"댓글 내용 없음", message:"내용을 입력해줘요", kind:"err"});
      return;
    }
    try{
      await apiFetch(`/posts/${postId}/comments`, {
        method:"POST",
        token,
        body:{ bodyMd, anonymous: commentAnon }
      });
      setCommentText("");
      toast.push({title:"댓글 등록", message:"등록됐어요", kind:"ok"});
      await load();
    }catch(e){
      toast.push({title:"댓글 실패", message:e.message, kind:"err"});
    }
  }

  async function deletePost(){
    if (!token || !post?.canDelete){
      toast.push({title:"권한 없음", message:"관리자만 삭제 가능", kind:"err"});
      return;
    }
    if (!confirm("정말 삭제할까요? (관리자 삭제)")) return;
    try{
      await apiFetch(`/posts/${postId}`, { method:"DELETE", token });
      toast.push({title:"삭제 완료", message:"게시물이 제거됐어요", kind:"ok"});
      location.hash = "#/";
    }catch(e){
      toast.push({title:"삭제 실패", message:e.message, kind:"err"});
    }
  }

  if (loading){
    return (
      <div className="grid">
        <div className="col">
          <Card title="게시물" right={<Button variant="ghost" onClick={()=>location.hash="#/"}>← 목록</Button>}>
            <div className="muted small">불러오는 중...</div>
          </Card>
        </div>
        <div className="col">
          <Card title="내 계정">
            <div className="muted small">...</div>
          </Card>
        </div>
      </div>
    );
  }

  if (!post){
    return (
      <div className="grid">
        <div className="col">
          <Card title="게시물" right={<Button variant="ghost" onClick={()=>location.hash="#/"}>← 목록</Button>}>
            <div className="muted small">게시물을 찾을 수 없어요.</div>
          </Card>
        </div>
        <div className="col">
          <Card title="내 계정">
            <div className="muted small">...</div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid">
        <div className="col">
          <Card
            title="게시물"
            right={
              <div className="row">
                <Button variant="ghost" onClick={()=>location.hash="#/"}>← 목록</Button>
                <Button size="sm" onClick={()=>like("post", postId)}><Icon name="heart" size={16}/> {post.likes||0}</Button>
                <Button size="sm" variant="ghost" onClick={()=>report("post", postId)}><Icon name="flag" size={16}/> 신고</Button>
                {post.canEdit && <Button size="sm" variant="ghost" onClick={()=>setOpenEditor(true)}><Icon name="edit" size={16}/> 수정</Button>}
                {post.canDelete && <Button size="sm" variant="danger" onClick={deletePost}><Icon name="trash" size={16}/> 삭제</Button>}
              </div>
            }
          >
            <div className="row" style={{justifyContent:"space-between"}}>
              <div className="row">
                <span className="badge">
                  <span className="badge-dot" style={{background:"rgba(167,139,250,.9)", boxShadow:"0 0 0 3px rgba(167,139,250,.14)"}}></span>
                  {post.category}
                </span>
                {post.pinned && <span className="badge"><Icon name="bolt" size={14}/> 고정</span>}
                <span className="badge"><Icon name="user" size={14}/> {post.authorName}{post.anonymous ? " (익명)" : ""}</span>
              </div>
              <div className="small muted">{fmtTime(post.createdAt)} · 업데이트 {fmtTime(post.updatedAt)}</div>
            </div>

            <h2 style={{margin:"12px 0 8px", fontSize:20, lineHeight:1.2}}>{post.title}</h2>

            <div className="hr"></div>

            <div className="md" dangerouslySetInnerHTML={{__html: renderMarkdown(post.bodyMd)}} />

            <div className="hr"></div>

            <div className="row" style={{justifyContent:"space-between"}}>
              <div className="muted small">
                댓글 {post.comments || 0}
              </div>
              <div className="row">
                <Button size="sm" variant="ghost" onClick={()=>{
                  const url = prompt("이미지/동영상 링크를 붙여넣기") || "";
                  if (!url.trim()) return;
                  const md = `![](${url.trim()})`;
                  navigator.clipboard?.writeText(md);
                  toast.push({title:"복사됨", message:md, kind:"ok"});
                }}>
                  <Icon name="image" size={16}/> 링크→마크다운
                </Button>
              </div>
            </div>
          </Card>

          <Card title="댓글">
            {!auth.token ? (
              <div className="small muted">댓글 작성은 로그인 후 가능해요.</div>
            ) : (
              <div className="col">
                <Textarea value={commentText} onChange={(e)=>setCommentText(e.target.value)} placeholder="댓글을 마크다운으로 작성할 수 있어요." />
                <div className="row" style={{justifyContent:"space-between"}}>
                  <label className="row small muted" style={{gap:8}}>
                    <input type="checkbox" checked={commentAnon} onChange={(e)=>setCommentAnon(e.target.checked)} />
                    익명으로 작성
                  </label>
                  <Button variant="primary" onClick={addComment}>
                    <Icon name="plus" /> 댓글 등록
                  </Button>
                </div>
              </div>
            )}

            <div className="hr"></div>

            <div className="col" style={{gap:10}}>
              {comments.map(c=>(
                <motion.div key={c.id} className="post" initial={{opacity:0, y:6}} animate={{opacity:1, y:0}}>
                  <div className="spread">
                    <div className="post-meta">
                      <span><Icon name="user" size={14}/> {c.authorName}{c.anonymous ? " (익명)" : ""}</span>
                      <span>·</span>
                      <span className="small muted">{fmtTime(c.createdAt)}</span>
                    </div>
                    <div className="row">
                      <Button size="sm" onClick={()=>like("comment", c.id)}>
                        <Icon name="heart" size={16}/> 좋아요
                      </Button>
                      <Button size="sm" variant="ghost" onClick={()=>report("comment", c.id)}>
                        <Icon name="flag" size={16}/> 신고
                      </Button>
                    </div>
                  </div>
                  <div className="md" dangerouslySetInnerHTML={{__html: renderMarkdown(c.bodyMd)}} />
                </motion.div>
              ))}
              {!comments.length && <div className="small muted center">아직 댓글이 없어요</div>}
            </div>
          </Card>
        </div>

        <div className="col">
          <Card title="내 계정">
            {!auth.token ? (
              <div className="col">
                <div className="muted small">읽기는 누구나 · 쓰기는 로그인 필요</div>
                <Button variant="primary" onClick={()=>{ location.hash="#/"; }}>
                  <Icon name="logIn" /> 피드로 이동해서 로그인
                </Button>
              </div>
            ) : (
              <div className="col">
                <div style={{fontSize:14, fontWeight:700}}>{user?.nickname}</div>
                <div className="small muted">{user?.studentId ? `학번: ${user.studentId}` : "학번 미등록"} · role: {user?.role}</div>
                <div className="hr"></div>
                <Button variant="ghost" onClick={auth.logout}>
                  <Icon name="logOut" /> 로그아웃
                </Button>
              </div>
            )}
          </Card>

          <Card title="마크다운 미리보기">
            <div className="small muted">댓글/글 작성 시 이렇게 보여요.</div>
            <div className="hr"></div>
            <div className="md" dangerouslySetInnerHTML={{__html: renderMarkdown(
              "# 제목\n## 소제목\n**굵게** / `코드`\n\n> 인용문\n\n![](https://placehold.co/900x420/png)\n"
            )}} />
          </Card>
        </div>
      </div>

      <EditorModal
        open={openEditor}
        onClose={()=>setOpenEditor(false)}
        toast={toast}
        auth={auth}
        editTarget={post}
        onSaved={async ()=>{ setOpenEditor(false); await load(); }}
      />
    </>
  );
}

/** ================== AUTH MODAL ================== **/
function AuthModal({open, tab, setTab, onClose, auth}){
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [studentId, setStudentId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(()=>{ if(open){ setBusy(false); } }, [open]);

  async function doLogin(){
    setBusy(true);
    try{
      await auth.login(identifier, password);
      onClose();
    }finally{
      setBusy(false);
    }
  }
  async function doRegister(){
    setBusy(true);
    try{
      await auth.register(nickname, password, studentId || "");
      setTab("login");
    }finally{
      setBusy(false);
    }
  }

  const tabs = (
    <div className="row">
      <Button size="sm" variant={tab==="login" ? "primary":"ghost"} onClick={()=>setTab("login")}>로그인</Button>
      <Button size="sm" variant={tab==="register" ? "primary":"ghost"} onClick={()=>setTab("register")}>회원가입</Button>
    </div>
  );

  return (
    <Modal
      open={open}
      title="계정"
      onClose={onClose}
      footer={null}
    >
      {tabs}
      <div className="hr"></div>

      {tab==="login" ? (
        <div className="col">
          <div className="small muted">
            닉네임 또는 학번 + 비밀번호로 로그인
          </div>
          <Input value={identifier} onChange={(e)=>setIdentifier(e.target.value)} placeholder="닉네임 또는 학번" />
          <Input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="비밀번호" />
          <div className="row" style={{justifyContent:"flex-end"}}>
            <Button variant="primary" disabled={busy} onClick={doLogin}>
              <Icon name="logIn" /> 로그인
            </Button>
          </div>
        </div>
      ) : (
        <div className="col">
          <div className="small muted">
            닉네임(2~16, 영문/숫자/한글/_) + 비밀번호(4+) + 학번(선택)
          </div>
          <Input value={nickname} onChange={(e)=>setNickname(e.target.value)} placeholder="닉네임" />
          <Input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="비밀번호" />
          <Input value={studentId} onChange={(e)=>setStudentId(e.target.value)} placeholder="학번 (옵션)" />
          <div className="row" style={{justifyContent:"flex-end"}}>
            <Button variant="primary" disabled={busy} onClick={doRegister}>
              <Icon name="user" /> 가입하기
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** ================== EDITOR MODAL ================== **/
function EditorModal({open, onClose, toast, auth, editTarget, onSaved}){
  const isEdit = Boolean(editTarget?.id);
  const [category, setCategory] = useState(editTarget?.category || "free");
  const [title, setTitle] = useState(editTarget?.title || "");
  const [bodyMd, setBodyMd] = useState(editTarget?.bodyMd || "");
  const [anonymous, setAnonymous] = useState(Boolean(editTarget?.anonymous));
  const [tab, setTab] = useState("write"); // write|preview
  const [busy, setBusy] = useState(false);

  useEffect(()=>{
    if (!open) return;
    setCategory(editTarget?.category || "free");
    setTitle(editTarget?.title || "");
    setBodyMd(editTarget?.bodyMd || "");
    setAnonymous(Boolean(editTarget?.anonymous));
    setTab("write");
    setBusy(false);
  }, [open, editTarget?.id]);

  async function save(){
    if (!auth.token){
      toast.push({title:"로그인 필요", message:"작성은 로그인 후 가능해요", kind:"err"});
      return;
    }
    const t = title.trim();
    const b = bodyMd.trim();
    if (!t || !b){
      toast.push({title:"필수", message:"제목/내용을 입력해줘요", kind:"err"});
      return;
    }
    setBusy(true);
    try{
      if (!isEdit){
        const r = await apiFetch("/posts", { method:"POST", token:auth.token, body:{category, title:t, bodyMd:b, anonymous} });
        toast.push({title:"등록 완료", message:"피드에 반영됐어요", kind:"ok"});
        onSaved?.(r.postId);
      }else{
        await apiFetch(`/posts/${editTarget.id}`, { method:"PATCH", token:auth.token, body:{title:t, bodyMd:b, anonymous} });
        toast.push({title:"수정 완료", message:"변경사항이 반영됐어요", kind:"ok"});
        onSaved?.(editTarget.id);
      }
    }catch(e){
      toast.push({title:"저장 실패", message:e.message, kind:"err"});
    }finally{
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title={isEdit ? "글 수정" : "새 글 작성"}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>닫기</Button>
          <Button variant="primary" disabled={busy} onClick={save}>
            <Icon name="spark" /> {isEdit ? "수정 저장" : "게시"}
          </Button>
        </>
      }
    >
      <div className="row" style={{justifyContent:"space-between"}}>
        <div className="row">
          {!isEdit && (
            <Select value={category} onChange={(e)=>setCategory(e.target.value)}>
              <option value="free">자유</option>
              <option value="qna">Q&A</option>
              <option value="notice">공지(운영)</option>
            </Select>
          )}
          <label className="row small muted" style={{gap:8}}>
            <input type="checkbox" checked={anonymous} onChange={(e)=>setAnonymous(e.target.checked)} />
            익명
          </label>
        </div>

        <div className="row">
          <Button size="sm" variant={tab==="write" ? "primary":"ghost"} onClick={()=>setTab("write")}>작성</Button>
          <Button size="sm" variant={tab==="preview" ? "primary":"ghost"} onClick={()=>setTab("preview")}>미리보기</Button>
        </div>
      </div>

      <div className="hr"></div>

      <div className="col">
        <Input value={title} onChange={(e)=>setTitle(e.target.value)} placeholder="제목" />
        {tab==="write" ? (
          <>
            <Textarea value={bodyMd} onChange={(e)=>setBodyMd(e.target.value)} placeholder="내용(마크다운 지원)\n\n예) ![](이미지링크)\n예) ```\n코드\n```" />
            <div className="row" style={{justifyContent:"space-between"}}>
              <div className="small muted">
                이미지/동영상은 업로드 후 링크를 받아 <span className="kbd">![](링크)</span>로 붙여넣기
              </div>
              <Button size="sm" variant="ghost" onClick={()=>{
                const url = prompt("이미지/동영상 링크를 붙여넣기") || "";
                if (!url.trim()) return;
                const md = `![](${url.trim()})`;
                setBodyMd(v => (v ? (v+"\n\n"+md) : md));
                toast.push({title:"삽입됨", message:md, kind:"ok"});
              }}>
                <Icon name="image" size={16}/> 링크 삽입
              </Button>
            </div>
          </>
        ) : (
          <div className="post">
            <div className="md" dangerouslySetInnerHTML={{__html: renderMarkdown(bodyMd)}} />
          </div>
        )}
      </div>
    </Modal>
  );
}

/** ================== APP SHELL ================== **/
function App(){
  const toast = useToasts();
  const auth = useAuth(toast);
  const route = useRoute();

  return (
    <>
      <div className="topbar">
        <div className="container topbar-inner">
          <div className="brand" onClick={()=>location.hash="#/"} role="button" tabIndex={0}>
            <div className="logo" aria-hidden="true">
              <Icon name="spark" />
            </div>
            <div>
              <h1>SRT Community</h1>
              <span className="sub">읽기는 누구나 · 쓰기는 로그인 필요</span>
            </div>
          </div>

          <div className="row">
            {auth.user ? (
              <>
                <span className="badge">
                  <span className="badge-dot"></span>
                  {auth.user.nickname} · {auth.user.role}
                </span>
                <Button className="pill" variant="ghost" onClick={auth.logout}>
                  <Icon name="logOut" /> 로그아웃
                </Button>
              </>
            ) : (
              <span className="badge">
                <span className="badge-dot" style={{background:"rgba(245,158,11,.95)"}}></span>
                게스트
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="container">
        {route.name==="feed" ? (
          <FeedPage auth={auth} toast={toast} />
        ) : (
          <PostPage auth={auth} toast={toast} postId={route.id} />
        )}
      </div>

      {toast.node}
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
