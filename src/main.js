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

  // 선생님이 폼에서 만든 "처음 점수 / 최종 점수 / 별표 개수" entry
  initialScore: "entry.1921141570",
  finalScore: "entry.1902624582",
  starCount: "entry.1581906669",
};

// ===== SweetAlert2 헬퍼 =====
function swalAlert(title, text, icon = "info") {
  return Swal.fire({
    title,
    text,
    icon,
    confirmButtonColor: "#3085d6",
    confirmButtonText: "확인",
  });
}

function swalConfirm({
  title,
  text,
  icon = "warning",
  confirmButtonText = "확인",
  cancelButtonText = "취소",
}) {
  return Swal.fire({
    title,
    text,
    icon,
    showCancelButton: true,
    confirmButtonColor: "#3085d6",
    cancelButtonColor: "#d33",
    confirmButtonText,
    cancelButtonText,
  });
}

// ===== 1. DOM 요소 =====

// 홈 + 섹션
const homeView = document.getElementById("home-view");
const controlSection = document.getElementById("control-section");
const quizSection = document.getElementById("quiz-section");
const summarySection = document.getElementById("summary-section");
const reviewSection = document.getElementById("review-section");
const controlBackHomeBtn = document.getElementById("control-back-home-btn");
const chatSection = document.getElementById("chat-section");
const finalSummarySection = document.getElementById("final-summary-section");
const dec2binPracticeSection = document.getElementById(
  "dec2bin-practice-section"
);
const bin2decPracticeSection = document.getElementById(
  "bin2dec-practice-section"
);

// 홈 화면 버튼
const openDec2BinPracticeBtn = document.getElementById(
  "open-dec2bin-practice-btn"
);
const openBin2DecPracticeBtn = document.getElementById(
  "open-bin2dec-practice-btn"
);
const openBaseQuizBtn = document.getElementById("open-base-quiz-btn");

// 연습 모드 내부 버튼
const dec2binBackHomeBtn = document.getElementById("dec2bin-back-home-btn");
const dec2binNewProblemBtn = document.getElementById(
  "dec2bin-new-problem-btn"
);

const bin2decBackHomeBtn = document.getElementById("bin2dec-back-home-btn");
const bin2decNewProblemBtn = document.getElementById(
  "bin2dec-new-problem-btn"
);

// 형성평가 컨트롤
const startQuizBtn = document.getElementById("startQuizBtn");
const stageLabel = document.getElementById("stage-label");
const questionList = document.getElementById("question-list");
const nextStageBtn = document.getElementById("nextStageBtn");
const finishQuizBtn = document.getElementById("finishQuizBtn");
const quizMessage = document.getElementById("quiz-message");
const timerSpan = document.getElementById("timer");

const summaryTable = document.getElementById("summary-table");

const reviewQuestionText = document.getElementById("review-question-text");
const reviewAnswerInput = document.getElementById("review-answer");
const reviewSubmitBtn = document.getElementById("review-submit-btn");
const reviewFeedback = document.getElementById("review-feedback");

const chatLog = document.getElementById("chat-log");
const chatInput = document.getElementById("chat-input");
const chatSendBtn = document.getElementById("chat-send-btn");

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

// ===== 2. 형성평가 상태 변수 =====
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
      gradeAllQuestions(); // 자동 채점
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

// ===== 8. 학생 정보 입력 → 시작 버튼 활성화 =====
function updateStartButtonState() {
  const idVal = studentIdInput.value.trim();
  const nameVal = studentNameInput.value.trim();
  startQuizBtn.disabled = !(idVal && nameVal);
}
studentIdInput.addEventListener("input", updateStartButtonState);
studentNameInput.addEventListener("input", updateStartButtonState);

// ===== 9. 홈 화면 & 섹션 전환 =====
function hideAllMainSections() {
  controlSection.classList.add("hidden");
  quizSection.classList.add("hidden");
  summarySection.classList.add("hidden");
  reviewSection.classList.add("hidden");
  chatSection.classList.add("hidden");
  finalSummarySection.classList.add("hidden");
  dec2binPracticeSection.classList.add("hidden");
  bin2decPracticeSection.classList.add("hidden");
}

