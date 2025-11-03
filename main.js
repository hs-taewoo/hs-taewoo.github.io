(function() {
  const scrollArea = document.getElementById('scrollArea');
  const body = document.body;

  // 문서의 전체 높이를 가로 길이에 맞게 설정 (동적으로 계산)
  function setScrollHeight() {
    const totalWidth = Math.max(0, scrollArea.scrollWidth - window.innerWidth);
    const scrollableHeight = totalWidth + window.innerHeight;
    body.style.height = scrollableHeight + 'px';
  }

  function update() {
    const maxScroll = Math.max(0, scrollArea.scrollWidth - window.innerWidth);
    const scrollY = Math.min(window.scrollY, maxScroll);
    // 스크롤 위치에 따라 가로 이동, Y 이동은 없음 (scroll-area가 fixed이므로)
    scrollArea.style.transform = `translateX(-${scrollY}px)`;
  }

  // 기본 업데이트 (매 스크롤 프레임마다 위치 적용)
  window.addEventListener('scroll', update, { passive: true });

  // 스냅 처리: 휠(또는 트랙패드) 이벤트 한 번으로 다음/이전 패널로 이동
  const panels = Array.from(document.querySelectorAll('.panel'));
  const panelCount = panels.length;
  let currentIndex = 0;
  let lock = false; // 잠금: 연속 휠 입력 방지
  const LOCK_TIME = 600; // ms - 한 번 스냅 후 잠금 유지 시간

  function clampIndex(i) {
    return Math.max(0, Math.min(i, panelCount - 1));
  }

  function goToIndex(i) {
    const idx = clampIndex(i);
    const maxScroll = Math.max(0, scrollArea.scrollWidth - window.innerWidth);
    const target = Math.min(idx * window.innerWidth, maxScroll);
    currentIndex = idx;
    window.scrollTo({ top: target, behavior: 'smooth' });
  }

  // 마지막 스크롤 위치 기준으로 현재 인덱스 동기화
  function syncCurrentIndex() {
    currentIndex = Math.round(window.scrollY / window.innerWidth);
    currentIndex = clampIndex(currentIndex);
  }

  // 휠 이벤트로 패널 전환
  window.addEventListener('wheel', function(e) {
    // 터치패드의 아주 작은 델타는 무시
    if (lock) return; 
    const delta = e.deltaY;
    if (Math.abs(delta) < 6) return; // 민감도: 너무 작은 움직임은 무시
    e.preventDefault();
    syncCurrentIndex();
    if (delta > 0) {
      goToIndex(currentIndex + 1);
    } else {
      goToIndex(currentIndex - 1);
    }
    lock = true;
    setTimeout(() => { lock = false; }, LOCK_TIME);
  }, { passive: false });

  // 터치 스와이프(간단한 처리): touchstart/touchend로 위/아래 스와이프 감지
  let touchStartY = null;
  window.addEventListener('touchstart', (ev) => {
    if (ev.touches && ev.touches[0]) touchStartY = ev.touches[0].clientY;
  }, { passive: true });
  window.addEventListener('touchend', (ev) => {
    if (touchStartY == null) return;
    const endY = (ev.changedTouches && ev.changedTouches[0]) ? ev.changedTouches[0].clientY : null;
    if (endY == null) { touchStartY = null; return; }
    const dy = touchStartY - endY;
    if (Math.abs(dy) < 30) { touchStartY = null; return; }
    syncCurrentIndex();
    if (dy > 0) goToIndex(currentIndex + 1); else goToIndex(currentIndex - 1);
    touchStartY = null;
  }, { passive: true });

  // 윈도우 리사이즈 시 인덱스와 스크롤 높이 재계산
  window.addEventListener('resize', () => {
    setScrollHeight();
    syncCurrentIndex();
    // 강제로 현재 인덱스로 맞춤
    goToIndex(currentIndex);
  });
  window.addEventListener('resize', () => {
    setScrollHeight();
    update();
  });

  // 초기 설정
  setScrollHeight();
  update();
})();

/* Intro click handler: 클릭하면 음악 재생, 애니메이션 트리거, 오버레이 제거 */
(function() {
  const intro = document.getElementById('intro');
  if (!intro) return;

  const audio = document.getElementById('introAudio');
  let triggered = false;

  function endIntro() {
    // 안전하게 DOM에서 제거하거나 숨김
    intro.classList.add('removed');
    
    // paint0 페이드인 시작
    const paint0 = document.querySelector('.paint.paint0');
    if (paint0) {
      // 약간의 지연 후 페이드인 시작 (50ms)
      setTimeout(() => paint0.classList.add('show'), 50);
    }
  }

  function onClickStart(event) {
    if (triggered) return;
    triggered = true;

    // 재생 시도 (사용자 클릭으로 허용됨)
    if (audio) {
      try { audio.currentTime = 0; } catch (e) {}
      const p = audio.play();
      if (p && p.catch) {
        p.catch(() => {
          // 재생 실패해도 진행
        });
      }
    }

    // 애니메이션 트리거
    intro.classList.add('hide');

    // 애니메이션(가장 긴 transition)에 맞춰 제거
    // 1200ms 여유를 둠
    setTimeout(endIntro, 1200);

    // 클릭 리스너 정리
    document.removeEventListener('click', onClickStart);
  }

  // 클릭 또는 터치 시작 이벤트로 트리거
  document.addEventListener('click', onClickStart, { once: true, passive: true });
  document.addEventListener('touchstart', onClickStart, { once: true, passive: true });
})();

// Door: 마지막 패널 클릭 시 전환 애니메이션 후 새 페이지로 이동
(function() {
  const door = document.getElementById('doorPanel');
  if (!door) return;
  // 1) 문 이미지 자동 탐지: 사용자가 교체한 파일명(door__ 또는 door___) 우선, 없으면 door.png
  (function setDoorBackground() {
    const candidates = [
      'images/door__.png',
      'images/door___.png',
      'images/door.png',
    ];
    function tryNext(index) {
      if (index >= candidates.length) return;
      const src = candidates[index];
      const img = new Image();
      img.onload = function() { door.style.backgroundImage = `url('${src}')`; };
      img.onerror = function() { tryNext(index + 1); };
      img.src = src;
    }
    tryNext(0);
  })();

  let navigating = false;
  door.addEventListener('click', () => {
    if (navigating) return;
    navigating = true;
    // 부드러운 2단계 확대 + 페이드 투 블랙
    door.classList.add('door-opening-start');
    const overlay = document.createElement('div');
    overlay.className = 'door-fade';
    document.body.appendChild(overlay);
    setTimeout(() => {
      door.classList.remove('door-opening-start');
      door.classList.add('door-opening');
      // 페이드 인 시작
      requestAnimationFrame(() => overlay.classList.add('show'));
    }, 160);
    // 전환 완료 후 페이지 이동
    setTimeout(() => {
      window.location.href = 'museum.html';
    }, 950);
  });
})();
