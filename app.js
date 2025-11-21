// Estado principal
const state = {
  players: 4,
  comodinOros: false,
  myHand: [], // [{suit, rank}]
  tableCard: null,
  seen: new Set(), // códigos "O-5" de cartas vistas (descartadas o en mesa o tomadas de mesa)
  discarded: [], // historial de descartes [{by:'E|N|O|S', card, t}]
  rivals: {
    E: { picks: [], discards: [], knownHand: [] },
    N: { picks: [], discards: [], knownHand: [] },
    O: { picks: [], discards: [], knownHand: [] },
  },
  startSeat: 1, // 1=S,2=E,3=N,4=O
  turnSeat: null,
  roundStarted: false,
  drawPileCount: null,
  // Estado de flujo
  awaitingRivalDiscard: null, // 'E' | 'N' | 'O' cuando esperamos su descarte
  awaitingMyHiddenDraw: false,
  // Sistema de reciclaje del mazo
  discardSequence: [], // Orden exacto de descartes [{card, by}] para reciclar
  recycledDeck: [], // Mazo reciclado con secuencia conocida [{card}]
  recycledIndex: 0, // Índice actual en recycledDeck
};

// Utilidades de cartas
const SUITS = ["oros", "copas", "espadas", "bastos"];
// Símbolos más neutros para palos españoles (evitar confusiones de corazones/diamantes)
const SUIT_SYMBOL = { oros: "O", copas: "C", espadas: "E", bastos: "B" };
const SUIT_CLASS = { oros: "oros", copas: "copas", espadas: "espadas", bastos: "bastos" };
// Ranks de baraja española a 40 cartas (sin 8,9): 1-7, 10,11,12
const RANKS = [1,2,3,4,5,6,7,10,11,12];

function cardCode(card) { return `${card.suit[0].toUpperCase()}-${card.rank}`; }
function parseCode(code) {
  const [s, r] = code.split("-");
  const suit = { O: "oros", C: "copas", E: "espadas", B: "bastos" }[s];
  return { suit, rank: Number(r) };
}

// Helpers de mano
function getMyHand() { return state.myHand.filter(Boolean); }
function compactHand() { state.myHand = state.myHand.filter(Boolean); }

function rankLabel(r) {
  if (r === 10) return "S"; // Sota
  if (r === 11) return "C"; // Caballo
  if (r === 12) return "R"; // Rey
  return String(r);
}
function rankName(r) {
  if (r === 10) return 'sota';
  if (r === 11) return 'caballo';
  if (r === 12) return 'rey';
  return String(r);
}
function cardName(card) {
  if (!card) return '';
  return `${rankName(card.rank)} de ${card.suit}`;
}
function cardNameWithArticle(card) {
  if (!card) return '';
  return `el ${cardName(card)}`;
}

// Valor en puntos de una carta según reglas del Chinchón
function cardValue(card) {
  if (!card) return 0;
  // Figuras (Sota=10, Caballo=11, Rey=12) valen 10 puntos
  if (card.rank >= 10) return 10;
  // Resto: valor nominal
  return card.rank;
}

// SVG de palos (colorean con currentColor vía CSS de .suit)
function suitSVG(suit) {
  // Tamaño 24x24, stroke ninguno, fill currentColor
  if (suit === 'oros') {
    return '<svg viewBox="0 0 24 24" aria-label="Oros" role="img"><polygon fill="currentColor" points="12,2 22,12 12,22 2,12"/></svg>';
  }
  if (suit === 'copas') {
    // Copa: bowl + tallo + base
    return '<svg viewBox="0 0 24 24" aria-label="Copas" role="img"><path fill="currentColor" d="M5 6c0 4.5 3.8 7 7 7s7-2.5 7-7H5z"/><rect fill="currentColor" x="11" y="13" width="2" height="5"/><rect fill="currentColor" x="8" y="18" width="8" height="2" rx="1"/></svg>';
  }
  if (suit === 'espadas') {
    // Espada simple vertical
    return '<svg viewBox="0 0 24 24" aria-label="Espadas" role="img"><polygon fill="currentColor" points="12,2 15,6 9,6"/><rect fill="currentColor" x="11" y="6" width="2" height="11"/><rect fill="currentColor" x="8" y="12" width="8" height="2" rx="1"/><rect fill="currentColor" x="10" y="17" width="4" height="4" rx="1"/></svg>';
  }
  if (suit === 'bastos') {
    // Basto: cabeza redondeada + palo
    return '<svg viewBox="0 0 24 24" aria-label="Bastos" role="img"><circle fill="currentColor" cx="16.5" cy="6.5" r="3.5"/><rect fill="currentColor" x="6" y="10" width="4" height="10" rx="2" transform="rotate(-25 8 15)"/></svg>';
  }
  return '';
}

function makeDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

function unseenCards() {
  const deck = makeDeck();
  const seen = new Set(state.seen);
  // Marca mi mano y carta en mesa como vistas
  for (const c of getMyHand()) seen.add(cardCode(c));
  if (state.tableCard) seen.add(cardCode(state.tableCard));
  // Rivales: cartas cogidas de mesa son vistas; cogidas ocultas no se pueden marcar
  for (const k of ["E","N","O"]) {
    for (const p of state.rivals[k].picks) {
      if (p.type === "mesa") seen.add(cardCode(p.card));
    }
  }
  return deck.filter(c => !seen.has(cardCode(c)));
}

