/* KPL 赛程 · 纯逻辑层（可被浏览器与 Node 共同加载，便于测试） */
(function (root) {
  'use strict';

  var TZ = 'Asia/Shanghai';

  /* ----------------------------- 时间工具 ----------------------------- */

  var dayFmt;
  try {
    dayFmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
    });
  } catch (e) {
    dayFmt = null;
  }

  var WEEKDAY_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /** 把任意时刻格式化为上海时区的 YYYY-MM-DD */
  function dayKey(input) {
    var d = input instanceof Date ? input : new Date(input);
    if (isNaN(d.getTime())) return '';
    if (dayFmt) {
      // en-CA 输出形如 2026-10-21
      var s = dayFmt.format(d);
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    }
    var t = new Date(d.getTime() + 8 * 3600 * 1000);
    return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate());
  }

  function nowKey() { return dayKey(new Date()); }

  function weekdayCN(key) {
    var p = key.split('-');
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return WEEKDAY_CN[d.getUTCDay()];
  }

  function dateLabel(key) {
    var p = key.split('-');
    return (+p[1]) + '月' + (+p[2]) + '日';
  }

  /** 距今多久：刚刚 / 3 小时 / 2 天 */
  function fromNow(ms) {
    var abs = Math.abs(ms);
    var min = 60000, hour = 3600000, day = 86400000;
    if (abs < min) return '刚刚';
    if (abs < hour) return Math.round(abs / min) + ' 分钟';
    if (abs < day) return Math.round(abs / hour) + ' 小时';
    var d = Math.round(abs / day);
    return d + ' 天';
  }

  /** 倒计时拆解，用于「距开赛 02:15:30」 */
  function countdown(ms) {
    if (ms < 0) ms = 0;
    var total = Math.floor(ms / 1000);
    var d = Math.floor(total / 86400);
    var h = Math.floor((total % 86400) / 3600);
    var m = Math.floor((total % 3600) / 60);
    var s = total % 60;
    return { days: d, text: (d > 0 ? d + ' 天 ' : '') + pad(h) + ':' + pad(m) + ':' + pad(s) };
  }

  /* ----------------------------- 赛程模型 ----------------------------- */

  function byTime(a, b) { return new Date(a.startAt) - new Date(b.startAt); }

  /** 给每场比赛补上状态：upcoming | live | ended */
  function withStatus(events, now) {
    var t = (now ? new Date(now) : new Date()).getTime();
    return events.map(function (ev) {
      var s = new Date(ev.startAt).getTime();
      var e = new Date(ev.endAt).getTime();
      var status = t < s ? 'upcoming' : (t < e ? 'live' : 'ended');
      var o = {};
      for (var k in ev) if (Object.prototype.hasOwnProperty.call(ev, k)) o[k] = ev[k];
      o.status = status;
      return o;
    });
  }

  function groupByDay(events) {
    var out = [], map = {};
    events.slice().sort(byTime).forEach(function (ev) {
      if (!map[ev.date]) {
        map[ev.date] = { date: ev.date, events: [] };
        out.push(map[ev.date]);
      }
      map[ev.date].events.push(ev);
    });
    return out;
  }

  function nextUpcoming(events, now) {
    var t = (now ? new Date(now) : new Date()).getTime();
    var list = events.filter(function (ev) { return new Date(ev.startAt).getTime() > t; }).sort(byTime);
    return list.length ? list[0] : null;
  }

  function currentLive(events, now) {
    var t = (now ? new Date(now) : new Date()).getTime();
    var list = events.filter(function (ev) {
      return new Date(ev.startAt).getTime() <= t && t < new Date(ev.endAt).getTime();
    });
    return list.length ? list[0] : null;
  }

  function allTeams(events) {
    var count = {}, order = [];
    events.forEach(function (ev) {
      [ev.home, ev.away].forEach(function (n) {
        if (!n || n === '待定') return;
        if (!count[n]) { count[n] = 0; order.push(n); }
        count[n]++;
      });
    });
    return order.sort(function (a, b) { return count[b] - count[a]; });
  }

  /* ----------------------------- 队伍视觉 ----------------------------- */

  // 常用战队的固定色，保证同一战队在各端颜色一致
  var TEAM_COLORS = {
    '成都AG超玩会': '#e5484d',
    '北京WB': '#3b82f6',
    '北京JDG': '#c8102e',
    '广州TTG': '#8b5cf6',
    '深圳DYG': '#06b6d4',
    '上海EDG.M': '#94a3b8',
    '杭州LGD.NBW': '#f59e0b',
    'KSG': '#10b981',
    '苏州KSG': '#10b981',
    '长沙TES.A': '#f97316',
    '济南RW侠': '#f43f5e',
    '南通Hero久竞': '#eab308',
    '重庆狼队': '#16a34a',
    '佛山DRG': '#a855f7'
  };

  function abbr(name) {
    if (!name) return '?';
    if (name === '待定') return '?';
    var m = name.match(/[A-Za-z][A-Za-z0-9]*/);
    if (m) return m[0].toUpperCase();
    // 纯中文队名（如“重庆狼队”）：取末尾两字更有辨识度
    return name.length > 2 ? name.slice(-2) : name;
  }

  function colorOf(name) {
    if (TEAM_COLORS[name]) return TEAM_COLORS[name];
    var h = 0;
    for (var i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
    return 'hsl(' + h + ', 62%, 52%)';
  }

  /* ----------------------------- iCalendar ----------------------------- */

  function escICS(v) {
    return String(v == null ? '' : v)
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r?\n/g, '\\n');
  }

  /** ISO 时间 → 上海时区的 YYYYMMDDTHHMMSS */
  function shanghaiParts(date, opts) {
    var o = { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' };
    for (var k in opts) if (Object.prototype.hasOwnProperty.call(opts, k)) o[k] = opts[k];
    return new Intl.DateTimeFormat('en-GB', o).formatToParts(date)
      .reduce(function (acc, p) { acc[p.type] = p.value; return acc; }, {});
  }

  function icsLocal(iso) {
    var p = shanghaiParts(new Date(iso));
    return p.year + p.month + p.day + 'T' + p.hour + p.minute + p.second;
  }

  /** ISO 时间 → 上海时区的 HH:MM */
  function hm(iso) {
    var p = shanghaiParts(new Date(iso));
    return p.hour + ':' + p.minute;
  }

  /** 按阶段窗口给某一天标注「阶段 / 赛制」 */
  function stageFor(date, stages) {
    if (stages) {
      for (var i = 0; i < stages.length; i++) {
        if (date >= stages[i].start && date <= stages[i].end) {
          return { stage: stages[i].stage, bo: stages[i].bo };
        }
      }
    }
    return { stage: 'KPL 赛程', bo: 'BO7' };
  }

  function icsUTC(date) {
    return date.getUTCFullYear() + pad(date.getUTCMonth() + 1) + pad(date.getUTCDate()) +
      'T' + pad(date.getUTCHours()) + pad(date.getUTCMinutes()) + pad(date.getUTCSeconds()) + 'Z';
  }

  var encoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
  function byteLen(str) {
    if (encoder) return encoder.encode(str).length;
    var n = 0;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0xd800 ? 3 : 4;
    }
    return n;
  }

  /** 按 RFC 5545 折行：每行不超过 73 字节，续行以空格开头 */
  function foldLine(line) {
    if (byteLen(line) <= 73) return [line];
    var out = [], cur = '', bytes = 0, i, ch, b;
    for (i = 0; i < line.length; i++) {
      ch = line[i];
      b = byteLen(ch);
      if (bytes + b > 73) { out.push(cur); cur = ' ' + ch; bytes = 1 + b; }
      else { cur += ch; bytes += b; }
    }
    if (cur) out.push(cur);
    return out;
  }

  function eventSummary(ev, prefix) {
    if (ev.tbd) return (prefix || 'KPL') + ' 总决赛 · 对阵待定';
    return (prefix || 'KPL') + ' ' + ev.home + ' vs ' + ev.away;
  }

  function eventDetail(ev, season) {
    var lines = [];
    lines.push((season || 'KPL') + ' · ' + ev.stage + ' · ' + ev.bo);
    lines.push('时间：' + ev.date + ' ' + ev.start + (ev.end ? '-' + ev.end : ''));
    lines.push('赛程由「KPL 赛程」小程序生成');
    return lines.join('\n');
  }

  /**
   * 生成 .ics
   * @param {Array} events
   * @param {{season?:string, alarmMinutes?:number}} opts
   */
  function buildICS(events, opts) {
    opts = opts || {};
    var season = opts.season || 'KPL';
    var alarm = opts.alarmMinutes == null ? 30 : opts.alarmMinutes;
    var stamp = icsUTC(new Date());
    var L = [];
    L.push('BEGIN:VCALENDAR');
    L.push('VERSION:2.0');
    L.push('PRODID:-//KPL Schedule Mini//CN');
    L.push('CALSCALE:GREGORIAN');
    L.push('METHOD:PUBLISH');
    L.push('X-WR-CALNAME:KPL 赛程');
    L.push('X-WR-TIMEZONE:' + TZ);
    L.push('X-WR-CALDESC:' + escICS(season + ' 赛程（由 KPL 赛程小程序生成）'));
    L.push('BEGIN:VTIMEZONE');
    L.push('TZID:' + TZ);
    L.push('BEGIN:STANDARD');
    L.push('DTSTART:19700101T000000');
    L.push('TZOFFSETFROM:+0800');
    L.push('TZOFFSETTO:+0800');
    L.push('TZNAME:CST');
    L.push('END:STANDARD');
    L.push('END:VTIMEZONE');

    events.slice().sort(byTime).forEach(function (ev) {
      L.push('BEGIN:VEVENT');
      L.push('UID:' + escICS(ev.uid || (ev.date + '-' + ev.start + '-' + ev.home + '-' + ev.away)));
      L.push('DTSTAMP:' + stamp);
      L.push('DTSTART;TZID=' + TZ + ':' + icsLocal(ev.startAt));
      L.push('DTEND;TZID=' + TZ + ':' + icsLocal(ev.endAt));
      L.push('SUMMARY:' + escICS(eventSummary(ev, 'KPL')));
      L.push('DESCRIPTION:' + escICS(eventDetail(ev, season)));
      L.push('CATEGORIES:KPL,电竞');
      L.push('STATUS:CONFIRMED');
      L.push('TRANSP:TRANSPARENT');
      if (alarm > 0) {
        L.push('BEGIN:VALARM');
        L.push('TRIGGER:-PT' + alarm + 'M');
        L.push('ACTION:DISPLAY');
        L.push('DESCRIPTION:' + escICS(eventSummary(ev, 'KPL') + ' 即将开始'));
        L.push('END:VALARM');
      }
      L.push('END:VEVENT');
    });

    L.push('END:VCALENDAR');

    var folded = [];
    L.forEach(function (line) { folded = folded.concat(foldLine(line)); });
    return folded.join('\r\n') + '\r\n';
  }

  /** Google 日历「添加活动」链接 */
  function gcalURL(ev, season) {
    var s = icsLocal(ev.startAt), e = icsLocal(ev.endAt);
    var params = [
      'action=TEMPLATE',
      'text=' + encodeURIComponent(eventSummary(ev, 'KPL')),
      'dates=' + s + '/' + e,
      'ctz=' + TZ,
      'details=' + encodeURIComponent(eventDetail(ev, season))
    ];
    return 'https://calendar.google.com/calendar/render?' + params.join('&');
  }

  /* ----------------------------- ICS 解析 ----------------------------- */

  function unfold(text) {
    var lines = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    var out = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (/^[ \t]/.test(line) && out.length) out[out.length - 1] += line.slice(1);
      else out.push(line);
    }
    return out;
  }

  function parseDateProp(value, tzid) {
    var m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec((value || '').trim());
    if (!m) return null;
    var iso = m[1] + '-' + m[2] + '-' + m[3] + 'T' + m[4] + ':' + m[5] + ':' + m[6];
    if (m[7] === 'Z' || (tzid || '').toUpperCase() === 'UTC') return iso + 'Z';
    return iso + '+08:00';
  }

  function unescapeICS(v) {
    return String(v || '')
      .replace(/\\n/gi, ' ')
      .replace(/\\,/g, ',')
      .replace(/\\;/g, ';')
      .replace(/\\\\/g, '\\')
      .trim();
  }

  /** 解析 .ics 文本 → 精简事件数组 */
  function parseICS(text) {
    var lines = unfold(text), cur = null, out = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line === 'BEGIN:VEVENT') { cur = { tzid: '' }; continue; }
      if (line === 'END:VEVENT') {
        if (cur && cur.summary && cur.startAt) {
          out.push({
            uid: cur.uid || '',
            summary: cur.summary,
            startAt: cur.startAt,
            endAt: cur.endAt || cur.startAt
          });
        }
        cur = null;
        continue;
      }
      if (!cur) continue;
      var idx = line.indexOf(':');
      if (idx < 0) continue;
      var head = line.slice(0, idx), value = line.slice(idx + 1);
      var name = head.split(';')[0].toUpperCase();
      var tz = (/TZID=([^;:]+)/.exec(head) || [])[1] || '';
      if (name === 'SUMMARY') cur.summary = unescapeICS(value);
      else if (name === 'UID') cur.uid = value.trim();
      else if (name === 'DTSTART') cur.startAt = parseDateProp(value, tz);
      else if (name === 'DTEND') cur.endAt = parseDateProp(value, tz);
    }
    return out;
  }

  /* ----------------------------- 战报数据 ----------------------------- */

  /** "元流之子(坦克)" → "元流之子" */
  function heroShort(name) {
    return String(name || '').replace(/[(（].*?[)）]/g, '').trim();
  }

  /** "长沙TES.A书源" → "书源"；"成都AG.钟意" → "钟意" */
  function stripTeam(full, team) {
    var s = String(full || '');
    if (!s) return s;
    var cands = [];
    if (team) {
      cands.push(team);
      var m = /[A-Za-z][A-Za-z0-9]*/.exec(team);
      if (m) {
        var abbr = m[0];
        var idx = team.indexOf(abbr);
        cands.push(team.slice(0, idx + abbr.length)); // 城市 + 简称，如「成都AG」
        cands.push(abbr);
      }
    }
    cands.sort(function (a, b) { return b.length - a.length; });
    for (var i = 0; i < cands.length; i++) {
      var c = cands[i];
      if (c && s.indexOf(c) === 0) {
        var rest = s.slice(c.length).replace(/^[.\s·_-]+/, '').trim();
        if (rest) return rest;
      }
    }
    return s;
  }

  function neededWins(bo) {
    var n = parseInt(String(bo || '').replace(/[^0-9]/g, ''), 10);
    return isNaN(n) || n <= 0 ? 4 : Math.floor(n / 2) + 1;
  }

  function gameWinner(game) {
    if (!game) return '';
    if (game.winner) return game.winner;
    var t = (game.teams || []).filter(function (x) { return x.camp === game.winCamp; })[0];
    return t ? t.name : '';
  }

  /** 根据已有局数重算比分 / 是否结束 */
  function recomputeSeries(detail) {
    if (!detail) return detail;
    var teams = detail.teams || [];
    var score = {};
    teams.forEach(function (n) { score[n] = 0; });
    (detail.games || []).forEach(function (g) {
      var w = gameWinner(g);
      if (w && score[w] != null) score[w] += 1;
    });
    var need = neededWins(detail.bo);
    var best = 0;
    teams.forEach(function (n) { best = Math.max(best, score[n]); });
    var finished = best >= need;
    detail.score = score;
    detail.finished = finished;
    detail.live = !finished;
    detail.winner = finished ? teams.filter(function (n) { return score[n] === best; })[0] || '' : '';
    return detail;
  }

  /** 官方单局 JSON → 精简结构（与 tools/fetch_details.py 保持一致） */
  function normalizeBattle(d) {
    if (!d || !d.battle_id) return null;
    var teams = [];
    [['camp1', 1], ['camp2', 2]].forEach(function (pair) {
      var c = d[pair[0]] || {};
      if (!c.team_name) return;
      teams.push({
        camp: pair[1],
        name: c.team_name,
        icon: c.team_icon,
        isWin: !!c.is_win,
        kills: c.kill_num || 0,
        deaths: c.death_num || 0,
        assists: c.assist_num || 0,
        gold: c.gold || 0,
        towers: c.push_tower_num || 0,
        bigDragons: c.kill_big_dragon_num || 0,
        darkTyrants: c.kill_dark_tyrant_num || 0,
        kda: c.kda || 0
      });
    });
    if (teams.length < 2) return null;

    var winCamp = d.win_camp;
    var winner = '';
    teams.forEach(function (t) { if (t.camp === winCamp) winner = t.name; });

    var players = (d.battle_player_list || []).map(function (p) {
      return {
        camp: p.camp,
        name: p.actual_player_name || '',
        team: p.team_name || '',
        hero: p.hero_name || '',
        heroIcon: p.hero_icon || '',
        kills: p.kill_num || 0,
        deaths: p.death_num || 0,
        assists: p.assist_num || 0,
        kda: p.kda || 0,
        gold: p.gold || 0,
        damage: p.hurt_total || 0,
        damageRate: Math.round((p.hurt_total_rate || 0) * 10000) / 10000,
        partRate: Math.round((p.participation_rate || 0) * 10) / 10,
        mvp: !!p.is_mvp,
        svp: !!p.is_lose_mvp,
        score: p.mvp_score || 0,
        spell: (p.SummonerAbilityInfo || {}).summoner_ability_name || ''
      };
    });

    var bans = [], picks = [];
    (d.bp_list || []).forEach(function (b) {
      var rec = { camp: b.camp, hero: b.hero_name || '', icon: b.hero_icon || '' };
      if (b.is_ban_or_pick === 0) bans.push(rec); else picks.push(rec);
    });

    return {
      seq: d.battle_seq || 0,
      winCamp: winCamp,
      winner: winner,
      duration: Math.round((d.game_duration || 0) / 1000),
      teams: teams,
      players: players,
      bans: bans,
      picks: picks
    };
  }

  /**
   * 强制收尾：把还在 live 的比分定格。
   * 用于「往日的比赛」——官方已经打完，但本地快照还停在 live 的情况。
   */
  function closeSeries(detail) {
    if (!detail) return detail;
    recomputeSeries(detail);
    var best = 0, win = '';
    (detail.teams || []).forEach(function (n) {
      var s = (detail.score && detail.score[n]) || 0;
      if (s > best) { best = s; win = n; }
    });
    detail.finished = true;
    detail.live = false;
    if (win) detail.winner = win;
    return detail;
  }

  /** 赛程 key：日期 + 排序后的两队名，用于把战报对到赛程 */
  function matchKey(date, a, b) {
    var pair = [a, b].sort();
    return date + '|' + pair[0] + '|' + pair[1];
  }

  /**
   * 列出该去刷新战报的比赛，按优先级：
   *   1. 今天有快照、还在打的
   *   2. 今天还没拿到过数据、但按时间应该已经在打的（新比赛，需要先「发现」match_id）
   *   3. 往日快照还挂着 live 的（隔夜没刷新）
   * @returns {Array<{key:string,matchId:string,date:string,stale:boolean,discover:boolean}>}
   */
  function refreshTargets(events, details, todayKey, maxAgeDays, limit, nowMs) {
    var today = todayKey || nowKey();
    var maxAge = maxAgeDays == null ? 2 : maxAgeDays;
    var now = nowMs == null ? Date.now() : nowMs;
    var c = new Date(new Date(today + 'T00:00:00Z').getTime() - maxAge * 86400000);
    var cutoff = c.getUTCFullYear() + '-' + pad(c.getUTCMonth() + 1) + '-' + pad(c.getUTCDate());

    var liveToday = [], freshToday = [], past = [];
    (events || []).forEach(function (ev) {
      if (!ev || !ev.date) return;
      var k = matchKey(ev.date, ev.home, ev.away);
      var d = details && details[k];

      if (d && d.live && d.matchId) {
        var hit = { key: k, matchId: d.matchId, date: ev.date, stale: ev.date !== today, discover: false };
        if (ev.date === today) liveToday.push(hit);
        else if (ev.date >= cutoff && ev.date < today) past.push(hit);
        return;
      }

      // 还没有任何快照：只针对「今天、已经开打、且没打太久」的比赛去尝试发现数据
      if (!d && ev.date === today && ev.startAt && ev.endAt) {
        var s = new Date(ev.startAt).getTime();
        var e = new Date(ev.endAt).getTime();
        if (now >= s - 5 * 60000 && now <= e + 3 * 3600000) {
          freshToday.push({ key: k, matchId: '', date: ev.date, stale: false, discover: true });
        }
      }
    });

    past.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var all = liveToday.concat(freshToday, past);
    return limit == null ? all : all.slice(0, limit);
  }

  /** 兼容旧调用：只要一个目标 */
  function nextRefreshTarget(events, details, todayKey, maxAgeDays) {
    var list = refreshTargets(events, details, todayKey, maxAgeDays, 1);
    return list.length ? list[0] : null;
  }

  var api = {
    TZ: TZ,
    dayKey: dayKey,
    nowKey: nowKey,
    weekdayCN: weekdayCN,
    dateLabel: dateLabel,
    fromNow: fromNow,
    countdown: countdown,
    withStatus: withStatus,
    groupByDay: groupByDay,
    nextUpcoming: nextUpcoming,
    currentLive: currentLive,
    allTeams: allTeams,
    abbr: abbr,
    colorOf: colorOf,
    hm: hm,
    stageFor: stageFor,
    buildICS: buildICS,
    gcalURL: gcalURL,
    eventSummary: eventSummary,
    parseICS: parseICS,
    escICS: escICS,
    foldLine: foldLine,
    heroShort: heroShort,
    stripTeam: stripTeam,
    neededWins: neededWins,
    gameWinner: gameWinner,
    recomputeSeries: recomputeSeries,
    closeSeries: closeSeries,
    normalizeBattle: normalizeBattle,
    matchKey: matchKey,
    nextRefreshTarget: nextRefreshTarget,
    refreshTargets: refreshTargets
  };

  root.KPLLib = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
