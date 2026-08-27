/* Aiden's Coin Game — all state lives in localStorage on this device. */
(function () {
  'use strict';

  // ---------- Things you can buy ----------
  var ANIMALS = [
    { id: 'caterpillar', emoji: '🐛', price: 100 },
    { id: 'fish', emoji: '🐠', price: 125 },
    { id: 'chick', emoji: '🐤', price: 150 },
    { id: 'mouse', emoji: '🐭', price: 180 },
    { id: 'frog', emoji: '🐸', price: 215 },
    { id: 'bunny', emoji: '🐰', price: 250 },
    { id: 'kitten', emoji: '🐱', price: 300 },
    { id: 'puppy', emoji: '🐶', price: 350 },
    { id: 'turtle', emoji: '🐢', price: 400 },
    { id: 'parrot', emoji: '🦜', price: 460 },
    { id: 'pig', emoji: '🐷', price: 525 },
    { id: 'sheep', emoji: '🐑', price: 600 },
    { id: 'horse', emoji: '🐴', price: 675 },
    { id: 'cow', emoji: '🐮', price: 750 },
    { id: 'penguin', emoji: '🐧', price: 850 },
    { id: 'monkey', emoji: '🐵', price: 950 },
    { id: 'panda', emoji: '🐼', price: 1050 },
    { id: 'lion', emoji: '🦁', price: 1150 },
    { id: 'tiger', emoji: '🐯', price: 1250 },
    { id: 'elephant', emoji: '🐘', price: 1350 },
    { id: 'giraffe', emoji: '🦒', price: 1450 },
    { id: 'whale', emoji: '🐳', price: 1550 },
    { id: 'dinosaur', emoji: '🦕', price: 1650 },
    { id: 'trex', emoji: '🦖', price: 1750 },
    { id: 'unicorn', emoji: '🦄', price: 1875 },
    { id: 'dragon', emoji: '🐉', price: 2000 }
  ];

  // ---------- The bonus coins ----------
  // A silver 5 and a copper 10 show up on their own clocks. Tapping one opens
  // a one-question math quiz instead of paying out straight away — the bigger
  // the coin, the bigger the numbers.
  var SPECIALS = {
    nickel: {
      seconds: 20,     // how often this coin tries to appear
      offset: 0,       // stagger, so the two never land at the same moment
      reward: 5,       // coins for a correct answer
      low: 2, high: 9, // the answer always lands in this range
      pad: 70          // keep it clear of the screen edge (it is a wide coin)
    },
    dime: {
      seconds: 20,
      offset: 10,
      reward: 10,
      low: 11, high: 19,
      pad: 80
    }
  };

  // ---------- Saved state ----------
  // Bumped when prices change, so nobody carries a balance from the old economy.
  var SAVE_KEY = 'aidenGame.v2';
  var state = {
    coins: 0,               // every new player starts from zero
    owned: {},              // { animalId: count }
    spawnSeconds: 10,       // parent-adjustable
    maxCoins: 6,            // parent-adjustable
    sound: true
  };

  function load() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (saved && typeof saved === 'object') {
        state.coins = Math.max(0, saved.coins | 0);
        state.owned = saved.owned && typeof saved.owned === 'object' ? saved.owned : {};
        state.spawnSeconds = clamp(saved.spawnSeconds || 10, 1, 45);
        state.maxCoins = clamp(saved.maxCoins || 6, 1, 10);
        state.sound = saved.sound !== false;
      }
    } catch (e) {
      /* corrupted save — start fresh rather than crash */
    }
  }

  var saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      } catch (e) { /* private mode / full quota — game still plays this session */ }
    }, 200);
  }

  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }

  // ---------- Sound (generated, no audio files to load) ----------
  var audioCtx = null;
  function tone(freq, start, duration, type, volume) {
    if (!state.sound) return;
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    var t0 = audioCtx.currentTime + start;
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume || 0.2, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  var sfx = {
    coin: function () {
      tone(988, 0, 0.12, 'triangle', 0.22);
      tone(1319, 0.06, 0.18, 'triangle', 0.18);
    },
    buy: function () {
      [523, 659, 784, 1047].forEach(function (f, i) {
        tone(f, i * 0.09, 0.35, 'triangle', 0.2);
      });
    },
    nope: function () { tone(196, 0, 0.22, 'sine', 0.16); },
    pet: function () {
      tone(700 + Math.random() * 500, 0, 0.14, 'sine', 0.18);
      tone(900 + Math.random() * 600, 0.08, 0.16, 'sine', 0.14);
    }
  };

  // ---------- Elements ----------
  var $ = function (id) { return document.getElementById(id); };
  var coinCountEl = $('coin-count');
  var counterEl = $('counter');
  var playfield = $('playfield');
  var playHint = $('play-hint');
  var shopGrid = $('shop-grid');
  var collectionGrid = $('collection-grid');
  var collectionEmpty = $('collection-empty');

  // ---------- Coin counter ----------
  function renderCoins() {
    coinCountEl.textContent = state.coins;
    counterEl.classList.add('bump');
    setTimeout(function () { counterEl.classList.remove('bump'); }, 130);
  }

  // ---------- Play screen ----------
  var spawnTimer = null;

  function spawnCoin() {
    if (playfield.children.length >= state.maxCoins) return;
    var rect = playfield.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    var pad = 60;
    var coin = document.createElement('div');
    coin.className = 'coin';
    coin.innerHTML = '<i class="coin-icon"></i>';
    coin.style.left = (pad + Math.random() * Math.max(1, rect.width - pad * 2)) + 'px';
    coin.style.top = (pad + Math.random() * Math.max(1, rect.height - pad * 2)) + 'px';
    coin.addEventListener('pointerdown', collectCoin);
    playfield.appendChild(coin);
    playHint.classList.add('hidden');
  }

  function collectCoin(e) {
    var coin = e.currentTarget;
    if (coin.classList.contains('taken')) return;
    coin.classList.add('taken');
    setTimeout(function () { coin.remove(); }, 450);

    state.coins += 1;
    save();
    renderCoins();
    sfx.coin();
    burst(coin.offsetLeft, coin.offsetTop);
    renderShop();

    if (navigator.vibrate) navigator.vibrate(18);
  }

  function burst(x, y) {
    for (var i = 0; i < 6; i++) {
      var s = document.createElement('div');
      s.className = 'sparkle';
      s.textContent = '✨';
      s.style.left = x + 'px';
      s.style.top = y + 'px';
      var angle = (Math.PI * 2 * i) / 6;
      s.style.setProperty('--dx', Math.cos(angle) * 70 + 'px');
      s.style.setProperty('--dy', Math.sin(angle) * 70 + 'px');
      playfield.appendChild(s);
      (function (el) { setTimeout(function () { el.remove(); }, 600); })(s);
    }
  }

  // ---------- Bonus coins + math challenge ----------
  var specialTimers = {};
  var mathOverlay = $('math');
  var mathChoices = $('math-choices');
  var pendingSpec = null;     // which coin's quiz is open
  var pendingAnswer = null;   // the correct answer while the quiz is open
  var specialSpot = null;     // where the coin was, so the reward bursts there

  function spawnSpecial(kind) {
    // Only ever one of each at a time, and never while a quiz is already up.
    if (pendingAnswer !== null) return;
    if (playfield.querySelector('.coin.' + kind)) return;
    var rect = playfield.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    var pad = SPECIALS[kind].pad;
    var coin = document.createElement('div');
    coin.className = 'coin ' + kind;
    coin.innerHTML = '<i class="coin-icon ' + kind + '-icon"></i>';
    coin.style.left = (pad + Math.random() * Math.max(1, rect.width - pad * 2)) + 'px';
    coin.style.top = (pad + Math.random() * Math.max(1, rect.height - pad * 2)) + 'px';
    coin.addEventListener('pointerdown', function (e) { tapSpecial(e, kind); });
    playfield.appendChild(coin);
    playHint.classList.add('hidden');
  }

  function tapSpecial(e, kind) {
    var coin = e.currentTarget;
    if (coin.classList.contains('taken')) return;
    // The coin is spent the moment it is tapped — right or wrong, it is gone.
    coin.classList.add('taken');
    specialSpot = { x: coin.offsetLeft, y: coin.offsetTop };
    setTimeout(function () { coin.remove(); }, 450);
    if (navigator.vibrate) navigator.vibrate(18);
    openMath(kind);
  }

  // Each bonus coin runs its own clock, offset so they alternate rather than
  // landing together. The first one is a full interval away, not immediate.
  function restartSpecialTimers() {
    Object.keys(SPECIALS).forEach(function (kind) {
      var spec = SPECIALS[kind];
      clearTimeout(specialTimers[kind + '-first']);
      clearInterval(specialTimers[kind]);
      specialTimers[kind + '-first'] = setTimeout(function () {
        spawnSpecial(kind);
        specialTimers[kind] = setInterval(function () { spawnSpecial(kind); }, spec.seconds * 1000);
      }, (spec.offset + spec.seconds) * 1000);
    });
  }

  // Addition inside the coin's range. The nickel keeps the answer single digit
  // (2–9); the dime asks for a two digit one (11–19) — sometimes 10 + a digit,
  // sometimes two digits that carry over the ten.
  function makeProblem(spec) {
    var answer = spec.low + Math.floor(Math.random() * (spec.high - spec.low + 1));
    var a;
    if (answer > 10 && (answer > 18 || Math.random() < 0.5)) {
      a = 10;                                     // 10 + 7 = 17
    } else {
      var lo = Math.max(1, answer - 9);           // both addends stay single digit
      var hi = Math.min(9, answer - 1);
      a = lo + Math.floor(Math.random() * (hi - lo + 1));
    }
    return { a: a, b: answer - a, answer: answer };
  }

  // Two wrong answers close enough to the real one that it is a real choice,
  // and inside the same range so a dime never offers a single digit.
  function wrongAnswers(answer, spec) {
    var pool = [];
    for (var n = Math.max(spec.low, answer - 3); n <= Math.min(spec.high, answer + 3); n++) {
      if (n !== answer) pool.push(n);
    }
    shuffle(pool);
    return pool.slice(0, 2);
  }

  function shuffle(list) {
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    return list;
  }

  function openMath(kind) {
    var spec = SPECIALS[kind];
    var problem = makeProblem(spec);
    pendingSpec = spec;
    pendingAnswer = problem.answer;
    $('math-a').textContent = problem.a;
    $('math-b').textContent = problem.b;

    // The prize badge wears the coin that was tapped.
    $('math-prize').className = 'math-prize ' + kind;
    $('math-prize-icon').className = 'coin-icon ' + kind + '-icon';
    $('math-prize-value').textContent = '+' + spec.reward;

    var options = shuffle(wrongAnswers(problem.answer, spec).concat([problem.answer]));
    mathChoices.classList.remove('answered');
    mathChoices.innerHTML = '';
    options.forEach(function (value) {
      var btn = document.createElement('button');
      btn.className = 'math-choice';
      btn.type = 'button';
      btn.textContent = value;
      btn.addEventListener('click', function () { answerMath(value, btn); });
      mathChoices.appendChild(btn);
    });

    mathOverlay.classList.add('open');
  }

  function answerMath(value, btn) {
    if (pendingAnswer === null) return;
    var correct = value === pendingAnswer;
    var reward = pendingSpec.reward;
    pendingAnswer = null;
    pendingSpec = null;

    // Freeze the buttons and show what happened before closing.
    mathChoices.classList.add('answered');
    btn.classList.add(correct ? 'right' : 'wrong');

    if (correct) {
      state.coins += reward;
      save();
      renderCoins();
      renderShop();
      sfx.buy();
      if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
    } else {
      sfx.nope();
    }

    setTimeout(function () {
      mathOverlay.classList.remove('open');
      // Sparkle where the coin was, so the reward lands back on the playfield.
      if (correct && specialSpot) burst(specialSpot.x, specialSpot.y);
      specialSpot = null;
    }, correct ? 750 : 900);
  }

  function restartSpawnTimer() {
    clearInterval(spawnTimer);
    spawnTimer = setInterval(spawnCoin, state.spawnSeconds * 1000);
  }

  // ---------- Shop ----------
  function renderShop() {
    var frag = document.createDocumentFragment();
    ANIMALS.forEach(function (animal) {
      var affordable = state.coins >= animal.price;
      var card = document.createElement('div');
      card.className = 'card ' + (affordable ? 'affordable' : 'locked');
      card.innerHTML =
        '<span class="emoji">' + animal.emoji + '</span>' +
        '<span class="price"><i class="coin-icon"></i>' + animal.price + '</span>';

      var count = state.owned[animal.id] || 0;
      if (count > 0) {
        var badge = document.createElement('span');
        badge.className = 'count-badge';
        badge.textContent = count;
        card.appendChild(badge);
      }

      card.addEventListener('click', function () { askToBuy(animal); });
      frag.appendChild(card);
    });
    shopGrid.innerHTML = '';
    shopGrid.appendChild(frag);
  }

  // ---------- Buy confirmation ----------
  var pendingAnimal = null;
  var confirmOverlay = $('confirm');

  function askToBuy(animal) {
    if (state.coins < animal.price) {
      sfx.nope();
      counterEl.classList.add('bump');
      setTimeout(function () { counterEl.classList.remove('bump'); }, 130);
      return;
    }
    pendingAnimal = animal;
    $('confirm-emoji').textContent = animal.emoji;
    $('confirm-price').lastElementChild.textContent = animal.price;
    confirmOverlay.classList.add('open');
  }

  $('confirm-no').addEventListener('click', function () {
    confirmOverlay.classList.remove('open');
    pendingAnimal = null;
  });

  $('confirm-yes').addEventListener('click', function () {
    if (!pendingAnimal) return;
    var animal = pendingAnimal;
    pendingAnimal = null;
    confirmOverlay.classList.remove('open');

    if (state.coins < animal.price) { sfx.nope(); return; }
    state.coins -= animal.price;
    state.owned[animal.id] = (state.owned[animal.id] || 0) + 1;
    save();
    renderCoins();
    renderShop();
    renderCollection();
    sfx.buy();
    if (navigator.vibrate) navigator.vibrate([20, 40, 20]);
    celebrate(animal.emoji);
  });

  function celebrate(emoji) {
    var overlay = $('celebrate');
    $('celebrate-emoji').textContent = emoji;
    overlay.classList.add('open');
    setTimeout(function () {
      overlay.classList.remove('open');
      // point him at his new animal
      document.querySelector('.nav-btn[data-screen="collection"]').classList.add('nudge');
      setTimeout(function () {
        document.querySelector('.nav-btn[data-screen="collection"]').classList.remove('nudge');
      }, 600);
    }, 1400);
  }

  // ---------- Collection ----------
  function renderCollection() {
    var ownedList = ANIMALS.filter(function (a) { return (state.owned[a.id] || 0) > 0; });
    collectionEmpty.classList.toggle('hidden', ownedList.length > 0);

    var frag = document.createDocumentFragment();
    ownedList.forEach(function (animal) {
      var card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = '<span class="emoji">' + animal.emoji + '</span>';

      var count = state.owned[animal.id];
      if (count > 1) {
        var badge = document.createElement('span');
        badge.className = 'count-badge';
        badge.textContent = count;
        card.appendChild(badge);
      }

      card.addEventListener('click', function () {
        card.classList.remove('jiggle');
        void card.offsetWidth; // restart the animation
        card.classList.add('jiggle');
        sfx.pet();
      });
      frag.appendChild(card);
    });
    collectionGrid.innerHTML = '';
    collectionGrid.appendChild(frag);
  }

  // ---------- Navigation ----------
  document.querySelectorAll('.nav-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.nav-btn').forEach(function (b) { b.classList.remove('active'); });
      document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); });
      btn.classList.add('active');
      $('screen-' + btn.dataset.screen).classList.add('active');
      sfx.pet();
    });
  });

  // ---------- Parent settings (long-press the gear) ----------
  var gear = $('gear');
  var settingsOverlay = $('settings');
  var gearTimer = null;
  var gearStart = null;

  function startGearHold(e) {
    e.preventDefault();
    gearStart = { x: e.clientX, y: e.clientY };
    // Keep receiving events even if the finger drifts off the button.
    if (gear.setPointerCapture) {
      try { gear.setPointerCapture(e.pointerId); } catch (err) { /* not critical */ }
    }
    gear.classList.remove('charging');
    void gear.offsetWidth; // restart the ring animation
    gear.classList.add('charging');
    gearTimer = setTimeout(function () {
      cancelGearHold();
      openSettings();
    }, 1500);
  }

  function cancelGearHold() {
    clearTimeout(gearTimer);
    gearStart = null;
    gear.classList.remove('charging');
  }

  gear.addEventListener('pointerdown', startGearHold);
  gear.addEventListener('pointerup', cancelGearHold);
  gear.addEventListener('pointercancel', cancelGearHold);
  // A little wobble is fine — only a real drag away cancels the hold.
  gear.addEventListener('pointermove', function (e) {
    if (!gearStart) return;
    if (Math.hypot(e.clientX - gearStart.x, e.clientY - gearStart.y) > 30) cancelGearHold();
  });
  // Stop the long-press menu on touch devices from eating the hold.
  gear.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  function showSpeed() {
    var s = state.spawnSeconds;
    $('speed-text').innerHTML = 'A coin every <b>' + s + '</b> ' + (s === 1 ? 'second' : 'seconds');
  }

  function openSettings() {
    $('speed-slider').value = state.spawnSeconds;
    showSpeed();
    $('maxcoins-slider').value = state.maxCoins;
    $('maxcoins-value').textContent = state.maxCoins;
    $('sound-toggle').checked = state.sound;
    settingsOverlay.classList.add('open');
  }

  $('settings-close').addEventListener('click', function () {
    settingsOverlay.classList.remove('open');
  });

  $('speed-slider').addEventListener('input', function (e) {
    state.spawnSeconds = clamp(parseInt(e.target.value, 10) || 10, 1, 45);
    showSpeed();
    restartSpawnTimer();
    save();
  });

  $('maxcoins-slider').addEventListener('input', function (e) {
    state.maxCoins = clamp(parseInt(e.target.value, 10) || 6, 1, 10);
    $('maxcoins-value').textContent = state.maxCoins;
    save();
  });

  $('sound-toggle').addEventListener('change', function (e) {
    state.sound = e.target.checked;
    save();
    if (state.sound) sfx.coin();
  });

  // Reset needs a 2 second hold so it can't happen by accident.
  var resetBtn = $('reset-btn');
  var resetBar = $('reset-progress').firstElementChild;
  var resetStart = 0;
  var resetRaf = null;

  function resetTick() {
    var pct = Math.min(1, (Date.now() - resetStart) / 2000);
    resetBar.style.width = pct * 100 + '%';
    if (pct >= 1) {
      cancelReset();
      state.coins = 0;
      state.owned = {};
      save();
      renderCoins();
      renderShop();
      renderCollection();
      settingsOverlay.classList.remove('open');
      return;
    }
    resetRaf = requestAnimationFrame(resetTick);
  }
  function beginReset(e) {
    e.preventDefault();
    resetStart = Date.now();
    resetRaf = requestAnimationFrame(resetTick);
  }
  function cancelReset() {
    cancelAnimationFrame(resetRaf);
    resetBar.style.width = '0%';
  }
  resetBtn.addEventListener('pointerdown', beginReset);
  resetBtn.addEventListener('pointerup', cancelReset);
  resetBtn.addEventListener('pointerleave', cancelReset);
  resetBtn.addEventListener('pointercancel', cancelReset);

  // ---------- Start ----------
  load();
  renderCoins();
  renderShop();
  renderCollection();
  restartSpawnTimer();
  restartSpecialTimers();
  spawnCoin();          // one waiting for him right away
  setTimeout(spawnCoin, 1200);

  // Keep the coin flow going when the tablet comes back from sleep.
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) {
      restartSpawnTimer();
      restartSpecialTimers();
      spawnCoin();
    }
  });

  // iOS needs a user gesture before audio will play.
  document.addEventListener('pointerdown', function unlockAudio() {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    document.removeEventListener('pointerdown', unlockAudio);
  });

  // Stop two-finger zoom / double-tap zoom from fighting with the taps.
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
})();
