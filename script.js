/* =============================================================
   🔥 Firebase 설정 (인증 키 연동 완료)
   ============================================================= */
const firebaseConfig = {
  apiKey: "AIzaSyBxUVKRY_zHpCK1ht3wvwXwSKYQ-iAe-JA",
  authDomain: "homework-app-cd7bf.firebaseapp.com",
  projectId: "homework-app-cd7bf",
  storageBucket: "homework-app-cd7bf.firebasestorage.app",
  messagingSenderId: "506437711028",
  appId: "1:50643771028:web:c9c19c585f11535dc853e1",
  measurementId: "G-VSL3P66CW0"
};

/* =============================================================
   Firebase 모듈 불러오기 (SDK v9+, CDN / ES Module 방식)
   ============================================================= */
import {
  initializeApp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  getDocs,
  deleteDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* =============================================================
   상수
   ============================================================= */
const TEACHER_CODE = "skyoc31";
const COLLECTION_NAME = "homeworks";
const MAX_HOMEWORK_COUNT = 10;

/* =============================================================
   Firebase 초기화
   ============================================================= */
function isFirebaseConfigValid(config) {
  return Object.values(config).every((v) => typeof v === "string" && v.trim() !== "");
}

let db = null;
if (isFirebaseConfigValid(firebaseConfig)) {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} else {
  console.warn(
    "[숙제 공지 앱] firebaseConfig가 비어있습니다. script.js 상단의 firebaseConfig 값을 채워주세요."
  );
}

/* =============================================================
   DOM 참조
   ============================================================= */
const views = {
  main: document.getElementById("view-main"),
  detail: document.getElementById("view-detail"),
  auth: document.getElementById("view-auth"),
  write: document.getElementById("view-write"),
};

const listStatusEl = document.getElementById("list-status");
const listEl = document.getElementById("homework-list");

const btnAdd = document.getElementById("btn-add");
const btnBack = document.getElementById("btn-back");
const btnAuthCancel = document.getElementById("btn-auth-cancel");
const btnWriteCancel = document.getElementById("btn-write-cancel");

const formAuth = document.getElementById("form-auth");
const authCodeInput = document.getElementById("auth-code");

const formWrite = document.getElementById("form-write");
const inputDate = document.getElementById("input-date");
const inputType = document.getElementById("input-type");
const inputAmount = document.getElementById("input-amount");
const inputDesc = document.getElementById("input-desc");
const btnSubmit = document.getElementById("btn-submit");

const detailTitleEl = document.getElementById("detail-title");
const detailTypeEl = document.getElementById("detail-type");
const detailAmountEl = document.getElementById("detail-amount");
const detailDescEl = document.getElementById("detail-desc");

/* =============================================================
   상태
   ============================================================= */
let homeworkCache = [];

/* =============================================================
   화면 전환
   ============================================================= */
function showView(name) {
  Object.entries(views).forEach(([key, el]) => {
    el.classList.toggle("view--active", key === name);
  });
  const appEl = document.getElementById("app");
  if (appEl) appEl.scrollTop = 0;
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}

/* =============================================================
   목록 상태 메시지 (로딩 / 빈 목록 / 오류 / 설정 필요)
   ============================================================= */
function showListStatus(title, description) {
  listStatusEl.innerHTML = `<strong>${title}</strong>${description ? `<span>${description}</span>` : ""}`;
  listStatusEl.hidden = false;
  listEl.hidden = true;
}

function hideListStatus() {
  listStatusEl.hidden = true;
  listEl.hidden = false;
}

/* =============================================================
   숙제 목록 렌더링
   ============================================================= */
function renderList() {
  if (!homeworkCache.length) {
    showListStatus("아직 등록된 숙제가 없습니다.", "선생님이 숙제를 등록하면 이곳에 표시돼요.");
    return;
  }
  hideListStatus();

  listEl.innerHTML = "";
  homeworkCache.forEach((hw) => {
    const li = document.createElement("li");
    li.className = "hw-item";

    const tagClass = hw.type === "문법" ? "tag--grammar" : "tag--reading";

    li.innerHTML = `
      <button class="hw-card" type="button" data-id="${hw.id}">
        <span class="hw-card__accent" aria-hidden="true"></span>
        <span class="hw-card__body">
          <span class="hw-card__title">${escapeHtml(hw.title)}</span>
          <span class="hw-card__meta">
            <span class="tag ${tagClass}">${escapeHtml(hw.type || "")}</span>
            <span class="hw-card__amount">분량 ${escapeHtml(hw.amount || "")}</span>
          </span>
        </span>
        <span class="hw-card__chevron" aria-hidden="true">›</span>
      </button>
    `;
    listEl.appendChild(li);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

/* =============================================================
   Firestore 실시간 구독 (최신순 정렬, 최대 10개)
   ============================================================= */
function subscribeToHomeworks() {
  if (!db) {
    showListStatus(
      "Firebase 설정이 필요합니다.",
      "script.js 상단의 firebaseConfig 값을 채운 뒤 새로고침 해주세요."
    );
    return;
  }

  showListStatus("숙제를 불러오는 중입니다...", "");

  const homeworksQuery = query(
    collection(db, COLLECTION_NAME),
    orderBy("createdAt", "desc"),
    limit(MAX_HOMEWORK_COUNT)
  );

  onSnapshot(
    homeworksQuery,
    (snapshot) => {
      homeworkCache = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      renderList();
    },
    (error) => {
      console.error("[숙제 공지 앱] 목록을 불러오지 못했습니다:", error);
      showListStatus("숙제를 불러오지 못했습니다.", "잠시 후 다시 시도해주세요.");
    }
  );
}

/* =============================================================
   숙제 등록 + 10개 초과분 정리
   ============================================================= */
async function addHomework({ date, type, amount, description }) {
  if (!db) {
    alert("Firebase 설정이 필요합니다. script.js 상단의 firebaseConfig 값을 확인해주세요.");
    return false;
  }

  const title = `${date} 숙제`;

  try {
    const homeworksRef = collection(db, COLLECTION_NAME);
    await addDoc(homeworksRef, {
      title,
      date,
      type,
      amount,
      description: description || "",
      createdAt: serverTimestamp(),
    });
    await pruneOldHomeworks();
    return true;
  } catch (error) {
    console.error("[숙제 공지 앱] 저장 중 오류가 발생했습니다:", error);
    alert("숙제 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    return false;
  }
}

async function pruneOldHomeworks() {
  const allQuery = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(allQuery);
  if (snapshot.size <= MAX_HOMEWORK_COUNT) return;

  const overflowDocs = snapshot.docs.slice(MAX_HOMEWORK_COUNT);
  await Promise.all(
    overflowDocs.map((docSnap) => deleteDoc(doc(db, COLLECTION_NAME, docSnap.id)))
  );
}

/* =============================================================
   상세 화면 채우기
   ============================================================= */
function fillDetail(hw) {
  detailTitleEl.textContent = hw.title || "";
  detailTypeEl.textContent = hw.type || "-";
  detailAmountEl.textContent = hw.amount || "-";
  detailDescEl.textContent = hw.description && hw.description.trim() ? hw.description : "전달된 설명이 없습니다.";
}

/* =============================================================
   폼 초기화
   ============================================================= */
function resetWriteForm() {
  formWrite.reset();
}

/* =============================================================
   이벤트 바인딩
   ============================================================= */

// 메인 -> 인증 화면
btnAdd.addEventListener("click", () => {
  authCodeInput.value = "";
  showView("auth");
  authCodeInput.focus();
});

// 인증 취소 -> 메인
btnAuthCancel.addEventListener("click", () => {
  authCodeInput.value = "";
  showView("main");
});

// 인증 확인
formAuth.addEventListener("submit", (e) => {
  e.preventDefault();
  const code = authCodeInput.value.trim();
  if (code === TEACHER_CODE) {
    authCodeInput.value = "";
    showView("write");
    inputDate.focus();
  } else {
    alert("인증 코드가 일치하지 않습니다.");
  }
});

// 작성 취소 -> 메인
btnWriteCancel.addEventListener("click", () => {
  resetWriteForm();
  showView("main");
});

// 숙제 등록
formWrite.addEventListener("submit", async (e) => {
  e.preventDefault();

  const date = inputDate.value.trim();
  const type = inputType.value;
  const amount = inputAmount.value.trim();
  const description = inputDesc.value.trim();

  if (!date || !type || !amount) {
    alert("날짜, 숙제 유형, 분량을 모두 입력해주세요.");
    return;
  }

  btnSubmit.disabled = true;
  btnSubmit.textContent = "생성 중...";

  const success = await addHomework({ date, type, amount, description });

  btnSubmit.disabled = false;
  btnSubmit.textContent = "생성";

  if (success) {
    resetWriteForm();
    showView("main");
  }
});

// 목록 -> 상세 화면
listEl.addEventListener("click", (e) => {
  const card = e.target.closest(".hw-card");
  if (!card) return;
  const hw = homeworkCache.find((item) => item.id === card.dataset.id);
  if (!hw) return;
  fillDetail(hw);
  showView("detail");
});

// 상세 -> 메인
btnBack.addEventListener("click", () => {
  showView("main");
});

/* =============================================================
   시작
   ============================================================= */
subscribeToHomeworks();