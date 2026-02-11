// 政党カラー定義（Wikipedia公式カラー準拠）
const PARTY_COLORS = {
  '自民': '#E53935',        // 赤（2017年以降の公式カラー）
  '自民党': '#E53935',
  '中道': '#2196F3',        // 青（公式カラー）
  '中道改革連合': '#2196F3',
  '維新': '#4CAF50',        // 緑（公式カラー）
  '日本維新の会': '#4CAF50',
  '国民': '#FFC107',        // 黄色（公式カラー：黄色+青色、黄色が主）
  '国民民主党': '#FFC107',
  '共産': '#9C27B0',        // 紫
  '共産党': '#9C27B0',
  '日本共産党': '#9C27B0',
  'れいわ': '#E91E63',      // ピンク（公式カラー）
  'れいわ新選組': '#E91E63',
  '減ゆ': '#827717',        // オリーブ（公式カラー不明）
  '減税日本': '#827717',
  '減税日本・ゆうこく連合': '#827717',
  '参政': '#FF9800',        // 橙色（公式カラー）
  '参政党': '#FF9800',
  '保守': '#00BCD4',        // ティール
  '日本保守党': '#00BCD4',
  'みらい': '#80CBC4',      // ミント
  '無所属': '#9E9E9E',
  '無・他': '#9E9E9E',
  '諸派': '#9E9E9E',
  'その他': '#757575'
};

// 政党名から色を取得
function getPartyColor(partyName) {
  // 完全一致を優先
  if (PARTY_COLORS[partyName]) {
    return PARTY_COLORS[partyName];
  }
  // 部分一致を試行
  for (const key in PARTY_COLORS) {
    if (partyName.includes(key) || key.includes(partyName)) {
      return PARTY_COLORS[key];
    }
  }
  // デフォルト色
  return '#9E9E9E';
}

// 政党の短縮名を取得
const PARTY_SHORT_NAMES = {
  '自由民主党': '自民',
  '中道改革連合': '中道',
  '日本維新の会': '維新',
  '国民民主党': '国民',
  '日本共産党': '共産',
  'れいわ新選組': 'れいわ',
  '減税日本・ゆうこく連合': '減ゆ',
  '参政党': '参政',
  '日本保守党': '保守',
  '無所属': '無・他'
};

function getPartyShortName(partyName) {
  return PARTY_SHORT_NAMES[partyName] || partyName;
}
