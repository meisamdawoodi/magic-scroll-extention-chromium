// content.js - این اسکریپت در تمام صفحات وب اجرا می شود.

// یک پرچم برای جلوگیری از بارگذاری مجدد اسکریپت در صورت تزریق چندگانه
if (window.__INTELLIGENT_SCROLL_LOADED__) {
    console.warn('Intelligent Scroll: Script already loaded. Skipping re-initialization.');
} else {
    window.__INTELLIGENT_SCROLL_LOADED__ = true; // علامت گذاری اسکریپت به عنوان بارگذاری شده

    let isDraggingPage = false; // وضعیت کشیدن صفحه (حالت دست)
    let isMouseDown = false; // وضعیت فشرده بودن دکمه ماوس
    let pressTimer; // تایمر برای تشخیص نگه داشتن کلیک
    let startX, startY; // مختصات شروع کشیدن
    let scrollLeft, scrollTop; // موقعیت اسکرول صفحه در زمان شروع کشیدن

    // تنظیمات پیش فرض اکستنشن
    let settings = {
        holdDuration: 250, // مدت زمان نگه داشتن کلیک برای فعال شدن اسکرول دست
        dragThreshold: 5,  // حداقل حرکت ماوس برای لغو تایمر نگه داشتن (برای انتخاب متن)
        minimapWidth: 40,  // عرض Minimap
        minimapOpacity: 0.03, // شفافیت پایه Minimap
        minimapHoverOpacity: 0.15, // شفافیت Minimap هنگام هاور
        thumbOpacity: 0.2, // شفافیت Thumb در Minimap
        thumbHoverOpacity: 0.5, // شفافیت Thumb هنگام هاور
        cursorEffectColor: '0,123,255', // رنگ افکت نشانگر (RGB)
        cursorEffectSize: 40, // اندازه افکت نشانگر
        scrollSpeed: 1.0, // سرعت اسکرول در حالت کشیدن
        minimapPosition: 'right', // موقعیت Minimap: 'right' یا 'left'
        enableDragScroll: true, // فعال/غیرفعال کردن اسکرول دست
        enableMinimap: true // فعال/غیرفعال کردن Minimap
    };

    let audioContext = null;
    let activationOscillator = null;
    let deactivationOscillator = null;

    // تابع برای راه اندازی Web Audio API برای صداها
    function initializeAudioContext() {
        if (audioContext === null) {
            try {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                console.log('Intelligent Scroll: AudioContext initialized.');
            } catch (e) {
                console.error('Intelligent Scroll: Web Audio API not supported or failed to initialize:', e);
                audioContext = null; // Reset to null if failed
            }
        }
    }

    // تابع برای ایجاد و پخش صدای فعال سازی
    function playActivationSound() {
        if (!audioContext) {
            initializeAudioContext();
            if (!audioContext) return; // If context still null, cannot play
        }

        try {
            if (activationOscillator) activationOscillator.stop(); // Stop any previous sound
            activationOscillator = audioContext.createOscillator();
            activationOscillator.type = 'sine'; // موج سینوسی برای صدای نرم تر
            activationOscillator.frequency.setValueAtTime(440, audioContext.currentTime); // C4
            
            const gainNode = audioContext.createGain();
            gainNode.gain.setValueAtTime(0.05, audioContext.currentTime); // صدای خیلی کم
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1); // محو شدن سریع

            activationOscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            activationOscillator.start();
            activationOscillator.stop(audioContext.currentTime + 0.1); // پخش کوتاه
        } catch (e) {
            console.error('Intelligent Scroll: Failed to play activation sound:', e);
        }
    }

    // تابع برای ایجاد و پخش صدای غیر فعال سازی
    function playDeactivationSound() {
        if (!audioContext) {
            initializeAudioContext();
            if (!audioContext) return; // If context still null, cannot play
        }

        try {
            if (deactivationOscillator) deactivationOscillator.stop(); // Stop any previous sound
            deactivationOscillator = audioContext.createOscillator();
            deactivationOscillator.type = 'sine';
            deactivationOscillator.frequency.setValueAtTime(330, audioContext.currentTime); // G3
            
            const gainNode = audioContext.createGain();
            gainNode.gain.setValueAtTime(0.05, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);

            deactivationOscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            deactivationOscillator.start();
            deactivationOscillator.stop(audioContext.currentTime + 0.1); // پخش کوتاه
        } catch (e) {
            console.error('Intelligent Scroll: Failed to play deactivation sound:', e);
        }
    }

    // === ایجاد عناصر UI در ابتدا ===
    // این عناصر باید در ابتدای اسکریپت ایجاد و به DOM اضافه شوند تا قبل از دسترسی به آن ها
    // توسط توابعی مانند applySettings() مطمئن باشیم که وجود دارند.

    const cursorEffect = document.createElement('div');
    cursorEffect.style.cssText = `
        position: fixed;
        border-radius: 50%;
        pointer-events: none;
        opacity: 0;
        transform: translate(-50%, -50%) scale(0);
        transition: opacity 0.2s ease-out, transform 0.2s ease-out;
        z-index: 9999;
    `;
    document.body.appendChild(cursorEffect);

    const minimapScrollbar = document.createElement('div');
    minimapScrollbar.id = 'minimapScrollbar';
    minimapScrollbar.style.cssText = `
        position: fixed;
        top: 50%;
        transform: translateY(-50%);
        height: 60vh;
        z-index: 9998;
        transition: background-color 0.2s ease-in-out;
        cursor: pointer;
        border-top-left-radius: 10px;
        border-bottom-left-radius: 10px;
        border-top-right-radius: 10px; /* برای تقارن در صورت قرارگیری در سمت چپ */
        border-bottom-right-radius: 10px; /* برای تقارن در صورت قرارگیری در سمت چپ */
    `;
    document.body.appendChild(minimapScrollbar);

    const minimapThumb = document.createElement('div');
    minimapThumb.id = 'minimapThumb';
    minimapThumb.style.cssText = `
        position: absolute;
        width: 100%;
        border-radius: 5px;
        left: 0;
        transition: background-color 0.2s ease-in-out;
    `;
    minimapScrollbar.appendChild(minimapThumb);

    // تابع برای بارگذاری تنظیمات از حافظه اکستنشن
    function loadSettings() {
        chrome.storage.local.get(settings, (items) => {
            Object.assign(settings, items); // اعمال تنظیمات ذخیره شده بر روی تنظیمات پیش فرض
            applySettings(); // اعمال تنظیمات روی عناصر UI
        });
    }

    // تابع برای اعمال تنظیمات به عناصر UI
    function applySettings() {
        // اعمال تنظیمات اسکرول با کشیدن
        if (!settings.enableDragScroll) {
            document.body.style.cursor = ''; // ریست نشانگر
            document.body.style.userSelect = ''; // فعال سازی مجدد انتخاب متن
            hideCursorEffect();
            isDraggingPage = false;
            isMouseDown = false;
            if (pressTimer) clearTimeout(pressTimer);
        }

        // اعمال تنظیمات Minimap
        if (settings.enableMinimap) {
            minimapScrollbar.style.display = 'block';
            minimapScrollbar.style.width = `${settings.minimapWidth}px`;
            minimapScrollbar.style.backgroundColor = `rgba(0, 0, 0, ${settings.minimapOpacity})`;

            // تنظیم موقعیت Minimap (راست یا چپ)
            if (settings.minimapPosition === 'right') {
                minimapScrollbar.style.right = '0';
                minimapScrollbar.style.left = 'auto';
                minimapScrollbar.style.borderTopLeftRadius = '10px';
                minimapScrollbar.style.borderBottomLeftRadius = '10px';
                minimapScrollbar.style.borderTopRightRadius = '0';
                minimapScrollbar.style.borderBottomRightRadius = '0';
            } else { // 'left'
                minimapScrollbar.style.left = '0';
                minimapScrollbar.style.right = 'auto';
                minimapScrollbar.style.borderTopRightRadius = '10px';
                minimapScrollbar.style.borderBottomRightRadius = '10px';
                minimapScrollbar.style.borderTopLeftRadius = '0';
                minimapScrollbar.style.borderBottomLeftRadius = '0';
            }
            
            minimapThumb.style.backgroundColor = `rgba(0, 0, 0, ${settings.thumbOpacity})`;
        } else {
            minimapScrollbar.style.display = 'none';
        }

        // اعمال تنظیمات افکت نشانگر
        cursorEffect.style.width = `${settings.cursorEffectSize}px`;
        cursorEffect.style.height = `${settings.cursorEffectSize}px`;
        cursorEffect.style.background = `radial-gradient(circle, rgba(${settings.cursorEffectColor},0.7) 0%, rgba(${settings.cursorEffectColor},0) 70%)`;

        updateMinimapThumb(); // اطمینان از به روز رسانی موقعیت Thumb
    }

    // گوش دادن به تغییرات تنظیمات از صفحه آپشن ها
    chrome.storage.local.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            for (let key in changes) {
                if (settings.hasOwnProperty(key)) {
                    settings[key] = changes[key].newValue;
                }
            }
            applySettings();
        }
    });

    // توابع مدیریت افکت نشانگر ماوس
    function showCursorEffect(x, y) {
        cursorEffect.style.left = `${x}px`;
        cursorEffect.style.top = `${y}px`;
        cursorEffect.style.opacity = '1';
        cursorEffect.style.transform = 'translate(-50%, -50%) scale(1)';
    }

    function hideCursorEffect() {
        cursorEffect.style.opacity = '0';
        cursorEffect.style.transform = 'translate(-50%, -50%) scale(0)';
    }

    // === منطق Minimap Scrollbar ===
    minimapScrollbar.addEventListener('mouseenter', () => {
        if (settings.enableMinimap) {
            minimapScrollbar.style.backgroundColor = `rgba(0, 0, 0, ${settings.minimapHoverOpacity})`;
            minimapThumb.style.backgroundColor = `rgba(0, 0, 0, ${settings.thumbHoverOpacity})`;
        }
    });

    minimapScrollbar.addEventListener('mouseleave', () => {
        if (settings.enableMinimap) {
            minimapScrollbar.style.backgroundColor = `rgba(0, 0, 0, ${settings.minimapOpacity})`;
            minimapThumb.style.backgroundColor = `rgba(0, 0, 0, ${settings.thumbOpacity})`;
        }
    });

    // تابع برای به روز رسانی موقعیت و اندازه Thumb در Minimap
    function updateMinimapThumb() {
        if (!settings.enableMinimap || !minimapScrollbar || !minimapThumb) {
            return;
        }

        const totalHeight = document.documentElement.scrollHeight || document.body.scrollHeight;
        const viewportHeight = window.innerHeight;
        const currentScroll = window.scrollY;

        if (totalHeight <= viewportHeight) {
            minimapScrollbar.style.display = 'none';
            return;
        } else {
            minimapScrollbar.style.display = 'block';
        }

        const thumbHeight = Math.max((viewportHeight / totalHeight) * minimapScrollbar.clientHeight, 20);
        minimapThumb.style.height = `${thumbHeight}px`;

        const thumbTop = (currentScroll / (totalHeight - viewportHeight)) * (minimapScrollbar.clientHeight - thumbHeight);
        minimapThumb.style.top = `${thumbTop}px`;
    }

    // گوش دادن به رویدادهای اسکرول و تغییر اندازه پنجره برای به روز رسانی Minimap
    window.addEventListener('scroll', updateMinimapThumb);
    window.addEventListener('resize', updateMinimapThumb);
    updateMinimapThumb(); // فراخوانی اولیه برای تنظیم Minimap

    let isDraggingMinimap = false;
    let minimapClickY;

    minimapScrollbar.addEventListener('mousedown', function(e) {
        if (e.button === 0 && settings.enableMinimap) {
            isDraggingMinimap = true;
            minimapClickY = e.clientY;
            e.preventDefault();
            document.body.style.userSelect = 'none';
            minimapScrollbar.style.cursor = 'grabbing';
            
            const minimapHeight = minimapScrollbar.clientHeight;
            const thumbHeight = minimapThumb.clientHeight;
            const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;

            if (e.target !== minimapThumb) {
                const clickRatio = (e.clientY - minimapScrollbar.getBoundingClientRect().top) / minimapHeight;
                const newScrollTop = clickRatio * scrollableHeight;
                window.scrollTo({ top: newScrollTop, behavior: 'auto' });
            }
        }
    });

    document.addEventListener('mousemove', function(e) {
        if (!isDraggingMinimap) return;

        const minimapHeight = minimapScrollbar.clientHeight;
        const thumbHeight = minimapThumb.clientHeight;
        const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;

        let newThumbTop = e.clientY - minimapScrollbar.getBoundingClientRect().top - minimapClickY;

        newThumbTop = Math.max(0, Math.min(newThumbTop, minimapHeight - thumbHeight));

        const scrollRatio = newThumbTop / (minimapHeight - thumbHeight);
        const newScrollY = scrollRatio * scrollableHeight;

        window.scrollTo({ top: newScrollY, behavior: 'auto' });
    });

    document.addEventListener('mouseup', function() {
        if (isDraggingMinimap) {
            isDraggingMinimap = false;
            document.body.style.userSelect = '';
            minimapScrollbar.style.cursor = 'pointer';
        }
    });

    // === منطق پیمایش صفحه با نگه داشتن و کشیدن (ابزار دست) ===
    document.addEventListener('mousedown', function(e) {
        if (e.button === 0 && !minimapScrollbar.contains(e.target) && settings.enableDragScroll) {
            isMouseDown = true;
            startX = e.clientX;
            startY = e.clientY;
            scrollLeft = window.scrollX;
            scrollTop = window.scrollY;

            pressTimer = setTimeout(() => {
                if (isMouseDown && !isDraggingMinimap) {
                    isDraggingPage = true;
                    document.body.style.cursor = 'grab';
                    document.body.style.userSelect = 'none';
                    showCursorEffect(e.clientX, e.clientY);
                    playActivationSound();
                }
            }, settings.holdDuration);
        }
    });

    document.addEventListener('mousemove', function(e) {
        if (isDraggingPage) {
            cursorEffect.style.left = `${e.clientX}px`;
            cursorEffect.style.top = `${e.clientY}px`;
        }

        if (!isDraggingPage && !isMouseDown) return;

        if (isMouseDown && !isDraggingPage) {
            if (Math.abs(e.clientX - startX) > settings.dragThreshold || Math.abs(e.clientY - startY) > settings.dragThreshold) {
                clearTimeout(pressTimer);
                isMouseDown = false;
                return;
            }
        }

        if (isDraggingPage) {
            e.preventDefault();
            const deltaX = (e.clientX - startX) * settings.scrollSpeed;
            const deltaY = (e.clientY - startY) * settings.scrollSpeed;

            window.scrollTo(scrollLeft - deltaX, scrollTop - deltaY);
        }
    });

    document.addEventListener('mouseup', function(e) {
        if (e.button === 0) {
            isMouseDown = false;
            clearTimeout(pressTimer);

            if (isDraggingPage) {
                isDraggingPage = false;
                document.body.style.cursor = 'default';
                document.body.style.userSelect = '';
                hideCursorEffect();
                playDeactivationSound();
            }
        }
    });

    window.addEventListener('blur', function() {
        if (isDraggingPage || isMouseDown) {
            clearTimeout(pressTimer);
            isDraggingPage = false;
            isMouseDown = false;
            document.body.style.cursor = 'default';
            document.body.style.userSelect = '';
            hideCursorEffect();
            playDeactivationSound();
        }
        if (isDraggingMinimap) {
            isDraggingMinimap = false;
            document.body.style.userSelect = '';
            minimapScrollbar.style.cursor = 'pointer';
        }
    });

    // === فراخوانی های اولیه ===
    loadSettings(); // بارگذاری و اعمال تنظیمات
    initializeAudioContext(); // راه اندازی AudioContext
}
