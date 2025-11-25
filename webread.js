(function () {


	// ---- 语音 ----
	const synth = window.speechSynthesis;
	let voices = [];
	function loadVoices() {
		voices = synth.getVoices();
	}
	speechSynthesis.onvoiceschanged = loadVoices;
	loadVoices();
	function pickVoice() {
		return (
			voices.find((v) => /Xiaoni/i.test(v.name)) ||
			voices.find((v) => /Microsoft/i.test(v.name)) ||
			null
		);
	}

	// ---- 朗读浮窗 ----
		const CONTENT_MAX_HEIGHT = '50vh';
		const RATE_RANGE = { min: 0.6, max: 3.0, step: 0.1 };
		const RATE_STORAGE_KEY = 'mlacls_speech_rate';
		const DEFAULT_SPEECH_RATE = 1.1;
		let panel = null,
			textBox = null,
			toggleBtn = null,
			contentShell = null,
			scrollArea = null,
			stopBtn = null,
			titleLabel = null,
			bar = null,
			isCollapsed = false,
			rateInput = null,
			rateValue = null,
			rateRow = null,
			speechRate = DEFAULT_SPEECH_RATE;

		try {
			const storedRate = localStorage.getItem(RATE_STORAGE_KEY);
			if (storedRate) {
				const parsed = parseFloat(storedRate);
				if (!Number.isNaN(parsed)) {
					speechRate = Math.min(
						RATE_RANGE.max,
						Math.max(RATE_RANGE.min, parsed),
					);
				}
			}
		} catch (err) {
			// 忽略本地存储的读取错误
		}
	function ensurePanel() {
		if (panel) return;
		panel = document.createElement('div');
		Object.assign(panel.style, {
			position: 'fixed',
			right: '20px',
			bottom: '72px',
			maxWidth: '680px',
			maxHeight: '60vh',
			overflow: 'hidden',
			background: 'rgba(255,255,255,0.96)',
			backdropFilter: 'blur(6px)',
			border: '1px solid rgba(0,0,0,0.1)',
			borderRadius: '10px',
			padding: '10px 12px',
			boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
			zIndex: 99999,
			font: '19px/1.6 system-ui, sans-serif',
			transition: 'box-shadow .2s ease',
			color: '#1f1f1f',
		});
		panel.style.transformOrigin = 'bottom right';
		panel.style.willChange = 'transform, box-shadow';
		bar = document.createElement('div');
		bar.style.display = 'flex';
		bar.style.gap = '8px';
		bar.style.marginBottom = '6px';
		bar.style.alignItems = 'center';
		stopBtn = document.createElement('button');
		stopBtn.textContent = '■';
		Object.assign(stopBtn.style, { cursor: 'pointer', padding: '2px 8px', background: 'rgba(255,226,150,0.9)'});
		stopBtn.onclick = () => {
			synth.cancel();
		};
		titleLabel = document.createElement('div');
		titleLabel.textContent = 'Reading';
		Object.assign(titleLabel.style, {
			opacity: 0.7,
			fontSize: '18px',
			flex: '1',
		});
		toggleBtn = document.createElement('button');
		toggleBtn.textContent = '收起';
		toggleBtn.title = '收起朗读浮窗';
		toggleBtn.setAttribute('aria-expanded', 'true');
		Object.assign(toggleBtn.style, {
			cursor: 'pointer',
			padding: '2px 10px',
			borderRadius: '6px',
			border: 'none',
			background: 'rgba(0,0,0,0.04)',
			color: '#333',
			transition: 'background .2s ease',
		});
		toggleBtn.onmouseenter = () =>
			(toggleBtn.style.background = 'rgba(0,0,0,0.1)');
		toggleBtn.onmouseleave = () =>
			(toggleBtn.style.background = 'rgba(0,0,0,0.04)');
		toggleBtn.onclick = () => {
			isCollapsed ? expandPanel() : collapsePanel();
		};
		bar.appendChild(stopBtn);
		bar.appendChild(titleLabel);
		bar.appendChild(toggleBtn);
		textBox = document.createElement('div');
		textBox.style.wordWrap = 'break-word';
		textBox.style.color = '#1f1f1f';

		contentShell = document.createElement('div');
		Object.assign(contentShell.style, {
			overflow: 'hidden',
			maxHeight: CONTENT_MAX_HEIGHT,
			opacity: '1',
		});
		contentShell.style.transformOrigin = 'top center';
		contentShell.style.willChange = 'transform, opacity';
		scrollArea = document.createElement('div');
		Object.assign(scrollArea.style, {
			maxHeight: CONTENT_MAX_HEIGHT,
			overflowY: 'auto',
			paddingRight: '4px',
		});
		scrollArea.appendChild(textBox);

		rateRow = document.createElement('div');
		Object.assign(rateRow.style, {
			display: 'flex',
			alignItems: 'center',
			gap: '10px',
			marginBottom: '10px',
			fontSize: '14px',
			color: '#2c2c2c',
		});
		const rateLabel = document.createElement('span');
		rateLabel.textContent = '语速';
		rateInput = document.createElement('input');
		rateInput.type = 'range';
		rateInput.min = String(RATE_RANGE.min);
		rateInput.max = String(RATE_RANGE.max);
		rateInput.step = String(RATE_RANGE.step);
		rateInput.value = String(speechRate);
		Object.assign(rateInput.style, {
			flex: '1',
		});
		rateValue = document.createElement('span');
		rateValue.textContent = `${speechRate.toFixed(1)}x`;
		rateValue.style.minWidth = '36px';
		rateValue.style.textAlign = 'right';
		rateRow.appendChild(rateLabel);
		rateRow.appendChild(rateInput);
		rateRow.appendChild(rateValue);

		rateInput.addEventListener('input', (e) => {
			const next = parseFloat(e.target.value);
			if (Number.isNaN(next)) return;
			setSpeechRate(next);
		});
		setSpeechRate(speechRate);

		contentShell.appendChild(rateRow);
		contentShell.appendChild(scrollArea);

		panel.appendChild(bar);
		panel.appendChild(contentShell);
		document.body.appendChild(panel);
		applyExpandedStyles();
	}

	const reduceMotionQuery =
		typeof window !== 'undefined' && window.matchMedia
			? window.matchMedia('(prefers-reduced-motion: reduce)')
			: null;
	function prefersReducedMotion() {
		return !!(reduceMotionQuery && reduceMotionQuery.matches);
	}

	const SHELL_EXPAND_FRAMES = [
		{ transform: 'translateY(16px) scale(0.94)', opacity: 0.05 },
		{ transform: 'translateY(2px) scale(1)', opacity: 1, offset: 0.86 },
		{ transform: 'translateY(0) scale(1)', opacity: 1 },
	];
	const SHELL_COLLAPSE_FRAMES = [
		{ transform: 'translateY(0) scale(1)', opacity: 1 },
		{ transform: 'translateY(12px) scale(0.92)', opacity: 0 },
	];
	const PANEL_EXPAND_FRAMES = [
		{ transform: 'translateY(10px) scale(0.96)', opacity: 0.8 },
		{ transform: 'translateY(0) scale(1)', opacity: 1 },
	];
	const PANEL_COLLAPSE_FRAMES = [
		{ transform: 'translateY(0) scale(1)', opacity: 1 },
		{ transform: 'translateY(6px) scale(0.95)', opacity: 0.8 },
	];

	function playSpring(element, frames, options, onFinish) {
		if (!element) {
			if (onFinish) onFinish();
			return null;
		}
		if (element._activeSpring) {
			try {
				element._activeSpring.cancel();
			} catch (err) {
				/* 忽略取消异常 */
			}
		}
		if (prefersReducedMotion()) {
			if (onFinish) onFinish();
			return null;
		}
		const animation = element.animate(frames, {
			duration: 360,
			easing: 'cubic-bezier(0.2, 0, 0, 1)',
			fill: 'forwards',
			...(options || {}),
		});
		element._activeSpring = animation;
		let done = false;
		const cleanup = () => {
			if (element._activeSpring === animation) {
				element._activeSpring = null;
			}
			if (!done) {
				done = true;
				if (onFinish) onFinish();
			}
		};
		animation.onfinish = cleanup;
		animation.oncancel = cleanup;
		return animation;
	}

	function applyCollapsedStyles() {
		if (!panel || !bar || !toggleBtn) return;
		panel.style.padding = '6px 8px';
		panel.style.maxWidth = '50px';
		panel.style.width = 'auto';
		panel.style.borderRadius = '12px';
		bar.style.marginBottom = '0';
		bar.style.justifyContent = 'center';
		if (stopBtn) {
			stopBtn.style.display = 'none';
		}
		if (titleLabel) {
			titleLabel.style.display = 'none';
		}
		toggleBtn.style.flex = '0';
		toggleBtn.border = '0';
		toggleBtn.style.minWidth = '80px';
		toggleBtn.style.alignSelf = 'center';
	}

	function applyExpandedStyles() {
		if (!panel || !bar || !toggleBtn) return;
		panel.style.padding = '10px 12px';
		panel.style.maxWidth = '680px';
		panel.style.width = '';
		panel.style.borderRadius = '10px';
		bar.style.marginBottom = '6px';
		bar.style.justifyContent = 'flex-start';
		if (stopBtn) {
			stopBtn.style.display = '';
		}
		if (titleLabel) {
			titleLabel.style.display = '';
		}
		toggleBtn.style.minWidth = '';
		toggleBtn.style.flex = '';
		toggleBtn.style.alignSelf = '';
	}

	function collapsePanel() {
		if (!panel || !contentShell || isCollapsed) return;
		isCollapsed = true;
		if (scrollArea) scrollArea.style.overflowY = 'hidden';
		if (toggleBtn) {
			toggleBtn.textContent = '展开';
			toggleBtn.title = '展开朗读浮窗';
			toggleBtn.setAttribute('aria-expanded', 'false');
		}
		const finalize = () => {
			contentShell.style.maxHeight = '0';
			contentShell.style.opacity = '0';
			contentShell.style.transform = '';
			panel.style.transform = '';
			panel.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
			applyCollapsedStyles();
		};
		if (prefersReducedMotion()) {
			finalize();
			return;
		}
		playSpring(
			contentShell,
			SHELL_COLLAPSE_FRAMES,
			{ duration: 240, easing: 'cubic-bezier(0.4, 0, 1, 1)' },
			finalize,
		);
		playSpring(panel, PANEL_COLLAPSE_FRAMES, {
			duration: 220,
			easing: 'cubic-bezier(0.4, 0, 1, 1)',
		});
	}

	function expandPanel() {
		if (!panel || !contentShell) return;
		isCollapsed = false;
		applyExpandedStyles();
		contentShell.style.maxHeight = CONTENT_MAX_HEIGHT;
		contentShell.style.opacity = '1';
		contentShell.style.transform = '';
		if (scrollArea) scrollArea.style.overflowY = 'hidden';
		if (toggleBtn) {
			toggleBtn.textContent = '收起';
			toggleBtn.title = '收起朗读浮窗';
			toggleBtn.setAttribute('aria-expanded', 'true');
		}
		const finalize = () => {
			contentShell.style.maxHeight = CONTENT_MAX_HEIGHT;
			contentShell.style.opacity = '1';
			contentShell.style.transform = '';
			if (scrollArea) scrollArea.style.overflowY = 'auto';
			panel.style.transform = '';
			panel.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
		};
		if (prefersReducedMotion()) {
			finalize();
			return;
		}
		playSpring(
			contentShell,
			SHELL_EXPAND_FRAMES,
			{ duration: 420, easing: 'cubic-bezier(0, 0, 0.2, 1)' },
			finalize,
		);
		playSpring(panel, PANEL_EXPAND_FRAMES, {
			duration: 420,
			easing: 'cubic-bezier(0, 0, 0.2, 1)',
		});
	}

	// ---- 文本处理 ----
	function prepareTokens(str) {
		// 保留空白：用正则把“词或标点”与“空白”都作为token
		const tokens = [];
		const re = /[\p{L}\p{N}’'\-]+|[^\s\p{L}\p{N}]+|\s+/gu;
		let m;
		while ((m = re.exec(str))) {
			tokens.push(m[0]);
		}
		return tokens;
	}
	let currentTokens = [];
	let currentSpans = [];
	let currentStartToken = 0;
		function renderTokens(tokens) {
			ensurePanel();
			if (isCollapsed) expandPanel();
			if (textBox.replaceChildren) textBox.replaceChildren();
			else while (textBox.firstChild) textBox.removeChild(textBox.firstChild);
		// 渲染 span
		const spans = tokens.map((t, idx) => {
			const s = document.createElement('span');
			s.textContent = t;
			if (t.trim()) {
				s.style.cursor = 'pointer';
				s.title = '点击从此处继续朗读';
			}
			s.addEventListener('click', (ev) => {
				ev.stopPropagation();
				startSpeechFrom(idx);
			});
			textBox.appendChild(s);
			return s;
		});
		currentTokens = tokens;
		currentSpans = spans;
		return spans;
	}

	// ---- 根据 charIndex 找到 token ----
	function buildIndex(tokens) {
		const idx = [];
		let pos = 0;
		for (let i = 0; i < tokens.length; i++) {
			idx.push({ i, start: pos, end: pos + tokens[i].length });
			pos += tokens[i].length;
		}
		return idx;
	}
	function locateToken(index, idx) {
		// 二分可做，数据量小用线性即可
		for (const it of idx) {
			if (index >= it.start && index < it.end) return it.i;
		}
		return -1;
	}

	// ---- 高亮控制 ----
	let lastSpan = null;
	function highlightSpan(spans, i) {
		if (lastSpan) lastSpan.style.background = '';
		const s = spans[i];
		if (!s) return;
		s.style.background = 'rgba(255,226,150,0.9)';
		lastSpan = s;
		// 确保可见
		const container = scrollArea || panel;
		if (!container) return;
		const spanTop = s.offsetTop;
		const spanBottom = spanTop + s.offsetHeight;
		const viewTop = container.scrollTop;
		const viewBottom = viewTop + container.clientHeight;
		if (spanBottom > viewBottom) {
			container.scrollTop += spanBottom - viewBottom + 8;
		} else if (spanTop < viewTop) {
			container.scrollTop += spanTop - viewTop - 8;
		}
	}
	function clearHighlight() {
		if (lastSpan) lastSpan.style.background = '';
		lastSpan = null;
	}

	function startSpeechFrom(tokenIndex) {
		if (!currentTokens.length) return;
		const clampedIndex = Math.max(0, Math.min(tokenIndex, currentTokens.length - 1));
		const remainingTokens = currentTokens.slice(clampedIndex);
		const nextText = remainingTokens.join('');
		if (!nextText || !nextText.trim()) return;
		currentStartToken = clampedIndex;
		synth.cancel();
		clearHighlight();
		const indexMap = buildIndex(remainingTokens);
		const utter = new SpeechSynthesisUtterance(nextText);
		utter.pitch = 1;
		utter.rate = speechRate;
		const v = pickVoice();
		if (v) utter.voice = v;

		utter.onboundary = (e) => {
			const ci = typeof e.charIndex === 'number' ? e.charIndex : 0;
			const ti = locateToken(ci, indexMap);
			if (ti >= 0) highlightSpan(currentSpans, currentStartToken + ti);
		};
		utter.onend = () => {
			clearHighlight();
		};
		utter.onerror = () => {
			clearHighlight();
		};
		synth.speak(utter);
	}

	// ---- 朗读主流程 ----
	function speak(text) {
		if (!text || !text.trim()) return;
		const tokens = prepareTokens(text);
		renderTokens(tokens);
		startSpeechFrom(0);
	}

	// ---- 浮动按钮 ----
const BTN_MARGIN = 14;
const BTN_GAP = 12;
const DEFAULT_BTN_RIGHT = '20px';
const DEFAULT_BTN_BOTTOM = '20px';
const DEFAULT_POSITION = 'fixed';

	const btn = document.createElement('button');
btn.textContent = '🔊 Read';
btn.tabIndex = -1;
Object.assign(btn.style, {
	position: DEFAULT_POSITION,
	right: DEFAULT_BTN_RIGHT,
	bottom: DEFAULT_BTN_BOTTOM,
	zIndex: 99999,
	padding: '10px 14px',
	fontSize: '15px',
		fontWeight: 500,
		color: '#fff',
		background: 'linear-gradient(135deg,#4a90e2,#357ae8)',
		border: 'none',
		borderRadius: '8px',
		boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
		cursor: 'pointer',
		transition: 'transform .15s, box-shadow .15s',
	});
	// 避免点击按钮时抢走选区焦点
	const suppressFocus = (e) => e.preventDefault();
	btn.addEventListener('mousedown', suppressFocus);
	btn.addEventListener('mouseup', suppressFocus);
	btn.addEventListener('pointerdown', suppressFocus);
	btn.onmouseenter = () => {
		btn.style.transform = 'translateY(-2px)';
		btn.style.boxShadow = '0 6px 14px rgba(0,0,0,0.2)';
	};
	btn.onmouseleave = () => {
		btn.style.transform = 'translateY(0)';
		btn.style.boxShadow = '0 4px 10px rgba(0,0,0,0.15)';
	};
	btn.onclick = () => {
		const sel = getActiveSelectionText();
		if (sel) speak(sel);
		else alert('先选择文本');
	};

function resetBtnPosition() {
	btn.style.position = DEFAULT_POSITION;
	btn.style.left = '';
	btn.style.top = '';
	btn.style.right = DEFAULT_BTN_RIGHT;
	btn.style.bottom = DEFAULT_BTN_BOTTOM;
}

let lastSelectionRect = null;
function positionBtnNearRect(rect, sourceWindow = window) {
	if (!rect) {
		resetBtnPosition();
		return;
	}
	const normRect = normalizeRectToTopWindow(rect, sourceWindow);
	const scrollX =
		window.pageXOffset ||
		(document.documentElement && document.documentElement.scrollLeft) ||
		0;
	const scrollY =
		window.pageYOffset ||
		(document.documentElement && document.documentElement.scrollTop) ||
		0;
	const vw = (window.innerWidth || 0) + scrollX;
	const vh = (window.innerHeight || 0) + scrollY;
	const btnWidth = btn.offsetWidth || 120;
	const btnHeight = btn.offsetHeight || 44;

	let left = normRect.right + BTN_GAP + scrollX;
	let top = normRect.bottom + BTN_GAP + scrollY;

	// 如果右侧放不下，就放到选区左侧
	if (left + btnWidth + BTN_MARGIN > vw) {
		left = Math.max(BTN_MARGIN + scrollX, normRect.left + scrollX - btnWidth - BTN_GAP);
	}
	// 如果下方放不下，就放到选区上方
	if (top + btnHeight + BTN_MARGIN > vh) {
		top = Math.max(BTN_MARGIN + scrollY, normRect.top + scrollY - btnHeight - BTN_GAP);
	}

	left = Math.min(
		Math.max(left, BTN_MARGIN + scrollX),
		Math.max(BTN_MARGIN + scrollX, vw - btnWidth - BTN_MARGIN),
	);
	top = Math.min(
		Math.max(top, BTN_MARGIN + scrollY),
		Math.max(BTN_MARGIN + scrollY, vh - btnHeight - BTN_MARGIN),
	);

	if (!Number.isFinite(left) || !Number.isFinite(top)) {
		resetBtnPosition();
		return;
	}

	btn.style.position = 'absolute';
	btn.style.right = '';
	btn.style.bottom = '';
	btn.style.left = `${left}px`;
	btn.style.top = `${top}px`;
}

function updateFloatingBtnPosition(win = window) {
	if (!win || !btn) return;
	const rect = getSelectionRect(win);
	if (rect) {
		lastSelectionRect = rect;
		positionBtnNearRect(rect, win);
	} else if (lastSelectionRect) {
		positionBtnNearRect(lastSelectionRect, win);
	} else {
		resetBtnPosition();
	}
}
	document.body.appendChild(btn);

	function safeGetSelectionFromWindow(targetWindow) {
		if (!targetWindow || !targetWindow.getSelection) return '';
		try {
			return String(targetWindow.getSelection()).trim();
		} catch (err) {
			return '';
		}
	}

	let lastSelectionText = '';
	function cacheSelection(win) {
		const s = safeGetSelectionFromWindow(win);
		if (s) lastSelectionText = s;
	}

	function collectSelectionFromWindows(targetWindow, visited = new Set()) {
		if (!targetWindow || visited.has(targetWindow)) return '';
		visited.add(targetWindow);
		const direct = safeGetSelectionFromWindow(targetWindow);
		if (direct) {
			lastSelectionText = direct;
			return direct;
		}

		let frameCount = 0;
		try {
			frameCount = targetWindow.frames ? targetWindow.frames.length : 0;
		} catch (err) {
			frameCount = 0;
		}
		for (let i = 0; i < frameCount; i++) {
			let childWindow = null;
			try {
				childWindow = targetWindow.frames[i];
			} catch (err) {
				continue;
			}
			const childSelection = collectSelectionFromWindows(
				childWindow,
				visited,
			);
			if (childSelection) return childSelection;
		}

		let candidateFrames = null;
		try {
			const doc = targetWindow.document;
			if (doc && doc.querySelectorAll) {
				candidateFrames = doc.querySelectorAll('iframe, frame');
			}
		} catch (err) {
			return '';
		}
		if (!candidateFrames) return '';
		for (let i = 0; i < candidateFrames.length; i++) {
			const frame = candidateFrames[i];
			let childWindow = null;
			try {
				childWindow = frame.contentWindow;
			} catch (err) {
				continue;
			}
			const childSelection = collectSelectionFromWindows(
				childWindow,
				visited,
			);
			if (childSelection) return childSelection;
		}
		return '';
	}

	function getActiveSelectionText() {
		const live = collectSelectionFromWindows(window);
		if (live) return live;
		return lastSelectionText;
	}

	function getTrimmedSelection(targetWindow = window) {
		return safeGetSelectionFromWindow(targetWindow);
	}

	function getSelectionRect(targetWindow = window) {
		if (!targetWindow || !targetWindow.getSelection) return null;
		try {
			const doc = targetWindow.document;
			const sel = targetWindow.getSelection();
			if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
			const range = sel.getRangeAt(0);
			let rect = range.getBoundingClientRect();
			if ((!rect || !rect.width) && range.getClientRects) {
				const first = range.getClientRects()[0];
				if (first) rect = first;
			}
			// 文本框/输入框内的选区可能返回 0 尺寸，退化为控件的矩形
			if ((!rect || (!rect.width && !rect.height)) && doc && doc.activeElement) {
				const el = doc.activeElement;
				if (el.getBoundingClientRect) {
					const box = el.getBoundingClientRect();
					if (box && (box.width || box.height)) rect = box;
				}
			}
			if (!rect || (!rect.width && !rect.height)) return null;
			return rect;
		} catch (err) {
			return null;
		}
	}

	function normalizeRectToTopWindow(rect, sourceWindow = window) {
		if (!rect) return rect;
		let r = rect;
		let win = sourceWindow;
		while (win && win !== window) {
			const frameEl = win.frameElement;
			if (!frameEl || !frameEl.getBoundingClientRect) break;
			const frameRect = frameEl.getBoundingClientRect();
			r = {
				left: r.left + frameRect.left,
				right: r.right + frameRect.left,
				top: r.top + frameRect.top,
				bottom: r.bottom + frameRect.top,
				width: r.width,
				height: r.height,
			};
			const parentWin =
				frameEl.ownerDocument && frameEl.ownerDocument.defaultView
					? frameEl.ownerDocument.defaultView
					: null;
			if (!parentWin || parentWin === win) break;
			win = parentWin;
		}
		return r;
	}

	function extractFallbackText(target) {
		if (!target) return '';
		if (target.innerText) return target.innerText.trim();
		if (target.textContent) return target.textContent.trim();
		return '';
	}

	function extractSelectedText(target, sourceWindow = window) {
		const sel = getTrimmedSelection(sourceWindow);
		if (sel) return sel;
		try {
			const selection =
				sourceWindow && sourceWindow.getSelection
					? sourceWindow.getSelection()
					: null;
			if (selection && selection.rangeCount > 0) {
				const text = String(selection.getRangeAt(0)).trim();
				if (text) return text;
			}
		} catch (err) {
			/* 忽略跨域 iframe 的 selection 错误 */
		}
		return extractFallbackText(target);
	}
	let dblTimer = null;
	let suppressDblSpeak = false;
	let lastClickTime = 0;
	let clickCount = 0;

	function getEventWindow(evt) {
		if (evt && evt.view && evt.view.window) return evt.view.window;
		const doc =
			evt && evt.target && evt.target.ownerDocument
				? evt.target.ownerDocument
				: null;
		if (doc && doc.defaultView) return doc.defaultView;
		return window;
	}

	function handleDblClick(e) {
		if (dblTimer) clearTimeout(dblTimer);
		const target = e.target;
		const contextWindow = getEventWindow(e);
		dblTimer = setTimeout(() => {
			dblTimer = null;
			if (suppressDblSpeak) {
				suppressDblSpeak = false;
				return;
			}
			const text = extractSelectedText(target, contextWindow);
			if (text) speak(text);
		}, 160);
	}

	function handleClick(e) {
		const now = Date.now();
		if (now - lastClickTime < 400) clickCount += 1;
		else clickCount = 1;
		lastClickTime = now;
		if (clickCount === 3) {
			const text = extractSelectedText(e.target, getEventWindow(e));
			if (text) speak(text);
			if (dblTimer) {
				clearTimeout(dblTimer);
				dblTimer = null;
			}
			suppressDblSpeak = true;
			clickCount = 0;
		}
	}

	const registeredDocs = new WeakSet();
	const FRAME_SELECTOR = 'iframe, frame';
	const watchedRoots = new WeakSet();
	const registeredWindows = new WeakSet();

	function crawlFrameTree(targetWindow) {
		if (!targetWindow) return;
		let frameCount = 0;
		try {
			frameCount = targetWindow.frames ? targetWindow.frames.length : 0;
		} catch (err) {
			frameCount = 0;
		}
		for (let i = 0; i < frameCount; i++) {
			let childWindow = null;
			try {
				childWindow = targetWindow.frames[i];
			} catch (err) {
				continue;
			}
			if (!childWindow || registeredWindows.has(childWindow)) continue;
			registeredWindows.add(childWindow);
			try {
				if (childWindow.document) registerDocument(childWindow.document);
			} catch (err) {
				/* 忽略跨域文档 */
			}
			crawlFrameTree(childWindow);
		}
	}

	function hookFrame(frame) {
		if (!frame) return;
		const tryRegister = () => {
			try {
				const childDoc = frame.contentDocument;
				if (childDoc) registerDocument(childDoc);
			} catch (err) {
				/* 忽略跨域 iframe */
			}
		};
		tryRegister();
		frame.addEventListener('load', tryRegister);
	}

	function processAddedNode(node) {
		if (!node || node.nodeType !== 1) return;
		if (node.matches && node.matches(FRAME_SELECTOR)) {
			hookFrame(node);
		}
		if (node.querySelectorAll) {
			node.querySelectorAll(FRAME_SELECTOR).forEach(hookFrame);
			node.querySelectorAll('*').forEach((el) => {
				if (el.shadowRoot) {
					watchFramesInRoot(el.shadowRoot);
				}
			});
		}
		if (node.shadowRoot) watchFramesInRoot(node.shadowRoot);
	}

	function watchFramesInRoot(root) {
		if (!root || watchedRoots.has(root)) return;
		watchedRoots.add(root);
		try {
			if (root.querySelectorAll) {
				root.querySelectorAll(FRAME_SELECTOR).forEach(hookFrame);
				root.querySelectorAll('*').forEach((el) => {
					if (el.shadowRoot) {
						watchFramesInRoot(el.shadowRoot);
					}
				});
			}
		} catch (err) {
			/* 忽略 shadowRoot 扫描错误 */
		}
		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				mutation.addedNodes.forEach((node) => {
					processAddedNode(node);
				});
			}
		});
		try {
			observer.observe(root, { childList: true, subtree: true });
		} catch (err) {
			/* 忽略 observer 异常 */
		}
	}

	function registerDocument(doc) {
		if (!doc || registeredDocs.has(doc)) return;
		registeredDocs.add(doc);
		doc.addEventListener('dblclick', handleDblClick);
		doc.addEventListener('click', handleClick);
		let updateTimer = null;
		const scheduleUpdate = () => {
			if (updateTimer) cancelAnimationFrame(updateTimer);
			updateTimer = requestAnimationFrame(() => {
				updateTimer = null;
				const ctxWin = doc.defaultView || window;
				updateFloatingBtnPosition(ctxWin);
				// 轻微延迟再跑一次，确保拖拽/键盘选区稳定后位置正确
				setTimeout(() => updateFloatingBtnPosition(ctxWin), 80);
			});
		};
		doc.addEventListener('selectionchange', () => {
			try {
				cacheSelection(doc.defaultView || window);
				scheduleUpdate();
			} catch (err) {
				/* 忽略 selectionchange 读取错误 */
			}
		});
		// 鼠标松开或键盘调整光标后再更新位置，确保选区已定型
		const update = () => scheduleUpdate();
		doc.addEventListener('mouseup', update);
		doc.addEventListener('pointerup', update);
		doc.addEventListener('keyup', update);
	if (doc.defaultView && doc.defaultView.addEventListener) {
		doc.defaultView.addEventListener('scroll', update, { passive: true });
		doc.defaultView.addEventListener('resize', update, { passive: true });
	}
		watchFramesInRoot(doc);
	}

	const baseAttachShadow = Element.prototype.attachShadow;
	if (baseAttachShadow && !baseAttachShadow._mlaclsPatched) {
		const originalAttachShadow = baseAttachShadow;
		const patchedAttachShadow = function (...args) {
			const shadow = Reflect.apply(originalAttachShadow, this, args);
			try {
				if (shadow) watchFramesInRoot(shadow);
			} catch (err) {
				/* 忽略 attachShadow 监控错误 */
			}
			return shadow;
		};
		patchedAttachShadow._mlaclsPatched = true;
		Element.prototype.attachShadow = patchedAttachShadow;
	}

	registerDocument(document);
	try {
		registeredWindows.add(window);
		crawlFrameTree(window);
	} catch (err) {
		/* 忽略初始 frame 遍历错误 */
	}
	const FRAME_WALK_INTERVAL = 1500;
	setInterval(() => {
		try {
			crawlFrameTree(window);
		} catch (err) {
			/* 忽略定时器中的错误 */
		}
	}, FRAME_WALK_INTERVAL);

	function setSpeechRate(value) {
		const clamped = Math.min(RATE_RANGE.max, Math.max(RATE_RANGE.min, value));
		speechRate = clamped;
		if (rateValue) rateValue.textContent = `${clamped.toFixed(1)}x`;
		if (rateInput && rateInput.value !== String(clamped)) {
			rateInput.value = String(clamped);
		}
		try {
			localStorage.setItem(RATE_STORAGE_KEY, String(clamped));
		} catch (err) {
			// 忽略本地存储的写入错误
		}
	}
})();
