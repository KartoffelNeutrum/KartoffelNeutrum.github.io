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
}

startBtn.addEventListener('click', ()=>{ buildBracket(teams); });

resetBtn.addEventListener('click', ()=>{ teams = []; state = null; renderTeamList(); renderBracket(); });

// start with empty team list (no example teams)
renderTeamList();
renderBracket();
