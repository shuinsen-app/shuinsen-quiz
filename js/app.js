// 衆院選クイズ メインアプリケーション
const { createApp, ref, computed, watch, onMounted, nextTick, onUnmounted } = Vue;

// ランキング管理（Firebase Realtime Database）
const MAX_RANKING = 10;

// 初級編の対象都道府県
const BEGINNER_PREFECTURES = ['北海道', '東京', '愛知', '大阪', '福岡'];

function getRankingPath(mode) {
  return 'rankings/' + (mode || 'beginner');
}

// Firebaseからランキングを読み込み（非同期）
async function loadRankingFromDB(mode) {
  try {
    const snapshot = await db.ref(getRankingPath(mode))
      .orderByChild('score')
      .limitToLast(MAX_RANKING)
      .once('value');
    
    const data = snapshot.val();
    if (!data) return [];
    
    // オブジェクト→配列、スコア降順
    return Object.values(data)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RANKING);
  } catch (error) {
    console.error('ランキング読み込みエラー:', error);
    return [];
  }
}

// Firebaseにスコアを追加（非同期）
async function addToRankingDB(name, score, mode) {
  try {
    const entry = {
      name,
      score,
      date: new Date().toISOString()
    };
    await db.ref(getRankingPath(mode)).push(entry);
    
    // 上位10件以外を削除（クリーンアップ）
    const snapshot = await db.ref(getRankingPath(mode))
      .orderByChild('score')
      .once('value');
    
    const data = snapshot.val();
    if (data) {
      const entries = Object.entries(data)
        .map(([key, val]) => ({ key, ...val }))
        .sort((a, b) => b.score - a.score);
      
      // 10件超えたら下位を削除
      if (entries.length > MAX_RANKING) {
        const toDelete = entries.slice(MAX_RANKING);
        const updates = {};
        toDelete.forEach(e => { updates[e.key] = null; });
        await db.ref(getRankingPath(mode)).update(updates);
      }
    }
    
    return await loadRankingFromDB(mode);
  } catch (error) {
    console.error('ランキング登録エラー:', error);
    return [];
  }
}

