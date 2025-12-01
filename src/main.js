// src/main.js

// ===== 0. 환경변수 불러오기 (Vite: VITE_ 접두사 필수) =====
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

// 🔗 Google Form 설정
const FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSeF3oDjvb9YohBuygEQ6tW_U3MrExWEHS87cb5aqSoodDKzyA/formResponse";

// Google Form entry 매핑 (학번/이름 + A/B/C/D 각 문제 + 점수)
const ENTRY_MAP = {
  studentId: "entry.1156379572",
  studentName: "entry.1031372173",
  "A-1": "entry.1965346174",
  "A-2": "entry.795362634",
  "A-3": "entry.449716902",
  "A-4": "entry.1916947983",
  "A-5": "entry.249009695",
  "B-1": "entry.249164313",
  "B-2": "entry.2064784806",
  "B-3": "entry.1368139771",
  "B-4": "entry.1240036767",
  "B-5": "entry.420685753",
  "C-1": "entry.1971980148",
  "C-2": "entry.1888873729",
  "C-3": "entry.1326659845",
  "C-4": "entry.1382173466",
  "C-5": "entry.791670312",
  "D-1": "entry.95235877",
  "D-2": "entry.981241081",
  "D-3": "entry.10177078",
  "D-4": "entry.1512639108",
  "D-5": "entry.1260872459",

  // 점수 요약 (폼에서 만든 질문 entry 값)
  initialScore: "entry.1921141570",
  finalScore: "entry.1902624582",
  starCount: "entry.1581906669",
};

// ===== 1. DOM 요소 =====
const homeView = document.getElementById("home-view");
const openBaseQuizBtn = document.getElementById("open-base-quiz-btn");

const controlSection = document.getElementById("control-section");
const startQuizBtn = document.getElementById("startQuizBtn");

const quizSection = document.getElementById("quiz-section");
const stageLabel = document.getElementById("stage-label");
const questionList = document.getElementById("question-list");
const nextStageBtn = document.getElementById("nextStageBtn");
const finishQuizBtn = document.getElementById("finishQuizBtn");
const quizMessage = document.getElementById("quiz-message");
const timerSpan = document.getElementById("timer");

const summarySection = document.getElementById("summary-section");
const summaryTable = document.getElementById("summary-table");

const reviewSection = document.getElementById("review-section");
const reviewQuestionText = document.getElementById("review-question-text");
const reviewAnswerInput = document.getElementById("review-answer");
const reviewSubmitBtn = document.getElementById("review-submit-btn");
const reviewFeedback = document.getElementById("review-feedback");

const chatSection = document.getElementById("chat-section");
const chatLog = document.getElementById("chat-log");
const chatInput = document.getElementById("chat-input");
const chatSendBtn = document.getElementById("chat-send-btn");

const finalSummarySection = document.getElementById("final-summary-section");
const finalSummaryDiv = document.getElementById("final-summary");
const submitAndEndBtn = document.getElementById("submit-and-end-btn");
const restartQuizBtn = document.getElementById("restart-quiz-btn");
const finalMessageEl = document.getElementById("final-message");

// 학생 정보 입력 DOM
const studentIdInput = document.getElementById("student-id");
const studentNameInput = document.getElementById("student-name");

// ===== 그림판 DOM =====
const scratchpadContainer = document.getElementById("scratchpad-container");
const scratchpadCanvas = document.getElementById("scratchpad");
const scratchpadModeBtn = document.getElementById("scratchpad-mode-btn");
const scratchpadClearBtn = document.getElementById("scratchpad-clear-btn");

// ===== 2. 퀴즈 상태 변수 =====
const SECTIONS = [
  { id: "A", label: "가. 2진수 → 10진수", type: "bin2dec" },
  { id: "B", label: "나. 10진수 → 2진수", type: "dec2bin" },
  { id: "C", label: "다. 2진수 → 8진수", type: "bin2oct" },
  { id: "D", label: "라. 2진수 → 16진수", type: "bin2hex" },
];

