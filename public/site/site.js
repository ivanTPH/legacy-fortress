(function(){
  // Opened from guided set-up (/onboarding): one clear way back, and no "Start free" to wander off to.
  if (/[?&]from=setup(&|$)/.test(location.search)) {
    document.documentElement.classList.add('lf-from-setup');
    var bar = document.createElement('div'); bar.className = 'setup-return';
    bar.innerHTML = '<a href="/onboarding?step=welcome"><span aria-hidden="true">&lsaquo;</span> Back to set-up</a>';
    document.body.insertBefore(bar, document.body.firstChild);
    var video = document.querySelector('section[aria-label="Video"]');
    if (video) setTimeout(function(){ video.scrollIntoView({ block: 'start' }); }, 50);
  }
  // Show which page you're on in the main menu.
  var here = document.body.getAttribute('data-path');
  document.querySelectorAll('nav[aria-label="Main"] a').forEach(function(a){
    if (a.getAttribute('href') === here) { a.setAttribute('aria-current','page'); a.style.textDecoration='underline'; a.style.textUnderlineOffset='6px'; a.style.fontWeight='600'; }
  });
  // Already signed in on this device: offer the Vault instead of Sign in / Start free.
  var signedIn = false;
  try { for (var i = 0; i < localStorage.length; i++) { if (/^sb-.+-auth-token$/.test(localStorage.key(i) || '')) { signedIn = true; break; } } } catch (e) {}
  // Been here before on a remembered device but signed out: invite them to sign in rather than start again.
  var returning = false;
  if (!signedIn) { try { returning = Boolean(localStorage.getItem('lf:returning')); } catch (e) {} }
  if (returning) {
    document.documentElement.classList.add('lf-returning');
    document.querySelectorAll('a[data-signup]').forEach(function(a){
      a.setAttribute('href', '/sign-in');
      if (a.closest('header')) a.hidden = true; else a.textContent = 'Sign in to your Vault';
    });
  }
  if (signedIn) {
    document.querySelectorAll('header a[data-signin]').forEach(function(a){ a.hidden = true; });
    document.documentElement.classList.add('lf-signed-in');
    // Every "Start free" button becomes "Open my Vault" (header, hero and closing call to action).
    document.querySelectorAll('a[data-signup]').forEach(function(a){
      a.setAttribute('href', '/dashboard');
      if (a.closest('header')) a.innerHTML = '<span class="lbl-long">Open my Vault</span><span class="lbl-short">My Vault</span>';
      else a.textContent = 'Open my Vault';
    });
  }
  // Pricing: monthly or yearly.
  var prices = {monthly:['£3.99','a month','Or £39 a year. 14 days free, cancel any time.'], yearly:['£39','a year','Works out at £3.25 a month. 14 days free.']};
  document.querySelectorAll('[data-billing]').forEach(function(btn){
    btn.addEventListener('click', function(){
      var which = btn.getAttribute('data-billing');
      document.querySelectorAll('[data-billing]').forEach(function(b){ var on = b === btn; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      document.querySelectorAll('[data-price]').forEach(function(el){ el.textContent = prices[which][0]; });
      document.querySelectorAll('[data-period]').forEach(function(el){ el.textContent = prices[which][1]; });
      document.querySelectorAll('[data-note]').forEach(function(el){ el.textContent = prices[which][2]; });
    });
  });

  // Forms: check the required fields, then show the thank-you message. Nothing is sent yet on TEST.
  document.querySelectorAll('[data-form]').forEach(function(form){
    form.addEventListener('submit', function(event){
      event.preventDefault();
      var first = null;
      form.querySelectorAll('.field-error').forEach(function(e){ e.remove(); });
      form.querySelectorAll('[required]').forEach(function(field){
        var bad = field.type === 'checkbox' ? !field.checked
          : field.tagName === 'SELECT' ? field.selectedIndex <= 0
          : field.type === 'email' ? !/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(field.value.trim())
          : !field.value.trim();
        field.setAttribute('aria-invalid', bad ? 'true' : 'false');
        if (bad) {
          var note = document.createElement('span');
          note.className = 'field-error';
          note.textContent = field.type === 'checkbox' ? 'Please tick this box so we can contact you.' : field.type === 'email' ? 'Enter an email address, like name@example.com.' : field.tagName === 'SELECT' ? 'Choose an option.' : 'Please fill this in.';
          (field.type === 'checkbox' ? field.parentElement : field.parentElement).appendChild(note);
          if (!first) first = field;
        }
      });
      if (first) { first.focus(); return; }
      var card = form.closest('[data-when="form"]').parentElement;
      card.querySelector('[data-when="form"]').hidden = true;
      var done = card.querySelector('[data-when="sent"]');
      done.hidden = false;
      done.setAttribute('tabindex','-1'); done.focus();
    });
  });
  // Partner form: the selected choice gets the strong border.
  document.querySelectorAll('input[name="request"]').forEach(function(radio){
    radio.addEventListener('change', function(){
      document.querySelectorAll('input[name="request"]').forEach(function(r){ r.parentElement.style.border = r.checked ? '2px solid #2B1714' : '1px solid #E3DAD3'; });
    });
  });


  // Phone header: a Menu button shows the page links (and Sign in) in a panel.
  document.querySelectorAll('.page header').forEach(function(header){
    var row = header.firstElementChild; var nav = header.querySelector('nav[aria-label="Main"]');
    if (!row || !nav) return;
    // Sign in is always in the menu too, on every page.
    var signin = header.querySelector('a[data-signin]');
    var signedIn = document.documentElement.classList.contains('lf-signed-in');
    if (!signin && !signedIn && !header.querySelector('a[href="/enterprise/sign-in"]')) {
      // Every page offers Sign in on a phone, not only the home page.
      signin = document.createElement('a');
      signin.setAttribute('data-signin', '');
      signin.href = /^https?:$/.test(location.protocol) && !/claude/.test(location.hostname) ? '/sign-in' : 'https://test.mylegacyfortress.com/sign-in';
      signin.textContent = 'Sign in';
      signin.className = 'phone-only';
      signin.style.color = '#1F1715'; signin.style.fontWeight = '600';
      row.insertBefore(signin, row.lastElementChild && row.lastElementChild.tagName === 'A' && row.lastElementChild.hasAttribute('data-signup') ? row.lastElementChild : null);
    }
    if (!signin) signin = header.querySelector('a[href="/enterprise/sign-in"]');
    if (signin && !signin.hidden) { var extra = signin.cloneNode(true); extra.removeAttribute('style'); extra.className = 'nav-extra'; extra.removeAttribute('data-signin'); nav.appendChild(extra); }
    var signup = header.querySelector('a[data-signup]');
    if (signup) { var cta = signup.cloneNode(true); cta.removeAttribute('style'); cta.className = 'nav-cta'; cta.removeAttribute('data-signup'); if (document.documentElement.classList.contains('lf-signed-in')) cta.textContent = 'Open my Vault'; nav.appendChild(cta); }
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'menu-btn'; btn.setAttribute('aria-label', 'Menu'); btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span class="ms" aria-hidden="true">menu</span><span class="menu-lbl">Menu</span>';
    btn.addEventListener('click', function(){
      var open = header.classList.toggle('menu-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.innerHTML = open ? '<span class="ms" aria-hidden="true">close</span><span class="menu-lbl">Close</span>' : '<span class="ms" aria-hidden="true">menu</span><span class="menu-lbl">Menu</span>';
    });
    nav.addEventListener('click', function(e){ if (e.target.closest('a')) { header.classList.remove('menu-open'); btn.setAttribute('aria-expanded','false'); btn.innerHTML = '<span class="ms" aria-hidden="true">menu</span><span class="menu-lbl">Menu</span>'; } });
    row.appendChild(btn);
  });

  // Tour film: each scene lasts as long as its voice-over, with a short cross-fade between scenes.
  var SCENES = [{"say": "This is Legacy Fortress. One safe place for everything your family will need, so life is easier for them when you're no longer there to help.", "secs": 9.07}, {"say": "Your whole picture is on one page. Finances, legal, property and possessions, with a clear view of what's done and what's next.", "secs": 8.18}, {"say": "Step one. Add what you have, a little at a time. Upload a statement and we'll read the details for you to check.", "secs": 6.85}, {"say": "Step two. Add your Will. We find the executors it names, and remind you to check it's still up to date.", "secs": 6.55}, {"say": "Step three. Name the people who'll help. Adding someone never shows them your records. You decide what each person sees.", "secs": 7.72}, {"say": "Step four. Invite them safely. They join with a quick ID check, and new devices get a simple code by email.", "secs": 7.88}, {"say": "Step five. When the time comes, a real person checks the evidence first. Only what you chose is released.", "secs": 7.17}, {"say": "Start free today, and upgrade to Premium whenever you need more. Legacy Fortress. Peace of mind for you and your family.", "secs": 7.9}];
  var player = document.querySelector('[data-player]');
  var posterHtml = player ? player.innerHTML : '';
  var film = null, idx = 0, timer = null, tick = null, started = 0, length = 0, paused = false, voiceOn = true, runId = 0;
  // Recorded voice-over, one clip per scene (a calm British female voice).
  var audio = new Audio(); audio.preload = 'auto';
  function clear(){ clearTimeout(timer); clearInterval(tick); try { audio.pause(); } catch (e) {} }
  function setProgress(){
    if (!film) return;
    var p = Math.min(1, (Date.now() - started) / length);
    var now = film.querySelector('.f-dots .now span');
    if (now) now.style.setProperty('--p', p.toFixed(3));
  }
  function next(){ if (idx < SCENES.length - 1) go(idx + 1); else finish(); }
  function go(n){
    clear(); runId++;
    var mine = runId;
    idx = n; paused = false; syncPause();
    film.querySelectorAll('.fs').forEach(function(s, i){ s.classList.toggle('on', i === n); s.setAttribute('aria-hidden', i === n ? 'false' : 'true'); });
    film.querySelectorAll('.f-dots button').forEach(function(b, i){ b.classList.toggle('done', i < n); b.classList.toggle('now', i === n); var sp = b.querySelector('span'); sp.style.removeProperty('--p'); });
    var text = SCENES[n].say;
    film.querySelector('[data-caption]').textContent = text;
    length = SCENES[n].secs * 1000 + 700; started = Date.now();
    tick = setInterval(setProgress, 100);
    if (voiceOn) {
      audio.src = '/site/audio/scene-' + n + '.mp3';
      audio.onended = function(){ if (mine === runId && !paused) { clearTimeout(timer); timer = setTimeout(next, 700); } };
      var playing = audio.play();
      if (playing && playing.catch) playing.catch(function(){});
      // Keep the film moving even if the clip can't play.
      timer = setTimeout(next, length + 2500);
    } else {
      timer = setTimeout(next, length);
    }
  }
  function finish(){
    clear();
    film.querySelectorAll('.f-dots button').forEach(function(b){ b.classList.add('done'); b.classList.remove('now'); });
    film.querySelector('[data-caption]').textContent = '';
    var bar = player.querySelector('[data-pause]');
    if (bar) bar.innerHTML = '<span class="ms" aria-hidden="true">replay</span>Play again';
    paused = true; ended = true;
  }
  var ended = false;
  function syncPause(){
    var b = player && player.querySelector('[data-pause]');
    if (b) b.innerHTML = paused ? '<span class="ms" aria-hidden="true">play_arrow</span>Play' : '<span class="ms" aria-hidden="true">pause</span>Pause';
  }
  function togglePause(){
    if (ended) { ended = false; go(0); return; }
    if (paused) { go(idx); return; }
    clear(); runId++; paused = true; syncPause();
  }
  function syncVoice(){
    var b = player.querySelector('[data-voice]');
    b.innerHTML = voiceOn ? '<span class="ms" aria-hidden="true">volume_up</span>Voice on' : '<span class="ms" aria-hidden="true">volume_off</span>Voice off';
    b.setAttribute('aria-pressed', voiceOn ? 'true' : 'false');
  }
  function play(){
    player.innerHTML = document.getElementById('film-template').innerHTML +
      '<div class="film-bar"><div><button type="button" data-pause></button><button type="button" data-voice></button></div>' +
      '<button type="button" data-close><span class="ms" aria-hidden="true">close</span>Close video</button></div>';
    film = player.querySelector('[data-film]');
    ended = false;
    syncVoice();
    film.querySelectorAll('[data-goto]').forEach(function(b){ b.addEventListener('click', function(){ ended = false; go(Number(b.getAttribute('data-goto'))); }); });
    player.querySelector('[data-pause]').addEventListener('click', togglePause);
    player.querySelector('[data-voice]').addEventListener('click', function(){ voiceOn = !voiceOn; syncVoice(); if (!paused && !ended) go(idx); });
    player.querySelector('[data-close]').addEventListener('click', stopFilm);
    go(0);
  }
  function stopFilm(){
    if (!player || !player.querySelector('[data-film]')) return;
    clear(); runId++; film = null;
    player.innerHTML = posterHtml;
    player.querySelector('[data-play]').addEventListener('click', play);
  }
  if (player) player.querySelector('[data-play]').addEventListener('click', play);
})();