// Render de carta
function renderCard(card, { removable = false, badge = "" } = {}) {
  const el = document.createElement("div");
  el.className = "card" + (removable ? " removable" : "");
  el.dataset.suit = card.suit;
  el.title = `${card.suit} ${card.rank}`;
  if (badge) {
    const b = document.createElement("div");
    b.className = "badge";
    b.textContent = badge;
    el.appendChild(b);
  }
  const rank = document.createElement("div");
  rank.className = "rank";
  rank.textContent = rankLabel(card.rank);
  const suit = document.createElement("div");
  suit.className = `suit ${SUIT_CLASS[card.suit]}`;
  suit.innerHTML = suitSVG(card.suit) || SUIT_SYMBOL[card.suit];
  const corner = document.createElement("div");
  corner.className = "corner";
  corner.textContent = `${card.rank}`;
  el.append(rank, suit, corner);
  return el;
}

function refreshUI() {
  const board = document.querySelector('.board');
  board.classList.toggle('three-players', state.players === 3);
  // Reordenar mano al inicio de mi turno para mostrar grupos
  if (state.turnSeat === 1 && getMyHand().length === 7) {
    reorderMyHandForDisplay();
  }
  const handBox = document.getElementById("myHand");
  handBox.innerHTML = "";
  const isInitialSetup = !state.roundStarted && getMyHand().length < 7;
  for (let i = 0; i < 7; i++) {
    const c = state.myHand[i];
    if (c) {
      const cardEl = renderCard(c);
      cardEl.addEventListener("click", () => {
        const choices = availableHandChoices(i);
        openPicker(newC => { state.myHand[i] = newC; refreshUI(); }, choices, isInitialSetup);
      });
      handBox.appendChild(cardEl);
    } else {
      const ph = document.createElement('div');
      ph.className = 'card placeholder';
      ph.title = 'Seleccionar carta';
      ph.addEventListener('click', () => {
        const choices = availableHandChoices(i);
        openPicker(newC => {
          // Evitar duplicar más de 7 cartas
          const firstEmpty = state.myHand.findIndex(x => !x);
          if (firstEmpty === -1) state.myHand.push(newC); else state.myHand[i] = newC;
          refreshUI();
          // Si completamos 7 cartas en setup inicial, cerrar diálogo
          if (isInitialSetup && getMyHand().length === 7) {
            const dlg = document.getElementById('cardPicker');
            if (dlg && dlg.open) dlg.close();
          }
        }, choices, isInitialSetup);
      });
      handBox.appendChild(ph);
    }
  }

  // Render mazo (drawPile) como una carta boca abajo
  const drawPile = document.getElementById('drawPile');
  if (drawPile) {
    drawPile.innerHTML = '';
    const back = document.createElement('div');
    back.className = 'card back';
    drawPile.appendChild(back);
  }
  // Render descarte (discardPile)
  const discardPile = document.getElementById('discardPile');
  if (discardPile) {
    discardPile.innerHTML = '';
    if (state.tableCard) {
      discardPile.appendChild(renderCard(state.tableCard, { badge: 'MESA' }));
    } else {
      const ph = document.createElement('div');
      ph.className = 'card placeholder';
      ph.title = 'Sin carta de descarte';
      discardPile.appendChild(ph);
    }
  }

  // Render enemigos: manos ocultas + conocidas
  renderEnemyHand('E');
  renderEnemyHand('N');
  renderEnemyHand('O');

  updateTurnIndicator();

  // Mostrar/ocultar asientos según nº jugadores
  document.getElementById('seat-N').style.display = (state.players === 2 || state.players === 4) ? '' : 'none';
  // Para 2 jugadores: activo N; para 3 jugadores: activos E y O; para 4: todos
  document.getElementById('seat-E').style.display = (state.players >= 3) ? '' : 'none';
  document.getElementById('seat-W').style.display = (state.players >= 3) ? '' : 'none';

  // Estado de turno
  const seatName = seatLabel(state.turnSeat);
  document.getElementById('turnStatus').textContent = `Turno: ${seatName ? seatName : '-'}`;
  const helper = document.getElementById('helperStatus');
  if (state.awaitingRivalDiscard) helper.textContent = `Selecciona el descarte de ${state.awaitingRivalDiscard} haciendo clic en su mano (carta oculta).`;
  else helper.textContent = '';

  // Render controles de rival junto a su asiento
  renderRivalSeatControls();

  // Botón de inicio/final de ronda
  const startBtn = document.getElementById('startRoundBtn');
  if (startBtn) {
    if (!state.roundStarted) {
      startBtn.textContent = 'Iniciar ronda';
      const ready = getMyHand().length === 7 && !!state.tableCard && !!state.startSeat;
      startBtn.disabled = !ready;
    } else {
      startBtn.textContent = 'Finalizar ronda';
      startBtn.disabled = false;
    }
  }

  // Contador de mazo
  const dc = document.getElementById('drawCount');
  if (dc) {
    dc.textContent = state.roundStarted && typeof state.drawPileCount === 'number' ? String(state.drawPileCount) : '-';
  }
}

function seatLabel(seat) {
  if (!seat) return null;
  const map = {1:'1 · Sur (Yo)',2:'2 · Este',3:'3 · Norte',4:'4 · Oeste'};
  return map[seat];
}

function activeSeats() {
  if (state.players === 2) return [1,3];
  if (state.players === 3) return [1,2,4];
  return [1,2,3,4];
}

function nextSeat(seat) {
  const act = activeSeats();
  const i = act.indexOf(seat);
  return act[(i + 1) % act.length];
}

