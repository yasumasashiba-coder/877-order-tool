import { useState, useEffect } from "react";

const DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];

const STAND_DOW = { 0:1.8, 1:0.6, 2:0.6, 3:0.7, 4:0.7, 5:0.9, 6:1.6 };
const STAND_MONTH = { 1:0.5,2:0.6,3:0.7,4:0.8,5:0.9,6:0.7,7:0.7,8:0.8,9:0.8,10:1.0,11:2.2,12:1.2 };
const STAND_BASE = 8;
const NAKA_DOW = { 0:1.6, 1:0.7, 2:0.7, 3:0.8, 4:0.8, 5:1.0, 6:1.4 };
const NAKA_MONTH = { 1:0.8,2:0.9,3:1.0,4:1.1,5:1.1,6:1.0,7:1.0,8:1.0,9:1.0,10:1.1,11:1.3,12:1.1 };
const NAKA_BASE = 2.7;
const BEAN_DOW = {0:2.12,1:1.02,2:0.58,3:0.32,4:0.36,5:0.48,6:2.12};
const BEAN_MONTH = {1:1.03,2:0.97,3:0.86,4:1.06,5:1.05,6:0.77,7:0.53,8:0.67,9:0.78,10:1.00,11:2.54,12:0.78};
const BEAN_BASE_DAILY = 1.705;

const WEATHER_OPTIONS = [
  { code:"sunny",  label:"晴れ", icon:"☀️",  factor:1.1  },
  { code:"cloudy", label:"曇り", icon:"⛅",  factor:1.0  },
  { code:"rainy",  label:"雨",   icon:"🌧️", factor:0.65 },
  { code:"snow",   label:"雪",   icon:"❄️",  factor:0.5  },
];

// WMO weathercode → app code
function wmoToCode(wmo) {
  if (wmo === 0 || wmo === 1) return "sunny";
  if (wmo <= 3) return "cloudy";
  if (wmo <= 67) return "rainy";
  if (wmo <= 77) return "snow";
  if (wmo <= 82) return "rainy";
  if (wmo <= 86) return "snow";
  return "rainy";
}

function tempFactor(t) {
  if (t < 5)  return 0.6;
  if (t < 10) return 0.8;
  if (t < 15) return 0.95;
  if (t < 20) return 1.0;
  if (t < 25) return 0.95;
  return 0.85;
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const data = [];
  for (const line of lines) {
    const cols = line.split(",");
    const dateStr = cols[1]?.trim();
    const consumption = parseFloat(cols[6]?.trim());
    if (dateStr && !isNaN(consumption) && consumption > 0) {
      const match = dateStr.match(/(\d+)\/(\d+)/);
      if (match) data.push({ month:parseInt(match[1]), day:parseInt(match[2]), consumption });
    }
  }
  return data;
}

function calcBase(data, fallback) {
  const valid = data.filter(d => d.consumption > 0 && d.consumption < 200);
  if (!valid.length) return fallback;
  return valid.reduce((a,b) => a + b.consumption, 0) / valid.length;
}

function initDays() {
  const today = new Date();
  return Array.from({length:7}, (_,i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + 1 + i);
    return { date:d, weather:["sunny"], tempHigh:12, tempLow:5, precip:null };
  });
}

function calcPrediction(days, dowF, monthF, baseVal, mode) {
  const mf = { just:1.0, normal:1.15, event:1.3 }[mode];
  return days.map(d => {
    const dow = d.date.getDay(), month = d.date.getMonth() + 1;
    const wCodes = Array.isArray(d.weather) ? d.weather : [d.weather];
    const wf = wCodes.reduce((s,c) => s + (WEATHER_OPTIONS.find(w=>w.code===c)?.factor??1.0), 0) / wCodes.length;
    const tEff = d.tempLow + (d.tempHigh - d.tempLow) * 0.65;
    const pred = baseVal * dowF[dow] * monthF[month] * wf * tempFactor(tEff) * mf;
    return { ...d, dow, pred:Math.ceil(pred), tEff:Math.round(tEff) };
  });
}

