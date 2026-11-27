// R2 시안 공통 스크립트: 칸 그림(선 아이콘), 크기 바꾸기, 넘침 검사.
// 게임 코드가 아니다. 시안을 보기 위한 것.

window.R2 = (function () {
  // 칸·전략 선 그림 (viewBox 0 0 48 48, 동굴벽화풍 선). R2-b에서는 장면 id로 바뀐다.
  var ICON = {
    stone_spear: 'M8 40 L34 14 M34 14 l-2 8 M34 14 l-8 2 M10 32 q6 -4 12 0 q-6 3 -12 0',
    spear_thrower: 'M6 36 L26 28 M26 28 l3 -4 M12 34 L42 10 M42 10 l-7 1 M42 10 l-1 7',
    weir_rack: 'M6 40 C14 36 22 42 30 38 C36 35 40 37 42 36 M10 30 V12 M38 30 V12 M8 14 h32 M16 14 v8 M24 14 v10 M32 14 v8',
    sled: 'M6 38 L40 32 M6 38 l4 -4 M10 34 L40 28 M16 32 v-9 h14 v7 M40 28 l4 -10',
    grinding_stone: 'M8 34 q16 8 32 0 q-16 -6 -32 0 M16 28 q8 -6 16 0 M20 19 l2 2 M26 16 l2 2 M31 21 l2 2',
    grain_meadow: 'M14 42 V18 M14 22 l-4 -4 M14 22 l4 -4 M14 28 l-4 -4 M14 28 l4 -4 M30 42 V14 M30 18 l-4 -4 M30 18 l4 -4 M30 24 l-4 -4 M30 24 l4 -4 M6 42 h36',
    farm_tools: 'M12 40 L32 12 M32 12 q8 2 8 10 q-6 -4 -12 -4 M8 42 h20',
    first_harvest: 'M24 42 L16 14 M24 42 L24 12 M24 42 L32 14 M17 30 h14 M14 14 l2 -4 M24 12 v-4 M32 14 l2 -4',
    tent_repair: 'M6 40 L24 10 L42 40 Z M24 10 V40 M15 28 l6 4 M27 32 l6 -4',
    cave_fortify: 'M4 40 Q8 12 24 10 Q40 12 44 40 M16 40 Q16 26 24 24 Q32 26 32 40 M4 40 h40 M8 40 v-8 M11 40 v-10',
    pit_house: 'M8 38 L24 14 L40 38 M14 38 q10 -6 20 0 M24 14 l-4 -6 M24 14 l4 -6 M4 38 h40',
    village: 'M4 40 L12 28 L20 40 M18 40 L28 22 L38 40 M34 40 L40 32 L46 40 M2 40 h46',
    none: 'M14 24 h20',
    net: 'M8 12 L40 36 M8 24 L28 38 M20 12 L40 26 M8 36 L32 12 M8 24 L20 12 M20 38 L40 18',
    woodpile: 'M8 40 h32 M10 34 h28 M12 28 h24 M10 28 V40 M38 28 V40 M8 24 L24 12 L40 24',
    fish: 'M8 22 q8 -6 16 0 q-8 6 -16 0 M24 22 l5 -4 v8 z M20 32 q8 -6 16 0 q-8 6 -16 0 M36 32 l5 -4 v8 z',
    acorn: 'M16 22 q8 -8 16 0 Z M17 22 q7 18 14 0 M24 14 v-4 M10 40 h28',
    lock: 'M15 22 v-5 a5 5 0 0 1 10 0 v5 M12 22 h16 v12 h-16 Z',
  };

  function icon(id, cls, size) {
    var d = ICON[id] || ICON.none;
    var s = size || 34;
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 48 48" aria-hidden="true"><path class="' + (cls || 'ln') + '" d="' + d + '"></path></svg>';
  }

  /** 진척 막대: total = 칸의 철 수, parts = [{k:'w'|'g'|'d'|'next', v:철}] */
  function prog(total, parts, h, step) {
    // step = 눈금 간격(철). 계절 턴 1, 1년차 1/3(한 달)
    var st = step || 1;
    var html = '<div class="prog"' + (h ? ' style="height:' + h + 'px"' : '') + '>';
    parts.forEach(function (p) {
      html += '<span class="' + p.k + '" style="width:' + (100 * p.v / total) + '%"></span>';
    });
    var n = Math.round(total / st);
    for (var i = 1; i < n; i++) html += '<span class="tick" style="left:calc(' + (100 * i / n) + '% - 1px)"></span>';
    return html + '</div>';
  }

  // 화면 밖 도구: 1366×650 / 1920×950
  function tools() {
    var bs = document.querySelectorAll('[data-size]');
    bs.forEach(function (b) {
      b.addEventListener('click', function () {
        document.body.classList.toggle('big', b.dataset.size === 'big');
        bs.forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
        check();
      });
    });
    var h = decodeURIComponent(location.hash.slice(1));
    if (/(^|,)big($|,)/.test(h)) document.body.classList.add('big');
    var solo = /solo=([\w-]+)/.exec(h);
    if (solo) {
      document.body.classList.add('solo');
      document.querySelectorAll('.board').forEach(function (b) { if (b.id !== solo[1]) b.classList.add('off'); });
      document.querySelectorAll('.state').forEach(function (st) { st.classList.toggle('off', !st.querySelector('#' + solo[1])); });
    }
    bs.forEach(function (o) { o.setAttribute('aria-pressed', String((o.dataset.size === 'big') === document.body.classList.contains('big'))); });
  }

  // 넘침 검사: 판 전체와 [data-fit] 칸. 결과를 판 이름표 옆 배지와 body[data-fit]에 남긴다
  function check() {
    var all = [];
    document.querySelectorAll('.board').forEach(function (board) {
      if (board.clientHeight === 0) return; // 숨긴 판은 보일 때 잰다
      var bad = [];
      if (board.scrollHeight > board.clientHeight + 1) bad.push('판 ' + (board.scrollHeight - board.clientHeight) + 'px');
      board.querySelectorAll('[data-fit]').forEach(function (el) {
        var over = el.scrollHeight - el.clientHeight;
        // 안쪽 여백으로 넘친 것도 잡는다: 자식의 아래 끝이 칸의 내용 상자(아래 여백 뺀 곳)를 넘으면
        var r = el.getBoundingClientRect();
        var inner = r.bottom - parseFloat(getComputedStyle(el).paddingBottom) - parseFloat(getComputedStyle(el).borderBottomWidth);
        Array.prototype.forEach.call(el.children, function (ch) {
          var cs = getComputedStyle(ch);
          if (cs.display === 'none' || cs.position === 'absolute') return;
          over = Math.max(over, Math.round(ch.getBoundingClientRect().bottom - inner));
        });
        if (over > 1) bad.push(el.dataset.fit + ' ' + over + 'px');
        var overX = el.scrollWidth - el.clientWidth;
        if (overX > 1) bad.push(el.dataset.fit + ' 가로 ' + overX + 'px');
      });
      var badge = document.getElementById('fit-' + board.id);
      if (badge) {
        badge.textContent = bad.length ? '넘침: ' + bad.join(', ') : '넘침 없음 (' + board.clientWidth + '×' + board.clientHeight + ')';
        badge.classList.toggle('bad', bad.length > 0);
      }
      all.push(board.id + ':' + (bad.length ? bad.join('|') : 'ok'));
    });
    document.body.dataset.fit = all.join(';');
  }

  function ready(fn) {
    document.addEventListener('DOMContentLoaded', function () {
      fn();
      tools();
      requestAnimationFrame(check);
      if (document.fonts) document.fonts.ready.then(check);
    });
  }

  return { icon: icon, prog: prog, ready: ready, check: check };
})();