let questions = [];
let currentSectionIndex = 0;
let timerId = null;
let timeLeft = 300;
let quizLocked = false;
let initialCorrectCount = 0;
let timeLeftWhenSubmitted = 0;

let currentRetryQuestion = null;
let currentChatQuestion = null;

// 학생 정보 상태
let studentId = "";
let studentName = "";

// Google Form 중복 제출 방지
let formSubmitted = false;

// ===== 3. 타이머 =====
function formatTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function startTimer() {
  if (timerId !== null) return;
  timeLeft = 300;
  timerSpan.textContent = formatTime(timeLeft);

  timerId = setInterval(() => {
    timeLeft--;
    timerSpan.textContent = formatTime(timeLeft);
    if (timeLeft <= 0) {
      clearInterval(timerId);
      timerId = null;
      quizLocked = true;
      quizMessage.textContent =
        "시간이 종료되었습니다. 현재까지 입력한 답안으로 채점합니다.";
      lockInputs();
      timeLeftWhenSubmitted = 0;
      gradeAllQuestions(); // 자동 채점 (폼 전송은 나중에 '마무리' 버튼에서)
    }
  }, 1000);
}

function stopTimer() {
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
}

// ===== 4. 문제 생성 =====
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randomNumByBitLen() {
  const bits = randInt(1, 8);
  const max = 2 ** bits - 1;
  const n = randInt(0, max);
  return n;
}
function toBinary(n) {
  return n.toString(2);
}
function toOctal(n) {
  return n.toString(8);
}
function toHex(n) {
  return n.toString(16).toUpperCase();
}

function generateQuestionsForSection(section) {
  const qs = [];
  const used = new Set();

  while (qs.length < 5) {
    const n = randomNumByBitLen();
    if (used.has(n)) continue;
    used.add(n);

    const bin = toBinary(n);
    const oct = toOctal(n);
    const hex = toHex(n);

    let promptText = "";
    let correctAnswer = "";
    let meta = {};

    switch (section.type) {
      case "bin2dec":
        promptText = `${bin}₂ 를 10진수로 변환하세요.`;
        correctAnswer = String(n);
        meta = { source: bin, targetBase: 10 };
        break;
      case "dec2bin":
        promptText = `${n}₁₀ 를 2진수로 변환하세요.`;
        correctAnswer = bin;
        meta = { source: n, targetBase: 2 };
        break;
      case "bin2oct":
        promptText = `${bin}₂ 를 8진수로 변환하세요.`;
        correctAnswer = oct;
        meta = { source: bin, targetBase: 8 };
        break;
      case "bin2hex":
        promptText = `${bin}₂ 를 16진수로 변환하세요.`;
        correctAnswer = hex;
        meta = { source: bin, targetBase: 16 };
        break;
    }

    qs.push({
      id: `${section.id}-${qs.length + 1}`,
      sectionId: section.id,
      sectionLabel: section.label,
      prompt: promptText,
      correctAnswer,
      userAnswer: "",
      meta,
      initialCorrect: false,
      status: null,
      retryCount: 0,
      reviewAttempts: 0,
      chatCount: 0,
      hadChat: false,
    });
  }
  return qs;
}

function generateAllQuestions() {
  questions = [];
  SECTIONS.forEach((sec) => {
    questions.push(...generateQuestionsForSection(sec));
  });
}

// ===== 5. 그림판 =====
let spCtx = null;
let spDrawing = false;
let spLastX = 0;
let spLastY = 0;
let spIsEraser = false;
const SP_BG = "#ffffff";

