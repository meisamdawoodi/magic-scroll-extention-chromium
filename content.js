// content.js - This script executes on all web pages.

// Flag to prevent re-initialization if the script is injected multiple times.
if (window.__INTELLIGENT_SCROLL_LOADED__) {
    console.warn('Intelligent Scroll: Script already loaded. Skipping re-initialization.');
} else {
    window.__INTELLIGENT_SCROLL_LOADED__ = true; // Mark script as loaded.

    // State variables for drag scrolling.
    let isDraggingPage = false;
    let isMouseDown = false;
    let pressTimer;
    let startX, startY;
    let scrollLeft, scrollTop;
    let currentScrollableElement = null; // Stores the specific element being scrolled.

    // Hardcoded settings (previously from options page).
    const settings = {
        holdDuration: 250,          // Time (ms) to hold left-click for drag scroll activation.
        dragThreshold: 5,           // Min mouse movement (pixels) to cancel hold timer.
        minimapWidth: 40,           // Width of the Minimap scrollbar.
        minimapOpacity: 0.03,       // Base transparency of Minimap.
        minimapHoverOpacity: 0.15,  // Transparency of Minimap on hover.
        thumbOpacity: 0.2,          // Transparency of the Minimap thumb.
        thumbHoverOpacity: 0.5,     // Transparency of the Minimap thumb on hover.
        cursorEffectColor: '0,123,255', // RGB color for the cursor effect.
        cursorEffectSize: 40,       // Size of the cursor effect.
        scrollSpeed: 1.0,           // Scrolling speed multiplier for drag scroll.
        minimapPosition: 'right',   // Position of Minimap: 'right' or 'left'.
        enableDragScroll: true,     // Enable/disable drag scroll.
        enableMinimap: true,        // Enable/disable Minimap.
        linkOpenHoldDuration: 2000  // Time (ms) to hold left-click on a link to open in new tab.
    };

    let audioContext = null;
    let activationOscillator = null;
    let deactivationOscillator = null;

    // Initializes Web Audio API for sound effects.
    function initializeAudioContext() {
        if (audioContext === null) {
            try {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.error('Intelligent Scroll: Web Audio API not supported or failed to initialize:', e);
                audioContext = null;
            }
        }
    }

    // Plays a subtle sound on drag scroll activation.
    function playActivationSound() {
        if (!audioContext) {
            initializeAudioContext();
            if (!audioContext) return;
        }

        try {
            if (activationOscillator) activationOscillator.stop();
            activationOscillator = audioContext.createOscillator();
            activationOscillator.type = 'sine';
            activationOscillator.frequency.setValueAtTime(440, audioContext.currentTime);
            
            const gainNode = audioContext.createGain();
            gainNode.gain.setValueAtTime(0.05, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);

            activationOscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            activationOscillator.start();
            activationOscillator.stop(audioContext.currentTime + 0.1);
        } catch (e) {
            console.error('Intelligent Scroll: Failed to play activation sound:', e);
        }
    }

    // Plays a subtle sound on drag scroll deactivation.
    function playDeactivationSound() {
        if (!audioContext) {
            initializeAudioContext();
            if (!audioContext) return;
        }

        try {
            if (deactivationOscillator) deactivationOscillator.stop();
            deactivationOscillator = audioContext.createOscillator();
            deactivationOscillator.type = 'sine';
            deactivationOscillator.frequency.setValueAtTime(330, audioContext.currentTime);
            
            const gainNode = audioContext.createGain();
            gainNode.gain.setValueAtTime(0.05, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);

            deactivationOscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            deactivationOscillator.start();
            deactivationOscillator.stop(audioContext.currentTime + 0.1);
        } catch (e) {
            console.error('Intelligent Scroll: Failed to play deactivation sound:', e);
        }
    }

    // === UI Elements Creation ===
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
        border-top-right-radius: 10px;
        border-bottom-right-radius: 10px;
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

    // Initial setup for UI elements based on hardcoded settings.
    function initializeUI() {
        if (!settings.enableDragScroll) {
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            hideCursorEffect();
            isDraggingPage = false;
            isMouseDown = false;
            if (pressTimer) clearTimeout(pressTimer);
        }

        if (settings.enableMinimap) {
            minimapScrollbar.style.display = 'block';
            minimapScrollbar.style.width = `${settings.minimapWidth}px`;
            minimapScrollbar.style.backgroundColor = `rgba(0, 0, 0, ${settings.minimapOpacity})`;

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

        cursorEffect.style.width = `${settings.cursorEffectSize}px`;
        cursorEffect.style.height = `${settings.cursorEffectSize}px`;
        cursorEffect.style.background = `radial-gradient(circle, rgba(${settings.cursorEffectColor},0.7) 0%, rgba(${settings.cursorEffectColor},0) 70%)`;

        updateMinimapThumb();
    }

    // Functions to manage cursor effect visibility.
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

    // === Minimap Scrollbar Logic ===
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

    // Updates the position and size of the Minimap thumb.
    function updateMinimapThumb() {
        if (!settings.enableMinimap || !minimapScrollbar || !minimapThumb) {
            return;
        }

        // Determine the actual scrollable content height.
        // For standard pages, this is document.documentElement.scrollHeight.
        // For specific scrollable divs, this would be their scrollHeight.
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

    // Event listeners for scroll and resize to update Minimap.
    window.addEventListener('scroll', updateMinimapThumb);
    window.addEventListener('resize', updateMinimapThumb);
    updateMinimapThumb(); // Initial call to set up Minimap.

    let isDraggingMinimap = false;
    let minimapThumbOffsetFromMouse = 0; // Offset of mouse click from top of the thumb.

    minimapScrollbar.addEventListener('mousedown', function(e) {
        if (e.button === 0 && settings.enableMinimap) { // Left click
            e.preventDefault(); // Prevent text selection.
            document.body.style.userSelect = 'none';
            minimapScrollbar.style.cursor = 'grabbing';
            isDraggingMinimap = true;

            const minimapRect = minimapScrollbar.getBoundingClientRect();
            const thumbRect = minimapThumb.getBoundingClientRect();
            
            if (e.target === minimapThumb) {
                // If clicked directly on the thumb, calculate offset.
                minimapThumbOffsetFromMouse = e.clientY - thumbRect.top;
            } else {
                // If clicked on the scrollbar (not thumb), jump thumb to click position.
                let newThumbTop = e.clientY - minimapRect.top - (thumbRect.height / 2); // Center thumb on click.
                
                // Clamp newThumbTop to minimap bounds.
                newThumbTop = Math.max(0, Math.min(newThumbTop, minimapRect.height - thumbRect.height));
                
                const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
                const scrollRatio = newThumbTop / (minimapRect.height - thumbRect.height);
                window.scrollTo({ top: scrollRatio * scrollableHeight, behavior: 'auto' });
                
                // Recalculate offset after the jump to ensure smooth dragging from new position.
                minimapThumbOffsetFromMouse = e.clientY - minimapThumb.getBoundingClientRect().top;
            }
        }
    });

    document.addEventListener('mousemove', function(e) {
        if (!isDraggingMinimap) return;

        const minimapRect = minimapScrollbar.getBoundingClientRect();
        const thumbRect = minimapThumb.getBoundingClientRect();
        const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;

        // Calculate new thumb top based on mouse movement relative to its initial click point.
        let newThumbTop = (e.clientY - minimapRect.top) - minimapThumbOffsetFromMouse;

        // Clamp newThumbTop to minimap bounds.
        newThumbTop = Math.max(0, Math.min(newThumbTop, minimapRect.height - thumbRect.height));

        const scrollRatio = newThumbTop / (minimapRect.height - thumbRect.height);
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

    // Helper to find the actual scrollable container.
    function findScrollableContainer(element) {
        let current = element;
        while (current && current !== document.body && current !== document.documentElement) {
            const style = window.getComputedStyle(current);
            // Check for vertical scrollability.
            if ((style.overflowY === 'scroll' || style.overflowY === 'auto' || style.overflow === 'scroll' || style.overflow === 'auto') && current.scrollHeight > current.clientHeight) {
                return current;
            }
            current = current.parentNode;
        }
        return document.documentElement; // Default to documentElement (window scroll)
    }

    // === Drag Scroll (Hand Tool) Logic ===
    let linkClickTimer = null; // Timer for holding click on a link
    let linkTarget = null;     // Element that was clicked on

    document.addEventListener('mousedown', function(e) {
        if (e.button === 0) { // Left click
            // Check if click is on a link or child of a link
            const targetLink = e.target.closest('a');
            if (targetLink) {
                linkTarget = targetLink;
                // Store initial mouse position for link hold duration check
                startX = e.clientX;
                startY = e.clientY;
                // Start timer for opening link in new tab
                linkClickTimer = setTimeout(() => {
                    // Check if mouse hasn't moved significantly
                    if (Math.abs(e.clientX - startX) < settings.dragThreshold && Math.abs(e.clientY - startY) < settings.dragThreshold) {
                         // Open link in new tab
                        window.open(linkTarget.href, '_blank');
                    }
                    linkClickTimer = null; // Reset timer
                }, settings.linkOpenHoldDuration);
            }

            // Start drag scroll logic if not on minimap/thumb and drag scroll is enabled
            if (!minimapScrollbar.contains(e.target) && settings.enableDragScroll) {
                isMouseDown = true;
                startX = e.clientX;
                startY = e.clientY;
                currentScrollableElement = findScrollableContainer(e.target); // Find the specific scrollable element
                
                // Store initial scroll positions of the identified scrollable element.
                scrollLeft = currentScrollableElement.scrollLeft || window.scrollX;
                scrollTop = currentScrollableElement.scrollTop || window.scrollY;

                pressTimer = setTimeout(() => {
                    if (isMouseDown && !isDraggingMinimap && !linkClickTimer) { // Ensure not dragging minimap or holding link
                        isDraggingPage = true;
                        document.body.style.cursor = 'grab';
                        document.body.style.userSelect = 'none';
                        showCursorEffect(e.clientX, e.clientY);
                        playActivationSound(); // Play sound on activation
                    }
                }, settings.holdDuration);
            }
        }
    });

    document.addEventListener('mousemove', function(e) {
        if (isDraggingPage) {
            cursorEffect.style.left = `${e.clientX}px`;
            cursorEffect.style.top = `${e.clientY}px`;
        }

        if (linkClickTimer) {
            // If mouse moves too much, cancel link hold timer
            if (Math.abs(e.clientX - startX) > settings.dragThreshold || Math.abs(e.clientY - startY) > settings.dragThreshold) {
                clearTimeout(linkClickTimer);
                linkClickTimer = null;
            }
        }

        if (!isDraggingPage && !isMouseDown) return; // Not dragging page and mouse not down.

        if (isMouseDown && !isDraggingPage) { // Mouse is down, but drag scroll not activated yet.
            if (Math.abs(e.clientX - startX) > settings.dragThreshold || Math.abs(e.clientY - startY) > settings.dragThreshold) {
                clearTimeout(pressTimer); // Cancel timer if mouse moves significantly.
                isMouseDown = false; // Reset mouse down state.
                return;
            }
        }

        if (isDraggingPage) {
            e.preventDefault(); // Prevent default browser actions (e.g., text selection).
            const deltaX = (e.clientX - startX) * settings.scrollSpeed;
            const deltaY = (e.clientY - startY) * settings.scrollSpeed;

            // Apply scroll to the identified scrollable element.
            if (currentScrollableElement === document.documentElement) {
                window.scrollTo(scrollLeft - deltaX, scrollTop - deltaY);
            } else {
                currentScrollableElement.scrollLeft = scrollLeft - deltaX;
                currentScrollableElement.scrollTop = scrollTop - deltaY;
            }
        }
    });

    document.addEventListener('mouseup', function(e) {
        if (e.button === 0) { // Left click released.
            isMouseDown = false;
            if (pressTimer) clearTimeout(pressTimer); // Clear any pending timer.
            if (linkClickTimer) clearTimeout(linkClickTimer); // Clear link hold timer on mouse up.

            if (isDraggingPage) {
                isDraggingPage = false;
                document.body.style.cursor = 'default';
                document.body.style.userSelect = ''; // Re-enable text selection.
                hideCursorEffect();
                playDeactivationSound(); // Play sound on deactivation.
            }
            linkTarget = null; // Reset link target.
        }
    });

    window.addEventListener('blur', function() {
        // Reset states if window loses focus (e.g., Alt+Tab).
        if (isDraggingPage || isMouseDown) {
            if (pressTimer) clearTimeout(pressTimer);
            if (linkClickTimer) clearTimeout(linkClickTimer); // Clear link hold timer on blur.
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

    // === Initial Calls ===
    initializeUI();
    initializeAudioContext();
}