function showHome() {
  hideAllMainSections();
  homeView.classList.remove("hidden");
}

// 홈 → 10진수→2진수 연습
openDec2BinPracticeBtn.addEventListener("click", () => {
  hideAllMainSections();
  homeView.classList.add("hidden");
  dec2binPracticeSection.classList.remove("hidden");
  newDec2BinProblem();
});

// 홈 → 2진수→10진수 연습
openBin2DecPracticeBtn.addEventListener("click", () => {
  hideAllMainSections();
  homeView.classList.add("hidden");
  bin2decPracticeSection.classList.remove("hidden");
  newBin2DecProblem();
});

// 홈 → 형성평가 컨트롤
openBaseQuizBtn.addEventListener("click", () => {
  hideAllMainSections();
  homeView.classList.add("hidden");
  controlSection.classList.remove("hidden");
});

// 연습모드 → 홈
dec2binBackHomeBtn.addEventListener("click", () => {
  showHome();
});
bin2decBackHomeBtn.addEventListener("click", () => {
  showHome();
});
controlBackHomeBtn.addEventListener("click", () => {
  // 아직 퀴즈 시작 전 단계라 기록은 없으니 바로 홈으로 보내면 충분
  showHome();
});

// ===== 10. 형성평가: 이벤트 =====
startQuizBtn.addEventListener("click", async () => {
  const idVal = studentIdInput.value.trim();
  const nameVal = studentNameInput.value.trim();
  if (!idVal || !nameVal) {
    await swalAlert("입력 필요", "학번과 이름을 모두 입력한 뒤 시작할 수 있습니다.", "warning");
    return;
  }

  studentId = idVal;
  studentName = nameVal;

  resetState();
  generateAllQuestions();
  quizSection.classList.remove("hidden");
  summarySection.classList.add("hidden");
  reviewSection.classList.add("hidden");
  chatSection.classList.add("hidden");
  finalSummarySection.classList.add("hidden");
  renderCurrentSection();
  startTimer();
});

nextStageBtn.addEventListener("click", async () => {
  if (quizLocked) {
    await swalAlert(
      "시간 종료",
      "시간이 종료되어 더 이상 수정할 수 없습니다.",
      "warning"
    );
    return;
  }
  const section = SECTIONS[currentSectionIndex];
  const sectionQuestions = questions.filter((q) => q.sectionId === section.id);
  const allAnswered = sectionQuestions.every(
    (q) => q.userAnswer && q.userAnswer !== ""
  );
  if (!allAnswered) {
    await swalAlert(
      "답안 미완성",
      "이 단계의 5문제에 모두 답을 입력해야 다음 단계로 넘어갈 수 있습니다.",
      "warning"
    );
    return;
  }

  const prevSection = SECTIONS[currentSectionIndex];
  if (currentSectionIndex < SECTIONS.length - 1) {
    currentSectionIndex++;
    const newSection = SECTIONS[currentSectionIndex];
    if (prevSection.id === "A" && newSection.id === "B") {
      clearScratchpad();
    }
    renderCurrentSection();
  }
});

