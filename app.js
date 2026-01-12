// Dynamisches Bracket für beliebig viele Teams (nächste Potenz von 2)
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const addTeamBtn = document.getElementById('addTeamBtn');
const clearTeamsBtn = document.getElementById('clearTeamsBtn');
const teamNameInput = document.getElementById('teamNameInput');
const teamListEl = document.getElementById('teamList');
const bracketEl = document.getElementById('bracket');

let teams = [];
let state = null; // { rounds: [ [ [a,b], ... ], ... ], winners: {"r-m": name} }

function renderTeamList(){
  teamListEl.innerHTML = '';
  teams.forEach((t, i)=>{
    const pill = document.createElement('div');
    pill.className = 'team-pill';
    const span = document.createElement('span');
    span.textContent = t;
    const remove = document.createElement('button');
    remove.className = 'remove-btn';
    remove.textContent = '✕';
    remove.title = 'Entfernen';
    remove.addEventListener('click', ()=>{ teams.splice(i,1); renderTeamList(); });
    pill.appendChild(span);
    pill.appendChild(remove);
    teamListEl.appendChild(pill);
  });
}

function addTeam(name){
  const n = name && name.trim() ? name.trim() : `Team ${teams.length+1}`;
  teams.push(n);
  renderTeamList();
}

addTeamBtn.addEventListener('click', ()=>{ addTeam(teamNameInput.value); teamNameInput.value = ''; });
teamNameInput.addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ addTeam(teamNameInput.value); teamNameInput.value = ''; }});
clearTeamsBtn.addEventListener('click', ()=>{ teams = []; renderTeamList(); });

function nextPow2(n){ return Math.pow(2, Math.ceil(Math.log2(Math.max(1,n)))); }

function buildBracket(fromTeams){
  if(!fromTeams || fromTeams.length < 2){ alert('Bitte mindestens 2 Teams hinzufügen.'); return; }
  const n = fromTeams.length;
  const size = nextPow2(n);
  const seed = fromTeams.slice();
  // add BYEs
  while(seed.length < size) seed.push('BYE');

  state = { rounds: [] , winners: {} };
  // round 0 pairs
  const round0 = [];
  for(let i=0;i<seed.length;i+=2) round0.push([seed[i], seed[i+1]]);
  state.rounds.push(round0);

  // further rounds placeholders
  let matches = round0.length;
  while(matches > 1){
    const arr = [];
    for(let i=0;i<matches/2;i++) arr.push(['-','-']);
    state.rounds.push(arr);
    matches = arr.length;
  }

  // champion column (optional single slot)
  state.champion = null;

  // auto-advance BYEs in round0
  state.rounds[0].forEach((m, idx)=>{
    const [a,b] = m;
    if(a === 'BYE' && b === 'BYE'){
      // both bye -> leave empty
    } else if(a === 'BYE'){
      setWinner(0, idx, b);
    } else if(b === 'BYE'){
      setWinner(0, idx, a);
    }
  });

  renderBracket();
}

function setWinner(roundIndex, matchIndex, winnerName){
  state.winners[`${roundIndex}-${matchIndex}`] = winnerName;
  const nextRound = roundIndex + 1;
  if(nextRound >= state.rounds.length){
    state.champion = winnerName;
    renderBracket();
    return;
  }
  const nextMatchIdx = Math.floor(matchIndex/2);
  const slot = (matchIndex % 2 === 0) ? 0 : 1;
  state.rounds[nextRound][nextMatchIdx][slot] = winnerName;
  // if opponent is BYE, auto advance
  const opponent = state.rounds[nextRound][nextMatchIdx][slot === 0 ? 1 : 0];
  if(opponent === 'BYE'){
    setWinner(nextRound, nextMatchIdx, winnerName);
  }
  renderBracket();
}

function createMatchElement(playerA, playerB, roundIndex, matchIndex){
  const wrap = document.createElement('div');
  wrap.className = 'match';

  const pA = document.createElement('div');
  pA.className = 'player';
  pA.textContent = playerA === 'BYE' ? 'BYE' : (playerA || '-');
  if(state.winners[`${roundIndex}-${matchIndex}`] === playerA) pA.classList.add('winner');
  wrap.appendChild(pA);

  const pB = document.createElement('div');
  pB.className = 'player';
  pB.textContent = playerB === 'BYE' ? 'BYE' : (playerB || '-');
  if(state.winners[`${roundIndex}-${matchIndex}`] === playerB) pB.classList.add('winner');
  wrap.appendChild(pB);

  // clicking selects winner (ignore BYE or empty)
  [pA,pB].forEach((el, idx)=>{
    el.addEventListener('click', ()=>{
      const name = el.textContent;
      if(!name || name === '-' || name === 'BYE') return;
      setWinner(roundIndex, matchIndex, name);
    });
  });

  return wrap;
}