function resizeScratchpadCanvas() {
  if (!scratchpadCanvas) return;
  const rect = scratchpadCanvas.getBoundingClientRect();
  const width = rect.width || 250;
  const height = rect.height || 240;
  scratchpadCanvas.width = width;
  scratchpadCanvas.height = height;
  if (spCtx) clearScratchpad();
}
function clearScratchpad() {
  if (!spCtx || !scratchpadCanvas) return;
  spCtx.fillStyle = SP_BG;
  spCtx.fillRect(0, 0, scratchpadCanvas.width, scratchpadCanvas.height);
}
function initScratchpad() {
  if (!scratchpadCanvas) return;
  spCtx = scratchpadCanvas.getContext("2d");
  resizeScratchpadCanvas();
  window.addEventListener("resize", () => resizeScratchpadCanvas());

  const getPos = (e) => {
    const rect = scratchpadCanvas.getBoundingClientRect();
    let x, y;
    if (e.touches) {
      const t = e.touches[0];
      x = t.clientX - rect.left;
      y = t.clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }
    return { x, y };
  };
  const startDraw = (e) => {
    e.preventDefault();
    spDrawing = true;
    const pos = getPos(e);
    spLastX = pos.x;
    spLastY = pos.y;
  };
  const draw = (e) => {
    if (!spDrawing || !spCtx) return;
    e.preventDefault();
    const pos = getPos(e);
    spCtx.lineCap = "round";
    spCtx.lineJoin = "round";
    spCtx.lineWidth = spIsEraser ? 16 : 3;
    spCtx.strokeStyle = spIsEraser ? SP_BG : "#333333";
    spCtx.beginPath();
    spCtx.moveTo(spLastX, spLastY);
    spCtx.lineTo(pos.x, pos.y);
    spCtx.stroke();
    spLastX = pos.x;
    spLastY = pos.y;
  };
  const endDraw = (e) => {
    if (!spDrawing) return;
    e.preventDefault();
    spDrawing = false;
  };

  scratchpadCanvas.addEventListener("mousedown", startDraw);
  scratchpadCanvas.addEventListener("mousemove", draw);
  scratchpadCanvas.addEventListener("mouseup", endDraw);
  scratchpadCanvas.addEventListener("mouseleave", endDraw);
  scratchpadCanvas.addEventListener("touchstart", startDraw, { passive: false });
  scratchpadCanvas.addEventListener("touchmove", draw, { passive: false });
  scratchpadCanvas.addEventListener("touchend", endDraw, { passive: false });
  scratchpadCanvas.addEventListener("touchcancel", endDraw, { passive: false });

  scratchpadModeBtn.addEventListener("click", () => {
    spIsEraser = !spIsEraser;
    scratchpadModeBtn.textContent = spIsEraser ? "🧽 지우개" : "✏️ 펜";
  });
  scratchpadClearBtn.addEventListener("click", () => clearScratchpad());
}

// ===== 6. 퀴즈 렌더링 =====
function updateScratchpadVisibility() {
  scratchpadContainer.classList.remove("hidden");
  requestAnimationFrame(() => resizeScratchpadCanvas());
}

function renderCurrentSection() {
  const section = SECTIONS[currentSectionIndex];
  const sectionQuestions = questions.filter((q) => q.sectionId === section.id);

  stageLabel.textContent = `현재 단계: ${section.label} · 총 5문제`;
  questionList.innerHTML = "";

  sectionQuestions.forEach((q) => {
    const div = document.createElement("div");
    div.className = "question";

    const label = document.createElement("p");
    label.className = "question-label";
    label.textContent = `${q.id}. ${q.prompt}`;

    const input = document.createElement("input");
    input.type = "text";
    input.value = q.userAnswer || "";
    input.placeholder = "답을 입력하세요";
    input.addEventListener("input", (e) => {
      if (quizLocked) return;
      q.userAnswer = e.target.value.trim();
    });

    div.appendChild(label);
    div.appendChild(input);
    questionList.appendChild(div);
  });

  if (currentSectionIndex === SECTIONS.length - 1) {
    nextStageBtn.classList.add("hidden");
    finishQuizBtn.classList.remove("hidden");
  } else {
    nextStageBtn.classList.remove("hidden");
    finishQuizBtn.classList.add("hidden");
  }

  quizMessage.textContent =
    "각 문항에 답을 입력한 뒤, 단계 이동 버튼을 눌러주세요.";

  updateScratchpadVisibility();
}

function lockInputs() {
  questionList.querySelectorAll("input").forEach((el) => (el.disabled = true));
}

