import { useState, useRef, useEffect, useCallback } from "react";

const T = { bg:"#F7F6F3",surface:"#FFFFFF",border:"#E8E6E0",text:"#1C1B18",muted:"#8A8880",accent:"#D4622A",accentLight:"#FBF0EB",track:"#E8E6E0" };
const PLATFORMS = [{id:"linkedin",label:"LinkedIn",icon:"in"},{id:"twitter",label:"X / Twitter",icon:"𝕏"},{id:"instagram",label:"Instagram",icon:"▣"},{id:"facebook",label:"Facebook",icon:"f"}];
const SLIDERS = [{id:"tone",label:"Tone of Voice",left:"Informative",right:"Excited",emoji:"🎙️"},{id:"focus",label:"Focus",left:"Practical",right:"Strategic",emoji:"🔭"},{id:"hero",label:"Hero",left:"My Company",right:"Me",emoji:"🦸"},{id:"length",label:"Length",left:"Short & punchy",right:"Long & detailed",emoji:"📏"}];
const HYPE_LINES = ["You're about to go viral. Probably. 🤞","Ghostwriting your way to internet fame…","Who's the next LinkedIn legend? You are.","Sprinkling just the right amount of cringe…","Making you sound smart AND relatable. No small feat.","Your followers won't know what hit them. 👀","Crafting words that'll make your boss double-tap.","You're literally killing it right now.","This post? Chef's kiss. Almost done.","Distilling your personal brand. It's glowing.","The algorithm is already nervous. Good.","Hold tight — greatness takes 4 seconds."];

const STYLES = {
  Narrative: {
    label: "Narrative",
    desc: "Personal story arc with unresolved tension",
    emoji: "📖",
    rules: `Style: NARRATIVE
- Open with a moral dilemma or personal tension, not an observation
- Use a real story arc: situation → tension → turning point → insight
- Use extreme specificity — real details (numbers, places, timeframes) make it feel true
- Don't resolve everything neatly. Sit in the discomfort
- Admit weakness or uncertainty when relevant — it's more powerful than a clean lesson
- Go from specific personal experience → universal human truth, not the reverse
- Close with a genuine question you don't already know the answer to, or a reflection that lingers`
  },
  Insight: {
    label: "Insight",
    desc: "Logical build from observation to earned principle",
    emoji: "💡",
    rules: `Style: INSIGHT
- Open with a specific observation or counterintuitive finding
- Build logically: observation → experiment or evidence → result → principle
- Use specific numbers and details as proof, even if approximate ("15 minutes here, 30 minutes there")
- Each paragraph should add a new layer — never repeat the same point
- Earn the right to state a principle at the end by showing evidence first
- State your belief directly and confidently at the close — no need for a question
- No hashtags needed if the insight is strong enough`
  },
  Craft: {
    label: "Craft",
    desc: "Self-aware, rhythmic — the form demonstrates the point",
    emoji: "✍️",
    rules: `Style: CRAFT
- The post should demonstrate its own point through its form
- Vary paragraph length deliberately and rhythmically — mix one-liners with longer passages
- Never let three consecutive paragraphs be the same length
- Use direct address: pull the reader into an active experience ("Try this", "Notice what just happened")
- Share one specific, slightly odd, memorable technique or habit — not a framework
- Be playful and self-aware about the craft
- End with a single confident word or short phrase — not a question`
  }
};

const STYLE_CYCLE = ["Narrative","Insight","Craft"];

