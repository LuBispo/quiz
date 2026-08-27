/* =========================================================
   CONFIGURAÇÃO GERAL
   ========================================================= */
const themes = [
  { name: 'Geografia', file: 'projeto2/geografia.json' },
  { name: 'História', file: 'projeto2/historia.json' },
  { name: 'Ciências', file: 'projeto2/ciencias.json' },
  { name: 'Língua Portuguesa', file: 'projeto2/portugues.json' },
  { name: 'Matemática', file: 'projeto2/matematica.json' },
  { name: 'Inglês', file: 'projeto2/ingles.json' },
  { name: 'Transpetro - Banco de Dados', file: 'projeto2/transpetro_banco_de_dados.json' },
  { name: 'Transpetro - Arquitetura Web', file: 'projeto2/transpetro_arquitetura_web.json' }
];

const QUESTOES_POR_TENTATIVA = 10; // tamanho alvo de cada avaliação
const STORAGE_KEY = 'quizAppData';       // contas, histórico e domínio de questões
const SESSION_KEY = 'quizCurrentUser';   // usuário logado no momento

/* =========================================================
   ESTADO EM MEMÓRIA
   ========================================================= */
let currentQuestion = 0;
let score = 0;
let questions = [];          // perguntas da tentativa atual
let questionResults = [];    // [{ id, correct }] da tentativa atual
let selectedTheme = null;
let themeDataCache = {};     // { arquivo: [perguntas...] } já carregado da rede

/* =========================================================
   ELEMENTOS DA TELA
   ========================================================= */
const loginScreen = document.getElementById('login-screen');
const introScreen = document.getElementById('intro-screen');
const themeSelectScreen = document.getElementById('theme-select-screen');
const quizScreen = document.getElementById('quiz-screen');
const historyScreen = document.getElementById('history-screen');
const resultEl = document.getElementById('result');

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const authError = document.getElementById('auth-error');

const questionEl = document.getElementById('question');
const answersForm = document.getElementById('answers');
const submitBtn = document.getElementById('submit');
const resultText = document.getElementById('result-text');
const quizThemeNameEl = document.getElementById('quiz-theme-name');
const cycleNoteEl = document.getElementById('cycle-note');
const welcomeMsgEl = document.getElementById('welcome-msg');
const historySummaryEl = document.getElementById('history-summary');
const historyListEl = document.getElementById('history-list');
const themeButtonsEl = document.getElementById('theme-buttons');

const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const historyBtn = document.getElementById('history-btn');
const historyBackBtn = document.getElementById('history-back-btn');
const logoutBtn = document.getElementById('logout-btn');
const themeSelectBackBtn = document.getElementById('theme-select-back-btn');

/* =========================================================
   UTILITÁRIOS
   ========================================================= */
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function showScreen(el) {
  [loginScreen, introScreen, themeSelectScreen, quizScreen, historyScreen, resultEl]
    .forEach(s => s.classList.add('hidden'));
  el.classList.remove('hidden');
}

/* =========================================================
   ARMAZENAMENTO (localStorage)
   ========================================================= */
function loadAppData() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { users: {} };
  } catch (e) {
    return { users: {} };
  }
}

function saveAppData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getCurrentUsername() {
  return localStorage.getItem(SESSION_KEY);
}

function setCurrentUsername(username) {
  localStorage.setItem(SESSION_KEY, username);
}

function clearCurrentUsername() {
  localStorage.removeItem(SESSION_KEY);
}

function getUserRecord(username) {
  const data = loadAppData();
  return data.users[username] || null;
}

function updateUserRecord(username, updaterFn) {
  const data = loadAppData();
  const user = data.users[username];
  if (!user) return;
  updaterFn(user);
  saveAppData(data);
}

/* =========================================================
   SENHA (hash SHA-256 implementado em JS puro)
   Não depende de crypto.subtle porque essa API só funciona em
   "contexto seguro" (https, localhost ou file://) — em http://
   com IP local (celular acessando via Wi-Fi, por exemplo) ela
   fica indisponível e travaria o cadastro/login silenciosamente.
   Observação: isso é uma proteção básica para uso em dispositivo
   pessoal do aluno, sem backend — não é segurança de produção.
   ========================================================= */
