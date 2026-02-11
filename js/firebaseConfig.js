// Firebase設定
const firebaseConfig = {
  apiKey: "AIzaSyDhMU7MpVUWWM6104amxLwkTjrPTQcEH5w",
  authDomain: "shuinsen-quiz.firebaseapp.com",
  databaseURL: "https://shuinsen-quiz-default-rtdb.firebaseio.com",
  projectId: "shuinsen-quiz",
  storageBucket: "shuinsen-quiz.firebasestorage.app",
  messagingSenderId: "762835902758",
  appId: "1:762835902758:web:c42ac9fa3ac990b79ea1e7",
  measurementId: "G-KRNLPRLX6W"
};

// Firebase初期化
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
