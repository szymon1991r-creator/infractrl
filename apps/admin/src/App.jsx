import { useState, useEffect, useCallback } from "react";

const API_URL = "/api";

async function apiGet(path) {
  const r = await fetch(`${API_URL}${path}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function apiPatch(path, body) {
  const r = await fetch(`${API_URL}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function apiDelete(path) {
  const r = await fetch(`${API_URL}${path}`, { method: "DELETE" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

const STATUSES = [
  { id: "nowe",         label: "Nowe",          color: "#64748b", bg: "#f1f5f9" },
  { id: "potwierdzone", label: "Potwierdzone",   color: "#7c3aed", bg: "#ede9fe" },
  { id: "produkcja",    label: "W produkcji",    color: "#d97706", bg: "#fef3c7" },
  { id: "gotowe",       label: "Gotowe",         color: "#059669", bg: "#d1fae5" },
  { id: "wyslane",      label: "Wyslane",        color: "#2563eb", bg: "#dbeafe" },
  { id: "awaria",       label: "Awaria",         color: "#dc2626", bg: "#fee2e2" },
];

function Badge({ status }) {
  const s = STATUSES.find(x => x.id === status) || STATUSES[0];
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700, color:s.color, background:s.bg, border:`0.5px solid ${s.color}55`, whiteSpace:"nowrap" }}>
      {s.label}
    </span>
  );
}

function Toast({ msg, ok, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2800); return () => clearTimeout(t); }, []);
  return (
    <div style={{ position:"fixed", bottom:20, left:16, right:16, zIndex:9999, padding:"13px 18px", borderRadius:12, fontSize:14, fontFamily:"monospace", background:ok?"#0d2b1e":"#2b0d0d", border:`1px solid ${ok?"#10b981":"#ef4444"}`, color:ok?"#34d399":"#f87171", textAlign:"center", boxShadow:"0 8px 30px rgba(0,0,0,.7)" }}>
      {ok ? "✓ " : "✕ "}{msg}
    </div>
  );
}

