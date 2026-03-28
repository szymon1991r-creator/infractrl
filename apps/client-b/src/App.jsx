import { useState, useEffect, useCallback } from "react";

const API_URL   = "/api";
const CLIENT_ID = import.meta.env.VITE_CLIENT_ID  || "B";
const ACCENT    = import.meta.env.VITE_ACCENT_COLOR || "#f59e0b";
const REGION    = import.meta.env.VITE_REGION_LABEL || "EU-CENTRAL-1";

const TEAL = "#0d9488";

const STATUSES = {
  nowe:         { label: "NEW",         hex: "#94a3b8" },
  potwierdzone: { label: "CONFIRMED",   hex: TEAL      },
  produkcja:    { label: "IN PROGRESS", hex: "#f59e0b" },
  gotowe:       { label: "READY",       hex: "#16a34a" },
  wyslane:      { label: "SHIPPED",     hex: "#2563eb" },
  awaria:       { label: "ISSUE",       hex: "#dc2626" },
};
const STEPS = ["nowe","potwierdzone","produkcja","gotowe","wyslane"];

async function apiGet(p)    { const r=await fetch(`${API_URL}${p}`); if(!r.ok)throw new Error(`HTTP ${r.status}`); return r.json(); }
async function apiPost(p,b) { const r=await fetch(`${API_URL}${p}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)}); if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.detail||`HTTP ${r.status}`);} return r.json(); }

function Badge({status}){
  const s=STATUSES[status]||STATUSES.nowe;
  return <span style={{display:"inline-block",padding:"4px 12px",borderRadius:24,fontSize:10,fontWeight:800,color:s.hex,background:`${s.hex}18`,border:`1.5px solid ${s.hex}55`,letterSpacing:1.5,fontFamily:"'DM Mono',monospace"}}>{s.label}</span>;
}

function Toast({msg,ok,onDone}){
  useEffect(()=>{const t=setTimeout(onDone,3200);return()=>clearTimeout(t);},[]);
  return <div style={{position:"fixed",top:20,right:20,zIndex:999,padding:"13px 20px",background:ok?"#fffbeb":"#fef2f2",border:`2px solid ${ok?ACCENT:"#fca5a5"}`,borderRadius:8,fontSize:13,fontWeight:700,color:ok?"#92400e":"#dc2626",boxShadow:"0 8px 24px rgba(0,0,0,.12)",fontFamily:"'DM Mono',monospace",maxWidth:300}}>{ok?"✓ ":"✗ "}{msg}</div>;
}

function Spin(){
  return <div style={{width:16,height:16,border:`2.5px solid rgba(255,255,255,.3)`,borderTop:"2.5px solid #fff",borderRadius:"50%",animation:"spin .6s linear infinite",display:"inline-block"}} />;
}

function Timeline({status}){
  const cur=STEPS.indexOf(status);
  return(
    <div style={{padding:"20px 24px 24px",background:"#fffbeb",borderTop:`2px solid ${ACCENT}33`}}>
      <div style={{fontSize:9,fontWeight:800,letterSpacing:3,color:"#d97706",marginBottom:16,fontFamily:"'DM Mono',monospace"}}>FULFILLMENT PIPELINE</div>
      <div style={{display:"flex",alignItems:"flex-start"}}>
        {STEPS.map((s,i)=>{
          const done=cur>=i&&status!=="awaria";
          const st=STATUSES[s];
          return(
            <div key={s} style={{flex:i<STEPS.length-1?1:"unset",display:"flex",flexDirection:"column",alignItems:"center",minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",width:"100%"}}>
                <div style={{width:30,height:30,borderRadius:"50%",background:done?st.hex:"#fff",border:`2px solid ${done?st.hex:"#fde68a"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:done?"#fff":"#d97706",flexShrink:0,fontFamily:"'DM Mono',monospace",boxShadow:done?`0 0 0 3px ${st.hex}22`:"none"}}>{done?"✓":i+1}</div>
                {i<STEPS.length-1&&<div style={{flex:1,height:2,background:cur>i&&status!=="awaria"?ACCENT:"#fde68a"}} />}
              </div>
              <div style={{fontSize:7,fontWeight:800,letterSpacing:1,color:done?st.hex:"#d97706",marginTop:5,textAlign:"center",fontFamily:"'DM Mono',monospace"}}>{st.label}</div>
            </div>
          );
        })}
      </div>
      {status==="awaria"&&<div style={{marginTop:14,padding:"10px 14px",background:"#fef2f2",border:"2px solid #fca5a5",borderRadius:6,color:"#dc2626",fontSize:12,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>⚠ ORDER ISSUE — PLEASE CONTACT SUPPORT</div>}
    </div>
  );
}

