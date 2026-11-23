(function () {
'use strict';

/* ------------------------------------------------------------------
   SETTINGS
   endpoint: the Google Apps Script web-app URL that stores applications
   (text → Google Sheet, photos → Google Drive). Empty = preview mode.
   PHOTOS: image URLs that replace the grey photo placeholders, keyed by
   the slot's data-photo name (hero, strip1…strip5, ev-<slug>, …).
------------------------------------------------------------------- */
var CONFIG = { endpoint: 'https://script.google.com/macros/s/AKfycbxQ9FhLkqB4kYz0qTMFi5ziyiEvzi5ZZcn9viqE6yLwvTxDpQ30ZH4Rx4QVROIxwMer/exec' };
var PHOTOS = {};

var root = document.documentElement;
function $(s, el) { return (el || document).querySelector(s); }
function $$(s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); }
var store = {
  get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
};
var lang = 'en';

$$('[data-photo]').forEach(function (el) {
  var u = PHOTOS[el.dataset.photo];
  if (u) { el.style.backgroundImage = 'url("' + u + '")'; el.classList.add('has-img'); }
});

/* mobile menu */
var nav = $('.nav'), menuBtn = $('.menu-btn');
if (menuBtn) menuBtn.addEventListener('click', function () {
  var open = !nav.classList.contains('open');
  nav.classList.toggle('open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
});
$$('.mnav a').forEach(function (a) { a.addEventListener('click', function () { nav.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); }); });

/* ---------------- messages ---------------- */
var MSG = {
  en: {
    req: 'This one is required.', choose: 'Please choose one.', email: 'Please enter a valid email address.',
    phone: 'Please enter a valid phone number.', linkedin: 'Please paste your LinkedIn profile link.',
    date: 'Please enter your date of birth.', age: 'You need to be 21 or older to attend.',
    min: function (n) { return 'Please pick at least ' + n + '.'; }, max: function (n) { return 'Please pick no more than ' + n + '.'; },
    other: 'Please fill in the box.', photo: 'Please add this photo.', ftype: 'Please use a JPG, PNG or HEIC file.',
    fsize: 'Each photo must be 10 MB or smaller.', more: 'You can add up to 3 more photos.',
    prompts: 'Please choose 2 different prompts and answer both.', long: 'Please shorten your answer to 50 words (about 100 characters in Chinese).',
    consent: 'Please confirm to continue.', fix: 'Please check the highlighted questions.',
    step: function (a, b) { return 'Step ' + a + ' of ' + b; },
    wc: function (n) { return n + ' / 50 words'; }, cc: function (n) { return n + ' / 100 characters'; },
    next: 'Next', submit: 'Submit application', send: 'Send', sending: 'Sending…', failed: 'Could not send. Please check your connection and try again.',
    tap: 'Tap to upload'
  },
  zh: {
    req: '这一项为必填。', choose: '请选择一项。', email: '请输入有效的邮箱地址。',
    phone: '请输入有效的手机号。', linkedin: '请粘贴你的 LinkedIn 主页链接。',
    date: '请填写出生日期。', age: '参加活动需年满 21 岁。',
    min: function (n) { return '请至少选择 ' + n + ' 项。'; }, max: function (n) { return '最多选择 ' + n + ' 项。'; },
    other: '请在输入框里补充说明。', photo: '请上传这张照片。', ftype: '请使用 JPG、PNG 或 HEIC 格式。',
    fsize: '每张照片不能超过 10 MB。', more: '最多再添加 3 张照片。',
    prompts: '请选择 2 个不同的话题，并分别作答。', long: '请把回答控制在 50 个英文单词（中文约 100 字）以内。',
    consent: '请勾选确认后继续。', fix: '请检查标红的问题。',
    step: function (a, b) { return '第 ' + a + ' 步，共 ' + b + ' 步'; },
    wc: function (n) { return n + ' / 50 词'; }, cc: function (n) { return n + ' / 100 字'; },
    next: '下一步', submit: '提交申请', send: '发送', sending: '提交中…', failed: '发送失败，请检查网络后再试。',
    tap: '点击上传'
  }
};
function M(key, arg) { var m = MSG[lang][key]; return typeof m === 'function' ? m(arg) : m; }

/* ---------------- validation (shared by both forms) ---------------- */
var MB10 = 10 * 1024 * 1024;
function isImage(f) { return /^image\/(jpeg|png|heic|heif)$/i.test(f.type) || /\.(jpe?g|png|heic|heif)$/i.test(f.name); }
function isHeic(f) { return /heic|heif/i.test(f.type) || /\.(heic|heif)$/i.test(f.name); }
function hasCJK(s) { return /[㐀-鿿豈-﫿]/.test(s); }
function measure(s) {
  s = s.trim();
  if (!s) return { n: 0, cjk: false, over: false };
  if (hasCJK(s)) { var c = s.replace(/\s/g, '').length; return { n: c, cjk: true, over: c > 100 }; }
  var w = s.split(/\s+/).length; return { n: w, cjk: false, over: w > 50 };
}
function setErr(q, key, arg) {
  q._err = key ? [key, arg] : null;
  q.classList.toggle('bad', !!key);
  var e = $('.err', q); if (e) e.textContent = key ? M(key, arg) : '';
  q.querySelectorAll('input:not([type=checkbox]):not([type=radio]),select,textarea').forEach(function (el) {
    if (key) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
  });
}
function refreshErrors() { $$('.q').forEach(function (q) { if (q._err) setErr(q, q._err[0], q._err[1]); }); }
function otherMissing(q) {
  var miss = false;
  $$('input[data-other]', q).forEach(function (o) {
    if (!o.checked) return;
    var box = $('.otherin[data-for="' + o.value + '"]', q);
    if (box && box.hasAttribute('data-otherreq') && !box.value.trim()) miss = true;
  });
  return miss;
}
function check(q) {
  var t = q.dataset.type, req = q.hasAttribute('data-req');
  var input = $('input,textarea,select', q);
  var v = input && typeof input.value === 'string' ? input.value.trim() : '';
  switch (t) {
    case 'text': case 'textarea': case 'select':
      return req && !v ? ['req'] : null;
    case 'email':
      if (!v) return req ? ['req'] : null;
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? null : ['email'];
    case 'tel':
      if (!v) return req ? ['req'] : null;
      var d = v.replace(/\D/g, '').length; return d >= 7 && d <= 15 ? null : ['phone'];
    case 'linkedin':
      if (!v) return req ? ['req'] : null;
      return /linkedin\./i.test(v) ? null : ['linkedin'];
    case 'date':
      if (!v) return req ? ['date'] : null;
      var b = new Date(v + 'T00:00:00'), now = new Date();
      if (isNaN(b) || b.getFullYear() < 1900 || b > now) return ['date'];
      var age = now.getFullYear() - b.getFullYear(), m = now.getMonth() - b.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
      return age >= 21 ? null : ['age'];
    case 'radio':
      if (!$('input:checked', q)) return req ? ['choose'] : null;
      return otherMissing(q) ? ['other'] : null;
    case 'checkbox':
      var n = $$('input[type=checkbox]:checked', q).length;
      var min = +(q.dataset.min || 1), max = +(q.dataset.max || 99);
      if (req && n < min) return min > 1 ? ['min', min] : ['choose'];
      if (n > max) return ['max', max];
      return otherMissing(q) ? ['other'] : null;
    case 'file':
      var f = input.files && input.files[0];
      if (!f) return req ? ['photo'] : null;
      if (!isImage(f)) return ['ftype'];
      return f.size > MB10 ? ['fsize'] : null;
    case 'more':
      var fs = Array.prototype.slice.call(input.files || []);
      if (fs.length > 3) return ['more'];
      if (fs.some(function (x) { return !isImage(x); })) return ['ftype'];
      return fs.some(function (x) { return x.size > MB10; }) ? ['fsize'] : null;
    case 'prompts':
      var p1 = $('#f-prompt1').value, p2 = $('#f-prompt2').value;
      var a1 = $('#f-answer1').value.trim(), a2 = $('#f-answer2').value.trim();
      if (!p1 || !p2 || p1 === p2 || !a1 || !a2) return ['prompts'];
      return measure(a1).over || measure(a2).over ? ['long'] : null;
    case 'consent':
      return input.checked ? null : ['consent'];
  }
  return null;
}
function validate(q) { var r = check(q); setErr(q, r && r[0], r && r[1]); return !r; }
function validateIn(el) { var first = null; $$('.q', el).forEach(function (q) { if (!validate(q) && !first) first = q; }); return first; }
function focusQ(q) {
  q.scrollIntoView({ block: 'center' });
  var el = $('input:not(.vh):not([hidden]),select,textarea', q) || $('input', q);
  if (el) { try { el.focus({ preventScroll: true }); } catch (e) {} }
}
document.addEventListener('input', function (e) { var q = e.target.closest && e.target.closest('.q'); if (q && q._err) validate(q); });
document.addEventListener('change', function (e) {
  var q = e.target.closest && e.target.closest('.q'); if (!q) return;
  syncOthers(q); limitMax(q);
  if (q._err) validate(q);
});
function syncOthers(q) {
  $$('input[data-other]', q).forEach(function (o) {
    var box = $('.otherin[data-for="' + o.value + '"]', q);
    if (box) box.hidden = !o.checked;
  });
}
function limitMax(q) {
  if (!q.dataset.max) return;
  var max = +q.dataset.max, boxes = $$('input[type=checkbox]', q);
  var n = boxes.filter(function (b) { return b.checked; }).length;
  boxes.forEach(function (b) { b.disabled = !b.checked && n >= max; });
}

/* ---------------- sending ---------------- */
function readAsDataURL(file) {
  return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsDataURL(file); });
}
/* Shrink photos before upload (max 1800px, JPEG). HEIC that the browser can't decode is sent as-is. */
function packFile(field, file) {
  return readAsDataURL(file).then(function (url) {
    if (isHeic(file)) return { field: field, name: file.name, type: file.type || 'image/heic', data: url.split(',')[1] };
    return new Promise(function (res) {
      var img = new Image();
      img.onload = function () {
        var s = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight));
        var c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        var out = c.toDataURL('image/jpeg', 0.86);
        res({ field: field, name: file.name.replace(/\.[^.]+$/, '') + '.jpg', type: 'image/jpeg', data: out.split(',')[1] });
      };
      img.onerror = function () { res({ field: field, name: file.name, type: file.type, data: url.split(',')[1] }); };
      img.src = url;
    });
  });
}
function collect(form) {
  var data = {}, jobs = [];
  $$('input,select,textarea', form).forEach(function (el) {
    if (!el.name || el.disabled && el.type !== 'checkbox') return;
    if (el.type === 'file') {
      Array.prototype.slice.call(el.files || []).forEach(function (f) { jobs.push(packFile(el.name, f)); });
      return;
    }
    if (el.type === 'checkbox' || el.type === 'radio') {
      if (!el.checked) return;
      if (el.type === 'checkbox') data[el.name] = data[el.name] ? data[el.name] + ', ' + el.value : el.value;
      else data[el.name] = el.value;
      return;
    }
    if (el.value.trim()) data[el.name] = el.value.trim();
  });
  data.language = lang;
  data.page = location.pathname;
  return Promise.all(jobs).then(function (files) { data.files = files; return data; });
}
function send(payload) {
  return fetch(CONFIG.endpoint, { method: 'POST', body: JSON.stringify(payload), headers: { 'Content-Type': 'text/plain;charset=utf-8' } })
    .then(function (r) { return r.json(); })
    .then(function (j) { if (!j || !j.ok) throw new Error((j && j.error) || 'failed'); return j; });
}