function sha256Hex(text) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  let result = '';

  sha256Hex._h = sha256Hex._h || [];
  sha256Hex._k = sha256Hex._k || [];
  const hConst = sha256Hex._h;
  const k = sha256Hex._k;

  if (k.length === 0) {
    const isComposite = {};
    let primeCounter = 0;
    for (let candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
        hConst[primeCounter] = (mathPow(candidate, 0.5) * mathPow(2, 32)) | 0;
        k[primeCounter++] = (mathPow(candidate, 1 / 3) * mathPow(2, 32)) | 0;
      }
    }
  }

  const h = hConst.slice(0, 8);

  const utf8 = unescape(encodeURIComponent(text));
  const strLen = utf8.length;

  const bytes = [];
  for (let i = 0; i < strLen; i++) bytes.push(utf8.charCodeAt(i));
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);

  const bitLen = strLen * 8;
  for (let i = 7; i >= 0; i--) bytes.push((bitLen / mathPow(2, i * 8)) & 0xff);

  for (let chunkStart = 0; chunkStart < bytes.length; chunkStart += 64) {
    const w = new Array(64).fill(0);
    for (let i = 0; i < 16; i++) {
      w[i] = (bytes[chunkStart + i * 4] << 24) |
             (bytes[chunkStart + i * 4 + 1] << 16) |
             (bytes[chunkStart + i * 4 + 2] << 8) |
             (bytes[chunkStart + i * 4 + 3]);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }

    let [a, b, c, d, e, f, g, hh] = h;

    for (let i = 0; i < 64; i++) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + S1 + ch + k[i] + w[i]) | 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      hh = g; g = f; f = e; e = (d + temp1) | 0;
      d = c; c = b; b = a; a = (temp1 + temp2) | 0;
    }

    h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
    h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
  }

  for (let i = 0; i < 8; i++) {
    result += (h[i] >>> 0).toString(16).padStart(8, '0');
  }
  return result;
}