export default function AdminPanel() {
  const [orders,    setOrders]    = useState(null);
  const [openId,    setOpenId]    = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [toast,     setToast]     = useState(null);
  const [filter,    setFilter]    = useState("all");
  const [search,    setSearch]    = useState("");
  const [loading,   setLoading]   = useState(false);

  const showToast = (msg, ok = true) => setToast({ msg, ok });

  const loadOrders = useCallback(async () => {
    try {
      const data = await apiGet("/orders");
      setOrders(data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch (e) {
      showToast("Blad polaczenia z API: " + e.message, false);
      setOrders([]);
    }
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  useEffect(() => {
    const t = setInterval(loadOrders, 15000);
    return () => clearInterval(t);
  }, [loadOrders]);

  const setSt = async (id, status) => {
    setLoading(true);
    try {
      const updated = await apiPatch(`/orders/${id}`, { status });
      setOrders(prev => prev.map(o => o.id === id ? updated : o));
      showToast("Status: " + (STATUSES.find(s => s.id === status)?.label || status));
    } catch (e) {
      showToast("Blad: " + e.message, false);
    } finally {
      setLoading(false);
    }
  };

  const deleteOrder = async (id) => {
    setLoading(true);
    try {
      await apiDelete(`/orders/${id}`);
      setOrders(prev => prev.filter(o => o.id !== id));
      setOpenId(null); setConfirmId(null);
      showToast("Zamowienie " + id + " usuniete");
    } catch (e) {
      showToast("Blad: " + e.message, false);
    } finally {
      setLoading(false);
    }
  };

  const visible = (orders || []).filter(o => {
    if (filter !== "all" && o.status !== filter) return false;
    const q = search.toLowerCase();
    if (q && !o.id.toLowerCase().includes(q) && !o.product.toLowerCase().includes(q)) return false;
    return true;
  });

  const counts = Object.fromEntries(STATUSES.map(s => [s.id, (orders || []).filter(o => o.status === s.id).length]));

  return (
    <div style={{ minHeight:"100vh", background:"#070b10", color:"#d1d5db", fontFamily:"system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        input,textarea{outline:none;font-family:inherit;}
        button{cursor:pointer;}
      `}</style>

      {toast && <Toast {...toast} onDone={() => setToast(null)} />}

      <div style={{ background:"#0d1117", borderBottom:"1px solid #1f2937", padding:"13px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:9, background:"linear-gradient(135deg,#a855f7,#7c3aed)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:700, color:"#fff", flexShrink:0 }}>A</div>
          <div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:15, color:"#f9fafb" }}>Panel Administratora</div>
            <div style={{ fontSize:9, color:"#374151", letterSpacing:1.5, fontFamily:"monospace" }}>INSTANCJA MASTER</div>
          </div>
        </div>
        <button onClick={loadOrders} disabled={loading} style={{ padding:"7px 12px", background:"rgba(99,102,241,.12)", border:"1px solid rgba(99,102,241,.35)", borderRadius:7, color:"#818cf8", fontSize:11, fontWeight:700, fontFamily:"monospace" }}>
          ↻ Odswiez
        </button>
      </div>

      <div style={{ maxWidth:1200, margin:"0 auto", padding:"20px 16px 40px" }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:8, marginBottom:20 }}>
          {STATUSES.map(s => (
            <div key={s.id} onClick={() => setFilter(filter === s.id ? "all" : s.id)}
              style={{ padding:"10px 10px", borderRadius:10, cursor:"pointer", background:filter===s.id?s.bg:"#0d1117", border:`0.5px solid ${filter===s.id?s.color+"66":"#1f2937"}` }}>
              <div style={{ color:s.color, fontSize:22, fontWeight:700, fontFamily:"monospace" }}>{counts[s.id]||0}</div>
              <div style={{ color:"#4b5563", fontSize:8, letterSpacing:.8, marginTop:3 }}>{s.label.toUpperCase()}</div>
            </div>
          ))}
        </div>

        <div style={{ display:"flex", gap:8, marginBottom:16 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Szukaj po numerze lub produkcie..."
            style={{ flex:1, padding:"11px 14px", background:"#0d1117", border:"0.5px solid #1f2937", borderRadius:9, color:"#f9fafb", fontSize:15 }}
          />
        </div>

        {orders === null ? (
          <div style={{ textAlign:"center", padding:"60px 0", color:"#374151" }}>Ladowanie...</div>
        ) : visible.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 0" }}>
            <div style={{ color:"#374151", fontSize:13 }}>
              {orders.length === 0 ? "Brak zamowien w bazie danych" : "Brak wynikow dla wybranego filtra"}
            </div>
          </div>
        ) : (
          <div style={{ background:"#0d1117", border:"0.5px solid #1f2937", borderRadius:12, overflow:"hidden" }}>
            {visible.map((o, idx) => (
              <div key={o.id}>
                <div style={{ padding:"11px 16px", borderBottom:"0.5px solid #111827", background:idx%2===0?"transparent":"rgba(255,255,255,.012)", cursor:"pointer" }}
                  onClick={() => { setOpenId(openId === o.id ? null : o.id); setConfirmId(null); }}
                >
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <div style={{ fontFamily:"monospace", color:"#a855f7", fontSize:11, marginBottom:2 }}>{o.id} <span style={{ color:"#374151" }}>· {o.clientId}</span></div>
                      <div style={{ color:"#f3f4f6", fontSize:12, fontWeight:600 }}>{o.product} <span style={{ color:"#6b7280", fontWeight:400 }}>· {o.tons}t</span></div>
                    </div>
                    <Badge status={o.status} />
                  </div>
                </div>
                {openId === o.id && (
                  <div style={{ background:"rgba(168,85,247,.04)", padding:"12px 16px", borderBottom:"0.5px solid #111827", display:"flex", flexDirection:"column", gap:10 }}>
                    {o.deadline && <div style={{ fontSize:11, color:"#9ca3af" }}>📅 Termin: {o.deadline}</div>}
                    {o.adminNote && <div style={{ fontSize:11, color:"#9ca3af", fontStyle:"italic" }}>📝 Notatka admina: {o.adminNote}</div>}

                    <div style={{ background:"#111827", borderRadius:8, padding:"10px 12px", display:"flex", flexDirection:"column", gap:6 }}>
                      <div style={{ fontSize:9, color:"#374151", letterSpacing:1.2, fontFamily:"monospace" }}>RAPORT Z PRODUKCJI</div>
                      <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
                        <div>
                          <div style={{ fontSize:9, color:"#4b5563", marginBottom:2 }}>STAN</div>
                          <div style={{ fontSize:12, fontWeight:700, color:
                            o.prodStatus === "gotowe"     ? "#059669" :
                            o.prodStatus === "w_toku"     ? "#d97706" :
                            o.prodStatus === "wstrzymane" ? "#ef4444" : "#64748b"
                          }}>
                            {{ oczekuje:"Oczekuje", w_toku:"W toku", wstrzymane:"Wstrzymane", gotowe:"Gotowe" }[o.prodStatus] || "Oczekuje"}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize:9, color:"#4b5563", marginBottom:2 }}>MATERIAL</div>
                          <div style={{ fontSize:12, fontWeight:700, color:
                            o.materialStatus === "ok"   ? "#059669" :
                            o.materialStatus === "brak" ? "#ef4444" : "#64748b"
                          }}>
                            {{ pending:"Oczekuje", ok:"OK", brak:"Brak" }[o.materialStatus] || "Oczekuje"}
                          </div>
                        </div>
                      </div>
                      {o.prodNote && (
                        <div style={{ fontSize:11, color:"#6b7280", fontStyle:"italic", borderTop:"0.5px solid #1f2937", paddingTop:6 }}>
                          💬 {o.prodNote}
                        </div>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize:10, color:"#4b5563", fontFamily:"monospace", marginBottom:8 }}>ZMIEN STATUS</div>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                        {STATUSES.map(st => (
                          <button key={st.id} onClick={() => setSt(o.id, st.id)} disabled={loading}
                            style={{ padding:"6px 12px", borderRadius:8, border:`1.5px solid ${o.status===st.id?st.color:"#374151"}`, background:o.status===st.id?st.bg:"transparent", color:o.status===st.id?st.color:"#6b7280", cursor:"pointer", fontSize:11, fontWeight:700 }}>
                            {st.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ borderTop:"0.5px solid #dc262633", paddingTop:8 }}>
                      {confirmId === o.id ? (
                        <div style={{ display:"flex", gap:6 }}>
                          <button onClick={() => setConfirmId(null)} style={{ flex:1, padding:"8px", borderRadius:8, border:"0.5px solid #374151", background:"transparent", color:"#9ca3af", cursor:"pointer", fontSize:12 }}>Anuluj</button>
                          <button onClick={() => deleteOrder(o.id)} disabled={loading} style={{ flex:1, padding:"8px", borderRadius:8, border:"none", background:"#dc2626", color:"#fff", cursor:"pointer", fontSize:12, fontWeight:700 }}>Usun</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmId(o.id)} style={{ padding:"6px 14px", borderRadius:7, border:"0.5px solid #dc262655", background:"transparent", color:"#f87171", fontSize:11, fontWeight:500, cursor:"pointer" }}>
                          Usun zamowienie
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