function renderEnemyHand(key) {
  const wrap = document.querySelector(`.enemy-hand[data-seat="${key}"]`);
  if (!wrap) return;
  wrap.innerHTML = '';
  const known = state.rivals[key].knownHand || [];
  const backCount = Math.max(0, 7 - known.length);
  for (let i=0; i<backCount; i++) {
    const back = document.createElement('div');
    back.className = 'card back';
    if (state.awaitingRivalDiscard === key) {
      back.classList.add('removable');
      back.title = 'Clic para elegir qué descarta';
      back.onclick = () => {
        const choices = possibleRivalDiscard(key);
        openPicker(c => { rivalDiscard(key, c); state.awaitingRivalDiscard = null; advanceTurn(); refreshUI(); }, choices);
      };
    }
    wrap.appendChild(back);
  }
  known.forEach(c => wrap.appendChild(renderCard(c, { badge: '✔' })));
}

function possibleRivalDiscard(key) {
  // Si robó del mazo reciclado, sabemos exactamente qué carta tiene
  const lastPick = state.rivals[key].picks[state.rivals[key].picks.length - 1];
  if (lastPick && lastPick.type === 'oculta' && lastPick.card) {
    // Puede descartar: la carta que robó + sus cartas conocidas + cartas no vistas
    const choices = new Map();
    choices.set(cardCode(lastPick.card), lastPick.card);
    const known = state.rivals[key].knownHand || [];
    known.forEach(c => choices.set(cardCode(c), c));
    const unseen = unseenCards();
    unseen.forEach(c => choices.set(cardCode(c), c));
    if (state.tableCard) choices.delete(cardCode(state.tableCard));
    return [...choices.values()];
  }
  
  // Lógica original: cartas no vistas + cartas conocidas del rival
  const unseen = unseenCards();
  const known = state.rivals[key].knownHand || [];
  const map = new Map();
  unseen.forEach(c => map.set(cardCode(c), c));
  known.forEach(c => map.set(cardCode(c), c));
  if (state.tableCard) map.delete(cardCode(state.tableCard));
  return [...map.values()];
}

// Diálogo de selección de carta
function openPicker(onPick, cardsList, keepOpen = false) {
  const dlg = document.getElementById("cardPicker");
  const grid = document.getElementById("pickerGrid");
  grid.innerHTML = "";
  const list = cardsList && cardsList.length ? cardsList : makeDeck();
  for (const c of list) {
    const el = renderCard(c);
    el.addEventListener("click", () => {
      onPick(c);
      if (!keepOpen) dlg.close();
    });
    grid.appendChild(el);
  }
  if (!dlg.open) dlg.showModal();
}

// Heurística de evaluación
function evaluateHand(cards, { comodinOros }) {
  // Devuelve: { score, groupedCount, canClose6, canChinchon, bestGroups:{sets,runs}, leftovers, closeReady, wildcardUsedIn }
  const bySuit = new Map();
  const byRank = new Map();
  for (const c of cards) {
    const s = c.suit, r = c.rank;
    if (!bySuit.has(s)) bySuit.set(s, []);
    bySuit.get(s).push(r);
    if (!byRank.has(r)) byRank.set(r, []);
    byRank.get(r).push(s);
  }
  for (const s of bySuit.keys()) bySuit.get(s).sort((a,b)=>a-b);

  const sets = [];
  for (const [r, suits] of byRank) if (suits.length >= 3) sets.push({ type:'set', rank:r, size:suits.length });

  const runs = [];
  const hasComodin = comodinOros && cards.some(c => c.suit==='oros' && c.rank===1);
  for (const [s, ranks] of bySuit) {
    // Corridas normales
    let start=0;
    for (let i=1;i<=ranks.length;i++) {
      if (i===ranks.length || ranks[i] !== ranks[i-1]+1) {
        const len = i - start;
        if (len>=3) runs.push({ type:'run', suit:s, from:ranks[start], to:ranks[i-1], size:len, wildcard:false });
        start = i;
      }
    }
    if (!hasComodin) continue;
    // Intentos con comodín: un hueco único o extensión por extremos
    const arr = ranks.slice();
    for (let i=0;i<arr.length;i++) {
      for (let j=i;j<arr.length;j++) {
        const slice = arr.slice(i,j+1);
        const min = slice[0], max = slice[slice.length-1];
        const span = max - min + 1;
        const missing = span - slice.length;
        if (missing === 1 && span >=3) {
          let missingRank=null; for (let r=min;r<=max;r++) if (!slice.includes(r)) missingRank=r;
          if (missingRank && missingRank!==8 && missingRank!==9) runs.push({ type:'run', suit:s, from:min, to:max, size:span, wildcard:true, missingRank });
        }
        if (slice.length>=2) {
          const down=min-1; const up=max+1;
          if (down>=1 && down!==8 && down!==9 && !slice.includes(down)) {
            const span2 = max - down + 1;
            if (span2>=3 && (span2 - slice.length) === 1) runs.push({ type:'run', suit:s, from:down, to:max, size:span2, wildcard:true, missingRank:down });
          }
          if (up<=12 && up!==8 && up!==9 && !slice.includes(up)) {
            const span3 = up - min + 1;
            if (span3>=3 && (span3 - slice.length) === 1) runs.push({ type:'run', suit:s, from:min, to:up, size:span3, wildcard:true, missingRank:up });
          }
        }
      }
    }
  }

  let covered=new Set();
  [...sets].sort((a,b)=>b.size-a.size).forEach(st => {
    for (const s of SUITS) {
      const code = `${s[0].toUpperCase()}-${st.rank}`;
      if (cards.find(c=>c.rank===st.rank && c.suit===s)) covered.add(code);
    }
  });
  let wildcardUsedIn=null;
  [...runs].sort((a,b)=>b.size-a.size).forEach(run => {
    for (let r=run.from;r<=run.to;r++) {
      const code = `${run.suit[0].toUpperCase()}-${r}`;
      if (cards.find(c=>c.suit===run.suit && c.rank===r)) {
        covered.add(code);
      } else if (hasComodin && run.wildcard && r===run.missingRank) {
        const comodinCard = cards.find(c=>c.suit==='oros' && c.rank===1);
        if (comodinCard) { covered.add(cardCode(comodinCard)); wildcardUsedIn={suit:run.suit, rank:r}; }
      }
    }
  });

  let groupedCount = [...covered].length + (hasComodin && !wildcardUsedIn ? 1 : 0);
  const canChinchon = groupedCount >= 7;
  const canClose6 = groupedCount >= 6;

  let adj=0, pairs=0, isolated=0;
  for (const [s, ranks] of bySuit) {
    const setRanks=new Set(ranks);
    for (const r of ranks) {
      let a=0; if (setRanks.has(r-1)) a++; if (setRanks.has(r+1)) a++; if (a===0) isolated++; adj+=a;
    }
  }
  for (const [r, suits] of byRank) if (suits.length===2) pairs++;
  const centrality = cards.reduce((acc,c)=>acc+(c.rank>=4 && c.rank<=6 ?1:0),0);
  const score = 1000*groupedCount + 30*adj + 40*pairs + 10*centrality - 25*isolated;
  const leftovers = cards.filter(c => !covered.has(cardCode(c)));
  const closeReady = canClose6 && leftovers.length===1 && leftovers[0].rank<=3;
  return { score, groupedCount, canClose6, canChinchon, bestGroups:{ sets, runs }, leftovers, closeReady, wildcardUsedIn };
}

