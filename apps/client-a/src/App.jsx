import { useState, useEffect, useCallback } from "react";

const API_URL   = "/api";
const CLIENT_ID = import.meta.env.VITE_CLIENT_ID  || "A";
const ACCENT    = import.meta.env.VITE_ACCENT_COLOR || "#0ea5e9";
const REGION    = import.meta.env.VITE_REGION_LABEL || "EU-WEST-1";

const STATUSES = {
  nowe:         { label: "NEW",         hex: "#64748b" },
  potwierdzone: { label: "CONFIRMED",   hex: "#0284c7" },
  produkcja:    { label: "IN PROGRESS", hex: "#d97706" },
  gotowe:       { label: "READY",       hex: "#059669" },
  wyslane:      { label: "SHIPPED",     hex: "#0891b2" },
  awaria:       { label: "ISSUE",       hex: "#dc2626" },
};
const STEPS = ["nowe","potwierdzone","produkcja","gotowe","wyslane"];

async function apiGet(p)     { const r=await fetch(`${API_URL}${p}`); if(!r.ok)throw new Error(`HTTP ${r.status}`); return r.json(); }
async function apiPost(p,b)  { const r=await fetch(`${API_URL}${p}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)}); if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.detail||`HTTP ${r.status}`);} return r.json(); }

function Badge({status}){
  const s=STATUSES[status]||STATUSES.nowe;
  return <span style={{display:"inline-block",padding:"3px 10px",border:`1.5px solid ${s.hex}`,borderRadius:3,fontSize:10,fontWeight:900,color:s.hex,letterSpacing:2,fontFamily:"'Barlow Condensed',sans-serif"}}>{s.label}</span>;
}

function Toast({msg,ok,onDone}){
  useEffect(()=>{const t=setTimeout(onDone,3200);return()=>clearTimeout(t);},[]);
  return <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",zIndex:999,padding:"12px 24px",background:ok?"#f0fdf4":"#fef2f2",border:`2px solid ${ok?"#16a34a":"#dc2626"}`,borderRadius:4,fontSize:13,fontWeight:700,color:ok?"#15803d":"#dc2626",whiteSpace:"nowrap",boxShadow:"0 4px 24px rgba(0,0,0,.15)",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1}}>{ok?"✓":"✗"} {msg}</div>;
}

function Spin(){
  return <div style={{width:16,height:16,border:`2.5px solid rgba(255,255,255,.3)`,borderTop:"2.5px solid #fff",borderRadius:"50%",animation:"spin .6s linear infinite",display:"inline-block"}} />;
}

function Timeline({status}){
  const cur=STEPS.indexOf(status);
  return(
    <div style={{padding:"20px 24px 24px",borderTop:"2px solid #e2e8f0",background:"#f8fafc"}}>
      <div style={{fontSize:9,fontWeight:900,letterSpacing:3,color:"#94a3b8",marginBottom:16,fontFamily:"'Barlow Condensed',sans-serif"}}>ORDER PIPELINE</div>
      <div style={{display:"flex",alignItems:"flex-start"}}>
        {STEPS.map((s,i)=>{
          const done=cur>=i&&status!=="awaria";
          const st=STATUSES[s];
          return(
            <div key={s} style={{flex:i<STEPS.length-1?1:"unset",display:"flex",flexDirection:"column",alignItems:"center",minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",width:"100%"}}>
                <div style={{width:28,height:28,borderRadius:"50%",background:done?st.hex:"#fff",border:`2px solid ${done?st.hex:"#cbd5e1"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:900,color:done?"#fff":"#94a3b8",flexShrink:0,fontFamily:"'Barlow Condensed',sans-serif"}}>{done?"✓":i+1}</div>
                {i<STEPS.length-1&&<div style={{flex:1,height:2,background:cur>i&&status!=="awaria"?ACCENT:"#e2e8f0"}} />}
              </div>
              <div style={{fontSize:7,fontWeight:900,letterSpacing:1,color:done?st.hex:"#94a3b8",marginTop:5,textAlign:"center",fontFamily:"'Barlow Condensed',sans-serif"}}>{st.label}</div>
            </div>
          );
        })}
      </div>
      {status==="awaria"&&<div style={{marginTop:14,padding:"10px 14px",background:"#fef2f2",border:"2px solid #fca5a5",borderRadius:4,color:"#dc2626",fontSize:12,fontWeight:700,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1}}>⚠ ISSUE DETECTED — CONTACT YOUR COORDINATOR</div>}
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
    if(isNaN(+tons)||+tons<=0){showToast("Quantity must be a positive number",false);return;}
    setBusy(true);
    try{
      await apiPost("/orders",{id:orderNum.trim(),product:product.trim(),tons:+tons,note:note.trim(),status:"nowe",clientId:CLIENT_ID,prodStatus:"oczekuje",materialStatus:"pending",prodNote:"",deadline:"",adminNote:""});
      const id=orderNum.trim();setOrderNum("");setProduct("");setTons("");setNote("");
      showToast(`Order ${id} submitted`);
    }catch(e){showToast(e.message||"Failed",false);}
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

  const INP={width:"100%",padding:"13px 16px",background:"#fff",border:"2px solid #e2e8f0",borderRadius:4,color:"#0f172a",fontSize:15,fontFamily:"inherit",outline:"none",transition:"border-color .15s"};

  return(
    <div style={{minHeight:"100vh",background:"#f1f5f9",color:"#0f172a",fontFamily:"'Barlow',sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=Barlow:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        @keyframes up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        input::-webkit-outer-spin-button,input::-webkit-inner-spin-button{-webkit-appearance:none;}
        input[type=number]{-moz-appearance:textfield;}
        input:focus{border-color:${ACCENT}!important;}
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:2px}
      `}</style>

      {toast&&<Toast {...toast} onDone={()=>setToast(null)} />}

      {/* HEADER */}
      <header style={{background:"#0f172a",padding:"0 24px",position:"sticky",top:0,zIndex:50,borderBottom:`3px solid ${ACCENT}`}}>
        <div style={{maxWidth:640,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:60}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:36,height:36,background:ACCENT,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:20,color:"#fff",letterSpacing:-1}}>
              {CLIENT_ID}
            </div>
            <div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:18,color:"#fff",letterSpacing:1,textTransform:"uppercase"}}>Client Portal</div>
              <div style={{fontSize:9,color:"#475569",letterSpacing:3,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700}}>{REGION}</div>
            </div>
          </div>
          <div style={{padding:"4px 12px",border:`1.5px solid #1e293b`,borderRadius:3,fontSize:10,fontWeight:900,color:"#475569",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:2}}>CLIENT {CLIENT_ID}</div>
        </div>
      </header>

      {/* HERO STRIPE */}
      <div style={{background:`linear-gradient(100deg, #0f172a 0%, #1e293b 60%, ${ACCENT}22 100%)`,padding:"28px 24px 24px",borderBottom:"2px solid #e2e8f0"}}>
        <div style={{maxWidth:640,margin:"0 auto"}}>
          <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:36,color:"#fff",letterSpacing:-1,lineHeight:1,textTransform:"uppercase"}}>ORDER<br/><span style={{color:ACCENT}}>MANAGEMENT</span></div>
          <div style={{marginTop:8,fontSize:12,color:"#64748b",fontWeight:500,letterSpacing:1}}>Place · Track · Review your orders</div>
        </div>
      </div>

      <main style={{maxWidth:640,margin:"0 auto",padding:"28px 24px 60px"}}>
        {/* TABS */}
        <div style={{display:"flex",gap:0,marginBottom:28,border:"2px solid #e2e8f0",borderRadius:4,overflow:"hidden",background:"#fff"}}>
          {[["order","NEW ORDER"],["check","TRACK"],["history","HISTORY"]].map(([v,l],i)=>(
            <button key={v} onClick={()=>setTab(v)} style={{flex:1,padding:"12px 0",border:"none",borderRight:i<2?"2px solid #e2e8f0":"none",background:tab===v?"#0f172a":"#fff",color:tab===v?ACCENT:"#94a3b8",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:13,letterSpacing:2,cursor:"pointer",transition:"all .15s"}}>
              {l}
            </button>
          ))}
        </div>

        {/* NEW ORDER */}
        {tab==="order"&&(
          <div style={{animation:"up .3s ease both"}}>
            <div style={{background:"#fff",border:"2px solid #e2e8f0",borderRadius:4,padding:"28px 24px"}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,letterSpacing:1,color:"#0f172a",textTransform:"uppercase",borderBottom:"2px solid #e2e8f0",paddingBottom:16,marginBottom:24}}>
                Place New Order
              </div>
              {[
                {label:"ORDER REFERENCE *",val:orderNum,set:setOrderNum,ph:"e.g. ORD-2026-001",type:"text"},
                {label:"PRODUCT / MATERIAL *",val:product,set:setProduct,ph:"e.g. Basalt aggregate 0–31.5 mm",type:"text"},
                {label:"QUANTITY (TONNES) *",val:tons,set:setTons,ph:"e.g. 50",type:"number"},
                {label:"NOTES (OPTIONAL)",val:note,set:setNote,ph:"Delivery address, schedule, instructions...",type:"text"},
              ].map(({label,val,set,ph,type})=>(
                <div key={label} style={{marginBottom:18}}>
                  <label style={{display:"block",fontSize:10,fontWeight:900,color:"#94a3b8",letterSpacing:2,marginBottom:7,fontFamily:"'Barlow Condensed',sans-serif"}}>{label}</label>
                  <input type={type} value={val} onChange={e=>set(e.target.value)} placeholder={ph} style={INP} />
                </div>
              ))}
              <button onClick={submitOrder} disabled={busy} style={{width:"100%",padding:"15px",background:busy?"#e2e8f0":`#0f172a`,border:`2px solid ${busy?"#e2e8f0":ACCENT}`,borderRadius:4,color:busy?"#94a3b8":ACCENT,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:15,letterSpacing:3,display:"flex",alignItems:"center",justifyContent:"center",gap:10,cursor:busy?"not-allowed":"pointer",transition:"all .15s",textTransform:"uppercase"}}>
                {busy?<><Spin /> Submitting...</>:"Submit Order →"}
              </button>
            </div>
          </div>
        )}

        {/* TRACK */}
        {tab==="check"&&(
          <div style={{animation:"up .3s ease both"}}>
            <div style={{background:"#fff",border:"2px solid #e2e8f0",borderRadius:4,padding:"28px 24px",marginBottom:16}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,letterSpacing:1,color:"#0f172a",textTransform:"uppercase",marginBottom:20}}>Track Order</div>
              <div style={{display:"flex",gap:10}}>
                <input value={checkId} onChange={e=>{setCheckId(e.target.value);setFound(null);setNotFound(false);}} onKeyDown={e=>e.key==="Enter"&&checkOrder()} placeholder="Enter order reference..." style={{...INP,flex:1}} />
                <button onClick={checkOrder} disabled={busy} style={{padding:"13px 20px",background:"#0f172a",border:`2px solid ${ACCENT}`,borderRadius:4,color:ACCENT,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:13,letterSpacing:2,display:"flex",alignItems:"center",gap:8,cursor:"pointer",whiteSpace:"nowrap"}}>
                  {busy?<Spin />:"SEARCH"}
                </button>
              </div>
            </div>
            {notFound&&<div style={{padding:"14px 18px",background:"#fef2f2",border:"2px solid #fca5a5",borderRadius:4,color:"#dc2626",fontSize:13,fontWeight:700,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1}}>✗ ORDER "{checkId}" NOT FOUND</div>}
            {found&&(
              <div style={{background:"#fff",border:"2px solid #e2e8f0",borderRadius:4,overflow:"hidden",animation:"up .25s ease both"}}>
                <div style={{padding:"20px 24px",background:"#f8fafc",borderBottom:"2px solid #e2e8f0",display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
                  <div>
                    <div style={{fontSize:10,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,color:ACCENT,letterSpacing:2,marginBottom:4}}>{found.id}</div>
                    <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,color:"#0f172a",textTransform:"uppercase"}}>{found.product}</div>
                    <div style={{fontSize:13,color:"#64748b",marginTop:2,fontWeight:600}}>{found.tons} tonnes</div>
                  </div>
                  <Badge status={found.status} />
                </div>
                <div style={{padding:"16px 24px"}}>
                  {[
                    ["Placed",      new Date(found.createdAt).toLocaleString("en-GB")],
                    ["Updated",     new Date(found.updatedAt).toLocaleString("en-GB")],
                    ...(found.deadline?[["Deadline",found.deadline]]:[]),
                    ...(found.adminNote?[["Admin Notes",found.adminNote]]:[]),
                  ].map(([k,v])=>(
                    <div key={k} style={{display:"flex",justifyContent:"space-between",gap:12,padding:"10px 0",borderBottom:"1px solid #f1f5f9"}}>
                      <span style={{fontSize:11,fontWeight:900,color:"#94a3b8",fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:1,flexShrink:0}}>{k.toUpperCase()}</span>
                      <span style={{fontSize:13,color:"#0f172a",textAlign:"right",wordBreak:"break-word",fontWeight:600}}>{v}</span>
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
          <div style={{animation:"up .3s ease both"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:22,letterSpacing:1,color:"#0f172a",textTransform:"uppercase"}}>Order History</div>
              <button onClick={loadOrders} disabled={loadingList} style={{padding:"8px 16px",background:"#fff",border:"2px solid #e2e8f0",borderRadius:4,color:"#64748b",fontSize:11,fontWeight:900,fontFamily:"'Barlow Condensed',sans-serif",letterSpacing:2,cursor:"pointer"}}>
                {loadingList?"...":"↺ REFRESH"}
              </button>
            </div>
            {loadingList&&<div style={{textAlign:"center",padding:40,color:"#94a3b8",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,letterSpacing:2}}>LOADING...</div>}
            {!loadingList&&orders!==null&&orders.length===0&&(
              <div style={{padding:"40px 24px",background:"#fff",border:"2px solid #e2e8f0",borderRadius:4,textAlign:"center",fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:16,color:"#94a3b8",letterSpacing:2}}>NO ORDERS FOUND</div>
            )}
            {!loadingList&&orders&&orders.length>0&&(
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {orders.map(o=>(
                  <div key={o.id} style={{background:"#fff",border:"2px solid #e2e8f0",borderRadius:4,padding:"16px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                    <div>
                      <div style={{fontSize:10,fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,color:ACCENT,letterSpacing:2,marginBottom:3}}>{o.id}</div>
                      <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:900,fontSize:17,color:"#0f172a",textTransform:"uppercase"}}>{o.product}</div>
                      <div style={{fontSize:11,color:"#94a3b8",marginTop:2,fontWeight:600}}>{o.tons} t · {new Date(o.createdAt).toLocaleDateString("en-GB")}</div>
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
