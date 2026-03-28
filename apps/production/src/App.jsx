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

const PROD_STATUS = {
  oczekuje:   { label: "Oczekuje",   color: "#64748b" },
  w_toku:     { label: "W toku",     color: "#d97706" },
  wstrzymane: { label: "Wstrzymane", color: "#ef4444" },
  gotowe:     { label: "Gotowe",     color: "#059669" },
};

const MATERIAL_STATUS = {
  pending:     { label: "Oczekuje",  color: "#64748b" },
  ok:          { label: "OK",        color: "#059669" },
  brak:        { label: "Brak",      color: "#ef4444" },
};

function Toast({ msg, ok, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2800); return () => clearTimeout(t); }, []);
  return (
    <div style={{ position:"fixed", bottom:20, left:16, right:16, zIndex:9999, padding:"13px 18px", borderRadius:12, fontSize:14, fontFamily:"monospace", background:ok?"#0d2b1e":"#2b0d0d", border:`1px solid ${ok?"#10b981":"#ef4444"}`, color:ok?"#34d399":"#f87171", textAlign:"center", boxShadow:"0 8px 30px rgba(0,0,0,.8)" }}>
      {ok ? "✓ " : "✕ "}{msg}
    </div>
  );
}

export default function ProdukcjaApp() {
  const [orders,  setOrders]  = useState(null);
  const [toast,   setToast]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [notes,   setNotes]   = useState({});

  const showToast = (msg, ok = true) => setToast({ msg, ok });

  const loadOrders = useCallback(async () => {
    try {
      const data = await apiGet("/orders");
      const forProd = data.filter(o => ["potwierdzone", "produkcja", "gotowe"].includes(o.status));
      setOrders(forProd.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      const n = {};
      forProd.forEach(o => { n[o.id] = o.prodNote || ""; });
      setNotes(prev => ({ ...n, ...prev }));
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

  const handleUpdate = async (id, patch) => {
    setLoading(true);
    try {
      const updated = await apiPatch(`/orders/${id}`, patch);
      setOrders(prev => {
        const newOrders = prev.map(o => o.id === id ? updated : o);
        return newOrders.filter(o => ["potwierdzone", "produkcja", "gotowe"].includes(o.status));
      });
      showToast("Zaktualizowano");
    } catch (e) {
      showToast("Blad: " + e.message, false);
    } finally {
      setLoading(false);
    }
  };

  const saveNote = (id) => {
    handleUpdate(id, { prodNote: notes[id] || "" });
  };

  return (
    <div style={{ minHeight:"100vh", background:"#07090d", color:"#d1d5db", fontFamily:"system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        input{outline:none;font-family:inherit;}
        button{cursor:pointer;}
      `}</style>

      {toast && <Toast {...toast} onDone={() => setToast(null)} />}

      <div style={{ background:"#0d1117", borderBottom:"1px solid #1f2937", padding:"13px 16px", position:"sticky", top:0, zIndex:100, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:9, background:"linear-gradient(135deg,#f59e0b,#d97706)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:700, color:"#fff" }}>H</div>
          <div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:15, color:"#f9fafb" }}>Hala Produkcji</div>
            <div style={{ fontSize:9, color:"#374151", letterSpacing:1.5, fontFamily:"monospace" }}>PRODUKCJA LIVE</div>
          </div>
        </div>
        <button onClick={loadOrders} disabled={loading} style={{ padding:"7px 12px", background:"rgba(245,158,11,.12)", border:"1px solid rgba(245,158,11,.35)", borderRadius:7, color:"#fbbf24", fontSize:11, fontWeight:700, fontFamily:"monospace" }}>
          ↻ Odswiez
        </button>
      </div>

      <div style={{ maxWidth:900, margin:"0 auto", padding:"20px 16px 40px" }}>
        {orders === null ? (
          <div style={{ textAlign:"center", padding:"60px 0", color:"#374151" }}>Ladowanie...</div>
        ) : orders.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 0", color:"#374151" }}>
            Brak zamowien do realizacji
          </div>
        ) : (
          orders.map(o => (
            <div key={o.id} style={{ background:"#0d1117", border:"0.5px solid #1f2937", borderRadius:12, padding:"15px", marginBottom:10 }}>
              <div style={{ marginBottom:8 }}>
                <div style={{ fontFamily:"monospace", color:"#a855f7", fontSize:11 }}>{o.id} <span style={{ color:"#374151" }}>· {o.clientId}</span></div>
                <div style={{ color:"#f3f4f6", fontWeight:700, fontSize:14 }}>{o.product}</div>
                <div style={{ color:"#9ca3af", fontSize:12 }}>{o.tons}t {o.deadline ? `· Termin: ${o.deadline}` : ""}</div>
              </div>

              <div style={{ marginBottom:10 }}>
                <div style={{ color:"#6b7280", fontSize:10, marginBottom:6 }}>STAN PRODUKCJI</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                  {Object.entries(PROD_STATUS).map(([k, v]) => (
                    <button key={k} onClick={() => handleUpdate(o.id, { prodStatus: k })} disabled={loading}
                      style={{ padding:"10px", borderRadius:8, background:(o.prodStatus||"oczekuje")===k ? v.color+"22" : "#1f2937", border:`1px solid ${(o.prodStatus||"oczekuje")===k ? v.color : "#374151"}`, color:v.color, cursor:"pointer", fontSize:12, fontWeight:600 }}>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom:10 }}>
                <div style={{ color:"#6b7280", fontSize:10, marginBottom:6 }}>MATERIAL</div>
                <div style={{ display:"flex", gap:6 }}>
                  {Object.entries(MATERIAL_STATUS).map(([k, v]) => (
                    <button key={k} onClick={() => handleUpdate(o.id, { materialStatus: k })} disabled={loading}
                      style={{ flex:1, padding:"8px", borderRadius:8, background:(o.materialStatus||"pending")===k ? v.color+"22" : "#1f2937", border:`1px solid ${(o.materialStatus||"pending")===k ? v.color : "#374151"}`, color:v.color, cursor:"pointer", fontSize:11, fontWeight:600 }}>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ color:"#6b7280", fontSize:10, marginBottom:6 }}>NOTATKA PRODUKCJI</div>
                <div style={{ display:"flex", gap:6 }}>
                  <input
                    type="text"
                    value={notes[o.id] ?? o.prodNote ?? ""}
                    onChange={e => setNotes(prev => ({ ...prev, [o.id]: e.target.value }))}
                    onBlur={() => saveNote(o.id)}
                    onKeyDown={e => e.key === "Enter" && saveNote(o.id)}
                    style={{ flex:1, padding:"8px 12px", background:"#1f2937", border:"0.5px solid #374151", borderRadius:8, color:"#f9fafb", fontSize:12 }}
                    placeholder="Dodaj notatke..."
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