finishQuizBtn.addEventListener("click", async () => {
  if (quizLocked) {
    await swalAlert("이미 채점 완료", "이미 채점이 진행되었습니다.", "info");
    return;
  }
  const section = SECTIONS[currentSectionIndex];
  const sectionQuestions = questions.filter((q) => q.sectionId === section.id);
  const allAnswered = sectionQuestions.every(
    (q) => q.userAnswer && q.userAnswer !== ""
  );
  if (!allAnswered) {
    await swalAlert(
      "답안 미완성",
      "마지막 단계의 5문제도 모두 답을 입력해주세요.",
      "warning"
    );
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
  if (formSubmitted) return;
  if (!FORM_URL) return;

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

  try {
    await fetch(FORM_URL, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: params.toString(),
    });
    formSubmitted = true;
    console.log("Google Form 제출 시도 완료 (no-cors, 응답은 확인 불가)");
  } catch (err) {
    console.error("Google Form 제출 중 오류:", err);
  }
}

// ===== 12. 채점 & 요약 =====
function normalizeAnswer(str) {
  return (str || "").trim().toUpperCase();
}

function gradeAllQuestions() {
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
    swalConfirm({
      title: "축하합니다!",
      text: "20문제를 모두 맞았습니다. 다음 수준의 문제로 넘어가시겠습니까?",
      icon: "success",
      confirmButtonText: "네, 다음 수준으로",
      cancelButtonText: "아니요",
    }).then((result) => {
      if (result.isConfirmed) {
        swalAlert(
          "준비 중",
          "다음 수준 문제는 나중에 확장할 수 있습니다 🙂",
          "info"
        );
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
summaryTable.addEventListener("click", async (e) => {
  const tr = e.target.closest("tr[data-qid]");
  if (!tr) return;

  const qid = tr.getAttribute("data-qid");
  const q = questions.find((qq) => qq.id === qid);
  if (!q) return;

  if (q.status !== "X") {
    await swalAlert(
      "다시 풀기 불가",
      "이미 맞았거나( O / △ / ★ ) 다시 풀기 대상이 아닙니다.",
      "info"
    );
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

reviewSubmitBtn.addEventListener("click", async () => {
  if (!currentRetryQuestion) return;

  const ans = normalizeAnswer(reviewAnswerInput.value);
  if (!ans) {
    await swalAlert("입력 필요", "답을 입력해주세요.", "warning");
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
- 각 자리의 가중치를 물어봐서 맞으면 맞다고 답해주고
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

// “같은 학생으로 새 문제 풀기” (버튼 라벨은 선생님 취향대로 :)
// “홈으로 돌아가기”
restartQuizBtn.addEventListener("click", async () => {
  // 아직 폼 안 보냈으면 한 번 물어보기
  if (!formSubmitted) {
    const result = await swalConfirm({
      title: "기록 미전송",
      text: "아직 Google Form으로 기록이 전송되지 않았습니다.\n그래도 홈으로 돌아가시겠습니까?",
      icon: "warning",
      confirmButtonText: "네, 홈으로 갈게요",
      cancelButtonText: "취소",
    });
    if (!result.isConfirmed) return;
  }

  // 형성평가 상태 초기화
  resetState();

  // 학번/이름은 남겨둘 수도 있고, 완전히 초기화하고 싶으면 여기서 비워도 됨
  // studentIdInput.value = "";
  // studentNameInput.value = "";
  // updateStartButtonState();

  // 홈 화면으로 이동
  showHome();
});


// ===== 16. 10진수 → 2진수 연습 (change1 스타일) =====
const dec2binState = {
  decimal: 0,
  bitCount: 0,
  bits: [],
  weights: [],
};

function newDec2BinProblem() {
  const n = randInt(0, 1023);
  const bitLen = Math.max(1, n.toString(2).length);

  dec2binState.decimal = n;
  dec2binState.bitCount = bitLen;
  dec2binState.bits = new Array(bitLen).fill(0);
  dec2binState.weights = [];

  for (let i = 0; i < bitLen; i++) {
    dec2binState.weights[i] = 2 ** (bitLen - 1 - i); // MSB 왼쪽
  }

  document.getElementById("dec2bin-decimal").textContent = n;
  document.getElementById("dec2bin-bits-input").value = "";

  renderDec2BinBitsGrid();
  updateDec2BinSum();
  document.getElementById("dec2bin-bits-feedback").textContent = "";
  document.getElementById("dec2bin-final-feedback").textContent = "";
}

function renderDec2BinBitsGrid() {
  const grid = document.getElementById("dec2bin-bits-grid");
  grid.innerHTML = "";

  const bitLen = dec2binState.bitCount;
  const weights = dec2binState.weights;

  grid.style.display = "grid";
  grid.style.gridTemplateColumns = `repeat(${bitLen}, minmax(56px, 1fr))`;
  grid.style.gap = "8px";

  for (let i = 0; i < bitLen; i++) {
    const col = document.createElement("div");
    col.className = "dec2bin-col";
    col.dataset.index = String(i);

    const bitBtn = document.createElement("button");
    bitBtn.className = "dec2bin-bit-btn";
    bitBtn.textContent = `${bitLen - 1 - i}번 비트`;
    bitBtn.addEventListener("click", () => {
      dec2binState.bits[i] = dec2binState.bits[i] ? 0 : 1;
      updateDec2BinView();
    });

    const weightDiv = document.createElement("div");
    weightDiv.className = "dec2bin-weight";
    weightDiv.textContent = weights[i];

    const bitValDiv = document.createElement("div");
    bitValDiv.className = "dec2bin-bit-value";
    bitValDiv.textContent = "0";

    const contribDiv = document.createElement("div");
    contribDiv.className = "dec2bin-contrib";
    contribDiv.textContent = "0";

    col.appendChild(bitBtn);
    col.appendChild(weightDiv);
    col.appendChild(bitValDiv);
    col.appendChild(contribDiv);

    grid.appendChild(col);
  }

  document.getElementById("dec2bin-bits-area").classList.add("hidden");
}

function updateDec2BinView() {
  const bits = dec2binState.bits;
  const weights = dec2binState.weights;

  const cols = document.querySelectorAll("#dec2bin-bits-grid .dec2bin-col");

  cols.forEach((col) => {
    const idx = Number(col.dataset.index);
    const bitValDiv = col.querySelector(".dec2bin-bit-value");
    const contribDiv = col.querySelector(".dec2bin-contrib");
    const b = bits[idx];

    // 0 / 1 표시
    bitValDiv.textContent = b;

    // 색상 토글 (1이면 강조색, 0이면 회색)
    if (b) {
      bitValDiv.classList.add("on");
    } else {
      bitValDiv.classList.remove("on");
    }

    // 아래 실제 값 (가중치 or 0)
    contribDiv.textContent = b ? weights[idx] : 0;
  });

  updateDec2BinSum();
}


// 선택한 비트의 합 + 정답 여부 표시
function updateDec2BinSum() {
  const bits = dec2binState.bits;
  const weights = dec2binState.weights;
  let sum = 0;

  for (let i = 0; i < bits.length; i++) {
    if (bits[i]) sum += weights[i];
  }

  // 합계 표시
  document.getElementById(
    "dec2bin-sum-text"
  ).innerHTML = `<b>선택한 비트의 합:</b> ${sum}`;

  // 정답/오답 피드백
  const target = dec2binState.decimal;
  const fbEl = document.getElementById("dec2bin-final-feedback");
  const bitsAreaVisible = !document
    .getElementById("dec2bin-bits-area")
    .classList.contains("hidden");

  // 아직 비트 수 정답을 못 맞춘 상태라면 메시지 비움
  if (!bitsAreaVisible) {
    fbEl.textContent = "";
    return;
  }

  if (sum === target) {
    const binStr = bits.map((b) => (b ? "1" : "0")).join("");
    fbEl.textContent = `정답! ${target}을(를) 2진수로 표현하면 ${binStr} 입니다.`;
  } else {
    fbEl.textContent = "아직 정답이 아닙니다. 비트를 조정해 보세요 🙂";
  }
}


// 비트 수 정답 확인
document
  .getElementById("dec2bin-check-bits-btn")
  .addEventListener("click", () => {
    const input = document.getElementById("dec2bin-bits-input");
    const userBits = Number(input.value);
    const correctBits = dec2binState.bitCount;
    const fb = document.getElementById("dec2bin-bits-feedback");

    if (!userBits) {
      fb.textContent = "비트 수를 입력해 주세요.";
      document.getElementById("dec2bin-bits-area").classList.add("hidden");
      return;
    }

    if (userBits === correctBits) {
      fb.textContent = `정답입니다! 이 수를 표현하는 데 필요한 비트 수는 ${correctBits}비트입니다.`;
      document
        .getElementById("dec2bin-bits-area")
        .classList.remove("hidden");
    } else {
      fb.textContent = `틀렸습니다. 다시 생각해 보세요 🙂`;
      document.getElementById("dec2bin-bits-area").classList.add("hidden");
    }
  });

// 새 문제 버튼
dec2binNewProblemBtn.addEventListener("click", () => {
  newDec2BinProblem();
});

// ===== 17. 2진수 → 10진수 연습 (change2 스타일) =====
const bin2decState = {
  bitLen: 0,
  bits: [],
  weights: [],
  answerWeights: [],
  decimalValue: 0,
};

function newBin2DecProblem() {
  const bitLen = randInt(1, 10);
  let bits;
  do {
    bits = Array.from({ length: bitLen }, () => randInt(0, 1));
  } while (!bits.some((b) => b === 1)); // 1이 적어도 하나

  const weights = [];
  for (let i = 0; i < bitLen; i++) {
    weights[i] = 2 ** (bitLen - 1 - i); // MSB 왼쪽
  }

  const answerWeights = [];
  let decimalValue = 0;
  for (let i = 0; i < bitLen; i++) {
    if (bits[i] === 1) {
      answerWeights.push(weights[i]);
      decimalValue += weights[i];
    }
  }

  bin2decState.bitLen = bitLen;
  bin2decState.bits = bits;
  bin2decState.weights = weights;
  bin2decState.answerWeights = answerWeights;
  bin2decState.decimalValue = decimalValue;

  document.getElementById("bin2dec-binary").textContent = bits.join("");

  const grid = document.getElementById("bin2dec-weights-grid");
  grid.innerHTML = "";
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = `repeat(${bitLen}, minmax(56px, 1fr))`;
  grid.style.gap = "8px";

  for (let i = 0; i < bitLen; i++) {
    const col = document.createElement("div");
    col.style.display = "flex";
    col.style.flexDirection = "column";
    col.style.alignItems = "center";
    col.style.gap = "4px";

    const bitLabel = document.createElement("div");
    bitLabel.textContent = bits[i];
    bitLabel.style.fontWeight = "600";

    const input = document.createElement("input");
    input.type = "text";
    input.dataset.index = String(i);
    input.style.textAlign = "center";
    input.style.width = "100%";
    input.style.maxWidth = "64px";

    col.appendChild(bitLabel);
    col.appendChild(input);
    grid.appendChild(col);
  }

  document.getElementById("bin2dec-weights-feedback").textContent = "";
  document.getElementById("bin2dec-final-feedback").textContent = "";
  document.getElementById("bin2dec-decimal-input").value = "";
}

document
  .getElementById("bin2dec-check-weights-btn")
  .addEventListener("click", () => {
    const grid = document.getElementById("bin2dec-weights-grid");
    const inputs = grid.querySelectorAll("input");
    const userWeights = [];
    const fb = document.getElementById("bin2dec-weights-feedback");

    try {
      inputs.forEach((input, idx) => {
        const v = input.value.trim();
        if (bin2decState.bits[idx] === 1 && v !== "") {
          const num = Number(v);
          if (Number.isNaN(num)) throw new Error("NaN");
          userWeights.push(num);
        }
      });

      const sortedUser = userWeights.slice().sort((a, b) => a - b);
      const sortedAns = bin2decState.answerWeights
        .slice()
        .sort((a, b) => a - b);

      if (JSON.stringify(sortedUser) === JSON.stringify(sortedAns)) {
        fb.textContent =
          "정답입니다! 이제 각 가중치의 합을 계산해 10진수 값을 구해보세요.";
      } else {
        fb.textContent =
          "틀렸습니다. 1이 있는 자리의 가중치를 정확히 입력했는지 다시 확인해 보세요.";
      }
    } catch (e) {
      fb.textContent = "숫자만 입력해 주세요.";
    }
  });

document
  .getElementById("bin2dec-final-check-btn")
  .addEventListener("click", () => {
    const input = document.getElementById("bin2dec-decimal-input");
    const value = Number(input.value);
    const fb = document.getElementById("bin2dec-final-feedback");

    if (Number.isNaN(value)) {
      fb.textContent = "10진수 값을 숫자로 입력해 주세요.";
      return;
    }

    if (value === bin2decState.decimalValue) {
      fb.textContent = `정답! 2진수 ${bin2decState.bits.join(
        ""
      )}의 10진수 값은 ${bin2decState.decimalValue}입니다.`;
    } else {
      fb.textContent = "틀렸습니다. 각 가중치의 합을 다시 계산해 보세요.";
    }
  });

// 새 문제 버튼
bin2decNewProblemBtn.addEventListener("click", () => {
  newBin2DecProblem();
});

// ===== 18. 초기화 =====
initScratchpad();
updateStartButtonState();
showHome(); // 처음에는 홈 화면 보이기