const S = {
  wrap: { fontFamily:"'Noto Sans JP',sans-serif", background:"#0a0a0f", minHeight:"100vh", color:"#e0e0f0" },
  header: { background:"linear-gradient(135deg,#0f1b3d,#0a0a1a)", padding:"18px 28px", display:"flex", justifyContent:"space-between", alignItems:"center", borderBottom:"1px solid rgba(99,102,241,0.2)" },
  topTabs: { display:"flex", borderBottom:"1px solid rgba(255,255,255,0.08)", background:"rgba(0,0,0,0.4)" },
  topTab: a => ({ padding:"14px 22px", cursor:"pointer", fontSize:"13px", fontWeight:600, letterSpacing:"0.05em", color:a?"#818cf8":"#6b7280", background:"transparent", border:"none", borderBottom:a?"2px solid #6366f1":"2px solid transparent" }),
  subTabs: { display:"flex", gap:"8px", padding:"16px 28px 0", borderBottom:"1px solid rgba(255,255,255,0.06)" },
  subTab: (a,color="#6366f1") => ({ padding:"8px 18px", borderRadius:"8px 8px 0 0", cursor:"pointer", fontSize:"12px", fontWeight:600, color:a?color:"#6b7280", background:a?"rgba(99,102,241,0.1)":"transparent", border:"none", borderBottom:a?`2px solid ${color}`:"2px solid transparent" }),
  content: { padding:"24px 28px" },
  label: { fontSize:"11px", color:"#6b7280", letterSpacing:"0.1em", marginBottom:"10px", textTransform:"uppercase" },
  card: (extra={}) => ({ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:"12px", padding:"20px", marginBottom:"16px", ...extra }),
  bigNum: { fontSize:"52px", fontWeight:"900", background:"linear-gradient(135deg,#6366f1,#10b981)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", lineHeight:1 },
  modeBtn: a => ({ padding:"10px 18px", borderRadius:"8px", border:`1px solid ${a?"#10b981":"rgba(255,255,255,0.1)"}`, background:a?"rgba(16,185,129,0.15)":"transparent", color:a?"#10b981":"#9ca3af", cursor:"pointer", fontSize:"13px", fontWeight:600, display:"flex", flexDirection:"column", alignItems:"center", gap:"2px" }),
  numInput: { background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.15)", borderRadius:"8px", color:"#e0e0f0", padding:"8px 12px", fontSize:"20px", width:"80px", textAlign:"center" },
  tempInput: { background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:"6px", color:"#e0e0f0", padding:"4px 6px", fontSize:"13px", width:"46px", textAlign:"center" },
  wBtn: a => ({ padding:"8px 14px", borderRadius:"7px", border:`1px solid ${a?"rgba(99,102,241,0.5)":"rgba(255,255,255,0.08)"}`, background:a?"rgba(99,102,241,0.2)":"transparent", color:a?"#a5b4fc":"#9ca3af", cursor:"pointer", fontSize:"14px", whiteSpace:"nowrap", minWidth:"64px" }),
  dayRow: dow => ({ display:"flex", alignItems:"center", gap:"10px", padding:"10px 14px", borderRadius:"8px", background:(dow===0||dow===6)?"rgba(99,102,241,0.08)":"rgba(255,255,255,0.02)", marginBottom:"6px", border:(dow===0||dow===6)?"1px solid rgba(99,102,241,0.15)":"1px solid transparent" }),
  textarea: { width:"100%", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"8px", color:"#9ca3af", padding:"12px", fontSize:"12px", fontFamily:"monospace", minHeight:"100px", boxSizing:"border-box" },
};

const PRODUCTS = [
  { id:"stand", label:"🥛 Stand牛乳", color:"#6366f1", sub:"タカナシ3.6" },
  { id:"naka",  label:"🏠 中腹牛乳",  color:"#f59e0b", sub:"G新札幌北海道", badge:"暫定係数" },
  { id:"bean",  label:"☕ 豆",         color:"#10b981", sub:"データ待ち" },
];

