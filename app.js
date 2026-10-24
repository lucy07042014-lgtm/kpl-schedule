/* KPL 赛程 · 交互层 */
(function () {
  'use strict';

  var L = window.KPLLib;
  var BASE = window.KPL_DATA || { season: 'KPL', stages: [], events: [] };
  var API = 'https://prod.comp.smoba.qq.com/leaguesite';
  var BUILD = '2026-10-24 22:50';   // 出问题时先看这个，能确定手机上跑的是哪一版

  var LS = { cache: 'kpl.cache.v2', follow: 'kpl.follow.v2', theme: 'kpl.theme.v2', hideEnded: 'kpl.hideEnded.v2' };

  var SOURCES = [
    { id: 'api', url: 'https://api.github.com/repos/futuretech6/KPL-Calendar/contents/kpl.ics?ref=actions', json: true },
    { id: 'jsdelivr', url: 'https://cdn.jsdelivr.net/gh/futuretech6/KPL-Calendar@actions/kpl.ics' },
    { id: 'raw', url: 'https://raw.githubusercontent.com/futuretech6/KPL-Calendar/actions/kpl.ics' }
  ];
  var SUBSCRIBE_URL = 'https://cdn.jsdelivr.net/gh/futuretech6/KPL-Calendar@actions/kpl.ics';

  var ICON = {
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16.5" rx="3.2"/><path d="M8 2.5v4M16 2.5v4M3 10h18"/><path d="M12 13.2v5.2M9.4 15.8h5.2"/></svg>',
    calX: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16.5" rx="3.2"/><path d="M8 2.5v4M16 2.5v4M3 10h18"/><path d="M9.6 13.6l4.8 4.8M14.4 13.6l-4.8 4.8"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.05"/><path d="M20.6 3.4V9h-5.5"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 14.3A8.6 8.6 0 0 1 9.7 3.4a8.6 8.6 0 1 0 10.9 10.9z"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7.5 10.5L12 15l4.5-4.5"/><path d="M4 20h16"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.5 1.5"/><path d="M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1.5-1.5"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.6l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 5.5L8 12l6.5 6.5"/></svg>',
    crown: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 8l4.2 3.2L12 4.5l4.8 6.7L21 8l-1.7 10.2H4.7z"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.2 2.5L4.8 13.6h5.4l-.9 7.9 8.4-11.1h-5.4z"/></svg>'
  };

  var state = {
    data: BASE,
    evs: [],
    tab: 'today',
    hideEnded: true,   // 「全部」默认只看还没打完的；boot 时会被本地记忆覆盖
    followed: [],
    busy: false,
    details: (window.KPL_DETAILS && window.KPL_DETAILS.matches) || {},
    detailsUpdatedAt: (window.KPL_DETAILS && window.KPL_DETAILS.updatedAt) || '',
    route: 'list',
    detailKey: null,
    gameIdx: 0,
    detailScroll: 0,
    detailBusy: false,
    syncing: {},     // key -> true，正在拉战报
    detailIds: {}    // key -> 官方 match_id（发现过一次就记住）
  };

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ----------------------------- 存储 ----------------------------- */

  function loadJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function saveJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 隐私模式忽略 */ }
  }

  function loadCache() {
    var c = loadJson(LS.cache, null);
    if (!c || !c.events || !c.events.length) return null;
    var t = new Date(c.updatedAt || 0).getTime();
    var baseT = new Date(BASE.updatedAt || 0).getTime();
    return t > baseT ? c : null;
  }

  /* ----------------------------- 视觉片段 ----------------------------- */

  function avatarStyle(name, size) {
    if (!name || name === '待定') {
      return 'background:var(--surface-3);color:var(--muted);box-shadow:none;' + (size ? 'font-size:' + size + 'px' : '');
    }
    var c = L.colorOf(name);
    return 'background:linear-gradient(150deg,' + c + ',color-mix(in srgb,' + c + ' 55%,#0b0f18));color:#fff;box-shadow:0 8px 20px -14px ' + c + ';';
  }

  function teamLine(name) {
    var tbd = !name || name === '待定';
    return '<div class="team-line' + (tbd ? ' tbd' : '') + '">' +
      '<span class="avatar avatar-sm" style="' + avatarStyle(name, 9) + '">' + esc(L.abbr(name)) + '</span>' +
      '<em>' + esc(tbd ? '待定' : name) + '</em></div>';
  }

  function statusHTML(ev) {
    if (ev.status === 'live') return '<span class="status-dot live"><i></i>进行中</span>';
    if (ev.status === 'ended') return '<span class="status-dot ended">已结束</span>';
    return '';
  }

  /* ----------------------------- 渲染 ----------------------------- */

  function render() {
    var evs = L.withStatus(state.data.events || []);
    state.evs = evs;

    var season = state.data.season || 'KPL';
    var shortSeason = season.replace(/^(\d{4})\s*KPL\s*/, '$1 ').replace(/^KPL\s*/, '');
    var updTxt = '';
    var iso = state.data.updatedAt || '';
    if (/^\d{4}-\d{2}-\d{2}/.test(iso)) {
      var t = new Date(iso).getTime();
      if (!isNaN(t)) {
        var rel = L.fromNow(Date.now() - t);
        updTxt = rel === '刚刚' ? '刚刚更新' : rel + '前更新';
      }
    }
    $('#season').textContent = shortSeason + (updTxt ? ' · ' + updTxt : '');
    document.title = 'KPL 赛程 · ' + season;

    $('#hero').innerHTML = state.tab === 'today' ? heroHTML(evs) : '';
    renderTabs(evs);
    $('#view').innerHTML = viewHTML(evs);
    renderDetail();
    tick();
  }

  function renderTabs(evs) {
    var todayKey = L.nowKey();
    var todayCount = evs.filter(function (e) { return e.date === todayKey; }).length;
    $('#badge-today').textContent = todayCount ? todayCount : '';
    $('#badge-today').style.display = todayCount ? '' : 'none';
    $$('.tab').forEach(function (t) {
      t.setAttribute('aria-selected', t.dataset.tab === state.tab ? 'true' : 'false');
    });
  }

  function heroHTML(evs) {
    var live = L.currentLive(evs);
    // 赛程时间是预估的，比赛常常打超时；战报说还在打，就以战报为准（只认当天的）
    if (!live) {
      var today = L.nowKey();
      for (var hi = 0; hi < evs.length; hi++) {
        if (evs[hi].date !== today) continue;
        var hd = detailFor(evs[hi]);
        if (hd && hd.live) { live = evs[hi]; break; }
      }
    }
    var next = nextKnown(evs);
    var ev = live || next;

    if (!ev) {
      return '<section class="hero"><div class="hero-top"><span class="kicker"><i class="dot"></i>赛程结束</span></div>' +
        '<p style="margin:0;font-size:13px;line-height:1.7;color:var(--muted)">当前赛段已全部结束。<br>新赛程公布后，点右上角刷新即可更新。</p>' +
        '</section>';
    }

    var isLive = !!live;
    var todayKey = L.nowKey();
    var kicker = isLive ? '正在进行' : (ev.date === todayKey ? '今日焦点' : '下一场比赛');
    var dateTxt = L.dateLabel(ev.date) + ' ' + L.weekdayCN(ev.date) + ' · ' + ev.start;

    var count;
    var dHero = detailFor(ev);
    if (isLive) {
      count = dHero && dHero.games.length
        ? '<div class="hero-count" data-since="' + ev.startAt + '">已打 <b>' + dHero.games.length + '</b> 局 · ' + esc(ev.start) + ' 开赛 · 已进行 <b class="count-b">—</b></div>'
        : '<div class="hero-count" data-since="' + ev.startAt + '">预计 <b>' + esc(ev.end) + '</b> 结束 · 已进行 <b class="count-b">—</b></div>';
    } else {
      count = '<div class="hero-count" data-deadline="' + ev.startAt + '">距开赛 <b class="count-b">—</b></div>';
    }

    var stageMeta = '<span class="chip strong">' + esc(ev.stage) + '</span>' +
      '<span class="chip">' + esc(ev.bo) + '</span>' +
      (function () {
        var d = detailFor(ev);
        if (!d) return isLive ? '<span class="chip live">LIVE</span>' : '';
        var hs = d.score[ev.home] || 0;
        var as = d.score[ev.away] || 0;
        return '<span class="chip' + (d.live ? ' live' : '') + '">' + hs + ' : ' + as + '</span>';
      })();

    return '<section class="hero' + (isLive ? ' live' : '') + '">' +
      '<div class="hero-top">' +
        '<span class="kicker"><i class="dot"></i>' + kicker + '</span>' +
        '<span class="hero-date">' + esc(dateTxt) + '</span>' +
      '</div>' +
      '<div class="hero-teams">' +
        '<div class="team-lg"><span class="avatar" style="' + avatarStyle(ev.home) + '">' + esc(L.abbr(ev.home)) + '</span>' +
          '<span class="team-lg-name">' + esc(ev.home || '待定') + '</span></div>' +
        '<span class="vs-mark">VS</span>' +
        '<div class="team-lg"><span class="avatar" style="' + avatarStyle(ev.away) + '">' + esc(L.abbr(ev.away)) + '</span>' +
          '<span class="team-lg-name">' + esc(ev.away || '待定') + '</span></div>' +
      '</div>' +
      '<div class="meta-row" style="justify-content:center">' + stageMeta + '</div>' +
      count +
      '<div class="hero-actions">' +
        '<button class="btn btn-primary" data-act="ics-one" data-id="' + esc(ev.id) + '">' + ICON.cal + '加入我的日历</button>' +
        '<button class="btn btn-ghost" data-act="tab" data-tab="all">全部赛程</button>' +
      '</div>' +
    '</section>';
  }

  function keyOf(ev) {
    return L.matchKey(ev.date, ev.home, ev.away);
  }

  function detailFor(ev) {
    return state.details[keyOf(ev)] || null;
  }

  /** 官方先排了日期、对阵还没抽出来的占位场（两队都写「待定」） */
  function isTbdEvent(ev) {
    return !!ev.tbd || !ev.home || !ev.away || ev.home === '待定' || ev.away === '待定';
  }

  /** 优先选有对阵的下一场；全季只剩待定场时才退回待定 */
  function nextKnown(evs) {
    var known = evs.filter(function (e) { return !isTbdEvent(e); });
    return L.nextUpcoming(known) || L.nextUpcoming(evs);
  }

  function matchHTML(ev) {
    var d = detailFor(ev);
    var key = keyOf(ev);
    var dLive = d ? !!d.live : false;
    // 快照里的 live 可能过夜失效：日期不是今天的，就别再标「进行中」
    var stale = dLive && ev.date !== L.nowKey();
    var live = d ? (dLive && !stale) : ev.status === 'live';
    var ended = d ? (!!d.finished && !stale) : ev.status === 'ended';
    var cls = live ? 'live' : (ended ? 'ended' : '');
    var scoreHTML = '';
    if (d) {
      var hs = d.score[ev.home] || 0;
      var as = d.score[ev.away] || 0;
      scoreHTML = '<span class="score-chip' + (live ? ' live' : '') + '">' + hs + '<i>:</i>' + as + '</span>';
    }

    return '<article class="match ' + cls + '" data-act="detail" data-key="' + esc(key) + '" role="button" tabindex="0">' +
      '<div class="match-time"><b>' + esc(ev.start) + '</b><span>' + esc(ev.bo) + '</span></div>' +
      '<div class="match-main">' +
        teamLine(ev.home) + teamLine(ev.away) +
        '<div class="match-sub">' +
          '<span class="chip">' + esc(ev.stage) + '</span>' +
          (live ? '<span class="status-dot live"><i></i>进行中</span>' : '') +
          (stale ? '<span class="status-dot wait">待更新</span>' : '') +
          (state.syncing[key] ? '<span class="status-dot wait">同步中</span>' : '') +
          (ended ? '<span class="status-dot ended">已结束</span>' : '') +
          scoreHTML +
          (ev.tbd ? '<span>对阵待定</span>' : (ended || stale || (live && d) ? '' : '<span>' + esc(ev.end) + ' 结束</span>')) +
        '</div>' +
      '</div>' +
      '<button class="cal-btn" data-act="ics-one" data-id="' + esc(ev.id) + '" aria-label="加入日历" title="加入日历">' + ICON.cal + '</button>' +
    '</article>';
  }

  function dayHTML(day) {
    var isToday = day.date === L.nowKey();
    return '<section class="day">' +
      '<div class="day-head">' +
        '<div class="day-date">' + L.dateLabel(day.date) + '<span>' + L.weekdayCN(day.date) + '</span></div>' +
        '<div class="day-right">' +
          (isToday ? '<span class="pill-today">今天</span>' : '') +
          '<span class="day-count">' + day.events.length + ' 场</span>' +
        '</div>' +
      '</div>' +
      day.events.map(matchHTML).join('') +
    '</section>';
  }

  function emptyHTML(title, desc, btnLabel, btnAct) {
    return '<div class="empty">' +
      '<div class="icon">' + ICON.calX + '</div>' +
      '<h3>' + esc(title) + '</h3>' +
      '<p>' + desc + '</p>' +
      (btnLabel ? '<button class="btn btn-ghost" style="flex:0 0 auto;margin:0 auto" data-act="' + btnAct + '">' + esc(btnLabel) + '</button>' : '') +
    '</div>';
  }

  function viewHTML(evs) {
    if (state.tab === 'mine') return mineHTML(evs);
    if (state.tab === 'all') return allHTML(evs);
    return todayHTML(evs);
  }

  function todayHTML(evs) {
    var key = L.nowKey();
    var todays = evs.filter(function (e) { return e.date === key; });
    if (todays.length) return dayHTML({ date: key, events: todays });

    var next = nextKnown(evs);
    var desc = next
      ? '下一场：<b style="color:var(--text-2)">' + esc(L.dateLabel(next.date) + ' ' + L.weekdayCN(next.date) + ' ' + next.start) + '</b><br>' +
        esc(next.home) + ' vs ' + esc(next.away)
      : '本赛季的赛程已经全部结束，感谢一起观赛。';
    return '<div style="margin-top:16px">' + emptyHTML('今天没有比赛', desc, '看看全部赛程', 'tab-all') + '</div>';
  }

  /** 连续多个「待定」比赛日折成一块，点开再看每天（避免整屏空卡） */
  function pendingHTML(days) {
    var first = days[0], last = days[days.length - 1];
    var events = [];
    days.forEach(function (d) { events = events.concat(d.events); });
    var stage = events[0].stage || '';
    var label = first.date === last.date
      ? L.dateLabel(first.date)
      : L.dateLabel(first.date) + ' – ' + L.dateLabel(last.date);
    return '<details class="day pending">' +
      '<summary class="pending-summary">' +
        '<span class="pending-range">' + esc(label) + '</span>' +
        '<span class="pending-meta">' + (stage ? esc(stage) + ' · ' : '') + events.length + ' 场待定</span>' +
      '</summary>' +
      '<p class="pending-hint">对阵还没抽出来，先按官方公布的日期排着；抽签后会自动变成具体对局。点开可以看每天的开赛时间和加入日历。</p>' +
      days.map(dayHTML).join('') +
    '</details>';
  }

  function allHTML(evs) {
    var days = L.groupByDay(evs);
    var shown = days;
    var hidden = 0;
    if (state.hideEnded) {
      shown = days.map(function (d) {
        return { date: d.date, events: d.events.filter(function (e) { return e.status !== 'ended'; }) };
      }).filter(function (d) { return d.events.length; });
      var left = shown.reduce(function (n, d) { return n + d.events.length; }, 0);
      hidden = evs.length - left;
    }
    var hint = shown.length + ' 个比赛日' + (hidden ? ' · 已隐藏 ' + hidden + ' 场' : '');
    var head = '<div class="section-head"><h2>全部赛程</h2>' +
      '<span class="hint">' + hint + '</span><span class="spacer"></span>' +
      '<button class="switch" data-act="toggle-ended" aria-pressed="' + state.hideEnded + '">隐藏已结束</button></div>';
    if (!shown.length) {
      return head + emptyHTML('没有待进行的比赛', '赛程已全部结束，或已开启「隐藏已结束」。', '显示全部', 'toggle-ended');
    }

    // 把「连续 ≥2 个比赛日、这些天全是待定」的日期合成一个折叠块
    var blocks = [];
    var run = [];
    function flushRun() {
      if (!run.length) return;
      blocks.push(run.length > 1 ? { pending: run } : { days: run });
      run = [];
    }
    shown.forEach(function (d) {
      var allTbd = d.events.every(isTbdEvent);
      var notEnded = d.events.every(function (e) { return e.status !== 'ended'; });
      // 日期必须连续：11/08 之后空一周再接 11/14 总决赛，不能并成一块
      var contiguous = !run.length ||
        (+new Date(d.date) - +new Date(run[run.length - 1].date)) === 86400000;
      if (allTbd && notEnded && contiguous) {
        run.push(d);
      } else {
        flushRun();
        if (allTbd && notEnded) run.push(d);
        else blocks.push({ days: [d] });
      }
    });
    flushRun();

    var body = blocks.map(function (b) {
      return b.pending ? pendingHTML(b.pending) : b.days.map(dayHTML).join('');
    }).join('');
    return head + body;
  }

  function mineEvents(evs) {
    var picked = state.followed;
    if (!picked.length) return [];
    return evs.filter(function (e) { return picked.indexOf(e.home) >= 0 || picked.indexOf(e.away) >= 0; });
  }

  function mineHTML(evs) {
    var teams = L.allTeams(evs);
    var picked = state.followed.filter(function (t) { return teams.indexOf(t) >= 0; });

    var grid = '<div class="team-grid">' + teams.map(function (t) {
      var on = picked.indexOf(t) >= 0;
      return '<button class="team-pick" data-act="follow" data-team="' + esc(t) + '" aria-pressed="' + on + '">' +
        '<span class="avatar avatar-sm" style="' + avatarStyle(t, 10) + '">' + esc(L.abbr(t)) + '</span>' +
        '<span>' + esc(t) + '</span></button>';
    }).join('') + '</div>';

    var head = '<div class="section-head"><h2>我的战队</h2>' +
      '<span class="hint">' + (picked.length ? '已关注 ' + picked.length + ' 支 · 自动只看相关比赛' : '点选战队，只看你想看的比赛') + '</span></div>';

    var mine = mineEvents(evs);
    if (!picked.length) {
      return head + grid + '<div style="margin-top:16px">' +
        emptyHTML('还没有关注的战队', '点选上面的战队，<br>它们的比赛会单独列在这里，还能一键导出到日历。') + '</div>';
    }
    if (state.hideEnded) {
      mine = mine.filter(function (e) { return e.status !== 'ended'; });
    }
    var days = L.groupByDay(mine);
    var list = days.length
      ? days.map(dayHTML).join('')
      : '<div style="margin-top:16px">' + emptyHTML('暂时没有相关比赛', '关注战队的赛程还没排出来，稍后再刷新看看。') + '</div>';

    return head + grid +
      '<div class="section-head"><h2>相关比赛</h2><span class="hint">' + mine.length + ' 场</span>' +
      '<span class="spacer"></span>' +
      '<button class="switch" data-act="toggle-ended" aria-pressed="' + state.hideEnded + '">隐藏已结束</button></div>' +
      list;
  }

  /* ----------------------------- 战报详情 ----------------------------- */

  function wfmt(n) {
    n = Number(n) || 0;
    if (n >= 10000) return (n / 10000).toFixed(1) + '万';
    return String(n);
  }

  function kfmt(n) {
    n = Number(n) || 0;
    return (n / 1000).toFixed(1) + 'k';
  }

  function mfmt(sec) {
    sec = Math.max(0, Math.round(Number(sec) || 0));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function heroImg(icon, name, cls) {
    if (!icon) return '<span class="hero-ph">' + esc(L.heroShort(name).slice(0, 1)) + '</span>';
    return '<img class="' + (cls || 'hero-ico') + '" src="' + esc(icon) + '" alt="' + esc(name) + '" title="' + esc(name) + '" loading="lazy" onerror="this.classList.add(\'broken\')">';
  }

  function detailEvent(key) {
    var list = state.evs || [];
    for (var i = 0; i < list.length; i++) {
      if (keyOf(list[i]) === key) return list[i];
    }
    return null;
  }

  function openDetail(key) {
    state.route = 'detail';
    state.detailKey = key;
    state.detailScroll = 0;
    var d = state.details[key];
    state.gameIdx = d && d.games.length ? d.games.length - 1 : 0;
    document.body.classList.add('lock');
    render();
    // 有快照且还在打 / 没快照但已经开打（含往日的）→ 都先拉一次
    var ev = detailEvent(key);
    var due = ev && (ev.status === 'live' || ev.date < L.nowKey());
    if ((d && d.live) || (!d && due)) {
      startPoll();
      refreshMatch(key, true);
    }
  }

  function closeDetail() {
    state.route = 'list';
    state.detailKey = null;
    stopPoll();
    document.body.classList.remove('lock');
    render();
  }

  var pollTimer = null;
  function startPoll() {
    stopPoll();
    pollTimer = setInterval(function () {
      if (state.route === 'detail' && state.detailKey) refreshMatch(state.detailKey, true);
      else stopPoll();
    }, 60000);
  }
  function stopPoll() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  function lineupHTML(g, ev) {
    if (!g) return '';
    var teams = g.teams.slice().sort(function (a, b) {
      var ai = a.name === (ev && ev.home) ? 0 : 1;
      var bi = b.name === (ev && ev.home) ? 0 : 1;
      return ai - bi;
    });
    var rows = teams.map(function (t) {
      var ps = g.players.filter(function (p) { return p.camp === t.camp; });
      return '<div class="lu-row">' +
        '<div class="lu-team"><span class="avatar avatar-sm" style="' + avatarStyle(t.name, 9) + '">' + esc(L.abbr(t.name)) + '</span>' +
        '<em>' + esc(t.name) + '</em></div>' +
        '<div class="lu-players">' + ps.map(function (p) {
          return '<span class="lu-p">' + heroImg(p.heroIcon, p.hero) +
            '<em>' + esc(L.stripTeam(p.name, p.team || t.name)) + '</em></span>';
        }).join('') + '</div>' +
      '</div>';
    }).join('');
    return '<section class="lineup">' +
      '<div class="sec-head"><h3>首发阵容</h3><span class="hint">第 1 局</span></div>' + rows + '</section>';
  }

  function mvpHTML(g) {
    var mvp = (g.players || []).filter(function (p) { return p.mvp; })[0];
    var svp = (g.players || []).filter(function (p) { return p.svp; })[0];
    var main = mvp || svp;
    if (!main) return '';
    var isMvp = !!mvp;
    return '<div class="mvp-card' + (isMvp ? '' : ' svp') + '">' +
      '<div class="mvp-badge">' + (isMvp ? 'MVP' : 'SVP') + '</div>' +
      '<div class="mvp-main">' +
        '<div class="mvp-name">' + esc(L.stripTeam(main.name, main.team)) +
          '<span>' + esc(main.team) + '</span></div>' +
        '<div class="mvp-meta">' + esc(L.heroShort(main.hero)) +
          ' · ' + main.kills + '/' + main.deaths + '/' + main.assists +
          ' · 评分 ' + main.score + '</div>' +
      '</div>' +
      '<div class="mvp-hero">' + heroImg(main.heroIcon, main.hero, 'hero-ico lg') + '</div>' +
    '</div>';
  }

  function cmpHTML(g) {
    var t1 = g.teams[0], t2 = g.teams[1];
    var row = function (label, a, b, fmt) {
      var f = fmt || function (x) { return x; };
      return '<div class="cmp-row"><b class="' + (a > b ? 'win' : '') + '">' + f(a) + '</b>' +
        '<span>' + label + '</span>' +
        '<b class="' + (b > a ? 'win' : '') + '">' + f(b) + '</b></div>';
    };
    return '<div class="cmp">' +
      '<div class="cmp-head"><span>' + esc(t1.name) + '</span><i></i><span>' + esc(t2.name) + '</span></div>' +
      row('人头', t1.kills, t2.kills) +
      row('经济', t1.gold, t2.gold, wfmt) +
      row('推塔', t1.towers, t2.towers) +
      row('大龙', t1.bigDragons, t2.bigDragons) +
    '</div>';
  }

  function bpHTML(g, camp, sideLabel) {
    var bans = (g.bans || []).filter(function (b) { return b.camp === camp; });
    var picks = (g.picks || []).filter(function (p) { return p.camp === camp; });
    var t = g.teams.filter(function (x) { return x.camp === camp; })[0] || {};
    if (!bans.length && !picks.length) return '';
    return '<div class="bp-side">' +
      '<div class="bp-team"><span class="bp-tag">' + sideLabel + '</span>' + esc(t.name || '') + '</div>' +
      (bans.length ? '<div class="bp-line"><span class="bp-label">禁用</span>' +
        bans.map(function (b) { return '<span class="bp-hero ban">' + heroImg(b.icon, b.hero) + '</span>'; }).join('') + '</div>' : '') +
      (picks.length ? '<div class="bp-line"><span class="bp-label">选用</span>' +
        picks.map(function (p) { return '<span class="bp-hero">' + heroImg(p.icon, p.hero) + '</span>'; }).join('') + '</div>' : '') +
    '</div>';
  }

  function rosterHTML(g, camp) {
    var t = g.teams.filter(function (x) { return x.camp === camp; })[0] || {};
    var ps = (g.players || []).filter(function (p) { return p.camp === camp; });
    if (!ps.length) return '';
    return '<div class="roster">' +
      '<div class="roster-head"><span class="avatar avatar-sm" style="' + avatarStyle(t.name, 9) + '">' + esc(L.abbr(t.name)) + '</span>' +
        '<em>' + esc(t.name || '') + '</em>' + (t.isWin ? '<span class="win-tag">胜</span>' : '') + '</div>' +
      ps.map(function (p) {
        return '<div class="roster-row' + (p.mvp ? ' mvp' : '') + '">' +
          heroImg(p.heroIcon, p.hero) +
          '<span class="pname">' + esc(L.stripTeam(p.name, p.team || t.name)) + '</span>' +
          '<span class="phero">' + esc(L.heroShort(p.hero)) + '</span>' +
          '<span class="pkda">' + p.kills + '/' + p.deaths + '/' + p.assists + '</span>' +
          '<span class="pgold">' + kfmt(p.gold) + '</span>' +
          (p.mvp ? '<span class="pmvp">MVP</span>' : (p.svp ? '<span class="pmvp svp">SVP</span>' : '')) +
        '</div>';
      }).join('') +
    '</div>';
  }

  function gameHTML(g) {
    if (!g) return '';
    var winName = L.gameWinner(g);
    return '<section class="game-card">' +
      '<div class="game-head">' +
        '<b>第 ' + g.seq + ' 局</b>' +
        '<span>' + mfmt(g.duration) + '</span>' +
        '<em>' + esc(winName) + ' 胜</em>' +
      '</div>' +
      mvpHTML(g) +
      cmpHTML(g) +
      '<div class="sec-head"><h3>BP</h3></div>' +
      '<div class="bp">' + bpHTML(g, 1, '蓝') + bpHTML(g, 2, '红') + '</div>' +
      '<div class="sec-head"><h3>选手数据</h3><span class="hint">KDA / 经济</span></div>' +
      rosterHTML(g, 1) + rosterHTML(g, 2) +
    '</section>';
  }

  function detailHTML(key) {
    var ev = detailEvent(key);
    if (!ev) return '';
    var d = state.details[key] || null;
    var games = d ? d.games || [] : [];
    var idx = Math.min(Math.max(state.gameIdx, 0), Math.max(games.length - 1, 0));
    var cur = games[idx] || null;

    var hs = d ? (d.score[ev.home] || 0) : 0;
    var as = d ? (d.score[ev.away] || 0) : 0;
    // 快照里的 live 可能过夜失效；没有快照但比赛已经开打时，也别写「未开始」
    var dStale = !!(d && d.live && ev.date !== L.nowKey());
    var schedulingLive = !d && ev.status === 'live';
    var stateTxt = !d
      ? (schedulingLive ? '进行中' : '未开始')
      : (d.finished ? '已结束' : (dStale ? '待更新' : '进行中'));

    var head = '<div class="detail-top">' +
      '<button class="icon-btn" data-act="detail-back" aria-label="返回">' + ICON.back + '</button>' +
      '<div class="detail-title"><b>' + esc(ev.stage) + ' · ' + esc(ev.bo) + '</b>' +
        '<span>' + esc(L.dateLabel(ev.date) + ' ' + L.weekdayCN(ev.date) + ' ' + ev.start) + '</span></div>' +
      '<button class="icon-btn' + (state.detailBusy ? ' spinning' : '') + '" data-act="detail-refresh" aria-label="刷新战报">' + ICON.refresh + '</button>' +
    '</div>';

    var board = '<section class="scoreboard">' +
      '<div class="sb-side"><span class="avatar" style="' + avatarStyle(ev.home) + '">' + esc(L.abbr(ev.home)) + '</span>' +
        '<b>' + esc(ev.home) + '</b></div>' +
      '<div class="sb-mid">' +
        '<div class="sb-num"><b>' + (d ? hs : '–') + '</b><i>:</i><b>' + (d ? as : '–') + '</b></div>' +
        '<span class="sb-tag' + (d && d.live && !dStale ? ' live' : '') + '">' + stateTxt +
          (d && d.live && !dStale ? ' · 自动更新' : (dStale ? ' · 正在同步' : '')) + '</span>' +
      '</div>' +
      '<div class="sb-side"><span class="avatar" style="' + avatarStyle(ev.away) + '">' + esc(L.abbr(ev.away)) + '</span>' +
        '<b>' + esc(ev.away) + '</b></div>' +
    '</section>';

    var body;
    if (!d || !games.length) {
      var fetching = !!state.syncing[key];
      var title = schedulingLive
        ? (fetching ? '正在获取战报…' : '战报还没出')
        : '比赛还没开始';
      var desc = schedulingLive
        ? '第一局结束后官方才会有数据。<br>页面会自动同步，也可以点下面重试。'
        : '开赛后会显示首发阵容与逐局战报。';
      body = '<div class="empty" style="margin-top:16px">' +
        '<div class="icon">' + ICON.calX + '</div>' +
        '<h3>' + title + '</h3>' +
        '<p>' + desc + '</p>' +
        '<button class="btn btn-ghost" style="flex:0 0 auto;margin:0 auto" data-act="detail-refresh">刷新战报</button>' +
      '</div>';
    } else {
      var tabs = games.map(function (g, i) {
        return '<button class="gtab' + (i === idx ? ' on' : '') + '" data-act="game-tab" data-idx="' + i + '">' +
          '第' + g.seq + '局</button>';
      }).join('');
      if (d.live) tabs += '<span class="gtab pending">进行中…</span>';

      body = '<div class="game-tabs">' + tabs + '</div>' +
        lineupHTML(games[0], ev) +
        gameHTML(cur);
    }

    var foot = '<div class="detail-foot">' +
      '<button class="btn btn-ghost" data-act="detail-ics" data-id="' + esc(ev.id) + '">' + ICON.cal + '加入日历</button>' +
      '<span class="src">数据：' + esc(d ? '王者荣耀赛事数据平台' : '官方战报待公布') + '</span>' +
    '</div>';

    return head + '<div class="detail-scroll">' + board + body + foot + '</div>';
  }

  function renderDetail() {
    var host = $('#detail');
    if (!host) return;
    if (state.route !== 'detail' || !state.detailKey) {
      host.hidden = true;
      host.innerHTML = '';
      return;
    }
    host.hidden = false;
    host.innerHTML = detailHTML(state.detailKey);
    var sc = host.querySelector('.detail-scroll');
    if (sc) sc.scrollTop = state.detailScroll || 0;
  }

  /* ----------------------------- 在线战报 ----------------------------- */

  async function apiJSON(path) {
    var resp = await fetch(API + path, { cache: 'no-store' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    return resp.json();
  }

  async function discoverMatchId(ev) {
    var compact = ev.date.replace(/-/g, '');
    for (var i = 1; i <= 4; i++) {
      var mid = compact + (i < 10 ? '0' + i : '' + i);
      try {
        var r = await apiJSON('/match/battles/open?match_id=' + mid);
        var list = r.results || [];
        if (!list.length) continue;
        var b = await apiJSON('/battle/open?battle_id=' + list[0].battle_id);
        var dt = b.data || {};
        var names = [(dt.camp1 || {}).team_name, (dt.camp2 || {}).team_name];
        if (names.indexOf(ev.home) >= 0 && names.indexOf(ev.away) >= 0) return mid;
      } catch (e) { /* 继续试下一场 */ }
    }
    return null;
  }

  async function refreshMatch(key, silent) {
    if (state.detailBusy) return;
    var ev = detailEvent(key);
    if (!ev) return;
    var d = state.details[key];
    state.detailBusy = true;
    state.syncing[key] = true;
    if (state.route === 'detail') renderDetail();
    else render();                     // 列表里立刻显示「同步中」
    if (!silent) toast('正在拉取官方战报…');

    try {
      var matchId = (d && d.matchId) || state.detailIds[key] || ev.matchId || (await discoverMatchId(ev));
      if (!matchId) {
        if (!silent) toast('官方还没有这场比赛的逐局数据');
        state.detailBusy = false;
        delete state.syncing[key];
        if (state.route === 'detail') renderDetail();
        else render();
        return;
      }
      state.detailIds[key] = matchId;
      var r = await apiJSON('/match/battles/open?match_id=' + matchId);
      var all = r.results || [];
      var done = all.filter(function (b) { return b.status === 2; });
      var have = d ? d.games.length : 0;
      var isPast = ev.date < L.nowKey();      // 往日的比赛一定已经打完了
      var pending = all.length > done.length; // 还有没打完的局
      // 已有数据可能是「半成品」（某局还没写胜方），这种不能算最新，必须重拉
      var broken = L.seriesIncomplete(d);

      if (done.length <= have && !broken) {
        // 局数没变。但如果这是往日的比赛、又没在打的局，说明快照卡在 live 上了，直接收尾
        if (d && isPast && !pending && d.live) {
          L.closeSeries(d);
          stopPoll();
          state.detailBusy = false;
          delete state.syncing[key];
          toast('已更新：' + (d.winner || '比赛') + ' 结束');
          render();
          return;
        }
        if (!silent) toast(have ? '已经是最新：' + have + ' 局' : '还没有结束的局');
        state.detailBusy = false;
        delete state.syncing[key];
        if (state.route === 'detail') renderDetail();
        else render();
        return;
      }

      var games = [];
      for (var i = 0; i < done.length; i++) {
        var one = await apiJSON('/battle/open?battle_id=' + done[i].battle_id);
        var g = L.normalizeBattle(one.data);
        // 局刚打完时官方数据可能还没写全（没有胜方），这种先不要，下一轮再拉
        if (g && g.winner) games.push(g);
      }
      if (!games.length) throw new Error('没有解析到完整的局数据');

      var nd = {
        matchId: matchId,
        date: ev.date,
        bo: ev.bo,
        teams: [games[0].teams[0].name, games[0].teams[1].name],
        icons: {},
        score: {},
        games: games
      };
      games.forEach(function (g) {
        g.teams.forEach(function (t) { nd.icons[t.name] = t.icon; });
      });
      L.recomputeSeries(nd);
      if (isPast && !pending) L.closeSeries(nd);
      state.details[key] = nd;
      state.gameIdx = Math.min(Math.max(state.gameIdx, 0), games.length - 1);
      if (nd.live) startPoll(); else stopPoll();
      toast('战报已更新到第 ' + games.length + ' 局');
    } catch (e) {
      if (!silent) toast('拉取失败，请检查网络后重试');
    }
    state.detailBusy = false;
    delete state.syncing[key];
    render();
  }

  /**
   * 后台同步：按优先级处理几场
   *   1. 今天有快照、还在打的
   *   2. 今天还没拿到数据、但按时间已经开打的（需要先发现 match_id）
   *   3. 往日快照还挂着 live 的（隔夜情况）
   */
  async function autoUpdateLive() {
    if (state.detailBusy) return;
    var list = L.refreshTargets(state.evs || [], state.details, L.nowKey(), 2, 3);
    for (var i = 0; i < list.length; i++) {
      if (state.detailBusy) break;
      await refreshMatch(list[i].key, true);
    }
  }

  /* ----------------------------- 倒计时 ----------------------------- */

  function tick() {
    var deadline = $('[data-deadline]');
    if (deadline) {
      var b = deadline.querySelector('.count-b');
      var ms = new Date(deadline.dataset.deadline) - Date.now();
      if (b) b.textContent = L.countdown(Math.max(0, ms)).text;
    }
    var since = $('[data-since]');
    if (since) {
      var b2 = since.querySelector('.count-b');
      if (b2) b2.textContent = L.fromNow(Date.now() - new Date(since.dataset.since).getTime());
    }
  }

  /* ----------------------------- 导出 ----------------------------- */

  function icsFor(events) {
    return L.buildICS(events, { season: state.data.season || 'KPL', alarmMinutes: 30 });
  }

  function download(filename, text) {
    try {
      var blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        URL.revokeObjectURL(url);
        if (a.parentNode) a.parentNode.removeChild(a);
      }, 1500);
      return true;
    } catch (e) {
      return false;
    }
  }

  function isWeChat() { return /micromessenger/i.test(navigator.userAgent || ''); }

  function exportEvents(events, tag) {
    if (!events.length) { toast('没有可导出的比赛'); return; }
    var stamp = L.nowKey().replace(/-/g, '');
    var ok = download('KPL-' + tag + '-' + stamp + '.ics', icsFor(events));
    if (!ok) { toast('导出失败，请换个浏览器试试'); return; }
    var msg = '已导出 ' + events.length + ' 场比赛';
    if (isWeChat()) msg += '；若没反应，点右上角「…」→ 在浏览器打开';
    else msg += '，打开文件即可加入日历';
    toast(msg);
  }

  function exportOne(id) {
    var ev = state.evs.filter(function (e) { return e.id === id; })[0];
    if (!ev) return;
    var tag = (L.abbr(ev.home) + '-' + L.abbr(ev.away)).replace(/[^\w.-]/g, '') || 'match';
    exportEvents([ev], ev.date + '-' + tag);
  }

  /* ----------------------------- 弹层 ----------------------------- */

  function openSheet() {
    var evs = state.evs.length ? state.evs : L.withStatus(state.data.events || []);
    var todayCount = evs.filter(function (e) { return e.date === L.nowKey(); }).length;
    var mineCount = mineEvents(evs).length;

    var opt = function (act, icon, title, desc, disabled) {
      return '<button class="opt" data-act="' + act + '"' + (disabled ? ' disabled' : '') + '>' +
        '<span class="opt-icon">' + icon + '</span>' +
        '<span class="opt-body"><span class="opt-title">' + title + '</span><span class="opt-desc">' + desc + '</span></span>' +
        '<span class="opt-arrow">›</span></button>';
    };

    $('#sheet-panel').innerHTML =
      '<div class="sheet-grip"></div>' +
      '<h2 id="sheet-title">导入到日历</h2>' +
      '<p class="sheet-sub">导出 .ics 文件，点开即可加入手机自带日历</p>' +
      opt('export-all', ICON.download, '全部赛程 · ' + evs.length + ' 场', '整季一键导入，含开赛前 30 分钟提醒') +
      opt('export-today', ICON.cal, '仅今天 · ' + todayCount + ' 场', todayCount ? '只要今天这一天的比赛' : '今天没有比赛', !todayCount) +
      opt('export-mine', ICON.star, '我的战队 · ' + mineCount + ' 场', mineCount ? '只导入关注战队的比赛' : '先去「我的战队」关注几支队', !mineCount) +
      opt('copy-sub', ICON.link, '订阅日历（自动更新）', '复制链接，粘到日历的「添加订阅」里') +
      '<div class="tips">' +
        '<h3>怎么用？</h3>' +
        '<ol>' +
          '<li><b>iPhone</b>：点「全部赛程」→ 下载 → 在「文件」里点开 .ics → 添加到日历</li>' +
          '<li><b>Android</b>：下载后用系统「日历」打开 .ics 文件</li>' +
          '<li><b>微信内</b>：先点右上角「…」→ 在浏览器打开，再下载</li>' +
          '<li><b>电脑</b>：双击 .ics 导入 Outlook / 系统日历；也可用 Google 日历「导入」</li>' +
        '</ol>' +
      '</div>' +
      '<p class="build">版本 ' + BUILD + '</p>';

    $('#sheet-mask').classList.add('open');
    $('#sheet-panel').classList.add('open');
  }

  function closeSheet() {
    $('#sheet-mask').classList.remove('open');
    $('#sheet-panel').classList.remove('open');
  }

  var toastTimer;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 3200);
  }

  /* ----------------------------- 刷新 ----------------------------- */

  function b64ToText(b64) {
    var bin = atob(String(b64).replace(/\s/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }

  function eventsFromICS(text) {
    var parsed = L.parseICS(text);
    var stages = state.data.stages || BASE.stages || [];
    return parsed.map(function (p) {
      var parts = p.summary.split(':').map(function (s) { return s.trim(); });
      var home = parts[0] || p.summary;
      var away = parts[1] || '';
      var date = L.dayKey(p.startAt);
      var st = L.stageFor(date, stages);
      return {
        id: date + 'T' + L.hm(p.startAt).replace(':', '') + '-' + String(p.uid || '').slice(0, 8),
        uid: p.uid,
        date: date,
        start: L.hm(p.startAt),
        end: L.hm(p.endAt),
        startAt: p.startAt,
        endAt: p.endAt,
        home: home,
        away: away,
        stage: st.stage,
        bo: st.bo,
        tbd: !away || home === '待定' || away === '待定'
      };
    }).sort(function (a, b) { return new Date(a.startAt) - new Date(b.startAt); });
  }

  async function refresh() {
    if (state.busy) return;
    state.busy = true;
    var btn = $('#btn-refresh');
    if (btn) btn.classList.add('spinning');
    toast('正在获取最新赛程…');

    for (var i = 0; i < SOURCES.length; i++) {
      var src = SOURCES[i];
      try {
        var resp = await fetch(src.url, { cache: 'no-store' });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        var text;
        if (src.json) {
          var body = await resp.json();
          if (!body || !body.content) throw new Error('无 content');
          text = b64ToText(body.content);
        } else {
          text = await resp.text();
        }
        if (text.indexOf('BEGIN:VCALENDAR') < 0) throw new Error('不是日历数据');
        var events = eventsFromICS(text);
        if (!events.length) throw new Error('解析到 0 场比赛');

        state.data = {
          season: state.data.season || BASE.season,
          stages: state.data.stages || BASE.stages,
          source: 'KPL 官方赛程（在线更新）',
          updatedAt: new Date().toISOString(),
          events: events
        };
        saveJson(LS.cache, state.data);
        render();
        toast('已更新：' + events.length + ' 场比赛');
        state.busy = false;
        if (btn) btn.classList.remove('spinning');
        return;
      } catch (e) {
        /* 换下一个数据源 */
      }
    }

    state.busy = false;
    if (btn) btn.classList.remove('spinning');
    toast('更新失败，继续使用本地赛程（网络或数据源不可用）');
  }

  /* ----------------------------- 主题 ----------------------------- */

  var mql = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    var meta = $('#meta-theme');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f2f4f9' : '#070a10');
    var b = $('#btn-theme');
    if (b) b.innerHTML = theme === 'light' ? ICON.moon : ICON.sun;
  }

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') || 'dark';
  }

  function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem(LS.theme); } catch (e) { /* ignore */ }
    applyTheme(saved || (mql && mql.matches ? 'light' : 'dark'));
    if (mql && mql.addEventListener) {
      mql.addEventListener('change', function () {
        var s = null;
        try { s = localStorage.getItem(LS.theme); } catch (e) { /* ignore */ }
        if (!s) applyTheme(mql.matches ? 'light' : 'dark');
      });
    }
  }

  /* ----------------------------- 事件 ----------------------------- */

  function onAction(act, el) {
    switch (act) {
      case 'tab':
        state.tab = el.dataset.tab;
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;
      case 'tab-all':
        state.tab = 'all';
        render();
        break;
      case 'toggle-ended':
        state.hideEnded = !state.hideEnded;
        saveJson(LS.hideEnded, state.hideEnded);
        render();
        break;
      case 'follow': {
        var team = el.dataset.team;
        var i = state.followed.indexOf(team);
        if (i >= 0) state.followed.splice(i, 1);
        else state.followed.push(team);
        saveJson(LS.follow, state.followed);
        render();
        break;
      }
      case 'ics-one':
        exportOne(el.dataset.id);
        break;
      case 'export-all':
        closeSheet();
        exportEvents(L.withStatus(state.data.events), 'all');
        break;
      case 'export-today':
        closeSheet();
        exportEvents(state.evs.filter(function (e) { return e.date === L.nowKey(); }), 'today');
        break;
      case 'export-mine':
        closeSheet();
        exportEvents(mineEvents(state.evs), 'my-teams');
        break;
      case 'copy-sub':
        copyText(SUBSCRIBE_URL);
        break;
      case 'sheet':
        openSheet();
        break;
      case 'close-sheet':
        closeSheet();
        break;
      case 'refresh':
        refresh();
        break;
      case 'detail':
        openDetail(el.dataset.key);
        break;
      case 'detail-back':
        closeDetail();
        break;
      case 'game-tab': {
        var sc = $('#detail') ? $('#detail').querySelector('.detail-scroll') : null;
        if (sc) state.detailScroll = sc.scrollTop;
        state.gameIdx = parseInt(el.dataset.idx, 10) || 0;
        render();
        break;
      }
      case 'detail-refresh':
        if (state.detailKey) refreshMatch(state.detailKey, false);
        break;
      case 'detail-ics':
        exportOne(el.dataset.id);
        break;
      case 'theme':
        var next = currentTheme() === 'light' ? 'dark' : 'light';
        try { localStorage.setItem(LS.theme, next); } catch (e) { /* ignore */ }
        applyTheme(next);
        break;
    }
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        toast('订阅链接已复制，粘到日历「添加订阅」里即可自动更新');
      }, function () { fallbackCopy(text); });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    toast(ok ? '订阅链接已复制' : text);
  }

  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
    if (!el) return;
    if (el.disabled) return;
    onAction(el.dataset.act, el);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (state.route === 'detail') closeDetail();
      else closeSheet();
      return;
    }
    if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.dataset && e.target.dataset.act) {
      e.preventDefault();
      onAction(e.target.dataset.act, e.target);
    }
  });

  /* ----------------------------- 启动 ----------------------------- */

  function boot() {
    state.followed = loadJson(LS.follow, []) || [];
    if (!Array.isArray(state.followed)) state.followed = [];
    // 默认隐藏已结束；用户手动切换过就按他的记忆来
    var savedHide = loadJson(LS.hideEnded, null);
    state.hideEnded = savedHide === null ? true : savedHide !== false;

    var cache = loadCache();
    if (cache) state.data = cache;

    initTheme();
    var btnRefresh = $('#btn-refresh');
    if (btnRefresh) btnRefresh.innerHTML = ICON.refresh;
    render();

    // 一打开就同步一次：隔夜之后，内置快照里可能还挂着「进行中」的旧比赛
    setTimeout(autoUpdateLive, 500);

    setInterval(tick, 1000);

    var lastKey = L.nowKey();
    var autoTick = 0;
    setInterval(function () {
      if (L.nowKey() !== lastKey) {
        lastKey = L.nowKey();
        render();
        autoUpdateLive();          // 跨天了，把昨天挂着的比赛收尾
      }
      autoTick++;
      if (autoTick % 10 === 0) autoUpdateLive();

      var fresh = L.withStatus(state.data.events || []);
      var changed = fresh.length !== state.evs.length;
      if (!changed) {
        for (var i = 0; i < fresh.length; i++) {
          if (fresh[i].status !== state.evs[i].status) { changed = true; break; }
        }
      }
      if (changed) render();
    }, 30000);

    // 回到前台：重算「今天」、刷倒计时，并补一次同步
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') return;
      if (L.nowKey() !== lastKey) { lastKey = L.nowKey(); render(); }
      else tick();
      autoUpdateLive();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