// ===== 7. 상태 초기화 =====
function resetState() {
  stopTimer();
  timeLeft = 300;
  timerSpan.textContent = "05:00";
  quizLocked = false;
  initialCorrectCount = 0;
  timeLeftWhenSubmitted = 0;
  formSubmitted = false;

  questions = [];
  currentSectionIndex = 0;
  currentRetryQuestion = null;
  currentChatQuestion = null;

  quizMessage.textContent = "";
  questionList.innerHTML = "";
  summaryTable.innerHTML = "";
  reviewFeedback.textContent = "";
  reviewAnswerInput.value = "";
  chatLog.innerHTML = "";
  chatInput.value = "";
  finalSummaryDiv.innerHTML = "";
  finalMessageEl.textContent = "";

  clearScratchpad();
}

// ===== 8. 홈 → 진법 변환 퀴즈 컨트롤 화면 전환 =====
openBaseQuizBtn.addEventListener("click", () => {
  homeView.classList.add("hidden");
  controlSection.classList.remove("hidden");

  studentId = "";
  studentName = "";
  studentIdInput.value = "";
  studentNameInput.value = "";
  updateStartButtonState();

  quizSection.classList.add("hidden");
  summarySection.classList.add("hidden");
  reviewSection.classList.add("hidden");
  chatSection.classList.add("hidden");
  finalSummarySection.classList.add("hidden");

  stopTimer();
  timeLeft = 300;
  timerSpan.textContent = "05:00";
});

// ===== 9. 학생 정보 입력 → 시작 버튼 활성화 =====
function updateStartButtonState() {
  const idVal = studentIdInput.value.trim();
  const nameVal = studentNameInput.value.trim();
  startQuizBtn.disabled = !(idVal && nameVal);
}
studentIdInput.addEventListener("input", updateStartButtonState);
studentNameInput.addEventListener("input", updateStartButtonState);

// ===== 10. 이벤트: 퀴즈 시작 / 단계 이동 / 제출 =====
startQuizBtn.addEventListener("click", () => {
  const idVal = studentIdInput.value.trim();
  const nameVal = studentNameInput.value.trim();
  if (!idVal || !nameVal) {
    Swal.fire({
      icon: "warning",
      title: "입력 필수",
      text: "학번과 이름을 모두 입력한 뒤 시작할 수 있습니다.",
      confirmButtonText: "확인"
    });
    return;
  }

  studentId = idVal;
  studentName = nameVal;

  resetState();
  generateAllQuestions();
  controlSection.classList.remove("hidden");
  quizSection.classList.remove("hidden");
  summarySection.classList.add("hidden");
  reviewSection.classList.add("hidden");
  chatSection.classList.add("hidden");
  finalSummarySection.classList.add("hidden");
  renderCurrentSection();
  startTimer();
});

nextStageBtn.addEventListener("click", () => {
  if (quizLocked) {
    Swal.fire({
      icon: "info",
      title: "시간 종료",
      text: "시간이 종료되어 더 이상 수정할 수 없습니다.",
      confirmButtonText: "확인"
    });
    return;
  }
  const prevSection = SECTIONS[currentSectionIndex];

  const section = SECTIONS[currentSectionIndex];
  const sectionQuestions = questions.filter((q) => q.sectionId === section.id);
  const allAnswered = sectionQuestions.every(
    (q) => q.userAnswer && q.userAnswer !== ""
  );
  if (!allAnswered) {
    Swal.fire({
      icon: "warning",
      title: "모든 문제를 풀어주세요",
      text: "이 단계의 5문제에 모두 답을 입력해야 다음 단계로 넘어갈 수 있습니다.",
      confirmButtonText: "확인"
    });
    return;
  }

  if (currentSectionIndex < SECTIONS.length - 1) {
    currentSectionIndex++;
    const newSection = SECTIONS[currentSectionIndex];
    if (prevSection.id === "A" && newSection.id === "B") {
      clearScratchpad();
    }
    renderCurrentSection();
  }
});