function simulateBestDiscard(afterDrawCards, options) {
  // Devuelve la mejor carta a descartar y la evaluación resultante
  let best = { discard: null, eval: null };
  for (let i = 0; i < afterDrawCards.length; i++) {
    const trial = afterDrawCards.slice();
    const [discard] = trial.splice(i,1);
    const ev = evaluateHand(trial, options);
    // Penalización si descartarías carta suelta >3 cuando puedes cerrar con regla especial
    let penalty = 0;
    if (ev.canClose6) {
      // Queremos que el RESULTADO tras descartar deje exactamente 1 carta suelta <=3.
      // ev.leftovers es el conjunto suelto tras la jugada.
      const lows = ev.leftovers.filter(c => c.rank <= 3);
      if (ev.leftovers.length === 1 && lows.length === 1) {
        // Estado óptimo de cierre: leftover es baja. Penaliza si descartamos precisamente esa baja.
        if (discard.rank <=3) penalty += 50; else penalty -= 20;
      } else {
        // Aún no logrado cierre perfecto: incentivar descartar carta alta no usada.
        penalty += discard.rank <=3 ? 10 : -10;
      }
    }
    // Bonus muy fuerte si la jugada deja cierre inmediato (closeReady)
    if (ev.closeReady) penalty -= 300; // incrementa score efectivo
    // Penalizar si la carta puede habilitar a un rival por señales simples
    penalty += rivalHeatPenalty(discard);
    const total = ev.score - penalty;
    
    // Desempate: si el score es igual, preferir descartar carta de mayor VALOR (figuras=10, resto=nominal)
    const discardValue = cardValue(discard);
    const bestValue = best.discard ? cardValue(best.discard) : 0;
    if (!best.eval || total > best.eval.score || (total === best.eval.score && discardValue > bestValue)) {
      best = { discard, eval: { ...ev, score: total } };
    }
  }
  return best;
}

function rivalHeatPenalty(card) {
  // Heurística muy simple: si un rival ha cogido de mesa una carta adyacente misma suit o misma rank, no regales el conector
  let heat = 0;
  for (const k of ["E","N","O"]) {
    for (const p of state.rivals[k].picks) {
      if (p.type !== "mesa" || !p.card) continue;
      if (p.card.suit === card.suit && Math.abs(p.card.rank - card.rank) === 1) heat += 8; // conector de escalera
      if (p.card.rank === card.rank) heat += 10; // set del mismo número
    }
  }
  return heat; // cuanto mayor, peor descartar
}