createApp({
  setup() {
    // 画面状態
    const screen = ref('title'); // 'title', 'quiz', 'result', 'ranking'
    const gameMode = ref('beginner'); // 'beginner' or 'advanced'
    
    // ゲームデータ
    const electionData = ref(null);
    const districts = ref([]);
    
    // クイズ状態
    const currentQuestion = ref(0);
    const totalQuestions = ref(10);
    const score = ref(0);
    const answered = ref(false);
    const isCorrect = ref(false);
    
    // 現在の問題
    const currentDistrict = ref(null);
    const choices = ref([]);
    const quizDistricts = ref([]);
    const selectedChoice = ref(null);
    
    // タイマー
    const TIME_LIMIT = 20;
    const timeLeft = ref(TIME_LIMIT);
    const questionStartTime = ref(0);
    const answerTime = ref(0);
    const questionScore = ref(0);
    let timerInterval = null;
    
    // ランキング
    const ranking = ref([]);
    const playerName = ref('');
    const showNameInput = ref(false);
    
    // Chart.js インスタンス
    let chartInstance = null;
    
    // データ読み込み
    async function loadData() {
      try {
        const response = await fetch('data/election2026.json');
        electionData.value = await response.json();
        districts.value = electionData.value.districts;
      } catch (error) {
        console.error('データの読み込みに失敗しました:', error);
      }
    }
    
    // タイマー開始
    function startTimer() {
      timeLeft.value = TIME_LIMIT;
      questionStartTime.value = Date.now();
      
      if (timerInterval) clearInterval(timerInterval);
      
      timerInterval = setInterval(() => {
        const elapsed = (Date.now() - questionStartTime.value) / 1000;
        timeLeft.value = Math.max(0, TIME_LIMIT - elapsed);
        
        if (timeLeft.value <= 0) {
          // 時間切れ
          clearInterval(timerInterval);
          if (!answered.value) {
            handleTimeUp();
          }
        }
      }, 50);
    }
    
    // タイマー停止
    function stopTimer() {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
    }
    
    // 時間切れ処理
    function handleTimeUp() {
      answered.value = true;
      isCorrect.value = false;
      answerTime.value = TIME_LIMIT;
      questionScore.value = 0;
      showAnswerMap();
    }
    
    // スコア計算
    // 4秒以内: 5 + 5 = 10点
    // 4秒以降: 5 + 残り秒数 * 5/16 (小数点2桁)
    function calculateScore(timeRemaining) {
      if (!isCorrect.value) return 0;
      
      const elapsedTime = TIME_LIMIT - timeRemaining;
      
      if (elapsedTime <= 4) {
        // 4秒以内は満点
        return 10.00;
      } else {
        // 4秒以降: 5点 + 残り秒数 * 5/16
        const bonus = timeRemaining * 5 / 16;
        const total = 5 + bonus;
        return Math.round(total * 100) / 100;
      }
    }
    
    // モード表示名
    const modeLabel = computed(() => {
      return gameMode.value === 'beginner' ? '初級編' : '上級編';
    });
    
    // 対象選挙区数
    const filteredDistrictsCount = computed(() => {
      if (gameMode.value === 'beginner') {
        return districts.value.filter(d => BEGINNER_PREFECTURES.includes(d.prefecture)).length;
      }
      return districts.value.length;
    });
    
    // ゲーム開始
    function startGame(mode) {
      if (mode) gameMode.value = mode;
      currentQuestion.value = 0;
      score.value = 0;
      showNameInput.value = false;
      
      // モードに応じて選挙区をフィルタリング
      let pool = districts.value;
      if (gameMode.value === 'beginner') {
        pool = districts.value.filter(d => BEGINNER_PREFECTURES.includes(d.prefecture));
      }
      
      // ランダムに問題を選択
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      quizDistricts.value = shuffled.slice(0, totalQuestions.value);
      
      screen.value = 'quiz';
      loadQuestion();
    }
    
    // 問題を読み込み
    function loadQuestion() {
      answered.value = false;
      isCorrect.value = false;
      selectedChoice.value = null;
      questionScore.value = 0;
      
      currentDistrict.value = quizDistricts.value[currentQuestion.value];
      generateChoices();
      
      nextTick(() => {
        renderChart();
        startTimer();
      });
    }
    
    // 4択を生成
    function generateChoices() {
      const correct = currentDistrict.value;
      
      // モードに応じて選択肢のプールを絞る
      let pool = districts.value;
      if (gameMode.value === 'beginner') {
        pool = districts.value.filter(d => BEGINNER_PREFECTURES.includes(d.prefecture));
      }
      
      const others = pool
        .filter(d => d.id !== correct.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
      
      choices.value = [correct, ...others].sort(() => Math.random() - 0.5);
    }
    
    // candidatesからresultsを計算
    function getResultsFromCandidates(candidates) {
      const totalVotes = candidates.reduce((sum, c) => sum + c.votes, 0);
      return candidates.map(c => ({
        party: c.party,
        percentage: Math.round(c.votes / totalVotes * 1000) / 10
      }));
    }
    
    // チャートを描画
    function renderChart() {
      const canvas = document.getElementById('pieChart');
      if (!canvas || !currentDistrict.value) return;
      
      if (chartInstance) {
        chartInstance.destroy();
      }
      
      const ctx = canvas.getContext('2d');
      const results = getResultsFromCandidates(currentDistrict.value.candidates);
      
      chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: results.map(r => r.party),
          datasets: [{
            data: results.map(r => r.percentage),
            backgroundColor: results.map(r => getPartyColor(r.party)),
            borderWidth: 2,
            borderColor: '#fff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  return `${context.label}: ${context.parsed}%`;
                }
              }
            }
          }
        }
      });
    }
    
    // 回答選択
    function selectAnswer(choice) {
      if (answered.value) return;
      
      stopTimer();
      answered.value = true;
      selectedChoice.value = choice;
      isCorrect.value = choice.id === currentDistrict.value.id;
      answerTime.value = TIME_LIMIT - timeLeft.value;
      
      // スコア計算
      questionScore.value = calculateScore(timeLeft.value);
      score.value = Math.round((score.value + questionScore.value) * 100) / 100;
      showAnswerMap();
    }
    
    // 次の問題へ
    function nextQuestion() {
      destroyAnswerMap();
      if (currentQuestion.value + 1 >= totalQuestions.value) {
        stopTimer();
        screen.value = 'result';
        showNameInput.value = true;
      } else {
        currentQuestion.value++;
        loadQuestion();
      }
    }
    
    // 選択肢のクラスを取得
    function getChoiceClass(choice) {
      if (!answered.value) return '';
      
      if (choice.id === currentDistrict.value.id) {
        return 'correct';
      }
      if (selectedChoice.value && choice.id === selectedChoice.value.id) {
        return 'incorrect';
      }
      return '';
    }
    
    // 結果メッセージ
    function getResultMessage() {
      const maxScore = totalQuestions.value * 10;
      const percent = score.value / maxScore * 100;
      
      if (percent >= 95) {
        return '🎊 パーフェクト！選挙マスターです！';
      } else if (percent >= 80) {
        return '🌟 素晴らしい！かなりの選挙通ですね！';
      } else if (percent >= 60) {
        return '👍 よくできました！もう少しで上級者！';
      } else if (percent >= 40) {
        return '📚 まずまず！もっと選挙区を覚えよう！';
      } else {
        return '💪 がんばろう！選挙区の特徴を覚えていこう！';
      }
    }
    
    // ランキング登録
    async function submitScore() {
      if (!playerName.value.trim()) {
        playerName.value = '名無しさん';
      }
      ranking.value = await addToRankingDB(playerName.value.trim(), score.value, gameMode.value);
      showNameInput.value = false;
    }
    
    // ランキング表示
    async function showRanking(mode) {
      if (mode) gameMode.value = mode;
      ranking.value = await loadRankingFromDB(gameMode.value);
      screen.value = 'ranking';
    }
    
    // タイマー表示用（小数点1桁）
    const timerDisplay = computed(() => {
      return timeLeft.value.toFixed(1);
    });
    
    // タイマーの色
    const timerColor = computed(() => {
      if (timeLeft.value <= 5) return '#dc3545';
      if (timeLeft.value <= 10) return '#ffc107';
      return '#28a745';
    });
    
    // タイマーの幅（パーセント）
    const timerWidth = computed(() => {
      return (timeLeft.value / TIME_LIMIT) * 100;
    });
    
    // 数値カンマ区切り
    function formatNumber(num) {
      return num.toLocaleString();
    }
    
    // 得票率を計算
    function calculatePercentage(votes, candidates) {
      const total = candidates.reduce((sum, c) => sum + c.votes, 0);
      return (votes / total * 100).toFixed(1);
    }

    // 都道府県の中心座標
    const PREF_COORDS = {
      '北海道':[43.06,141.35],'青森':[40.82,140.74],'岩手':[39.70,141.15],'宮城':[38.27,140.87],
      '秋田':[39.72,140.10],'山形':[38.24,140.33],'福島':[37.75,140.47],'茨城':[36.34,140.45],
      '栃木':[36.57,139.88],'群馬':[36.39,139.06],'埼玉':[35.86,139.65],'千葉':[35.61,140.12],
      '東京':[35.68,139.69],'神奈川':[35.45,139.64],'新潟':[37.90,139.02],'富山':[36.70,137.21],
      '石川':[36.59,136.63],'福井':[36.07,136.22],'山梨':[35.66,138.57],'長野':[36.23,138.18],
      '岐阜':[35.39,136.72],'静岡':[34.98,138.38],'愛知':[35.18,136.91],'三重':[34.73,136.51],
      '滋賀':[35.00,135.87],'京都':[35.02,135.76],'大阪':[34.69,135.52],'兵庫':[34.69,135.18],
      '奈良':[34.69,135.83],'和歌山':[34.23,135.17],'鳥取':[35.50,134.24],'島根':[35.47,133.05],
      '岡山':[34.66,133.93],'広島':[34.40,132.46],'山口':[34.19,131.47],'徳島':[34.07,134.56],
      '香川':[34.34,134.04],'愛媛':[33.84,132.77],'高知':[33.56,133.53],'福岡':[33.61,130.42],
      '佐賀':[33.25,130.30],'長崎':[32.74,129.87],'熊本':[32.79,130.74],'大分':[33.24,131.61],
      '宮崎':[31.91,131.42],'鹿児島':[31.56,130.56],'沖縄':[26.34,127.80]
    };

    let answerMapInstance = null;

    // 地図を表示
    function showAnswerMap() {
      destroyAnswerMap();
      Vue.nextTick(() => {
        const el = document.getElementById('answerMap');
        if (!el) return;
        const pref = currentDistrict.value.prefecture;
        const coords = PREF_COORDS[pref];
        if (!coords) return;
        const map = L.map('answerMap', { zoomControl: false, attributionControl: false }).setView(coords, 10);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 18
        }).addTo(map);
        L.marker(coords).addTo(map);
        answerMapInstance = map;
      });
    }

    function destroyAnswerMap() {
      if (answerMapInstance) {
        answerMapInstance.remove();
        answerMapInstance = null;
      }
    }
    
    // 初期化
    onMounted(async () => {
      loadData();
      ranking.value = await loadRankingFromDB(gameMode.value);
    });
    
    onUnmounted(() => {
      stopTimer();
    });
    
    return {
      // 状態
      screen,
      gameMode,
      modeLabel,
      filteredDistrictsCount,
      currentQuestion,
      totalQuestions,
      score,
      answered,
      isCorrect,
      currentDistrict,
      choices,
      selectedChoice,
      questionScore,
      
      // タイマー
      timeLeft,
      timerDisplay,
      timerColor,
      timerWidth,
      answerTime,
      
      // ランキング
      ranking,
      playerName,
      showNameInput,
      
      // メソッド
      startGame,
      selectAnswer,
      nextQuestion,
      getChoiceClass,
      getResultMessage,
      getResultsFromCandidates,
      submitScore,
      showRanking,
      formatNumber,
      calculatePercentage,
      getPartyColor,
      showAnswerMap,
      destroyAnswerMap
    };
  }
}).mount('#app');