finishQuizBtn.addEventListener("click", () => {
  if (quizLocked) {
    Swal.fire({
      icon: "info",
      title: "이미 채점됨",
      text: "이미 채점이 진행되었습니다.",
      confirmButtonText: "확인"
    });
    return;
  }
  const section = SECTIONS[currentSectionIndex];
  const sectionQuestions = questions.filter((q) => q.sectionId === section.id);
  const allAnswered = sectionQuestions.every(
    (q) => q.userAnswer && q.userAnswer !== ""
  );
  if (!allAnswered) {
    Swal.fire({
      icon: "warning",
      title: "모든 문제를 풀어주세요",
      text: "마지막 단계의 5문제도 모두 답을 입력해주세요.",
      confirmButtonText: "확인"
    });
    return;
  }

  stopTimer();
  timeLeftWhenSubmitted = timeLeft;
  quizLocked = true;
  lockInputs();
  gradeAllQuestions();
});

// ===== 11. Google Form 전송 =====
async function sendResultsToGoogleForm() {
  console.log("🔵 sendResultsToGoogleForm() 호출됨");
  console.log("  ▶ 현재 학생:", studentId, studentName);

  if (formSubmitted) {
    console.log("  ↪ 이미 formSubmitted = true, 전송 취소");
    return;
  }
  if (!FORM_URL) {
    console.log("  ❌ FORM_URL 이 비어있음");
    return;
  }

  const params = new URLSearchParams();

  // 학번 / 이름
  if (ENTRY_MAP.studentId) {
    params.append(ENTRY_MAP.studentId, studentId || "");
  }
  if (ENTRY_MAP.studentName) {
    params.append(ENTRY_MAP.studentName, studentName || "");
  }

  // 각 문제의 결과(O/X/△/★)
  questions.forEach((q) => {
    const entryKey = ENTRY_MAP[q.id];
    if (!entryKey) return;
    const value = q.status || "";
    params.append(entryKey, value);
  });

  // 점수 요약 값
  const total = questions.length;
  const finalCorrect = questions.filter((q) =>
    ["O", "△", "★"].includes(q.status)
  ).length;
  const starCount = questions.filter((q) => q.status === "★").length;

  if (ENTRY_MAP.initialScore) {
    params.append(ENTRY_MAP.initialScore, String(initialCorrectCount));
  }
  if (ENTRY_MAP.finalScore) {
    params.append(ENTRY_MAP.finalScore, String(finalCorrect));
  }
  if (ENTRY_MAP.starCount) {
    params.append(ENTRY_MAP.starCount, String(starCount));
  }

  console.log("  ▶ 전송될 폼 데이터:", Object.fromEntries(params));

  try {
    const res = await fetch(FORM_URL, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: params.toString(),
    });
    formSubmitted = true;
    console.log("✅ Google Form 제출 시도 완료 (no-cors, 응답은 확인 불가)", res);
  } catch (err) {
    console.error("❌ Google Form 제출 중 오류:", err);
  }
}

// ===== 12. 채점 & 요약 =====
function normalizeAnswer(str) {
  return (str || "").trim().toUpperCase();
}

function gradeAllQuestions() {
  console.log("👉 gradeAllQuestions() 실행");
  initialCorrectCount = 0;

  questions.forEach((q) => {
    if (!q.userAnswer) {
      q.initialCorrect = false;
      q.status = "X";
      return;
    }
    const userA = normalizeAnswer(q.userAnswer);
    const correctA = normalizeAnswer(q.correctAnswer);
    q.initialCorrect = userA === correctA;
    q.status = q.initialCorrect ? "O" : "X";
    if (q.initialCorrect) initialCorrectCount++;
  });

  renderSummaryTable();
  summarySection.classList.remove("hidden");

  if (initialCorrectCount === questions.length) {
    Swal.fire({
      icon: "success",
      title: "축하합니다!",
      text: "20문제를 모두 맞았습니다. 다음 수준의 문제로 넘어가시겠습니까?",
      showCancelButton: true,
      confirmButtonText: "네",
      cancelButtonText: "아니요"
    }).then((result) => {
      if (result.isConfirmed) {
        Swal.fire({
          icon: "info",
          title: "안내",
          text: "다음 수준 문제는 나중에 확장할 수 있습니다 🙂",
          confirmButtonText: "확인"
        });
      }
    });
  }

  showFinalSummary();
}