function recommendPlay() {
  const options = { comodinOros: state.comodinOros };
  const explainLines = [];
  const hand = getMyHand();
  if (hand.length !== 7) {
    setRecommendation("Añade exactamente 7 cartas a tu mano.");
    return;
  }

  // Caso A: carta en mesa disponible
  let mesaResult = null;
  if (state.tableCard) {
    const after = hand.concat([state.tableCard]);
    mesaResult = simulateBestDiscard(after, options);
    explainLines.push(`Tomar ${cardNameWithArticle(state.tableCard)} → descartar ${cardNameWithArticle(mesaResult.discard)} (score ${mesaResult.eval.score})`);
  } else {
    explainLines.push("No hay carta en mesa marcada.");
  }

  // Caso B: robar oculta - expectativa sobre cartas no vistas
  const unseen = unseenCards();
  let evSum = 0;
  let bestHidden = null;
  const sample = unseen.slice(0, Math.min(unseen.length, 60)); // limitar para rendimiento
  for (const draw of sample) {
    const after = hand.concat([draw]);
    const res = simulateBestDiscard(after, options);
    if (!bestHidden || res.eval.score > bestHidden.eval.score) bestHidden = { draw, ...res };
    evSum += res.eval.score;
  }
  const evHidden = sample.length ? evSum / sample.length : -Infinity;
  explainLines.push(`Robar oculta (EV aprox): score medio ${evHidden.toFixed(1)}; mejor caso ${bestHidden ? cardName(bestHidden.draw) : '-'} → descartar ${bestHidden ? cardName(bestHidden.discard) : '-'}`);

  // Comparar
  let decisionText = "";
  // Prioridad absoluta: si tomar de mesa habilita cierre inmediato, elegirla
  if (mesaResult && mesaResult.eval.closeReady) {
    decisionText = `Toma ${cardNameWithArticle(state.tableCard)} para cerrar inmediatamente (descarta ${cardNameWithArticle(mesaResult.discard)}).`;
  } else if (mesaResult && mesaResult.eval.score >= evHidden) {
    decisionText = `Toma ${cardNameWithArticle(state.tableCard)} y descarta ${cardNameWithArticle(mesaResult.discard)}.`;
  } else {
    decisionText = `Roba del mazo oculto. Tras verla, considera descartar ${bestHidden ? cardNameWithArticle(bestHidden.discard) : 'la peor carta'}.`;
  }

  const evalCurrent = evaluateHand(hand, options);
  if (evalCurrent.closeReady) {
    decisionText = `Puedes cerrar ahora: grupos listos y sobra ${cardNameWithArticle(evalCurrent.leftovers[0])}.`;
  } else if (evalCurrent.canClose6) {
    decisionText += " Puedes cerrar si tras el movimiento te quedas con solo 1 suelta ≤3.";
  }
  if (evalCurrent.canChinchon) decisionText += " ¡Chinchón posible!";
  setRecommendation(decisionText, explainLines.join("<br>"));
  
  // Añadir botones de acción
  const box = document.getElementById('recommendation');
  if (box && state.roundStarted && state.turnSeat === 1) {
    const br = document.createElement('br');
    box.appendChild(br);
    
    if (evalCurrent.closeReady) {
      const btnClose = document.createElement('button');
      btnClose.className = 'btn btn-primary';
      btnClose.textContent = 'Cerrar ahora';
      btnClose.onclick = () => finalizeRoundWithClose(evalCurrent);
      box.appendChild(btnClose);
    } else {
      // Botones para ejecutar la recomendación
      if (mesaResult && mesaResult.eval.score >= evHidden) {
        const btnMesa = document.createElement('button');
        btnMesa.className = 'btn btn-primary';
        btnMesa.textContent = 'Tomar de mesa';
        btnMesa.onclick = () => {
          state.myHand.push(state.tableCard);
          compactHand();
          state.tableCard = null;
          discardFromMyHand(mesaResult.discard);
          advanceTurn();
          refreshUI();
        };
        box.appendChild(btnMesa);
      } else {
        const btnOculta = document.createElement('button');
        btnOculta.className = 'btn btn-primary';
        btnOculta.textContent = 'Robar oculta';
        btnOculta.onclick = () => {
          // Verificar si necesitamos reciclar el mazo
          if (state.drawPileCount === 0 && state.recycledDeck.length === 0) {
            recycleDeck();
          }
          
          // Si hay mazo reciclado, sabemos exactamente qué carta vamos a robar
          const drawnCard = getNextRecycledCard();
          
          if (drawnCard) {
            // Mazo reciclado: sabemos la carta exacta
            state.myHand.push(drawnCard);
            compactHand();
            const best = simulateBestDiscard(getMyHand(), { comodinOros: state.comodinOros });
            discardFromMyHand(best.discard);
            if (state.roundStarted && typeof state.drawPileCount === 'number') {
              state.drawPileCount = Math.max(0, state.drawPileCount - 1);
            }
            advanceTurn();
            refreshUI();
          } else {
            // Mazo normal: elegir de cartas no vistas
            const choices = unseenCards();
            openPicker(c => {
              state.myHand.push(c);
              compactHand();
              const best = simulateBestDiscard(getMyHand(), { comodinOros: state.comodinOros });
              discardFromMyHand(best.discard);
              if (state.roundStarted && typeof state.drawPileCount === 'number') {
                state.drawPileCount = Math.max(0, state.drawPileCount - 1);
              }
              advanceTurn();
              refreshUI();
            }, choices);
          }
        };
        box.appendChild(btnOculta);
      }
      
      // Botón alternativo
      const btnAlt = document.createElement('button');
      btnAlt.className = 'btn';
      btnAlt.textContent = 'Otra acción';
      btnAlt.onclick = () => showManualActionChoices(box, hand);
      box.appendChild(btnAlt);
    }
  }
}

function setRecommendation(main, explain = "") {
  document.getElementById("recommendation").innerHTML = main;
  document.getElementById("explainBox").innerHTML = explain;
}

function finalizeRoundWithClose(ev) {
  state.roundStarted=false;
  state.turnSeat=null;
  state.awaitingRivalDiscard=null;
  state.awaitingMyHiddenDraw=false;
  state.drawPileCount=null;
  state.discardSequence = [];
  state.recycledDeck = [];
  state.recycledIndex = 0;
  setRecommendation(`Ronda cerrada. Sobra ${cardNameWithArticle(ev.leftovers[0])}.`, 'Cierre con grupos detectados.');
  refreshUI();
}

