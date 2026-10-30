import {englishQuestions} from './game-en.mjs';
/** Curated game content kept separate from persistence and UI. */
export const stages = Object.freeze([
  { id: 'egypt', order: 0, country: 'Egypt', jp: 'エジプト', city: 'Cairo', flag: '🇪🇬', coords: [30.0444, 31.2357], tag: 'THE BEGINNING', landmark: 'Pyramids of Giza', theme: 'sand', intro: 'すべての旅は、ナイル川のほとりから。', stamp: '01' },
  { id: 'turkiye', order: 1, country: 'Türkiye', jp: 'トルコ', city: 'Istanbul', flag: '🇹🇷', coords: [41.0082, 28.9784], tag: 'EAST MEETS WEST', landmark: 'Hagia Sophia', theme: 'rose', intro: 'ヨーロッパとアジアが出会う街へ。', stamp: '02' },
  { id: 'italy', order: 2, country: 'Italy', jp: 'イタリア', city: 'Rome', flag: '🇮🇹', coords: [41.9028, 12.4964], tag: 'A TIMELESS CITY', landmark: 'Colosseum', theme: 'olive', intro: '歴史が息づく永遠の都を歩く。', stamp: '03' },
  { id: 'france', order: 3, country: 'France', jp: 'フランス', city: 'Paris', flag: '🇫🇷', coords: [48.8566, 2.3522], tag: 'CITY OF LIGHT', landmark: 'Eiffel Tower', theme: 'blue', intro: '芸術と文化の街で、次の扉を開こう。', stamp: '04' },
  { id: 'japan', order: 4, country: 'Japan', jp: '日本', city: 'Tokyo', flag: '🇯🇵', coords: [35.6762, 139.6503], tag: 'THE DESTINATION', landmark: 'Tokyo', theme: 'pink', intro: '世界を巡る旅、最後の目的地へ。', stamp: '05' }
]);

export const questions = Object.freeze({
  egypt: [
    { id:'eg1', prompt:'ギザの三大ピラミッドがある都市は？', options:['アレクサンドリア','カイロ近郊','ルクソール','アスワン'], correct:1, note:'ギザのピラミッドは、エジプトの首都カイロ近郊にあります。', category:'HISTORY' },
    { id:'eg2', prompt:'エジプトを南から北へ流れる大きな川は？', options:['ナイル川','チグリス川','ドナウ川','ヨルダン川'], correct:0, note:'ナイル川はエジプトの歴史や暮らしを支えてきた川です。', category:'GEOGRAPHY' },
    { id:'eg3', prompt:'古代エジプトの文字として有名なのは？', options:['ルーン文字','楔形文字','ヒエログリフ','甲骨文字'], correct:2, note:'ヒエログリフは古代エジプトで使われていた文字体系です。', category:'CULTURE' }
  ],
  turkiye: [
    { id:'tr1', prompt:'イスタンブールを通る、海峡の名前は？', options:['ジブラルタル海峡','ボスポラス海峡','ドーバー海峡','マラッカ海峡'], correct:1, note:'ボスポラス海峡はイスタンブールでヨーロッパ側とアジア側を分けています。', category:'GEOGRAPHY' },
    { id:'tr2', prompt:'トルコの首都はどこ？', options:['イズミル','アンタルヤ','イスタンブール','アンカラ'], correct:3, note:'最大都市はイスタンブールですが、首都はアンカラです。', category:'GEOGRAPHY' },
    { id:'tr3', prompt:'トルコの伝統的な飲み物「チャイ」は主に何？', options:['紅茶','コーヒー','ヨーグルト','果実酒'], correct:0, note:'トルコでは小さなグラスで紅茶（チャイ）を飲む文化が広く親しまれています。', category:'CULTURE' }
  ],
  italy: [
    { id:'it1', prompt:'ローマにある有名な古代円形闘技場は？', options:['パンテオン','コロッセオ','フォロ・ロマーノ','サン・ピエトロ大聖堂'], correct:1, note:'コロッセオは古代ローマ時代に建てられた巨大な円形闘技場です。', category:'HISTORY' },
    { id:'it2', prompt:'イタリアの国旗に使われていない色は？', options:['緑','白','青','赤'], correct:2, note:'イタリア国旗は緑・白・赤の縦三色です。', category:'FLAGS' },
    { id:'it3', prompt:'ピサの斜塔がある国は？', options:['イタリア','スペイン','ギリシャ','ポルトガル'], correct:0, note:'ピサの斜塔はイタリアのトスカーナ州ピサにあります。', category:'LANDMARKS' }
  ],
  france: [
    { id:'fr1', prompt:'エッフェル塔のある都市は？', options:['リヨン','マルセイユ','パリ','ボルドー'], correct:2, note:'エッフェル塔はパリにあるフランスを代表するランドマークです。', category:'LANDMARKS' },
    { id:'fr2', prompt:'フランスの通貨は？', options:['ポンド','ユーロ','フラン','クローナ'], correct:1, note:'フランスはユーロ圏の加盟国です。', category:'CULTURE' },
    { id:'fr3', prompt:'ルーブル美術館がある都市は？', options:['パリ','ニース','ストラスブール','トゥールーズ'], correct:0, note:'ルーブル美術館はパリにあり、「モナ・リザ」などで知られます。', category:'ART' }
  ],
  japan: [
    { id:'jp1', prompt:'日本で最も高い山は？', options:['立山','阿蘇山','富士山','白山'], correct:2, note:'標高3,776mの富士山が日本で最も高い山です。', category:'GEOGRAPHY' },
    { id:'jp2', prompt:'福岡県の県庁所在地は？', options:['久留米市','福岡市','北九州市','太宰府市'], correct:1, note:'福岡県の県庁所在地は福岡市です。', category:'GEOGRAPHY' },
    { id:'jp3', prompt:'日本の伝統的な衣服は？', options:['サリー','ハンボク','キルト','着物'], correct:3, note:'着物は日本の伝統的な衣服です。', category:'CULTURE' }
  ]
});

export function stageById(id) { return stages.find(s => s.id === id) ?? null; }
export function getQuestion(stageId,index){ return questions[stageId]?.[index] ?? null; }
export function publicQuestion(q,index,total=3){return {id:q.id,prompt:q.prompt,options:q.options,category:q.category,index,total,en:englishQuestions[q.id]};}
export function scoreAnswer({correct,streak,remainingSeconds}) {
  if(!correct) return {points:0,nextStreak:0};
  return {points:100+(streak>=1?25:0)+Math.max(0,Math.min(20,Math.floor(remainingSeconds))),nextStreak:streak+1};
}
export function unlockIndex(progressRows){
  const done=new Set(progressRows.filter(r=>r.completed).map(r=>r.stage_id));
  let idx=0;while(idx<stages.length-1&&done.has(stages[idx].id))idx++;
  return idx;
}
export function publicStages(progressRows){
  const byId=new Map(progressRows.map(r=>[r.stage_id,r])); const available=unlockIndex(progressRows);
  return stages.map((s,i)=>({...s,locked:i>available,bestScore:byId.get(s.id)?.best_score??0,cleared:!!byId.get(s.id)?.completed,attempts:byId.get(s.id)?.attempts??0}));
}