export default function App() {
  const [topTab, setTopTab]     = useState("order");
  const [product, setProduct]   = useState("stand");
  const [mode, setMode]         = useState("normal");
  const [days, setDays]         = useState(initDays);
  const [weatherStatus, setWeatherStatus] = useState("idle"); // idle | loading | ok | error
  const [stockStand, setStockStand] = useState("20");
  const [stockNaka, setStockNaka]   = useState("10");
  const [stockBean, setStockBean]   = useState("0");
  const [beanBuffer, setBeanBuffer] = useState("5");
  const [dataStand, setDataStand]   = useState([]);
  const [dataNaka, setDataNaka]     = useState([]);
  const [csvStand, setCsvStand]     = useState("");
  const [csvNaka, setCsvNaka]       = useState("");
  const [result, setResult]         = useState(null);

  // 起動時に天気取得
  useEffect(() => { fetchWeather(); }, []);
  useEffect(() => { calc(); }, [days, mode, product, stockStand, stockNaka, stockBean, beanBuffer, dataStand, dataNaka]);

  async function fetchWeather() {
    setWeatherStatus("loading");
    try {
      const url = "https://api.open-meteo.com/v1/forecast" +
        "?latitude=36.0828&longitude=140.0764" +
        "&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
        "&timezone=Asia%2FTokyo&forecast_days=8";
      const res  = await fetch(url);
      const data = await res.json();
      const { time, weathercode, temperature_2m_max, temperature_2m_min, precipitation_probability_max } = data.daily;

      // index 1〜7（翌日〜7日後）を使用
      setDays(prev => prev.map((d, i) => ({
        ...d,
        weather: [wmoToCode(weathercode[i + 1])],
        tempHigh: Math.round(temperature_2m_max[i + 1]),
        tempLow:  Math.round(temperature_2m_min[i + 1]),
        precip:   precipitation_probability_max[i + 1] ?? null,
      })));
      setWeatherStatus("ok");
    } catch {
      setWeatherStatus("error");
    }
  }

  function calc() {
    let dowF, monthF, baseF, stock;
    if (product === "stand") {
      dowF = STAND_DOW; monthF = STAND_MONTH;
      baseF = calcBase(dataStand, STAND_BASE);
      stock = parseFloat(stockStand) || 0;
    } else if (product === "naka") {
      dowF = NAKA_DOW; monthF = NAKA_MONTH;
      baseF = calcBase(dataNaka, NAKA_BASE);
      stock = parseFloat(stockNaka) || 0;
    } else {
      const mf = { just:1.0, normal:1.15, event:1.3 }[mode];
      const dayResults = days.map(d => {
        const month = d.date.getMonth() + 1, dow = d.date.getDay();
        const pred  = BEAN_BASE_DAILY * (BEAN_MONTH[month]||1.0) * (BEAN_DOW[dow]||1.0) * mf;
        return { ...d, dow, pred: Math.round(pred*10)/10 };
      });
      const total    = Math.round(dayResults.reduce((a,b) => a+b.pred, 0)*10)/10;
      const st       = parseFloat(stockBean) || 0;
      const buffer   = parseFloat(beanBuffer) || 0;
      const orderQty = Math.max(0, Math.round((total + buffer - st)*10)/10);
      setResult({ bean:true, dayResults, total, orderQty, stock:st });
      return;
    }
    const dayResults = calcPrediction(days, dowF, monthF, baseF, mode);
    const total      = dayResults.reduce((a,b) => a+b.pred, 0);
    const orderQty   = Math.max(0, total - stock);
    setResult({ dayResults, total, orderQty, stock, base: Math.round(baseF*10)/10 });
  }

  function toggleWeather(i, code) {
    setDays(prev => prev.map((d,idx) => {
      if (idx !== i) return d;
      const cur  = Array.isArray(d.weather) ? d.weather : [d.weather];
      if (cur.includes(code)) {
        const next = cur.filter(c => c !== code);
        return { ...d, weather: next.length ? next : [code] };
      }
      return { ...d, weather: [...cur, code] };
    }));
  }

  function updateDay(i, key, val) {
    setDays(prev => prev.map((d,idx) => idx===i ? {...d,[key]:val} : d));
  }

  function handleCSV(text, prod) {
    const parsed = parseCSV(text);
    if (prod === "stand") { setCsvStand(text); setDataStand(parsed); }
    if (prod === "naka")  { setCsvNaka(text);  setDataNaka(parsed); }
  }

  const fmtDate = d => `${d.getMonth()+1}/${d.getDate()}(${DAY_NAMES[d.getDay()]})`;
  const stockVal = product==="stand" ? stockStand : product==="naka" ? stockNaka : stockBean;
  const setStock = product==="stand" ? setStockStand : product==="naka" ? setStockNaka : setStockBean;

  const precipColor = p => p == null ? "#6b7280" : p >= 70 ? "#f87171" : p >= 40 ? "#fbbf24" : "#60a5fa";

  // 天気ステータスバッジ
  const WeatherBadge = () => {
    const map = {
      idle:    null,
      loading: { text:"天気取得中…", color:"#6b7280" },
      ok:      { text:"✅ 天気自動反映済み", color:"#34d399" },
      error:   { text:"⚠️ 天気取得失敗（手動入力）", color:"#f87171" },
    };
    const b = map[weatherStatus];
    if (!b) return null;
    return (
      <span style={{fontSize:"11px", color:b.color, marginLeft:"12px"}}>
        {b.text}
        {weatherStatus==="error" && (
          <button onClick={fetchWeather} style={{marginLeft:"8px",fontSize:"10px",background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.3)",color:"#f87171",borderRadius:"4px",padding:"2px 6px",cursor:"pointer"}}>再試行</button>
        )}
      </span>
    );
  };

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <div style={{display:"flex",alignItems:"center",gap:"14px"}}>
          <span style={{fontSize:"26px"}}>🏔️</span>
          <div>
            <p style={{fontSize:"20px",fontWeight:"800",letterSpacing:"0.05em",margin:0}}>877 Order Tool</p>
            <p style={{fontSize:"11px",color:"#6b7280",margin:0,letterSpacing:"0.1em"}}>ORDER PREDICTION SYSTEM</p>
          </div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:"12px",color:"#6b7280"}}>つくば市</div>
          <WeatherBadge />
        </div>
      </div>

      <div style={S.subTabs}>
        {PRODUCTS.map(p => (
          <button key={p.id} style={S.subTab(product===p.id, p.color)} onClick={()=>setProduct(p.id)}>
            {p.label}
            {p.badge && <span style={{marginLeft:"6px",fontSize:"10px",color:"#f59e0b"}}>({p.badge})</span>}
          </button>
        ))}
      </div>

      <div style={S.topTabs}>
        {[["order","📦 発注予測"],["weather","🌤️ 天気確認・修正"],["data","📊 データ入力"]].map(([id,label])=>(
          <button key={id} style={S.topTab(topTab===id)} onClick={()=>setTopTab(id)}>{label}</button>
        ))}
      </div>

      <div style={S.content}>

        {/* ===== 発注予測 ===== */}
        {topTab==="order" && (
          <div>
            {product==="bean" ? (
              <div>
                <div style={S.label}>発注モード</div>
                <div style={{display:"flex",gap:"10px",marginBottom:"24px"}}>
                  {[["just","ジャスト","2週分そのまま"],["normal","ちょい多め","+15%"],["event","イベント","+30%"]].map(([id,name,sub])=>(
                    <button key={id} style={S.modeBtn(mode===id)} onClick={()=>setMode(id)}>
                      <span>{name}</span><span style={{fontSize:"10px",opacity:0.7}}>{sub}</span>
                    </button>
                  ))}
                </div>
                <div style={S.label}>現在の在庫（kg）</div>
                <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"20px"}}>
                  <input type="number" style={S.numInput} value={stockBean} onChange={e=>setStockBean(e.target.value)} min="0" />
                  <span style={{color:"#9ca3af"}}>kg</span>
                </div>
                <div style={S.label}>最低在庫バッファ（kg）</div>
                <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"28px"}}>
                  <input type="number" style={{...S.numInput,fontSize:"16px"}} value={beanBuffer} onChange={e=>setBeanBuffer(e.target.value)} min="0" step="0.5" />
                  <span style={{color:"#9ca3af"}}>kg</span>
                  <span style={{fontSize:"11px",color:"#6b7280"}}>焙煎所休みや繁忙期は多めに</span>
                </div>
                {result?.bean && (
                  <div>
                    <div style={{...S.card({background:"linear-gradient(135deg,rgba(16,185,129,0.12),rgba(99,102,241,0.08))",border:"1px solid rgba(16,185,129,0.25)"}), textAlign:"center", padding:"28px"}}>
                      <div style={{fontSize:"12px",color:"#6b7280",letterSpacing:"0.1em",marginBottom:"8px"}}>今週の発注推奨量</div>
                      <div style={{fontSize:"52px",fontWeight:"900",background:"linear-gradient(135deg,#10b981,#6366f1)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",lineHeight:1}}>{result.orderQty}</div>
                      <div style={{fontSize:"14px",color:"#9ca3af",marginTop:"8px"}}>kg</div>
                      <div style={{marginTop:"16px",display:"flex",justifyContent:"center",gap:"24px",fontSize:"13px",color:"#6b7280",flexWrap:"wrap"}}>
                        <span>7日予測: <strong style={{color:"#34d399"}}>{result.total}kg</strong></span>
                        <span>現在庫: <strong style={{color:"#a5b4fc"}}>{result.stock}kg</strong></span>
                        <span>不足: <strong style={{color:"#f87171"}}>{result.orderQty}kg</strong></span>
                        <span>バッファ: <strong style={{color:"#fbbf24"}}>{parseFloat(beanBuffer)||0}kg</strong></span>
                      </div>
                    </div>
                    <div style={S.label}>日別内訳</div>
                    <div style={S.card()}>
                      {result.dayResults.map((d,i) => (
                        <div key={i} style={S.dayRow(d.dow)}>
                          <span style={{width:"80px",fontSize:"13px",color:(d.dow===0||d.dow===6)?"#a5b4fc":"#d1d5db",flexShrink:0}}>{fmtDate(d.date)}</span>
                          <span style={{flex:1,fontSize:"12px",color:"#9ca3af"}}>{d.date.getMonth()+1}月係数 {BEAN_MONTH[d.date.getMonth()+1]}</span>
                          <span style={{fontSize:"18px",fontWeight:"700",color:(d.dow===0||d.dow===6)?"#a5b4fc":"#e0e0f0"}}>{d.pred}</span>
                          <span style={{fontSize:"12px",color:"#6b7280"}}>kg</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                {product==="naka" && (
                  <div style={{background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:"8px",padding:"10px 14px",marginBottom:"16px",fontSize:"12px",color:"#fbbf24"}}>
                    ⚠️ 2/5オープンから3週分のデータをもとにした暫定係数です。データが溜まったら更新します。
                  </div>
                )}
                <div style={S.label}>発注モード</div>
                <div style={{display:"flex",gap:"10px",marginBottom:"24px"}}>
                  {[["just","ジャスト","予測値そのまま"],["normal","ちょい多め","+15%"],["event","イベント","+30%"]].map(([id,name,sub])=>(
                    <button key={id} style={S.modeBtn(mode===id)} onClick={()=>setMode(id)}>
                      <span>{name}</span><span style={{fontSize:"10px",opacity:0.7}}>{sub}</span>
                    </button>
                  ))}
                </div>
                <div style={S.label}>現在の在庫（本）</div>
                <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"28px"}}>
                  <input type="number" style={S.numInput} value={stockVal} onChange={e=>setStock(e.target.value)} min="0" />
                  <span style={{color:"#9ca3af"}}>本</span>
                </div>
                {result && !result.bean && (
                  <div>
                    <div style={{...S.card({background:"linear-gradient(135deg,rgba(99,102,241,0.12),rgba(16,185,129,0.08))",border:"1px solid rgba(99,102,241,0.25)"}), textAlign:"center", padding:"28px"}}>
                      <div style={{fontSize:"12px",color:"#6b7280",letterSpacing:"0.1em",marginBottom:"8px"}}>今週の発注推奨数</div>
                      <div style={S.bigNum}>{result.orderQty}</div>
                      <div style={{fontSize:"14px",color:"#9ca3af",marginTop:"8px"}}>本</div>
                      <div style={{marginTop:"16px",display:"flex",justifyContent:"center",gap:"24px",fontSize:"13px",color:"#6b7280",flexWrap:"wrap"}}>
                        <span>7日予測: <strong style={{color:"#a5b4fc"}}>{result.total}本</strong></span>
                        <span>現在庫: <strong style={{color:"#34d399"}}>{result.stock}本</strong></span>
                        <span style={{color:"#f87171"}}>不足: <strong>{result.orderQty}本</strong></span>
                      </div>
                      <div style={{marginTop:"10px",fontSize:"11px",color:"#6b7280"}}>
                        {dataStand.length||dataNaka.length ? `📈 実績データ使用 / 日平均ベース: ${result.base}本` : `📐 標準係数使用 / 日平均ベース: ${result.base}本`}
                      </div>
                    </div>
                    <div style={S.label}>日別内訳</div>
                    <div style={S.card()}>
                      {result.dayResults.map((d,i) => {
                        const wOpts = (Array.isArray(d.weather)?d.weather:[d.weather]).map(c=>WEATHER_OPTIONS.find(w=>w.code===c)).filter(Boolean);
                        return (
                          <div key={i} style={S.dayRow(d.dow)}>
                            <span style={{width:"80px",fontSize:"13px",color:(d.dow===0||d.dow===6)?"#a5b4fc":"#d1d5db",flexShrink:0}}>{fmtDate(d.date)}</span>
                            <span style={{fontSize:"16px"}}>{wOpts.map(w=>w.icon).join("")}</span>
                            <span style={{fontSize:"12px",color:"#9ca3af",minWidth:"60px"}}>{d.tempHigh}↑{d.tempLow}↓</span>
                            {d.precip != null && (
                              <span style={{fontSize:"12px",color:precipColor(d.precip),minWidth:"38px"}}>💧{d.precip}%</span>
                            )}
                            <span style={{flex:1}}/>
                            <span style={{fontSize:"18px",fontWeight:"700",color:(d.dow===0||d.dow===6)?"#a5b4fc":"#e0e0f0"}}>{d.pred}</span>
                            <span style={{fontSize:"12px",color:"#6b7280"}}>本</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===== 天気確認・修正 ===== */}
        {topTab==="weather" && (
          <div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"16px"}}>
              <div style={S.label}>7日間の天気（自動取得 → 手動で上書き可）</div>
              <button
                onClick={fetchWeather}
                disabled={weatherStatus==="loading"}
                style={{fontSize:"12px",background:"rgba(99,102,241,0.15)",border:"1px solid rgba(99,102,241,0.3)",color:"#a5b4fc",borderRadius:"6px",padding:"6px 14px",cursor:"pointer",opacity:weatherStatus==="loading"?0.5:1}}
              >
                {weatherStatus==="loading" ? "取得中…" : "🔄 再取得"}
              </button>
            </div>
            <div style={S.card()}>
              {days.map((d,i) => (
                <div key={i} style={{display:"flex",flexDirection:"column",padding:"10px 14px",borderRadius:"8px",background:(d.date.getDay()===0||d.date.getDay()===6)?"rgba(99,102,241,0.08)":"rgba(255,255,255,0.02)",border:(d.date.getDay()===0||d.date.getDay()===6)?"1px solid rgba(99,102,241,0.15)":"1px solid transparent",marginBottom:"10px",gap:"8px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:"13px",color:(d.date.getDay()===0||d.date.getDay()===6)?"#a5b4fc":"#d1d5db",fontWeight:600}}>{fmtDate(d.date)}</span>
                    <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                      {d.precip != null && (
                        <span style={{fontSize:"12px",color:precipColor(d.precip)}}>💧{d.precip}%</span>
                      )}
                      <input type="number" style={S.tempInput} value={d.tempHigh} onChange={e=>updateDay(i,"tempHigh",parseInt(e.target.value)||0)} />
                      <span style={{fontSize:"11px",color:"#f87171"}}>↑</span>
                      <input type="number" style={S.tempInput} value={d.tempLow} onChange={e=>updateDay(i,"tempLow",parseInt(e.target.value)||0)} />
                      <span style={{fontSize:"11px",color:"#60a5fa"}}>↓℃</span>
                    </div>
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>
                    {WEATHER_OPTIONS.map(opt => (
                      <button key={opt.code} style={S.wBtn(Array.isArray(d.weather)&&d.weather.includes(opt.code))} onClick={()=>toggleWeather(i,opt.code)}>
                        {opt.icon} {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div style={{fontSize:"12px",color:"#6b7280"}}>💡 天気・気温は手動で変更可能。降水確率は表示のみです。</div>
          </div>
        )}

        {/* ===== データ入力 ===== */}
        {topTab==="data" && (
          <div>
            {[{id:"stand",label:"🥛 Stand牛乳",csv:csvStand,data:dataStand},{id:"naka",label:"🏠 中腹牛乳",csv:csvNaka,data:dataNaka}].map(p => (
              <div key={p.id} style={{marginBottom:"24px"}}>
                <div style={{...S.label, color:product===p.id?"#6366f1":"#6b7280"}}>{p.label} — 過去データ</div>
                <textarea style={S.textarea} value={p.csv} onChange={e=>handleCSV(e.target.value, p.id)} placeholder="月次CSVを貼り付けると精度が上がります（列6が消費数）" />
                {p.data.length > 0 && (
                  <div style={{fontSize:"12px",color:"#34d399",marginTop:"4px"}}>
                    ✅ {p.data.length}件読み込み済み / 日平均: {Math.round(calcBase(p.data,0)*10)/10}本
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