// Eventos UI
function init() {
  // Nº jugadores
  document.getElementById("playersSelect").addEventListener("change", e => {
    state.players = Number(e.target.value);
    const act = activeSeats();
    if (!act.includes(state.startSeat)) state.startSeat = act[0];
    updateStartSeatOptions();
    refreshUI();
  });

  // Comodín 1 de oros
  document.getElementById("comodinCheckbox").addEventListener("change", e => {
    state.comodinOros = e.target.checked;
    refreshUI();
  });

  // Vaciar mi mano (junto a la mano)
  document.getElementById("resetHandBtnBottom").addEventListener("click", () => {
    state.myHand = [];
    refreshUI();
  });

  // Clic en MAZO (drawPile): seleccionar carta robada o descarte de rival
  const drawEl = document.getElementById('drawPile');
  if (drawEl) drawEl.addEventListener('click', () => {
    if (state.awaitingRivalDiscard) { return; }
    const seat = state.turnSeat;
    if (!seat) return;
    if (seat === 1) {
      // Verificar si necesitamos reciclar el mazo
      if (state.drawPileCount === 0 && state.recycledDeck.length === 0) {
        recycleDeck();
      }
      
      // Si hay mazo reciclado, sabemos exactamente qué carta vamos a robar
      const drawnCard = getNextRecycledCard();
      
      if (drawnCard) {
        // Mazo reciclado: sabemos la carta exacta
        state.myHand.push(drawnCard); compactHand();
        const best = simulateBestDiscard(getMyHand(), { comodinOros: state.comodinOros });
        discardFromMyHand(best.discard);
        if (state.roundStarted && typeof state.drawPileCount === 'number') {
          state.drawPileCount = Math.max(0, state.drawPileCount - 1);
        }
        advanceTurn(); refreshUI();
      } else {
        // Mazo normal: elegir de cartas no vistas
        const choices = unseenCards();
        openPicker(c => {
          state.myHand.push(c); compactHand();
          const best = simulateBestDiscard(getMyHand(), { comodinOros: state.comodinOros });
          discardFromMyHand(best.discard);
          if (state.roundStarted && typeof state.drawPileCount === 'number') {
            state.drawPileCount = Math.max(0, state.drawPileCount - 1);
          }
          advanceTurn(); refreshUI();
        }, choices);
      }
    } else {
      // Turno rival: marcar que ha robado oculta y pedir su descarte
      const key = seatToKey(seat);
      onRivalDrawHidden(key);
    }
  });

  // Clic en DESCARTE (discardPile): tomar la carta visible por quien esté en turno o fijar carta inicial
  const disEl = document.getElementById('discardPile');
  if (disEl) disEl.addEventListener('click', () => {
    const seat = state.turnSeat;
    if (!state.roundStarted) {
      // Permitir fijar carta de descarte inicial antes de iniciar la ronda
        const choices = availableInitialDiscardChoices();
        openPicker(c => { state.tableCard = c; state.seen.add(cardCode(c)); refreshUI(); }, choices);
      return;
    }
    if (!state.tableCard) return; // nada para tomar
    if (seat === 1) {
      // Yo tomo de mesa y descarto automático
      const best = simulateBestDiscard(getMyHand().concat([state.tableCard]), { comodinOros: state.comodinOros });
      applyPlayerTakeFromTableAuto(best.discard);
      refreshUI();
    } else {
      const key = seatToKey(seat);
      onRivalTakeFromTable(key); // esto pone awaitingRivalDiscard
      refreshUI();
    }
  });

  // Controles de ronda
  document.getElementById('startSeatSelect').addEventListener('change', e => {
    state.startSeat = Number(e.target.value);
  });
  document.getElementById('startRoundBtn').addEventListener('click', () => {
    if (!state.roundStarted) {
      // Validar prerrequisitos
      if (getMyHand().length !== 7 || !state.tableCard) return;
      state.roundStarted = true;
      state.turnSeat = state.startSeat;
      // Inicializar contador de mazo: 40 - (7*jugadores) - 1 (descarte)
      state.drawPileCount = Math.max(0, 40 - (7 * state.players) - 1);
    } else {
      // Finalizar ronda (soft reset de turnos/flags)
      state.roundStarted = false;
      state.turnSeat = null;
      state.awaitingRivalDiscard = null;
      state.awaitingMyHiddenDraw = false;
      state.drawPileCount = null;
      state.discardSequence = [];
      state.recycledDeck = [];
      state.recycledIndex = 0;
    }
    refreshUI();
  });
  document.getElementById('resetRoundBtn').addEventListener('click', () => {
    state.turnSeat = null;
    state.tableCard = null;
    state.myHand = [];
    for (const k of ['E','N','O']) {
      state.rivals[k] = { picks: [], discards: [], knownHand: [] };
    }
    state.seen = new Set();
    state.awaitingRivalDiscard = null;
    state.awaitingMyHiddenDraw = false;
    state.roundStarted = false;
    state.drawPileCount = null;
    state.discardSequence = [];
    state.recycledDeck = [];
    state.recycledIndex = 0;
    refreshUI();
  });

  // Botón de análisis manual
  const btn = document.getElementById("recommendBtn");
  if (btn) btn.addEventListener("click", recommendPlay);

  refreshUI();
}

function updateStartSeatOptions() {
  const sel = document.getElementById('startSeatSelect');
  if (!sel) return;
  const seats = activeSeats();
  sel.innerHTML = '';
  const labels = {1:'1 (Sur Yo)',2:'2 (Este)',3:'3 (Norte)',4:'4 (Oeste)'};
  seats.forEach(s => {
    const opt = document.createElement('option');
    opt.value = String(s);
    opt.textContent = labels[s];
    sel.appendChild(opt);
  });
  if (!seats.includes(state.startSeat)) state.startSeat = seats[0];
  sel.value = String(state.startSeat);
}

document.addEventListener("DOMContentLoaded", init);