function renderSummaryTable() {
  const total = questions.length;
  const oCount = questions.filter((q) => q.status === "O").length;
  const triCount = questions.filter((q) => q.status === "△").length;
  const starCount = questions.filter((q) => q.status === "★").length;
  const xCount = questions.filter((q) => q.status === "X").length;

  const rows = questions
    .map(
      (q) => `
      <tr data-qid="${q.id}" class="${q.status === "X" ? "clickable" : ""}">
        <td>${q.id}</td>
        <td>${q.sectionLabel}</td>
        <td>${q.prompt}</td>
        <td style="text-align:center;">${q.status || "-"}</td>
      </tr>`
    )
    .join("");

  summaryTable.innerHTML = `
    <p>
      총 ${total}문제 중,
      처음 맞춘(O): ${oCount}개,
      다시 풀어서 맞힌(△): ${triCount}개,
      GPT 도움 + 여러 번 시도하여 맞힌(★): ${starCount}개,
      아직 틀린(X): ${xCount}개
    </p>
    <p class="section-caption">
      X 표시가 있는 문제를 클릭하면, 해당 문제만 다시 풀 수 있어요.
      다시 맞히면 △로 바뀌고,
      GPT와 대화하면서 세 번 이상 시도 끝에 맞히면 ★로 표시됩니다.
    </p>
    <table>
      <thead>
        <tr>
          <th>번호</th>
          <th>단계</th>
          <th>문제</th>
          <th>결과 (O / X / △ / ★)</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;

  updateFinalSummary();
}

// ===== 13. 틀린 문제 다시 풀기 =====
summaryTable.addEventListener("click", (e) => {
  const tr = e.target.closest("tr[data-qid]");
  if (!tr) return;

  const qid = tr.getAttribute("data-qid");
  const q = questions.find((qq) => qq.id === qid);
  if (!q) return;

  if (q.status !== "X") {
    Swal.fire({
      icon: "info",
      title: "다시 풀 수 없음",
      text: "이미 맞았거나( O / △ / ★ ) 다시 풀기 대상이 아닙니다.",
      confirmButtonText: "확인"
    });
    return;
  }

  currentRetryQuestion = q;
  reviewQuestionText.textContent = `다시 풀기: ${q.id} - ${q.prompt}`;
  reviewAnswerInput.value = "";
  reviewFeedback.textContent = "";
  reviewSection.classList.remove("hidden");
  chatSection.classList.add("hidden");
  reviewAnswerInput.focus();
});

reviewSubmitBtn.addEventListener("click", () => {
  if (!currentRetryQuestion) return;

  const ans = normalizeAnswer(reviewAnswerInput.value);
  if (!ans) {
    Swal.fire({
      icon: "warning",
      title: "답 입력 필요",
      text: "답을 입력해주세요.",
      confirmButtonText: "확인"
    });
    return;
  }

  const q = currentRetryQuestion;
  const correctA = normalizeAnswer(q.correctAnswer);

  q.reviewAttempts += 1;

  if (ans === correctA) {
    if (q.hadChat && q.reviewAttempts >= 3) {
      q.status = "★";
      reviewFeedback.textContent =
        "정답입니다! 여러 번 고민하고 GPT와 상의해서 결국 풀어낸 문제라 ★ 표시가 됩니다 👏";
    } else {
      q.status = "△";
      reviewFeedback.textContent =
        "정답입니다! X가 △(세모)로 바뀝니다.";
    }
    q.retryCount = Math.max(q.retryCount, 1);
    renderSummaryTable();
    currentRetryQuestion = null;
  } else {
    q.retryCount += 1;
    if (q.retryCount === 1) {
      reviewFeedback.textContent =
        "아직 틀렸습니다. 이번 문제는 두 번 틀렸으니까, 생성형 AI에게 원리를 물어보며 다시 이해해 봅시다.";
      showChatbotForQuestion(q);
    } else {
      reviewFeedback.textContent =
        "아직 정답은 아니에요. 챗봇에게 궁금한 점을 물어보면서 다시 생각해 보세요.";
      showChatbotForQuestion(q);
    }
  }
});

// ===== 14. 챗봇 =====
function appendChatMessage(role, text) {
  const div = document.createElement("div");
  if (role === "user") {
    div.innerHTML = `<span class="chat-user">학생:</span> ${text}`;
  } else {
    div.innerHTML = `<span class="chat-assistant">AI 교사:</span> ${text}`;
  }
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function showChatbotForQuestion(q) {
  currentChatQuestion = q;
  q.hadChat = true;
  chatLog.innerHTML = "";
  chatInput.value = "";
  chatSection.classList.remove("hidden");
  appendChatMessage(
    "assistant",
    "어떤 부분이 가장 헷갈렸나요? 정답을 직접 알려달라고 하기보다는,\n" +
      "예를 들어 ‘2진수에서 10진수로 바꿀 때 어떤 규칙을 쓰나요?’처럼 원리나 방법에 대해 질문해 보세요."
  );
}

chatSendBtn.addEventListener("click", () => {
  const questionText = chatInput.value.trim();
  if (!questionText) return;
  appendChatMessage("user", questionText);
  chatInput.value = "";

  const lower = questionText.toLowerCase();
  const askDirectAnswer =
    lower.includes("정답") ||
    lower.includes("답 알려") ||
    lower.includes("답이 뭐") ||
    lower.includes("answer") ||
    lower.includes("what is the answer");

  if (askDirectAnswer) {
    appendChatMessage(
      "assistant",
      "정답을 바로 알려 달라고 하기보다는,\n" +
        "‘어떤 규칙으로 계산하나요?’, ‘어디서부터 잘못 생각한 걸까요?’처럼 원리와 과정을 질문해 보세요.\n" +
        "스스로 계산해 보는 연습이 훨씬 큰 도움이 됩니다 🙂"
    );
    return;
  }

  if (!OPENAI_API_KEY) {
    appendChatMessage(
      "assistant",
      "현재 OpenAI API 키가 설정되어 있지 않아 실제 AI 응답을 가져올 수 없습니다.\n" +
        "Netlify 환경변수 또는 .env 에 VITE_OPENAI_API_KEY를 설정해 주세요."
    );
    return;
  }
  if (!currentChatQuestion) {
    appendChatMessage(
      "assistant",
      "먼저 틀린 문제를 선택하고 다시 풀어본 뒤에 질문해 주세요."
    );
    return;
  }

  askChatbot(currentChatQuestion, questionText);
});

chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    chatSendBtn.click();
  }
});

async function askChatbot(question, userText) {
  const systemPrompt = `
당신은 고등학교 정보 교과 선생님입니다.
학생이 푼 진법 변환 문제를 도와주되, 절대로 정답을 숫자로 직접 말하지 마세요.
대신,
- 개념과 원리를 쉬운 말로 설명하고
- 비슷하지만 다른 예시를 들어주고
- 학생이 스스로 계산해 볼 수 있도록 질문을 던져 주세요.
같은 문제에 대한 최종 정답(숫자나 해석)을 직접 제시하지 마세요.
  `.trim();

  const userPrompt = `
문제: ${question.prompt}
학생의 질문:
${userText}

위 학생의 질문에 대해,
1) 이 문제를 풀 때 어떤 원리/규칙을 사용해야 하는지 설명해 주고,
2) 예를 하나 들어서 연습하게 도와주고,
3) 마지막에는 "그럼 이 문제에 이 원리를 적용해 보세요." 처럼 스스로 풀어보게 유도해 주세요.
  `.trim();

  question.chatCount += 1;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(res.status, errText);
      appendChatMessage(
        "assistant",
        "AI 응답을 가져오는 중 오류가 발생했습니다."
      );
      return;
    }

    const data = await res.json();
    const answer = data.choices[0].message.content.trim();
    appendChatMessage("assistant", answer);

    if (question.chatCount >= 3) {
      appendChatMessage(
        "assistant",
        "이제 여기까지 설명을 바탕으로,\n" +
          "다시 한 번 입력창에 답을 적어 보고 채점해 보세요.\n" +
          "‘틀린 문제 다시 풀기’ 영역에서 답을 다시 작성해 보세요 🙂"
      );
    }
  } catch (err) {
    console.error(err);
    appendChatMessage(
      "assistant",
      "네트워크 오류로 인해 AI 응답을 가져오지 못했습니다."
    );
  }
}

// ===== 15. 최종 요약 + 마무리 버튼 =====
function updateFinalSummary() {
  const total = questions.length;
  const oCount = questions.filter((q) => q.status === "O").length;
  const triCount = questions.filter((q) => q.status === "△").length;
  const starCount = questions.filter((q) => q.status === "★").length;
  const xCount = questions.filter((q) => q.status === "X").length;
  const timeStr = formatTime(timeLeftWhenSubmitted);

  finalSummaryDiv.innerHTML = `
    <p>🕒 첫 5분 내 제출 기준</p>
    <ul>
      <li>학생: <b>${studentId || "-"} ${studentName || ""}</b></li>
      <li>처음 맞춘 문제 수(O): <b>${initialCorrectCount} / ${total}</b></li>
      <li>제출 시 남은 시간: <b>${timeStr}</b></li>
      <li>최종 맞힌 문제 수(O + △ + ★): <b>${
        oCount + triCount + starCount
      } / ${total}</b></li>
      <li>다시 풀어서 맞힌 문제 수(△): <b>${triCount}</b></li>
      <li>GPT 도움 + 여러 번 시도 후 맞힌 수(★): <b>${starCount}</b></li>
      <li>아직 틀린 문제 수(X): <b>${xCount}</b></li>
    </ul>
  `;
}

function showFinalSummary() {
  finalSummarySection.classList.remove("hidden");
  updateFinalSummary();
}

// “마무리하고 기록 남기기”
submitAndEndBtn.addEventListener("click", async () => {
  console.log("🟠 [클릭] 마무리하고 기록 남기기 버튼 눌림");

  if (formSubmitted) {
    finalMessageEl.textContent =
      "이미 Google Form으로 기록을 전송했습니다. 오늘은 여기까지 풀었습니다.";
    return;
  }
  await sendResultsToGoogleForm();
  finalMessageEl.textContent =
    "Google Form으로 기록을 전송했습니다. 오늘은 여기까지 풀어도 좋고, 새 문제로 다시 풀어볼 수도 있어요.";
  submitAndEndBtn.disabled = true;
});

// “홈으로 돌아가기”
restartQuizBtn.addEventListener("click", async () => {
  if (!formSubmitted) {
    const result = await Swal.fire({
      icon: "warning",
      title: "기록 미전송",
      text: "아직 Google Form으로 기록이 전송되지 않았습니다. 그래도 홈으로 돌아가시겠습니까?",
      showCancelButton: true,
      confirmButtonText: "네",
      cancelButtonText: "아니요"
    });
    if (!result.isConfirmed) return;
  }

  // 1) 현재 퀴즈 상태 초기화
  resetState();

  // 2) 학번/이름도 비우고, 내부 변수도 초기화
  studentId = "";
  studentName = "";
  studentIdInput.value = "";
  studentNameInput.value = "";
  updateStartButtonState(); // ▶ start 버튼 다시 비활성화

  // 3) 모든 퀴즈 관련 섹션 숨기기
  controlSection.classList.add("hidden");
  quizSection.classList.add("hidden");
  summarySection.classList.add("hidden");
  reviewSection.classList.add("hidden");
  chatSection.classList.add("hidden");
  finalSummarySection.classList.add("hidden");

  // 4) 홈 화면 보여주기
  homeView.classList.remove("hidden");

  finalMessageEl.textContent = "";
});


// ===== 16. 초기화 =====
initScratchpad();
updateStartButtonState();