function renderBracket(){
  bracketEl.innerHTML = '';
  if(!state) return;
  state.rounds.forEach((round, rIdx)=>{
    const col = document.createElement('div');
    col.className = 'round';
    round.forEach((match, mIdx)=>{
      const matchEl = createMatchElement(match[0], match[1], rIdx, mIdx);
      col.appendChild(matchEl);
    });
    bracketEl.appendChild(col);
  });

  // champion column
  const champCol = document.createElement('div');
  champCol.className = 'round';
  const champMatch = document.createElement('div');
  champMatch.className = 'match';
  const champSlot = document.createElement('div');
  champSlot.className = 'player';
  champSlot.textContent = state.champion ? `Champion: ${state.champion}` : 'Champion';
  champMatch.appendChild(champSlot);
  champCol.appendChild(champMatch);
  bracketEl.appendChild(champCol);
  renderChampionSummary();
}

function renderChampionSummary(){
  const el = document.getElementById('championSummary');
  if(!el) return;
  if(!state || !state.champion){ el.style.display = 'none'; el.innerHTML = ''; return; }
  el.style.display = 'flex';
  const step = parseFloat(el.dataset.step || '0.5');
  // compute eliminations: map team -> roundIndex where they lost
  const numRounds = state.rounds.length;
  const eliminated = {}; // team -> roundIndex
  for(let r=0;r<numRounds;r++){
    state.rounds[r].forEach((match, mIdx)=>{
      const a = match[0], b = match[1];
      const winner = state.winners[`${r}-${mIdx}`];
      if(winner){
        const loser = (a === winner) ? b : ((b === winner) ? a : null);
        if(loser && loser !== 'BYE' && loser !== '-') eliminated[loser] = r;
      } else {
        // fallback: if champion equals one player here, mark the other as loser
        if(state.champion && (a === state.champion || b === state.champion)){
          const loser = (a === state.champion) ? b : a;
          if(loser && loser !== 'BYE' && loser !== '-') eliminated[loser] = r;
        }
      }
    });
  }

  const fmt = v => { const n = Math.round(Number(v)*10)/10; return (n % 1 === 0) ? String(n) : String(n); };

  let html = `
    <div class="champ-text"><strong>Champion:</strong> ${state.champion}</div>
    <div class="champ-controls">
      <label>Basis (Gläser-Stufe): <input id="baseStep" type="number" min="0" step="0.5" value="${fmt(step)}" style="width:70px"></label>
      <div class="preset-buttons">
        <button id="presetHalf">0.5</button>
        <button id="presetOne">1</button>
        <button id="presetTwo">2</button>
      </div>
    </div>
  `;

  // per-round breakdown
  html += '<div class="round-breakdown"><ul style="margin:6px 0 0;padding-left:18px;color:var(--muted)">';
  for(let r=0;r<numRounds;r++){
    const amount = Math.round((numRounds - r) * step * 10)/10;
    html += `<li>Verlierer Runde ${r+1}: ${fmt(amount)} ${amount==1? 'Glas' : 'Gläser' } pro Spieler</li>`;
  }
  html += '</ul></div>';

  // per-team list
  const teamsList = Object.keys(eliminated).sort((a,b)=> eliminated[a]-eliminated[b]);
  if(teamsList.length){
    html += '<div class="team-list-summary" style="margin-left:12px;"><strong>Teams:</strong><ul style="margin:6px 0 0;padding-left:18px">';
    teamsList.forEach(t=>{
      const r = eliminated[t];
      const amt = Math.round((numRounds - r) * step * 10)/10;
      html += `<li>${t}: ${fmt(amt)} ${amt==1?'Glas':'Gläser'} (verloren in Runde ${r+1})</li>`;
    });
    html += '</ul></div>';
  } else {
    html += '<div class="team-list-summary" style="margin-left:12px;color:var(--muted)">Keine ausgeschiedenen Teams gefunden.</div>';
  }

  el.innerHTML = html;

  const baseInput = el.querySelector('#baseStep');
  function applyStep(v){ el.dataset.step = String(v); renderChampionSummary(); }
  baseInput.addEventListener('input', ()=>{ const v = parseFloat(baseInput.value) || 0; applyStep(v); });
  el.querySelector('#presetHalf').addEventListener('click', ()=>{ baseInput.value = 0.5; applyStep(0.5); });
  el.querySelector('#presetOne').addEventListener('click', ()=>{ baseInput.value = 1; applyStep(1); });
  el.querySelector('#presetTwo').addEventListener('click', ()=>{ baseInput.value = 2; applyStep(2); });
}

startBtn.addEventListener('click', ()=>{ buildBracket(teams); });

resetBtn.addEventListener('click', ()=>{ teams = []; state = null; renderTeamList(); renderBracket(); });

// start with empty team list (no example teams)
renderTeamList();
renderBracket();