function updateTurnIndicator() {
  const map = {1:'S',2:'E',3:'N',4:'O'};
  for (const seatNum of [1,2,3,4]) {
    const key = map[seatNum];
    const el = document.getElementById(`seat-${key}`);
    if (!el) continue;
    el.classList.toggle('active-turn', state.turnSeat === seatNum && state.roundStarted);
    const label = el.querySelector('.seat-label');
    if (label) {
      label.textContent = label.textContent.replace(/^▶\s*/,'');
      if (state.turnSeat === seatNum && state.roundStarted) {
        label.textContent = '▶ ' + label.textContent.replace(/^▶\s*/,'');
      }
    }
  }
}

// Renderiza controles de rival junto a su asiento activo
function renderRivalSeatControls() {
  // Limpiar todos los contenedores
  for (const id of ['E','N','O']) {
    const el = document.getElementById(`seat-controls-${id}`);
    if (el) el.innerHTML = '';
  }
  if (!state.turnSeat || state.turnSeat === 1) return;
  const key = seatToKey(state.turnSeat);
  const host = document.getElementById(`seat-controls-${key}`);
  if (!host) return;
  const row = document.createElement('div'); row.className='controls-row';
  const btnMesa = document.createElement('button'); btnMesa.className='btn'; btnMesa.textContent='Rival toma de mesa'; btnMesa.disabled = !state.tableCard;
  btnMesa.onclick = () => { onRivalTakeFromTable(key); };
  const btnOculta = document.createElement('button'); btnOculta.className='btn'; btnOculta.textContent='Rival roba oculta';
  // Deshabilitar si no hay cartas para robar (ni mazo ni reciclado pendiente)
  const canDraw = state.drawPileCount > 0 || state.recycledDeck.length > 0 || state.discardSequence.length > 0;
  btnOculta.disabled = !canDraw;
  btnOculta.onclick = () => { onRivalDrawHidden(key); };
  row.append(btnMesa, btnOculta);
  host.appendChild(row);
}

function showManualActionChoices(box, hand) {
  // Limpiar zona de acciones y ofrecer menú manual
  const manualRow = document.createElement('div'); manualRow.className='controls-row';
  const info = document.createElement('div'); info.className='explain'; info.textContent='¿Qué haces? Elige la acción:';
  const btnMesa = document.createElement('button'); btnMesa.className='btn'; btnMesa.textContent='Tomar de mesa'; btnMesa.disabled = !state.tableCard;
  btnMesa.onclick = () => {
    if (!state.tableCard) return;
    const draw = state.tableCard;
    state.myHand.push(draw); compactHand();
    state.tableCard = null;
    // Elegir descarte manualmente
    openPicker(card => { discardFromMyHand(card); advanceTurn(); });
  };
  const btnOculta = document.createElement('button'); btnOculta.className='btn'; btnOculta.textContent='Robar oculta';
  btnOculta.onclick = () => beginPlayerHiddenFlow();
  manualRow.append(info, btnMesa, btnOculta);
  box.appendChild(manualRow);
}

// Reordenar mano: primero runs, luego sets, luego sobrantes
function reorderMyHandForDisplay() {
  const hand = getMyHand();
  if (hand.length !== 7) return; // sólo cuando mano completa
  const ev = evaluateHand(hand, { comodinOros: state.comodinOros });
  const used = new Set();
  const ordered = [];
  // Runs: ordenar por suit y from
  const runs = [...ev.bestGroups.runs].sort((a,b)=> a.suit.localeCompare(b.suit) || a.from - b.from);
  for (const run of runs) {
    for (let r = run.from; r <= run.to; r++) {
      let card = hand.find(c => c.suit===run.suit && c.rank===r && !used.has(cardCode(c)));
      if (!card && run.wildcard) {
        // Usar comodín para el hueco
        card = hand.find(c => c.suit==='oros' && c.rank===1 && !used.has(cardCode(c)));
      }
      if (card) { ordered.push(card); used.add(cardCode(card)); }
    }
  }
  // Sets: ordenar por tamaño desc y rank asc
  const sets = [...ev.bestGroups.sets].sort((a,b)=> b.size - a.size || a.rank - b.rank);
  for (const set of sets) {
    for (const card of hand.filter(c => c.rank===set.rank && !used.has(cardCode(c)))) {
      ordered.push(card); used.add(cardCode(card));
    }
  }
  // Sobrantes
  for (const card of hand) if (!used.has(cardCode(card))) ordered.push(card);
  if (ordered.length === hand.length) state.myHand = ordered; // asignar nueva ordenación
}

function seatToKey(seat) { return {2:'E',3:'N',4:'O'}[seat] || 'S'; }

// Función de reciclaje del mazo cuando se agota
function recycleDeck() {
  if (state.discardSequence.length === 0) return; // No hay nada para reciclar
  
  // La última carta descartada se queda boca arriba como nueva carta de mesa
  const lastDiscard = state.discardSequence[state.discardSequence.length - 1];
  state.tableCard = lastDiscard.card;
  
  // El resto de cartas se reciclan en el mismo orden (primera descartada = primera en salir)
  state.recycledDeck = [];
  for (let i = 0; i < state.discardSequence.length - 1; i++) {
    state.recycledDeck.push(state.discardSequence[i].card);
  }
  
  state.recycledIndex = 0;
  state.drawPileCount = state.recycledDeck.length;
}

// Obtiene la próxima carta del mazo reciclado
function getNextRecycledCard() {
  if (state.recycledIndex < state.recycledDeck.length) {
    return state.recycledDeck[state.recycledIndex++];
  }
  return null;
}