/* ---------------- application form ---------------- */
var form = $('#appform');
if (form) (function () {
  var panels = $$('.panel', form), tabs = $$('.ftabs li', form);
  var nextBtn = $('#next'), backBtn = $('#back'), progress = $('#progress');
  var step = 0;

  /* event preselected from ?event= */
  var ev = new URLSearchParams(location.search).get('event');
  var evInput = $('#f-event'), note = $('#evnote');
  if (ev && evInput) {
    var opt = $('option[value="' + ev.replace(/[^a-z0-9-]/gi, '') + '"]', evInput);
    if (opt) { evInput.value = opt.value; if (note) { note.hidden = false; $('#evname-en').textContent = opt.dataset.en; $('#evname-zh').textContent = opt.dataset.zh; } }
  }

  function updateProgress() {
    progress.textContent = MSG[lang].step(step + 1, panels.length);
    progress.style.color = '';
    nextBtn.textContent = step === panels.length - 1 ? M('submit') : M('next');
    backBtn.hidden = step === 0;
    tabs.forEach(function (t, i) { t.classList.toggle('on', i === step); t.classList.toggle('done', i < step); });
  }
  function show(i) { panels.forEach(function (p, k) { p.hidden = k !== i; }); step = i; updateProgress(); form.scrollIntoView({ block: 'start' }); }
  nextBtn.addEventListener('click', function () {
    var bad = validateIn(panels[step]);
    if (bad) { focusQ(bad); return; }
    if (step < panels.length - 1) { show(step + 1); var h = $('h2', panels[step]); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); } }
    else submit();
  });
  backBtn.addEventListener('click', function () { if (step > 0) show(step - 1); });

  function preview(slot, file) {
    var pv = $('#pv-' + slot); if (!pv) return;
    pv.innerHTML = '';
    if (!file) { var s = document.createElement('small'); s.innerHTML = '<span data-t="en">' + MSG.en.tap + '</span><span data-t="zh">' + MSG.zh.tap + '</span>'; pv.appendChild(s); return; }
    if (isHeic(file)) { var n = document.createElement('small'); n.textContent = file.name; pv.appendChild(n); return; }
    var img = document.createElement('img'); img.alt = ''; img.src = URL.createObjectURL(file); pv.appendChild(img);
  }
  $$('.q[data-type=file] input[type=file]', form).forEach(function (inp) {
    inp.addEventListener('change', function () { var q = inp.closest('.q'), ok = validate(q); preview(q.dataset.q, ok ? inp.files[0] : null); });
  });
  var more = $('#f-photo_more');
  if (more) more.addEventListener('change', function () {
    var q = more.closest('.q'), ok = validate(q), th = $('#thumbs');
    th.innerHTML = '';
    if (!ok) return;
    Array.prototype.slice.call(more.files).forEach(function (f) {
      var pv = document.createElement('span'); pv.className = 'pv';
      if (isHeic(f)) { var s = document.createElement('small'); s.textContent = f.name; pv.appendChild(s); }
      else { var img = document.createElement('img'); img.alt = ''; img.src = URL.createObjectURL(f); pv.appendChild(img); }
      th.appendChild(pv);
    });
  });
  function updateCounts() {
    [1, 2].forEach(function (i) {
      var a = $('#f-answer' + i), c = $('#cnt' + i); if (!a || !c) return;
      var m = measure(a.value);
      c.textContent = m.cjk ? MSG[lang].cc(m.n) : MSG[lang].wc(m.n);
      c.classList.toggle('over', m.over);
    });
  }
  form.addEventListener('input', function (e) { if (/^f-answer/.test(e.target.id)) updateCounts(); });
  var dob = $('#f-dob');
  if (dob) { var t = new Date(); dob.max = (t.getFullYear() - 18) + '-12-31'; dob.min = '1940-01-01'; }

  /* autosave text answers (photos can't be saved by the browser) */
  var SAVE = 'av-application';
  function save() {
    var data = {};
    $$('input,select,textarea', form).forEach(function (el) {
      if (!el.name || el.type === 'file') return;
      if (el.type === 'checkbox' || el.type === 'radio') {
        if (!el.checked) return;
        if (el.type === 'checkbox') (data[el.name] = data[el.name] || []).push(el.value); else data[el.name] = el.value;
      } else if (el.value) data[el.name] = el.value;
    });
    store.set(SAVE, JSON.stringify(data));
  }
  function restore() {
    var raw = store.get(SAVE); if (!raw) return;
    var data; try { data = JSON.parse(raw); } catch (e) { return; }
    $$('input,select,textarea', form).forEach(function (el) {
      if (!el.name || el.type === 'file' || !(el.name in data)) return;
      if (el.name === 'event_interest' && ev) return;
      var v = data[el.name];
      if (el.type === 'checkbox') el.checked = [].concat(v).indexOf(el.value) >= 0;
      else if (el.type === 'radio') el.checked = el.value === v;
      else el.value = v;
    });
    $$('.q', form).forEach(function (q) { syncOthers(q); limitMax(q); });
  }
  var saveT;
  form.addEventListener('input', function () { clearTimeout(saveT); saveT = setTimeout(save, 400); });
  form.addEventListener('change', function () { clearTimeout(saveT); saveT = setTimeout(save, 100); });

  function finish(sent) {
    panels.forEach(function (p) { p.hidden = true; });
    $('.ftabs', form).hidden = true; $('#actions').hidden = true;
    $('#previewnote').hidden = sent;
    var d = $('#done'); d.hidden = false;
    store.del(SAVE);
    form.scrollIntoView({ block: 'start' }); d.focus({ preventScroll: true });
  }
  function submit() {
    for (var i = 0; i < panels.length; i++) {
      var bad = validateIn(panels[i]);
      if (bad) { show(i); progress.textContent = M('fix'); (function (b) { setTimeout(function () { focusQ(b); }, 50); })(bad); return; }
    }
    if (!CONFIG.endpoint) { finish(false); return; }
    nextBtn.disabled = true; backBtn.disabled = true; nextBtn.textContent = M('sending');
    collect(form).then(function (data) { data.form_type = 'application'; return send(data); })
      .then(function () { finish(true); })
      .catch(function () { progress.textContent = M('failed'); progress.style.color = 'var(--err)'; nextBtn.disabled = false; backBtn.disabled = false; nextBtn.textContent = M('submit'); });
  }
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  restore();
  window.__avForm = { updateProgress: updateProgress, updateCounts: updateCounts };
})();