function randomSalt() {
  if (window.crypto && crypto.getRandomValues) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // fallback extremamente improvável de ser necessário (navegadores muito antigos)
  let s = '';
  for (let i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}

/* =========================================================
   AUTENTICAÇÃO
   ========================================================= */
function normalizeUsername(raw) {
  return raw.trim().toLowerCase();
}

async function registerUser(rawUsername, password, password2) {
  const username = normalizeUsername(rawUsername);
  if (!username || !password) {
    return { ok: false, error: 'Preencha usuário e senha.' };
  }
  if (password.length < 4) {
    return { ok: false, error: 'A senha precisa ter pelo menos 4 caracteres.' };
  }
  if (password !== password2) {
    return { ok: false, error: 'As senhas não coincidem.' };
  }

  const data = loadAppData();
  if (data.users[username]) {
    return { ok: false, error: 'Esse usuário já existe. Tente entrar.' };
  }

  const salt = randomSalt();
  const passwordHash = await sha256Hex(salt + password);

  data.users[username] = {
    displayName: rawUsername.trim(),
    salt,
    passwordHash,
    createdAt: new Date().toISOString(),
    mastery: {},   // { arquivoTema: [idsDominados...] }
    attempts: []   // histórico de avaliações
  };
  saveAppData(data);
  setCurrentUsername(username);
  return { ok: true };
}

async function loginUser(rawUsername, password) {
  const username = normalizeUsername(rawUsername);
  const data = loadAppData();
  const user = data.users[username];
  if (!user) {
    return { ok: false, error: 'Usuário não encontrado. Crie uma conta.' };
  }
  const hash = await sha256Hex(user.salt + password);
  if (hash !== user.passwordHash) {
    return { ok: false, error: 'Senha incorreta.' };
  }
  setCurrentUsername(username);
  return { ok: true };
}

function logoutUser() {
  clearCurrentUsername();
  loginForm.classList.remove('hidden');
  registerForm.classList.add('hidden');
  authError.classList.add('hidden');
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
  showScreen(loginScreen);
}

/* =========================================================
   TELAS DE LOGIN / CADASTRO
   ========================================================= */
document.getElementById('show-register').addEventListener('click', (e) => {
  e.preventDefault();
  loginForm.classList.add('hidden');
  registerForm.classList.remove('hidden');
  authError.classList.add('hidden');
});

document.getElementById('show-login').addEventListener('click', (e) => {
  e.preventDefault();
  registerForm.classList.add('hidden');
  loginForm.classList.remove('hidden');
  authError.classList.add('hidden');
});

document.getElementById('login-btn').addEventListener('click', async () => {
  try {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const result = await loginUser(username, password);
    if (!result.ok) {
      authError.textContent = result.error;
      authError.classList.remove('hidden');
      return;
    }
    authError.classList.add('hidden');
    enterApp();
  } catch (err) {
    authError.textContent = 'Ocorreu um erro ao entrar. Tente novamente.';
    authError.classList.remove('hidden');
  }
});

document.getElementById('register-btn').addEventListener('click', async () => {
  try {
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    const password2 = document.getElementById('register-password2').value;
    const result = await registerUser(username, password, password2);
    if (!result.ok) {
      authError.textContent = result.error;
      authError.classList.remove('hidden');
      return;
    }
    authError.classList.add('hidden');
    enterApp();
  } catch (err) {
    authError.textContent = 'Ocorreu um erro ao criar a conta. Tente novamente.';
    authError.classList.remove('hidden');
  }
});

logoutBtn.addEventListener('click', logoutUser);

/* =========================================================
   CARREGAMENTO DOS TEMAS (uma vez, com cache)
   ========================================================= */
async function preloadThemes() {
  const results = await Promise.all(themes.map(t =>
    fetch(t.file).then(res => res.json()).then(data => ({ file: t.file, data }))
  ));
  results.forEach(r => { themeDataCache[r.file] = r.data; });
}

function usableThemes() {
  // só entram no sorteio temas que já têm pelo menos 1 questão cadastrada
  return themes.filter(t => (themeDataCache[t.file] || []).length > 0);
}

/* =========================================================
   ENTRADA NO APP APÓS LOGIN
   ========================================================= */
async function enterApp() {
  const username = getCurrentUsername();
  const user = getUserRecord(username);
  welcomeMsgEl.textContent = `Olá, ${user.displayName}! Pronto para o quiz de hoje?`;

  if (Object.keys(themeDataCache).length === 0) {
    await preloadThemes();
  }
  showScreen(introScreen);
}

/* =========================================================
   ESCOLHA DA MATÉRIA (o aluno decide, sem sorteio)
   ========================================================= */
function renderThemeSelect() {
  const usable = usableThemes();
  const username = getCurrentUsername();
  const user = getUserRecord(username);

  if (usable.length === 0) {
    themeButtonsEl.innerHTML = '<p class="empty-history">Nenhuma matéria com questões cadastradas no momento.</p>';
    return;
  }

  themeButtonsEl.innerHTML = '';
  usable.forEach(theme => {
    const total = (themeDataCache[theme.file] || []).length;
    const mastered = ((user.mastery && user.mastery[theme.file]) || []).length;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-option-btn';
    btn.innerHTML = `
      <span class="theme-option-name">${theme.name}</span>
      <span class="theme-option-progress">${mastered}/${total} questões já dominadas</span>
    `;
    btn.addEventListener('click', () => {
      selectedTheme = theme;
      quizThemeNameEl.textContent = theme.name;
      cycleNoteEl.classList.add('hidden');
      cycleNoteEl.textContent = '';
      showScreen(quizScreen);
      startQuiz(theme);
    });

    themeButtonsEl.appendChild(btn);
  });
}

startBtn.addEventListener('click', () => {
  renderThemeSelect();
  showScreen(themeSelectScreen);
});

themeSelectBackBtn.addEventListener('click', () => {
  showScreen(introScreen);
});

/* Seleciona as perguntas da tentativa, excluindo as já dominadas
   (respondidas corretamente em tentativas anteriores) */
function pickQuestions(allQuestions, masteredIds) {
  const pool = allQuestions.filter(q => !masteredIds.includes(q.id));
  let workingPool = pool;
  let didReset = false;

  if (workingPool.length === 0) {
    // aluno já dominou todas as questões do tema: reinicia o ciclo
    didReset = true;
    workingPool = allQuestions.slice();
  }

  const count = Math.min(QUESTOES_POR_TENTATIVA, workingPool.length);
  const selected = shuffle(workingPool.slice()).slice(0, count);
  return { selected, didReset };
}

function startQuiz(theme) {
  const allQuestions = themeDataCache[theme.file] || [];
  const username = getCurrentUsername();
  const user = getUserRecord(username);
  const masteredIds = (user.mastery && user.mastery[theme.file]) || [];

  const { selected, didReset } = pickQuestions(allQuestions, masteredIds);

  if (didReset) {
    // zera o domínio desse tema no armazenamento, já que um novo ciclo começou
    updateUserRecord(username, (u) => {
      if (!u.mastery) u.mastery = {};
      u.mastery[theme.file] = [];
    });
    cycleNoteEl.textContent = 'Você já acertou todas as questões deste tema em tentativas anteriores! Começando um novo ciclo com todas elas de novo.';
    cycleNoteEl.classList.remove('hidden');
  }

  questions = selected;
  questionResults = [];
  currentQuestion = 0;
  score = 0;
  loadQuestion();
}

function loadQuestion() {
  const q = questions[currentQuestion];
  questionEl.textContent = `(${currentQuestion + 1}/${questions.length}) ${q.question}`;
  answersForm.innerHTML = '';

  const optionList = Object.entries(q.options);
  const shuffledOptions = shuffle(optionList);

  for (let [key, value] of shuffledOptions) {
    const optionId = `${q.id}-${key}`;

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'answer';
    input.id = optionId;
    input.value = key;

    const label = document.createElement('label');
    label.htmlFor = optionId;
    label.textContent = value;
    label.classList.add('option-label');

    input.addEventListener('change', () => {
      submitBtn.disabled = false;
    });

    answersForm.appendChild(input);
    answersForm.appendChild(label);
  }

  submitBtn.disabled = true;
}

submitBtn.addEventListener('click', () => {
  const selected = document.querySelector('input[name="answer"]:checked');
  if (!selected) return;

  const q = questions[currentQuestion];
  const answer = selected.value;
  const correctAnswer = q.correct;
  const isCorrect = answer === correctAnswer;

  submitBtn.disabled = true;
  const inputs = document.querySelectorAll('input[name="answer"]');
  inputs.forEach(input => input.disabled = true);

  const selectedLabel = document.querySelector(`label[for="${q.id}-${answer}"]`);
  const correctLabel = document.querySelector(`label[for="${q.id}-${correctAnswer}"]`);

  if (isCorrect) {
    score++;
    selectedLabel.classList.add('correct');
  } else {
    selectedLabel.classList.add('incorrect');
    correctLabel.classList.add('correct');
  }

  questionResults.push({ id: q.id, correct: isCorrect });

  setTimeout(() => {
    currentQuestion++;
    if (currentQuestion >= questions.length) {
      finishQuiz();
    } else {
      loadQuestion();
    }
  }, 3000);
});

/* =========================================================
   FIM DO QUIZ: salva histórico e atualiza domínio de questões
   ========================================================= */
function finishQuiz() {
  const username = getCurrentUsername();
  const total = questions.length;
  const percentage = Math.round((score / total) * 100);

  updateUserRecord(username, (user) => {
    if (!user.mastery) user.mastery = {};
    if (!user.mastery[selectedTheme.file]) user.mastery[selectedTheme.file] = [];

    // toda questão respondida CORRETAMENTE entra para o domínio do aluno
    // (não volta a aparecer em tentativas futuras deste tema, até esgotar o ciclo)
    questionResults.forEach(r => {
      if (r.correct && !user.mastery[selectedTheme.file].includes(r.id)) {
        user.mastery[selectedTheme.file].push(r.id);
      }
    });

    if (!user.attempts) user.attempts = [];
    user.attempts.push({
      date: new Date().toISOString(),
      themeFile: selectedTheme.file,
      themeName: selectedTheme.name,
      total,
      correct: score,
      percentage
    });
  });

  showScreen(resultEl);
  resultText.textContent = `Você acertou ${score} de ${total} perguntas no tema "${selectedTheme.name}" (${percentage}%).`;
}

restartBtn.addEventListener('click', () => {
  showScreen(introScreen);
});

/* =========================================================
   HISTÓRICO DO ALUNO
   ========================================================= */
function percentageClass(pct) {
  if (pct >= 70) return 'hist-good';
  if (pct >= 40) return 'hist-mid';
  return 'hist-bad';
}

function renderHistory() {
  const username = getCurrentUsername();
  const user = getUserRecord(username);
  const attempts = (user.attempts || []).slice().reverse(); // mais recentes primeiro

  if (attempts.length === 0) {
    historySummaryEl.innerHTML = '';
    historyListEl.innerHTML = '<p class="empty-history">Você ainda não fez nenhuma avaliação.</p>';
    return;
  }

  const mediaGeral = Math.round(
    attempts.reduce((acc, a) => acc + a.percentage, 0) / attempts.length
  );

  historySummaryEl.innerHTML = `
    <p class="history-average">Média geral: <strong>${mediaGeral}%</strong> em ${attempts.length} avaliação(ões)</p>
  `;

  historyListEl.innerHTML = attempts.map(a => {
    const dataFormatada = new Date(a.date).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    return `
      <div class="history-item">
        <div class="history-item-top">
          <span class="history-theme">${a.themeName}</span>
          <span class="history-pct ${percentageClass(a.percentage)}">${a.percentage}%</span>
        </div>
        <div class="history-item-bottom">
          <span>${a.correct}/${a.total} acertos</span>
          <span>${dataFormatada}</span>
        </div>
      </div>
    `;
  }).join('');
}

historyBtn.addEventListener('click', () => {
  renderHistory();
  showScreen(historyScreen);
});

historyBackBtn.addEventListener('click', () => {
  showScreen(introScreen);
});

/* =========================================================
   INICIALIZAÇÃO
   ========================================================= */
(function init() {
  const username = getCurrentUsername();
  if (username && getUserRecord(username)) {
    enterApp();
  } else {
    clearCurrentUsername();
    showScreen(loginScreen);
  }
})();