function Field({label,value,set,placeholder,type="text"}){
  const [f,setF]=useState(false);
  return(
    <div style={{marginBottom:20}}>
      <label style={{display:"block",fontSize:9,fontWeight:800,color:f?"#92400e":"#d97706",letterSpacing:2.5,marginBottom:7,fontFamily:"'DM Mono',monospace",transition:"color .15s"}}>{label}</label>
      <input type={type} value={value} onChange={e=>set(e.target.value)} placeholder={placeholder} onFocus={()=>setF(true)} onBlur={()=>setF(false)}
        style={{width:"100%",padding:"13px 16px",background:f?"#fff":"#fffbeb",border:`2px solid ${f?ACCENT:"#fde68a"}`,borderRadius:8,color:"#1c1917",fontSize:15,fontFamily:"inherit",outline:"none",transition:"all .2s",fontWeight:500}}
      />
    </div>
  );
}

export default function App(){
  const [tab,setTab]=useState("order");
  const [orderNum,setOrderNum]=useState("");
  const [product,setProduct]=useState("");
  const [tons,setTons]=useState("");
  const [note,setNote]=useState("");
  const [toast,setToast]=useState(null);
  const [checkId,setCheckId]=useState("");
  const [found,setFound]=useState(null);
  const [notFound,setNotFound]=useState(false);
  const [busy,setBusy]=useState(false);
  const [orders,setOrders]=useState(null);
  const [loadingList,setLoadingList]=useState(false);

  const showToast=(msg,ok=true)=>setToast({msg,ok});

  const loadOrders=useCallback(async()=>{
    setLoadingList(true);
    try{const d=await apiGet(`/orders?client_id=${CLIENT_ID}`);setOrders(d);}
    catch{setOrders([]);showToast("Could not load orders",false);}
    finally{setLoadingList(false);}
  },[]);

  useEffect(()=>{if(tab==="history")loadOrders();},[tab,loadOrders]);

  const submitOrder=async()=>{
    if(!orderNum.trim()||!product.trim()||!tons){showToast("Please fill all required fields",false);return;}
    if(isNaN(+tons)||+tons<=0){showToast("Quantity must be positive",false);return;}
    setBusy(true);
    try{
      await apiPost("/orders",{id:orderNum.trim(),product:product.trim(),tons:+tons,note:note.trim(),status:"nowe",clientId:CLIENT_ID,prodStatus:"oczekuje",materialStatus:"pending",prodNote:"",deadline:"",adminNote:""});
      const id=orderNum.trim();setOrderNum("");setProduct("");setTons("");setNote("");
      showToast(`Order ${id} submitted successfully`);
    }catch(e){showToast(e.message||"Submission failed",false);}
    finally{setBusy(false);}
  };

  const checkOrder=async()=>{
    if(!checkId.trim())return;
    setBusy(true);
    try{
      const d=await apiGet(`/orders?client_id=${CLIENT_ID}`);
      const o=d.find(x=>x.id.toLowerCase()===checkId.trim().toLowerCase());
      if(o){setFound(o);setNotFound(false);}else{setNotFound(true);setFound(null);}
    }catch{showToast("API connection failed",false);}
    finally{setBusy(false);}
  };

  return(
    <div style={{minHeight:"100vh",background:"#fafaf9",color:"#1c1917",fontFamily:"'DM Sans',sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700;800&family=Playfair+Display:wght@700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        @keyframes up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        input::-webkit-outer-spin-button,input::-webkit-inner-spin-button{-webkit-appearance:none;}
        input[type=number]{-moz-appearance:textfield;}
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:#fde68a;border-radius:2px}
      `}</style>

      {toast&&<Toast {...toast} onDone={()=>setToast(null)} />}

      {/* HEADER */}
      <header style={{background:"#fff",borderBottom:`3px solid ${ACCENT}`,position:"sticky",top:0,zIndex:50,boxShadow:"0 2px 12px rgba(0,0,0,.06)"}}>
        <div style={{maxWidth:640,margin:"0 auto",padding:"0 24px",display:"flex",alignItems:"center",justifyContent:"space-between",height:64}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:40,height:40,background:`linear-gradient(135deg,${ACCENT},#f97316)`,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Playfair Display',serif",fontWeight:800,fontSize:20,color:"#fff",boxShadow:`0 4px 12px ${ACCENT}55`}}>
              {CLIENT_ID}
            </div>
            <div>
              <div style={{fontFamily:"'Playfair Display',serif",fontWeight:800,fontSize:19,color:"#1c1917",letterSpacing:-0.5}}>Client Portal</div>
              <div style={{fontSize:9,fontWeight:600,color:"#d97706",letterSpacing:2.5,fontFamily:"'DM Mono',monospace"}}>{REGION}</div>
            </div>
          </div>
          <div style={{padding:"5px 14px",background:`${ACCENT}18`,border:`1.5px solid ${ACCENT}55`,borderRadius:20,fontSize:10,fontWeight:800,color:"#92400e",fontFamily:"'DM Mono',monospace",letterSpacing:1.5}}>CLIENT {CLIENT_ID}</div>
        </div>
      </header>

      {/* HERO */}
      <div style={{background:`linear-gradient(135deg, #1c1917 0%, #292524 50%, ${TEAL}44 100%)`,padding:"32px 24px 28px"}}>
        <div style={{maxWidth:640,margin:"0 auto"}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontWeight:800,fontSize:38,color:"#fff",lineHeight:1.1,letterSpacing:-1}}>Order<br/><span style={{color:ACCENT}}>Portal</span></div>
          <div style={{marginTop:10,fontSize:12,color:"#78716c",fontWeight:500,letterSpacing:0.5}}>Manage your orders · Real-time status · Full history</div>
        </div>
      </div>

      <main style={{maxWidth:640,margin:"0 auto",padding:"28px 24px 60px"}}>
        {/* TABS */}
        <div style={{display:"flex",gap:6,marginBottom:28,background:"#fff",border:`2px solid ${ACCENT}33`,borderRadius:12,padding:5,boxShadow:`0 4px 16px ${ACCENT}11`}}>
          {[["order","New Order"],["check","Track"],["history","History"]].map(([v,l])=>(
            <button key={v} onClick={()=>setTab(v)} style={{flex:1,padding:"11px 0",border:"none",borderRadius:8,background:tab===v?ACCENT:"transparent",color:tab===v?"#fff":"#a8a29e",fontFamily:"'DM Sans',sans-serif",fontWeight:800,fontSize:13,cursor:"pointer",transition:"all .2s",boxShadow:tab===v?`0 4px 12px ${ACCENT}44`:"none"}}>
              {l}
            </button>
          ))}
        </div>

        {/* NEW ORDER */}
        {tab==="order"&&(
          <div style={{animation:"up .35s ease both"}}>
            <div style={{background:"#fff",border:`2px solid ${ACCENT}22`,borderRadius:16,padding:"28px 24px",boxShadow:`0 4px 24px ${ACCENT}0d`}}>
              <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:28,paddingBottom:20,borderBottom:`2px solid #fef3c7`}}>
                <div style={{width:44,height:44,background:`linear-gradient(135deg,${ACCENT},#f97316)`,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,boxShadow:`0 4px 12px ${ACCENT}44`}}>📦</div>
                <div>
                  <div style={{fontFamily:"'Playfair Display',serif",fontWeight:800,fontSize:20,color:"#1c1917"}}>Place New Order</div>
                  <div style={{fontSize:11,color:"#a8a29e",marginTop:2,fontWeight:500}}>Submit to our fulfilment team</div>
                </div>
              </div>
              <Field label="ORDER REFERENCE *"   value={orderNum} set={setOrderNum} placeholder="e.g. ORD-2026-001" />
              <Field label="PRODUCT / MATERIAL *" value={product}  set={setProduct}  placeholder="e.g. Mining sand 0–2 mm" />
              <Field label="QUANTITY (TONNES) *"  value={tons}     set={setTons}     placeholder="e.g. 80" type="number" />
              <Field label="ADDITIONAL NOTES"     value={note}     set={setNote}     placeholder="Delivery instructions, schedule..." />
              <button onClick={submitOrder} disabled={busy} style={{width:"100%",padding:"15px",background:busy?"#fef3c7":`linear-gradient(135deg,${ACCENT},#f97316)`,border:"none",borderRadius:10,color:busy?"#d97706":"#fff",fontFamily:"'DM Sans',sans-serif",fontWeight:800,fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",gap:10,cursor:busy?"not-allowed":"pointer",boxShadow:busy?"none":`0 6px 20px ${ACCENT}55`,transition:"all .2s"}}>
                {busy?<><Spin /> Submitting...</>:"Submit Order →"}
              </button>
            </div>
          </div>
        )}

        {/* TRACK */}
        {tab==="check"&&(
          <div style={{animation:"up .35s ease both"}}>
            <div style={{background:"#fff",border:`2px solid ${ACCENT}22`,borderRadius:16,padding:"28px 24px",marginBottom:16,boxShadow:`0 4px 24px ${ACCENT}0d`}}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:22}}>
                <div style={{width:44,height:44,background:`${ACCENT}18`,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>🔍</div>
                <div style={{fontFamily:"'Playfair Display',serif",fontWeight:800,fontSize:20,color:"#1c1917"}}>Track Order</div>
              </div>
              <div style={{display:"flex",gap:10}}>
                <input value={checkId} onChange={e=>{setCheckId(e.target.value);setFound(null);setNotFound(false);}} onKeyDown={e=>e.key==="Enter"&&checkOrder()} placeholder="Enter order reference..." style={{flex:1,padding:"13px 16px",background:"#fffbeb",border:`2px solid #fde68a`,borderRadius:8,color:"#1c1917",fontSize:15,fontFamily:"inherit",outline:"none",transition:"all .2s",fontWeight:500}} onFocus={e=>e.target.style.borderColor=ACCENT} onBlur={e=>e.target.style.borderColor="#fde68a"} />
                <button onClick={checkOrder} disabled={busy} style={{padding:"13px 22px",background:`linear-gradient(135deg,${ACCENT},#f97316)`,border:"none",borderRadius:8,color:"#fff",fontFamily:"'DM Sans',sans-serif",fontWeight:800,fontSize:14,display:"flex",alignItems:"center",gap:8,boxShadow:`0 4px 12px ${ACCENT}55`,cursor:"pointer",whiteSpace:"nowrap"}}>
                  {busy?<Spin />:"Search"}
                </button>
              </div>
            </div>
            {notFound&&<div style={{padding:"14px 20px",background:"#fef2f2",border:"2px solid #fca5a5",borderRadius:10,color:"#dc2626",fontWeight:700,fontSize:13,fontFamily:"'DM Mono',monospace"}}>✗ No order found: "{checkId}"</div>}
            {found&&(
              <div style={{background:"#fff",border:`2px solid ${ACCENT}22`,borderRadius:16,overflow:"hidden",boxShadow:`0 4px 24px ${ACCENT}0d`,animation:"up .25s ease both"}}>
                <div style={{padding:"20px 24px",background:`linear-gradient(135deg,${ACCENT}0d,#f97316 0a)`,borderBottom:`2px solid ${ACCENT}22`,display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
                  <div>
                    <div style={{fontSize:10,fontWeight:800,color:ACCENT,letterSpacing:2,marginBottom:4,fontFamily:"'DM Mono',monospace"}}>{found.id}</div>
                    <div style={{fontFamily:"'Playfair Display',serif",fontWeight:800,fontSize:20,color:"#1c1917"}}>{found.product}</div>
                    <div style={{fontSize:13,color:"#d97706",fontWeight:600,marginTop:4}}>{found.tons} tonnes</div>
                  </div>
                  <Badge status={found.status} />
                </div>
                <div style={{padding:"16px 24px"}}>
                  {[
                    ["Placed",    new Date(found.createdAt).toLocaleString("en-GB")],
                    ["Updated",   new Date(found.updatedAt).toLocaleString("en-GB")],
                    ...(found.deadline?[["Deadline",found.deadline]]:[]),
                    ...(found.adminNote?[["Notes",found.adminNote]]:[]),
                  ].map(([k,v])=>(
                    <div key={k} style={{display:"flex",justifyContent:"space-between",gap:12,padding:"10px 0",borderBottom:"1px solid #fef3c7"}}>
                      <span style={{fontSize:10,fontWeight:800,color:"#d97706",fontFamily:"'DM Mono',monospace",letterSpacing:1.5,flexShrink:0}}>{k.toUpperCase()}</span>
                      <span style={{fontSize:13,color:"#1c1917",textAlign:"right",wordBreak:"break-word",fontWeight:600}}>{v}</span>
                    </div>
                  ))}
                </div>
                <Timeline status={found.status} />
              </div>
            )}
          </div>
        )}

        {/* HISTORY */}
        {tab==="history"&&(
          <div style={{animation:"up .35s ease both"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <div style={{fontFamily:"'Playfair Display',serif",fontWeight:800,fontSize:22,color:"#1c1917"}}>Order History</div>
              <button onClick={loadOrders} disabled={loadingList} style={{padding:"8px 16px",background:"#fff",border:`2px solid ${ACCENT}33`,borderRadius:8,color:"#d97706",fontSize:11,fontWeight:800,fontFamily:"'DM Mono',monospace",letterSpacing:1,cursor:"pointer"}}>
                {loadingList?"...":"↺ REFRESH"}
              </button>
            </div>
            {loadingList&&<div style={{textAlign:"center",padding:40,color:"#d97706",fontFamily:"'DM Mono',monospace",fontSize:12,letterSpacing:2}}>LOADING...</div>}
            {!loadingList&&orders!==null&&orders.length===0&&(
              <div style={{padding:"44px 24px",background:"#fff",border:`2px solid ${ACCENT}22`,borderRadius:16,textAlign:"center"}}>
                <div style={{fontSize:36,marginBottom:12}}>📭</div>
                <div style={{color:"#a8a29e",fontSize:14,fontWeight:700,fontFamily:"'DM Mono',monospace",letterSpacing:1}}>NO ORDERS YET</div>
              </div>
            )}
            {!loadingList&&orders&&orders.length>0&&(
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {orders.map(o=>(
                  <div key={o.id} style={{background:"#fff",border:`2px solid ${ACCENT}22`,borderRadius:14,padding:"16px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap",boxShadow:`0 2px 8px ${ACCENT}08`}}>
                    <div>
                      <div style={{fontSize:10,fontWeight:800,color:ACCENT,letterSpacing:2,marginBottom:3,fontFamily:"'DM Mono',monospace"}}>{o.id}</div>
                      <div style={{fontFamily:"'Playfair Display',serif",fontWeight:700,fontSize:16,color:"#1c1917"}}>{o.product}</div>
                      <div style={{fontSize:11,color:"#a8a29e",marginTop:3,fontWeight:600}}>{o.tons} t · {new Date(o.createdAt).toLocaleDateString("en-GB")}</div>
                    </div>
                    <Badge status={o.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