/* ---------------- partner form ---------------- */
var pform = $('#partnerform');
if (pform) {
  pform.addEventListener('submit', function (e) {
    e.preventDefault();
    var bad = validateIn(pform); if (bad) { focusQ(bad); return; }
    var btn = $('button[type=submit]', pform), msg = $('#pmsg');
    if (!CONFIG.endpoint) { pform.hidden = true; $('#pdone').hidden = false; $('#ppreview').hidden = false; return; }
    btn.disabled = true; btn.textContent = M('sending');
    collect(pform).then(function (data) { data.form_type = 'partner'; return send(data); })
      .then(function () { pform.hidden = true; $('#pdone').hidden = false; })
      .catch(function () { msg.textContent = M('failed'); btn.disabled = false; btn.textContent = M('send'); });
  });
}

/* ---------------- language ---------------- */
function setLang(l) {
  lang = l === 'zh' ? 'zh' : 'en';
  root.dataset.lang = lang; root.lang = lang === 'zh' ? 'zh-CN' : 'en';
  $$('.lang button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === lang)); });
  $$('[data-alt-en]').forEach(function (el) { el.alt = lang === 'zh' ? el.dataset.altZh : el.dataset.altEn; });
  $$('[data-ph-en]').forEach(function (el) { el.placeholder = lang === 'zh' ? el.dataset.phZh : el.dataset.phEn; });
  $$('option[data-en]').forEach(function (op) { op.textContent = op.dataset[lang]; });
  var tt = root.dataset['title' + (lang === 'zh' ? 'Zh' : 'En')]; if (tt) document.title = tt;
  store.set('av-lang', lang);
  if (window.__avForm) { window.__avForm.updateProgress(); window.__avForm.updateCounts(); }
  refreshErrors();
}
$$('.lang button').forEach(function (b) { b.addEventListener('click', function () { setLang(b.dataset.lang); }); });
var saved = store.get('av-lang');
setLang(saved || ((navigator.language || '').toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en'));
})();