// Aplica automáticamente la toma de mesa y el descarte sugerido
function applyPlayerTakeFromTableAuto(discardCard) {
  if (!state.tableCard) return;
  const draw = state.tableCard;
  state.myHand.push(draw); compactHand();
  state.tableCard = null;
  discardFromMyHand(discardCard);
  advanceTurn();
}

// Inicia flujo de robo oculto directo
function beginPlayerHiddenFlow() {
  // Verificar si necesitamos reciclar el mazo
  if (state.drawPileCount === 0 && state.recycledDeck.length === 0) {
    recycleDeck();
  }
  
  // Si hay mazo reciclado, sabemos exactamente qué carta vamos a robar
  const drawnCard = getNextRecycledCard();
  
  if (drawnCard) {
    // Mazo reciclado: sabemos la carta exacta
    state.myHand.push(drawnCard);
    compactHand();
    openPicker(card => {
      discardFromMyHand(card);
      if (state.roundStarted && typeof state.drawPileCount === 'number') {
        state.drawPileCount = Math.max(0, state.drawPileCount - 1);
      }
      advanceTurn();
    });
  } else {
    // Mazo normal: elegir de cartas no vistas
    const choices = unseenCards();
    openPicker(c => {
      state.myHand.push(c);
      compactHand();
      openPicker(card => {
        discardFromMyHand(card);
        if (state.roundStarted && typeof state.drawPileCount === 'number') {
          state.drawPileCount = Math.max(0, state.drawPileCount - 1);
        }
        advanceTurn();
      });
    }, choices);
  }
}

function discardFromMyHand(card) {
  // remove one instance
  const i = state.myHand.findIndex(c => c && c.suit===card.suit && c.rank===card.rank);
  if (i>=0) state.myHand.splice(i,1);
  compactHand();
  state.tableCard = card; // va a mesa
  state.seen.add(cardCode(card));
  // Registrar en secuencia de descartes para reciclaje
  state.discardSequence.push({ card, by: 'S' });
}

function isCardUsed(card, skipIndex = -1) {
  const code = cardCode(card);
  // Mi mano (excepto índice actual si se edita)
  for (let i=0;i<state.myHand.length;i++) {
    if (i === skipIndex) continue;
    const c = state.myHand[i];
    if (c && cardCode(c) === code) return true;
  }
  // Carta en mesa
  if (state.tableCard && cardCode(state.tableCard) === code) return true;
  // Rivales conocidas
  for (const k of ['E','N','O']) {
    for (const c of state.rivals[k].knownHand) if (cardCode(c) === code) return true;
  }
  // Descartes históricos
  for (const d of state.discarded) if (cardCode(d.card) === code) return true;
  return false;
}

function availableHandChoices(skipIndex) {
  return makeDeck().filter(c => !isCardUsed(c, skipIndex));
}

function availableInitialDiscardChoices() {
  return makeDeck().filter(c => !isCardUsed(c));
}

function onRivalTakeFromTable(key) {
  if (!state.tableCard) return;
  const card = state.tableCard;
  state.rivals[key].picks.push({ type: 'mesa', card, t: Date.now() });
  state.rivals[key].knownHand.push(card);
  state.seen.add(cardCode(card));
  state.tableCard = null;
  state.awaitingRivalDiscard = key;
  refreshUI();
}

function onRivalDrawHidden(key) {
  // Verificar si necesitamos reciclar el mazo
  if (state.drawPileCount === 0 && state.recycledDeck.length === 0) {
    recycleDeck();
  }
  
  // Si hay mazo reciclado, sabemos exactamente qué carta robó
  const drawnCard = getNextRecycledCard();
  
  state.rivals[key].picks.push({ type: 'oculta', card: drawnCard, t: Date.now() });
  state.awaitingRivalDiscard = key;
  
  if (state.roundStarted && typeof state.drawPileCount === 'number') {
    state.drawPileCount = Math.max(0, state.drawPileCount - 1);
  }
  
  refreshUI();
}

function rivalDiscard(key, card) {
  // Verificar si sabemos qué carta robó en su último pick
  const lastPick = state.rivals[key].picks[state.rivals[key].picks.length - 1];
  if (lastPick && lastPick.type === 'oculta' && lastPick.card) {
    // Si robó del mazo reciclado y descarta otra carta diferente, sabemos que se quedó la robada
    const drawnCode = cardCode(lastPick.card);
    const discardCode = cardCode(card);
    if (drawnCode !== discardCode) {
      // Añadir la carta robada a su mano conocida si no está ya
      const alreadyKnown = state.rivals[key].knownHand.some(c => cardCode(c) === drawnCode);
      if (!alreadyKnown) {
        state.rivals[key].knownHand.push(lastPick.card);
      }
    }
  }
  
  state.rivals[key].discards.push({ card, t: Date.now() });
  state.seen.add(cardCode(card));
  // Si estaba en conocidas, remover
  const idx = state.rivals[key].knownHand.findIndex(c => c.suit===card.suit && c.rank===card.rank);
  if (idx>=0) state.rivals[key].knownHand.splice(idx,1);
  // La carta descartada pasa a mesa
  state.tableCard = card;
  // Registrar en secuencia de descartes para reciclaje
  state.discardSequence.push({ card, by: key });
  refreshUI();
}

function advanceTurn() {
  state.turnSeat = nextSeat(state.turnSeat);
  refreshUI();
  // Si es mi turno y la ronda está activa, aconsejar automáticamente
  if (state.roundStarted && state.turnSeat === 1 && getMyHand().length === 7) {
    recommendPlay();
  }
}
