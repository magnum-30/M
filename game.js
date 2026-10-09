(() => {
  "use strict";
  const STORAGE_KEY = "elite_duel_session_v1";
  const MAX_HEALTH = 30;
  const $ = id => document.getElementById(id);
  const screens = ["homeScreen", "gameScreen", "handoffScreen", "resultScreen"];
  let soundEnabled = false;
  let audioCtx = null;
  let toastTimer = null;

  const CARD_LIBRARY = [
    {id:"slash",name:"ضربة خاطفة",type:"هجوم",cost:1,icon:"⚔️",desc:"ألحق 4 نقاط ضرر بالخصم.",attack:4,glow:"#ff8d9b"},
    {id:"heavy",name:"ضربة ساحقة",type:"هجوم",cost:2,icon:"🗡️",desc:"ألحق 7 نقاط ضرر بالخصم.",attack:7,glow:"#ff8d9b"},
    {id:"guard",name:"درع الفولاذ",type:"دفاع",cost:1,icon:"🛡️",desc:"اكتسب 5 نقاط درع تحميك من الضرر.",shield:5,glow:"#75caff"},
    {id:"fortress",name:"حصن الحارس",type:"دفاع",cost:2,icon:"🏰",desc:"اكتسب 9 نقاط درع.",shield:9,glow:"#75caff"},
    {id:"heal",name:"بلسم الحياة",type:"شفاء",cost:2,icon:"💚",desc:"استعد 5 نقاط صحة، حتى الحد الأقصى.",heal:5,glow:"#70dfb1"},
    {id:"spark",name:"شرارة سحرية",type:"هجوم",cost:1,icon:"✨",desc:"ألحق 3 ضرر واسحب بطاقة.",attack:3,draw:1,glow:"#c6a2ff"},
    {id:"drain",name:"امتصاص الروح",type:"هجوم",cost:2,icon:"🌘",desc:"ألحق 4 ضرر واستعد 3 صحة.",attack:4,heal:3,glow:"#c6a2ff"},
    {id:"pierce",name:"رمح الاختراق",type:"هجوم",cost:3,icon:"🔱",desc:"ألحق 10 نقاط ضرر قوية.",attack:10,glow:"#ff8d9b"},
    {id:"focus",name:"تركيز المحارب",type:"قدرة",cost:0,icon:"🔥",desc:"اسحب بطاقتين فورًا.",draw:2,glow:"#e8bd73"},
    {id:"counter",name:"صدّ مرتد",type:"دفاع",cost:1,icon:"🪞",desc:"اكتسب 3 درع واسحب بطاقة.",shield:3,draw:1,glow:"#75caff"},
    {id:"poison",name:"سمّ الظلال",type:"هجوم",cost:2,icon:"☠️",desc:"ألحق 5 ضرر مباشر.",attack:5,glow:"#70dfb1"},
    {id:"meteor",name:"نيزك اللهب",type:"هجوم",cost:3,icon:"☄️",desc:"ألحق 8 ضرر واسحب بطاقة.",attack:8,draw:1,glow:"#ff9c6a"}
  ];

  function shuffledDeck() {
    const deck = [];
    CARD_LIBRARY.forEach(card => {
      deck.push({...card, uid: makeId()});
      deck.push({...card, uid: makeId()});
    });
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }
  function makeId() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
  function newPlayer(name) { return {name, health:MAX_HEALTH, shield:0, energy:1, maxEnergy:1, hand:[], deck:[]}; }
  function newGame() {
    const p1 = newPlayer("اللاعب الأول"), p2 = newPlayer("اللاعب الثاني");
    p1.deck = shuffledDeck(); p2.deck = shuffledDeck();
    for(let i=0;i<5;i++){ drawCard(p1, false); drawCard(p2, false); }
    return {players:[p1,p2], current:0, round:1, phase:"playing", logs:["بدأت المبارزة. اللاعب الأول يبدأ أولًا."], winner:null, handoffTo:null};
  }
  let state = null;

  function save() {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) { /* اللعبة تستمر حتى لو كان التخزين معطّلًا في المتصفح */ }
  }
  function load() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.players) || data.players.length !== 2) return null;
      return data;
    } catch(e) { return null; }
  }
  function drawCard(player, announce = true) {
    if (!player.deck.length) {
      if (announce) addLog(`${player.name} لم يعد لديه بطاقات للسحب.`);
      return false;
    }
    if (player.hand.length >= 8) {
      if (announce) addLog(`${player.name} لديه 8 بطاقات؛ لا يمكنه حمل المزيد.`);
      return false;
    }
    player.hand.push(player.deck.pop());
    return true;
  }
  function addLog(message) {
    state.logs.push(message);
    if (state.logs.length > 12) state.logs.shift();
  }
  function showScreen(id) {
    screens.forEach(s => $(s).classList.toggle("hidden", s !== id));
  }
  function showToast(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add("hidden"), 2200);
  }
  function beep(freq=440, duration=0.07) {
    if (!soundEnabled) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
      osc.type = "sine"; osc.frequency.value = freq; gain.gain.value = 0.035;
      osc.connect(gain); gain.connect(audioCtx.destination); osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.stop(audioCtx.currentTime + duration);
    } catch(e) {}
  }
  function beginGame() {
    state = newGame();
    save();
    render();
    showScreen("gameScreen");
    beep(540, .12);
  }
  function switchToHandoff(nextPlayer) {
    state.phase = "handoff";
    state.handoffTo = nextPlayer;
    save();
    $("handoffName").textContent = state.players[nextPlayer].name;
    showScreen("handoffScreen");
  }
  function continueHandoff() {
    state.phase = "playing";
    state.current = state.handoffTo;
    state.handoffTo = null;
    const player = state.players[state.current];
    player.maxEnergy = Math.min(5, player.maxEnergy + (state.current === 0 ? 0 : 0));
    // Increase energy once at the beginning of each player's new turn.
    player.maxEnergy = Math.min(5, Math.max(player.maxEnergy, state.round));
    player.energy = player.maxEnergy;
    drawCard(player, false);
    addLog(`بدأ دور ${player.name}. الطاقة ${player.energy}.`);
    save();
    render();
    showScreen("gameScreen");
    beep(500, .1);
  }
  function endTurn() {
    if (!state || state.phase !== "playing") return;
    const next = 1 - state.current;
    if (state.current === 1) state.round += 1;
    addLog(`${state.players[state.current].name} أنهى دوره.`);
    switchToHandoff(next);
  }
  function playCard(uid) {
    if (!state || state.phase !== "playing") return;
    const player = state.players[state.current], enemy = state.players[1-state.current];
    const index = player.hand.findIndex(c => c.uid === uid);
    if (index < 0) return;
    const card = player.hand[index];
    if (card.cost > player.energy) {
      showToast("طاقتك لا تكفي للعب هذه البطاقة.");
      beep(180,.1); return;
    }
    player.energy -= card.cost;
    player.hand.splice(index, 1);
    const effects = [];
    if (card.attack) {
      const blocked = Math.min(enemy.shield, card.attack);
      enemy.shield -= blocked;
      const damage = card.attack - blocked;
      enemy.health = Math.max(0, enemy.health - damage);
      effects.push(`ضرر ${damage}${blocked ? ` (امتص الدرع ${blocked})` : ""}`);
    }
    if (card.shield) { player.shield += card.shield; effects.push(`درع +${card.shield}`); }
    if (card.heal) {
      const actual = Math.min(card.heal, MAX_HEALTH-player.health);
      player.health += actual;
      effects.push(`صحة +${actual}`);
    }
    if (card.draw) {
      let drawn = 0;
      for(let i=0;i<card.draw;i++) if(drawCard(player,false)) drawn++;
      effects.push(`سحب ${drawn} بطاقة`);
    }
    addLog(`${player.name} لعب «${card.name}»: ${effects.join("، ") || "تم تفعيل القدرة"}.`);
    beep(card.attack ? 230 : card.heal ? 650 : 480, .12);
    if (enemy.health <= 0) {
      state.phase = "finished"; state.winner = state.current;
      addLog(`انتهت المبارزة بفوز ${player.name}!`);
      save(); render(); showResult(); return;
    }
    save(); render();
  }
  function showResult() {
    const winner = state.players[state.winner];
    $("resultTitle").textContent = `انتصار ${winner.name}!`;
    $("resultText").textContent = `حسمت المبارزة وبقيت صحة الفائز ${winner.health} نقطة.`;
    $("resultRounds").textContent = state.round;
    $("resultWinner").textContent = winner.name;
    showScreen("resultScreen");
    beep(740,.22);
  }
  function escapeHTML(str) {
    return String(str).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  function cardMarkup(card, player) {
    const canPlay = state.phase === "playing" && player === state.current && card.cost <= state.players[player].energy;
    const statParts = [];
    if(card.attack) statParts.push(`<span class="stat-atk">⚔ ${card.attack}</span>`);
    if(card.shield) statParts.push(`<span class="stat-def">⬟ ${card.shield}</span>`);
    if(card.heal) statParts.push(`<span class="stat-special">✚ ${card.heal}</span>`);
    if(card.draw) statParts.push(`<span class="stat-special">▤ +${card.draw}</span>`);
    return `<button class="game-card" data-card="${escapeHTML(card.uid)}" style="--card-glow:${card.glow}" ${canPlay ? "" : "disabled"} aria-label="العب بطاقة ${escapeHTML(card.name)}">
      <div class="card-top"><span class="card-cost">${card.cost}</span><span class="card-type">${escapeHTML(card.type)}</span></div>
      <div class="card-art">${card.icon}</div><h3>${escapeHTML(card.name)}</h3><div class="card-desc">${escapeHTML(card.desc)}</div>
      <div class="card-stats">${statParts.join("") || '<span class="stat-special">قدرة خاصة</span>'}</div></button>`;
  }
  function render() {
    if (!state) return;
    const p1 = state.players[0], p2 = state.players[1], active = state.players[state.current];
    $("roundLabel").textContent = `الجولة ${state.round}`;
    setPlayerUI(1,p1); setPlayerUI(2,p2);
    $("playerHand").innerHTML = active.hand.map(c => cardMarkup(c,state.current)).join("");
    $("playerHand").querySelectorAll("[data-card]").forEach(btn => btn.addEventListener("click", () => playCard(btn.dataset.card)));
    $("opponentHand").innerHTML = Array.from({length:Math.min(8,p2.hand.length)},()=>'<span class="mini-back"></span>').join("");
    $("p1Turn").classList.toggle("hidden",state.current!==0);
    $("p2Turn").classList.toggle("hidden",state.current!==1);
    $("p1Status").textContent = state.current===0 ? "دورك الحالي" : "انتظر حتى ينتهي الخصم";
    $("p2Status").textContent = state.current===1 ? "دورك الحالي" : "ينتظر دوره";
    $("turnInfoTitle").textContent = `دور ${active.name}`;
    $("turnInfoText").textContent = `لديك ${active.energy} من الطاقة. العب أوراقك أو أنهِ دورك.`;
    $("endTurnBtn").disabled = state.phase !== "playing";
    $("logEntries").innerHTML = state.logs.slice(-5).map(m=>`<p>${escapeHTML(m)}</p>`).join("");
  }
  function setPlayerUI(n,p) {
    $(`p${n}HealthText`).textContent = `${p.health} / ${MAX_HEALTH}` + (p.shield ? ` · درع ${p.shield}` : "");
    $(`p${n}HealthBar`).style.width = `${Math.max(0,p.health/MAX_HEALTH*100)}%`;
    $(`p${n}Energy`).textContent = `${p.energy}/${p.maxEnergy}`;
    if(n===1) $("p1HandCount").textContent = p.hand.length;
    if(n===2) $("p2DeckCount").textContent = p.deck.length + p.hand.length;
  }

  $("startBtn").addEventListener("click", beginGame);
  $("rulesBtn").addEventListener("click",()=> $("rulesModal").classList.remove("hidden"));
  $("closeRulesBtn").addEventListener("click",()=> $("rulesModal").classList.add("hidden"));
  $("rulesOkBtn").addEventListener("click",()=> { $("rulesModal").classList.add("hidden"); beginGame(); });
  $("continueBtn").addEventListener("click",continueHandoff);
  $("endTurnBtn").addEventListener("click",endTurn);
  $("restartBtn").addEventListener("click",()=>{ if(confirm("هل تريد بدء مباراة جديدة؟ ستفقد نتيجة المباراة الحالية.")) beginGame(); });
  $("backHomeBtn").addEventListener("click",()=>{ save(); showScreen("homeScreen"); });
  $("playAgainBtn").addEventListener("click",beginGame);
  $("resultHomeBtn").addEventListener("click",()=>showScreen("homeScreen"));
  $("soundToggle").addEventListener("click",()=>{
    soundEnabled=!soundEnabled;
    $("soundToggle").textContent=soundEnabled?"♫":"♩";
    $("soundToggle").style.color=soundEnabled?"var(--gold)":"";
    if(soundEnabled) beep(560,.1);
  });
  $("rulesModal").addEventListener("click",e=>{if(e.target===$("rulesModal")) $("rulesModal").classList.add("hidden");});
  window.addEventListener("beforeunload",save);

  state = load();
  if (state && state.phase === "playing") {
    render(); showScreen("gameScreen");
  } else if (state && state.phase === "handoff") {
    $("handoffName").textContent = state.players[state.handoffTo]?.name || "اللاعب التالي";
    showScreen("handoffScreen");
  } else if (state && state.phase === "finished") {
    showResult();
  } else {
    showScreen("homeScreen");
  }
})();