function buildPrompt({content, take, platform, sliders, forceStyle=null}){
  const tone=sliders.tone<40?"informative and factual":sliders.tone>60?"enthusiastic and excited":"balanced";
  const focus=sliders.focus<40?"practical and tactical":sliders.focus>60?"strategic and big-picture":"a mix of practical and strategic";
  const hero=sliders.hero<40?"centered on the company":sliders.hero>60?"written from a personal I perspective":"balanced between company and personal";
  const length=sliders.length<40?"very short — maximum 1 paragraph, 2-3 sentences only, no fluff, but do include relevant hashtags":sliders.length>60?"long and detailed, using the full character/word limit of the platform":"medium length, 1–2 paragraphs";
  const pg={linkedin:"LinkedIn (1–3 short paragraphs, 150–250 words, max 3 hashtags)",twitter:"X/Twitter (max 280 characters, punchy)",instagram:"Instagram (casual caption, 1–2 paragraphs, 3–5 hashtags, assumes a visual will accompany the post)",facebook:"Facebook (conversational, 1–3 paragraphs, 100–200 words, no more than 2 hashtags)"}[platform];

  const linkedinStyle = platform === "linkedin" ? `
## Post Style
${forceStyle
  ? `Use the ${forceStyle} style as defined below.`
  : `Read the content and choose the most fitting style from the three below. Pick Narrative if the content has a human story or tension. Pick Insight if it contains data, research, or a logical argument. Pick Craft if it's about process, communication, or a meta topic.`}

${Object.values(STYLES).map(s=>s.rules).join("\n\n")}

## Output format
Your response must start with exactly this on the first line: [STYLE:Narrative] or [STYLE:Insight] or [STYLE:Craft]
Then a blank line.
Then the post text only. Nothing else.

## Universal LinkedIn rules
- One idea only. Pick the strongest angle.
- Hook in the first 2 lines. Never an announcement opener.
- Never: "I'm excited to share", "Thrilled to announce", "Big news", "Here's why", humblebrags
- Short paragraphs, 1–3 sentences. Line breaks between thoughts. Never every sentence as its own line.
- Voice: "I" not "we". Honest over polished.
- Hashtags at the very end, 0–3, never inline. Strong content may need none.
- Max 1 emoji or none.
- No motivational poster language. No fortune cookie lessons.` : "";

  const universalRules = `
## Universal rules
- No em dashes (—) anywhere
- No hollow openers
- No buzzwords: "delve", "foster", "leverage", "game-changer", "landscape", "unleash", "groundbreaking", "innovative"
- No rhetorical sign-off questions like "What do you think?" or "Have you experienced this?"
- Vary sentence length naturally
- No corporate speak`;

  return `You are a social media ghostwriter helping an employee share company content on their personal account. Write something that sounds like a real human — not AI, not marketing.

Company content:
---
${content}
---
${take?`\nEmployee's personal take: "${take}"\n`:""}
Platform: ${pg}
Tone: ${tone}
Focus: ${focus}
Perspective: ${hero}
Length: ${length}
${linkedinStyle}
${platform !== "linkedin" ? universalRules : ""}
${platform !== "linkedin" ? "\nOutput ONLY the post text, nothing else." : ""}`;
}

function parseStyleFromResponse(text){
  const match = text.match(/^\[STYLE:(Narrative|Insight|Craft)\]\n\n?/);
  if(match) return { style: match[1], post: text.slice(match[0].length).trim() };
  return { style: null, post: text.trim() };
}

async function callClaude(prompt, url){
  const body = url ? {url, prompt} : {prompt};
  const res=await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const data=await res.json();
  if(!res.ok)throw new Error(data.error||"Request failed");
  if(!data.text)throw new Error("No response");
  return data.text;
}

function Btn({children,onClick,disabled,variant="primary",style={}}){
  const s={primary:{background:T.text,color:"#fff",border:"none"},ghost:{background:"transparent",color:T.text,border:`1.5px solid ${T.border}`},accent:{background:T.accent,color:"#fff",border:"none"}}[variant];
  return <button onClick={onClick} disabled={disabled} style={{padding:"13px 24px",borderRadius:10,fontSize:14,fontWeight:600,cursor:disabled?"not-allowed":"pointer",fontFamily:"inherit",opacity:disabled?0.4:1,transition:"opacity 0.15s",...s,...style}}>{children}</button>;
}

function SliderRow({slider,value,onChange}){
  return(
    <div style={{marginBottom:28}}>
      <style>{`input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:${T.text};cursor:pointer;border:3px solid white;box-shadow:0 0 0 1.5px ${T.text}}input[type=range]::-moz-range-thumb{width:20px;height:20px;border-radius:50%;background:${T.text};border:3px solid white}`}</style>
      <div style={{fontSize:12,fontWeight:600,color:T.text,letterSpacing:"0.04em",textTransform:"uppercase",marginBottom:10}}>{slider.emoji} {slider.label}</div>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:11,color:T.muted,width:72,textAlign:"right",flexShrink:0}}>{slider.left}</span>
        <div style={{flex:1,position:"relative"}}>
          <div style={{position:"absolute",top:"50%",left:0,right:0,height:3,background:T.track,borderRadius:99,transform:"translateY(-50%)"}}/>
          <div style={{position:"absolute",top:"50%",left:0,width:`${value}%`,height:3,background:T.text,borderRadius:99,transform:"translateY(-50%)"}}/>
          <input type="range" min={0} max={100} value={value} onChange={e=>onChange(Number(e.target.value))} style={{position:"relative",width:"100%",appearance:"none",WebkitAppearance:"none",background:"transparent",cursor:"pointer",height:24}}/>
        </div>
        <span style={{fontSize:11,color:T.muted,width:72,flexShrink:0}}>{slider.right}</span>
      </div>
    </div>
  );
}

function Section({label,number,active,children}){
  return(
    <div style={{opacity:active?1:0.35,transition:"opacity 0.4s",pointerEvents:active?"auto":"none"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
        <div style={{width:24,height:24,borderRadius:"50%",background:active?T.text:T.border,color:active?"#fff":T.muted,fontSize:12,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"background 0.3s"}}>{number}</div>
        <span style={{fontSize:13,fontWeight:600,color:active?T.text:T.muted,letterSpacing:"0.02em",textTransform:"uppercase",transition:"color 0.3s"}}>{label}</span>
      </div>
      {children}
    </div>
  );
}

function Divider(){ return <div style={{height:1,background:T.border,margin:"32px 0"}}/>; }

function LoadingBar(){
  const [prog,setProg]=useState(0);
  const [idx]=useState(()=>Math.floor(Math.random()*HYPE_LINES.length));
  useEffect(()=>{
    const steps=3500/40;let cur=0;
    const t=setInterval(()=>{cur++;setProg(Math.min((1-Math.pow(1-cur/steps,2.5))*100,97));if(cur>=steps)clearInterval(t);},40);
    return()=>clearInterval(t);
  },[]);
  return(
    <div style={{padding:"24px 0 8px"}}>
      <style>{`@keyframes bounce{0%,100%{transform:translateY(0);opacity:.3}50%{transform:translateY(-8px);opacity:1}}`}</style>
      <div style={{display:"flex",gap:6,marginBottom:20}}>
        {[0,1,2].map(i=><div key={i} style={{width:8,height:8,borderRadius:"50%",background:T.text,animation:`bounce 1.1s ease-in-out ${i*0.18}s infinite`}}/>)}
      </div>
      <p style={{fontSize:16,fontWeight:700,color:T.text,marginBottom:4}}>{HYPE_LINES[idx]}</p>
      <p style={{fontSize:13,color:T.muted,marginBottom:20}}>Writing your post…</p>
      <div style={{background:T.track,borderRadius:99,height:4,overflow:"hidden"}}>
        <div style={{height:"100%",borderRadius:99,background:`linear-gradient(90deg,${T.text},${T.accent})`,width:`${prog}%`,transition:"width 0.04s linear"}}/>
      </div>
    </div>
  );
}

export default function PostMe(){
  const [inputMode, setInputMode] = useState("text");
  const [state,setState]=useState({content:"",take:"",platform:"",sliders:{tone:50,focus:50,hero:50,length:50}});
  const [result,setResult]=useState("");
  const [detectedStyle,setDetectedStyle]=useState(null);
  const [loading,setLoading]=useState(false);
  const [generating,setGenerating]=useState(false);
  const [error,setError]=useState("");
  const [copied,setCopied]=useState(false);
  const [showTerms,setShowTerms]=useState(false);
  const [showPrivacy,setShowPrivacy]=useState(false);
  const resultRef=useRef();

  const hasContent=state.content.trim().length>0;
  const hasPlatform=!!state.platform;
  const canGenerate=hasContent&&hasPlatform;

  const generate=useCallback(async(forceStyle=null)=>{
    setLoading(true);setGenerating(true);setError("");setResult("");
    setTimeout(()=>resultRef.current?.scrollIntoView({behavior:"smooth",block:"start"}),100);
    try{
      const isUrl = inputMode === "url";
      const prompt = buildPrompt({
        content: isUrl ? `Fetch and summarise the content at ${state.content} and use it as the company content to write about.` : state.content,
        take:state.take, platform:state.platform, sliders:state.sliders, forceStyle
      });
      const [raw]=await Promise.allSettled([
        callClaude(prompt, isUrl ? state.content : null),
        new Promise(r=>setTimeout(r,3800)),
      ]);
      setGenerating(false);setLoading(false);
      if(raw.status==="fulfilled"){
        const {style, post} = parseStyleFromResponse(raw.value);
        setDetectedStyle(style);
        setResult(post);
      } else {
        setError(raw.reason?.message||"Generation failed. Please try again.");
      }
    }catch(err){
      setGenerating(false);setLoading(false);
      setError(err.message||"Generation failed. Please try again.");
    }
  },[state, inputMode]);

  const tryDifferentStyle = useCallback(()=>{
    const current = detectedStyle || STYLE_CYCLE[0];
    const idx = STYLE_CYCLE.indexOf(current);
    const next = STYLE_CYCLE[(idx+1) % STYLE_CYCLE.length];
    generate(next);
  },[detectedStyle, generate]);

  const reset=()=>{
    setState({content:"",take:"",platform:"",sliders:{tone:50,focus:50,hero:50,length:50}});
    setResult("");setError("");setGenerating(false);setLoading(false);setInputMode("text");setDetectedStyle(null);
    window.scrollTo({top:0,behavior:"smooth"});
  };

  const iStyle={width:"100%",padding:"13px 15px",border:`1.5px solid ${T.border}`,borderRadius:10,fontSize:14,fontFamily:"inherit",color:T.text,background:T.surface,outline:"none",boxSizing:"border-box"};

  return(
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:"'DM Sans','Helvetica Neue',sans-serif",padding:"0 16px"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700&family=Cormorant+Garamond:wght@600&display=swap" rel="stylesheet"/>
      <header style={{maxWidth:540,margin:"0 auto",padding:"28px 0 0"}}>
        <div style={{display:"flex",alignItems:"baseline",gap:6,marginBottom:3}}>
          <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,fontWeight:600,color:T.text}}>PostMe</span>
          <span style={{width:6,height:6,borderRadius:"50%",background:T.accent,display:"inline-block",marginBottom:1}}/>
        </div>
        <p style={{fontSize:12,color:T.muted,margin:0}}>Post your company news. Sound like yourself.</p>
      </header>

      <main style={{maxWidth:540,margin:"24px auto 80px"}}>
        <div style={{background:T.surface,borderRadius:20,border:`1px solid ${T.border}`,padding:"36px 36px 32px",boxShadow:"0 2px 24px rgba(0,0,0,0.05)"}}>

          <Section label="What are you sharing?" number="1" active={true}>
            <div style={{display:"flex",gap:3,marginBottom:16,background:T.bg,borderRadius:10,padding:3}}>
              <button onClick={()=>{ setInputMode("text"); setState(s=>({...s,content:""})); }} style={{flex:1,padding:"8px 0",border:"none",borderRadius:8,cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:inputMode==="text"?600:400,color:inputMode==="text"?T.text:T.muted,background:inputMode==="text"?T.surface:"transparent",boxShadow:inputMode==="text"?"0 1px 4px rgba(0,0,0,0.08)":"none"}}>Paste Text</button>
              <button onClick={()=>{ setInputMode("url"); setState(s=>({...s,content:""})); }} style={{flex:1,padding:"8px 0",border:"none",borderRadius:8,cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:inputMode==="url"?600:400,color:inputMode==="url"?T.text:T.muted,background:inputMode==="url"?T.surface:"transparent",boxShadow:inputMode==="url"?"0 1px 4px rgba(0,0,0,0.08)":"none"}}>URL</button>
              <div style={{flex:1,padding:"8px 4px",borderRadius:8,textAlign:"center",opacity:0.4,cursor:"not-allowed",userSelect:"none"}}>
                <div style={{fontSize:13,color:T.muted}}>Upload File</div>
                <div style={{fontSize:10,fontWeight:700,color:T.accent,marginTop:2}}>Coming soon</div>
              </div>
            </div>
            {inputMode==="url"
              ? <input type="url" placeholder="https://yourcompany.com/blog/post" value={state.content} onChange={e=>setState(s=>({...s,content:e.target.value}))} style={iStyle}/>
              : <textarea placeholder="Paste the company post, article, or message here…" value={state.content} onChange={e=>setState(s=>({...s,content:e.target.value}))} rows={5} style={{...iStyle,resize:"vertical",lineHeight:1.6}}/>
            }
          </Section>

          <Divider/>

          <Section label="Your voice" number="2" active={hasContent}>
            <label style={{display:"block",fontSize:12,fontWeight:600,color:T.text,marginBottom:8,letterSpacing:"0.04em",textTransform:"uppercase"}}>Your take <span style={{color:T.muted,fontWeight:400,textTransform:"none"}}>(optional)</span></label>
            <textarea placeholder='e.g. "This is huge for our industry"' value={state.take} onChange={e=>setState(s=>({...s,take:e.target.value}))} rows={2} style={{...iStyle,resize:"none",lineHeight:1.6,marginBottom:24}}/>
            <label style={{display:"block",fontSize:12,fontWeight:600,color:T.text,marginBottom:12,letterSpacing:"0.04em",textTransform:"uppercase"}}>Platform</label>
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
              {PLATFORMS.map(p=>(
                <button key={p.id} onClick={()=>setState(s=>({...s,platform:p.id}))} style={{flex:"1 1 80px",padding:"12px 8px",border:`1.5px solid ${state.platform===p.id?T.text:T.border}`,borderRadius:12,cursor:"pointer",background:state.platform===p.id?T.text:T.surface,color:state.platform===p.id?"#fff":T.text,fontFamily:"inherit",textAlign:"center",transition:"all 0.15s"}}>
                  <div style={{fontSize:16,marginBottom:2}}>{p.icon}</div>
                  <div style={{fontSize:12,fontWeight:600}}>{p.label}</div>
                </button>
              ))}
            </div>
          </Section>

          <Divider/>

          <Section label="Your style" number="3" active={hasContent&&hasPlatform}>
            {SLIDERS.map(sl=><SliderRow key={sl.id} slider={sl} value={state.sliders[sl.id]} onChange={v=>setState(s=>({...s,sliders:{...s.sliders,[sl.id]:v}}))}/>)}
          </Section>

          <Divider/>

          <div style={{opacity:canGenerate?1:0.35,transition:"opacity 0.4s",pointerEvents:canGenerate?"auto":"none"}}>
            <Btn onClick={()=>generate(null)} disabled={loading||!canGenerate} style={{width:"100%",textAlign:"center",fontSize:15,padding:"16px 24px"}}>
              {loading?"✦ Writing…":"✦ Generate Post"}
            </Btn>
          </div>

          {(generating||result||error)&&(
            <div ref={resultRef} style={{marginTop:32,paddingTop:32,borderTop:`1px solid ${T.border}`}}>
              {generating&&<LoadingBar/>}
              {!generating&&result&&(
                <>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:"#22C55E",flexShrink:0}}/>
                      <span style={{fontSize:13,color:T.muted,fontWeight:500}}>Ready to post on {PLATFORMS.find(x=>x.id===state.platform)?.label}</span>
                    </div>
                    {detectedStyle&&state.platform==="linkedin"&&(
                      <div style={{display:"flex",alignItems:"center",gap:6,background:T.bg,borderRadius:20,padding:"4px 10px"}}>
                        <span style={{fontSize:11,color:T.muted}}>{STYLES[detectedStyle]?.emoji} {detectedStyle} style</span>
                      </div>
                    )}
                  </div>
                  {state.platform==="instagram"&&<div style={{display:"flex",gap:10,alignItems:"flex-start",background:T.accentLight,border:`1.5px solid #F0C4AD`,borderRadius:10,padding:"11px 14px",marginBottom:16}}>
                    <span style={{fontSize:16,flexShrink:0}}>📸</span>
                    <p style={{margin:0,fontSize:13,color:T.accent,lineHeight:1.5}}><strong>Don't forget a visual.</strong> Instagram captions need a photo or video to land — pair this with a strong image before posting.</p>
                  </div>}
                  <textarea value={result} onChange={e=>setResult(e.target.value)} style={{width:"100%",background:T.surface,border:`1.5px solid ${T.border}`,borderRadius:14,padding:"20px",marginBottom:16,fontSize:15,color:T.text,lineHeight:1.75,fontFamily:"inherit",resize:"vertical",outline:"none",boxSizing:"border-box",minHeight:160}}/>
                  <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                    <Btn onClick={()=>{navigator.clipboard.writeText(result);setCopied(true);setTimeout(()=>setCopied(false),2000);}} variant="accent">{copied?"✓ Copied!":"Copy Post"}</Btn>
                    <Btn variant="ghost" onClick={()=>generate(null)} disabled={loading}>{loading?"Writing…":"↺ Regenerate"}</Btn>
                    {state.platform==="linkedin"&&<Btn variant="ghost" onClick={tryDifferentStyle} disabled={loading}>↝ Try different style</Btn>}
                    <Btn variant="ghost" onClick={reset}>Start Over</Btn>
                  </div>
                </>
              )}
              {!generating&&error&&<div style={{padding:"12px 16px",background:"#FEF2F2",borderRadius:8,color:"#DC2626",fontSize:13}}>{error}</div>}
            </div>
          )}

        </div>
      </main>

      <footer style={{borderTop:`1px solid ${T.border}`,padding:"14px 16px",textAlign:"center",display:"flex",justifyContent:"center",gap:16}}>
        <button onClick={()=>setShowTerms(true)} style={{background:"none",border:"none",color:T.muted,fontSize:12,cursor:"pointer",fontFamily:"inherit",textDecoration:"underline"}}>Terms & Conditions</button>
        <button onClick={()=>setShowPrivacy(true)} style={{background:"none",border:"none",color:T.muted,fontSize:12,cursor:"pointer",fontFamily:"inherit",textDecoration:"underline"}}>Privacy Policy</button>
      </footer>

      {(showTerms||showPrivacy)&&(
        <div onClick={()=>{setShowTerms(false);setShowPrivacy(false);}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16}}>
          <div onClick={e=>e.stopPropagation()} style={{background:T.surface,borderRadius:16,maxWidth:600,width:"100%",maxHeight:"80vh",overflow:"auto",padding:"32px 36px",boxShadow:"0 8px 40px rgba(0,0,0,0.15)",position:"relative"}}>
            <button onClick={()=>{setShowTerms(false);setShowPrivacy(false);}} style={{position:"absolute",top:16,right:16,background:"none",border:"none",fontSize:20,cursor:"pointer",color:T.muted,fontFamily:"inherit",lineHeight:1}}>✕</button>
            {showTerms&&<>
            <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:600,color:T.text,margin:"0 0 4px"}}>Terms & Conditions</h2>
            <p style={{fontSize:12,color:T.muted,margin:"0 0 20px"}}>Last updated: March 2026</p>
            <div style={{fontSize:14,color:T.text,lineHeight:1.7}}>
              <p>Welcome to PostMe. By using this tool, you agree to the following terms.</p>
              <h3 style={{fontSize:14,fontWeight:700,margin:"20px 0 8px"}}>1. What PostMe Does</h3>
              <p style={{margin:"0 0 12px"}}>PostMe is an AI-powered tool that helps employees create personalized social media posts based on company content. It generates draft posts for your review — you decide whether and how to share them.</p>
              <h3 style={{fontSize:14,fontWeight:700,margin:"20px 0 8px"}}>2. Your Responsibility for Content</h3>
              <ul style={{margin:"0 0 12px",paddingLeft:20}}>
                <li>You are solely responsible for any post you publish on social media.</li>
                <li>PostMe generates suggestions only. Always review content before posting.</li>
                <li>Do not input confidential, sensitive, or proprietary company information that is not already publicly available.</li>
                <li>Ensure that any post you publish complies with your employer's social media policy.</li>
              </ul>
              <h3 style={{fontSize:14,fontWeight:700,margin:"20px 0 8px"}}>3. AI-Generated Content</h3>
              <ul style={{margin:"0 0 12px",paddingLeft:20}}>
                <li>Posts are generated by an AI model and may occasionally be inaccurate, incomplete, or unsuitable.</li>
                <li>PostMe does not guarantee that generated content is error-free, on-brand, or appropriate for your specific context.</li>
                <li>You should edit and review all generated posts before publishing.</li>
              </ul>
              <h3 style={{fontSize:14,fontWeight:700,margin:"20px 0 8px"}}>4. Intellectual Property</h3>
              <ul style={{margin:"0 0 12px",paddingLeft:20}}>
                <li>Company content you input remains the property of its original owner.</li>
                <li>Generated posts are provided to you for personal use. PostMe claims no ownership over them.</li>
                <li>Do not input content that infringes third-party copyrights or trademarks.</li>
              </ul>
              <h3 style={{fontSize:14,fontWeight:700,margin:"20px 0 8px"}}>5. Privacy & Data</h3>
              <ul style={{margin:"0 0 12px",paddingLeft:20}}>
                <li>PostMe does not store your inputs or generated posts.</li>
                <li>Content you enter is sent to Anthropic's API solely for the purpose of generating your post. It is subject to Anthropic's Privacy Policy.</li>
                <li>PostMe does not collect personal data beyond what is necessary to operate the tool.</li>
              </ul>
              <h3 style={{fontSize:14,fontWeight:700,margin:"20px 0 8px"}}>6. Acceptable Use</h3>
              <p style={{margin:"0 0 4px"}}>You agree not to use PostMe to:</p>
              <ul style={{margin:"0 0 12px",paddingLeft:20}}>
                <li>Generate misleading, defamatory, or harmful content</li>
                <li>Spread misinformation or manipulate public opinion</li>
                <li>Violate any applicable laws or platform terms of service (LinkedIn, X, Instagram, etc.)</li>
              </ul>
              <h3 style={{fontSize:14,fontWeight:700,margin:"20px 0 8px"}}>7. Disclaimer of Warranties</h3>
              <p style={{margin:"0 0 12px"}}>PostMe is provided "as is" without warranties of any kind. We do not guarantee uninterrupted availability or fitness for any particular purpose.</p>
              <h3 style={{fontSize:14,fontWeight:700,margin:"20px 0 8px"}}>8. Limitation of Liability</h3>
              <p style={{margin:"0 0 12px"}}>PostMe and its creators are not liable for any damages arising from your use of this tool, including consequences of publishing AI-generated content.</p>
              <h3 style={{fontSize:14,fontWeight:700,margin:"20px 0 8px"}}>9. Changes to These Terms</h3>
              <p style={{margin:0}}>We may update these Terms from time to time. Continued use of PostMe after changes constitutes acceptance of the revised terms.</p>
            </div>
            </>}
            {showPrivacy&&<>
            <h2 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:600,color:T.text,margin:"0 0 4px"}}>Privacy Policy</h2>
            <p style={{fontSize:12,color:T.muted,margin:"0 0 20px"}}>Last updated: March 2026</p>
            <div style={{fontSize:14,color:T.text,lineHeight:1.7}}>
              <p>At PostMe, your privacy matters. This policy explains what data we handle and how.</p>
              <h3 style={{fontSize:14,fontWeight:700,margin:"20px 0 8px"}}>1. What We Collect</h3>
              <p style={{margin:"0 0 4px"}}>PostMe does not collect, store, or sell your personal data.</p>
              <p style={{margin:"0 0 4px"}}>The only information that passes through PostMe is:</p>
              <ul style={{margin:"0 0 12px",paddingLeft:20}}>
                <li>Content you input (company posts, URLs, or uploaded files)</li>
                <li>Your preferences (platform choice, slider settings, personal take)</li>
              </ul>
              <p style={{margin:"0 0 12px"}}>This information is used solely to generate your social media post and is not retained after your session ends.</p>
              <h3 style={{fontSize:14,fontWeight:700,margin:"20px 0 8px"}}>2. How Your Content Is Processed</h3>
              <p style={{margin:"0 0 12px"}}>Content you enter is sent to Anthropic's API to generate your post. Anthropic may process this data in accordance with their own privacy policy, available at anthropic.com/privacy.</p>
              <p style={{margin:"0 0 12px"}}>We recommend not entering confidential or sensitive information that isn't already public.</p>
              <h3 style={{fontSize:14,fontWeight:700,margin:"20px 0 8px"}}>3. Cookies & Tracking</h3>
              <p style={{margin:"0 0 12px"}}>PostMe does not use cookies, analytics trackers, or any third-party tracking tools.</p>
              <h3 style={{fontSize:14,fontWeight:700,margin:"20px 0 8px"}}>4. Third-Party Platforms</h3>
              <p style={{margin:"0 0 12px"}}>When you copy and post generated content to LinkedIn, X, Instagram, or any other platform, that platform's own privacy policy applies. PostMe has no control over and no visibility into what happens after you leave our tool.</p>
              <h3 style={{fontSize:14,fontWeight:700,margin:"20px 0 8px"}}>5. Children's Privacy</h3>
              <p style={{margin:"0 0 12px"}}>PostMe is intended for use by adults in a professional context and is not directed at children under 16.</p>
              <h3 style={{fontSize:14,fontWeight:700,margin:"20px 0 8px"}}>6. Changes to This Policy</h3>
              <p style={{margin:0}}>We may update this policy occasionally. Any changes will be reflected here with an updated date.</p>
            </div>
            </>}
          </div>
        </div>
      )}
    </div>
  );
}
