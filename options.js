// options.js - Logic for managing extension settings.

document.addEventListener('DOMContentLoaded', restoreOptions);

const elements = {
    enableDragScroll: document.getElementById('enableDragScroll'),
    holdDuration: document.getElementById('holdDuration'),
    holdDurationValue: document.getElementById('holdDurationValue'),
    scrollSpeed: document.getElementById('scrollSpeed'),
    scrollSpeedValue: document.getElementById('scrollSpeedValue'),
    linkOpenHoldDuration: document.getElementById('linkOpenHoldDuration'),
    linkOpenHoldDurationValue: document.getElementById('linkOpenHoldDurationValue'),
    enableMinimap: document.getElementById('enableMinimap'),
    minimapWidth: document.getElementById('minimapWidth'),
    minimapWidthValue: document.getElementById('minimapWidthValue'),
    minimapOpacity: document.getElementById('minimapOpacity'),
    minimapOpacityValue: document.getElementById('minimapOpacityValue'),
    minimapHoverOpacity: document.getElementById('minimapHoverOpacity'),
    minimapHoverOpacityValue: document.getElementById('minimapHoverOpacityValue'),
    thumbOpacity: document.getElementById('thumbOpacity'),
    thumbOpacityValue: document.getElementById('thumbOpacityValue'),
    thumbHoverOpacity: document.getElementById('thumbHoverOpacity'),
    thumbHoverOpacityValue: document.getElementById('thumbHoverOpacityValue'),
    cursorEffectSize: document.getElementById('cursorEffectSize'),
    cursorEffectSizeValue: document.getElementById('cursorEffectSizeValue'),
    cursorEffectColor: document.getElementById('cursorEffectColor'),
    colorPreview: document.getElementById('colorPreview'),
    minimapPosition: document.getElementById('minimapPosition')
};

function saveOptions() {
    const settings = {
        enableDragScroll: elements.enableDragScroll.checked,
        holdDuration: parseInt(elements.holdDuration.value),
        scrollSpeed: parseFloat(elements.scrollSpeed.value),
        linkOpenHoldDuration: parseInt(elements.linkOpenHoldDuration.value),
        enableMinimap: elements.enableMinimap.checked,
        minimapWidth: parseInt(elements.minimapWidth.value),
        minimapOpacity: parseFloat(elements.minimapOpacity.value),
        minimapHoverOpacity: parseFloat(elements.minimapHoverOpacity.value),
        thumbOpacity: parseFloat(elements.thumbOpacity.value),
        thumbHoverOpacity: parseFloat(elements.thumbHoverOpacity.value),
        cursorEffectSize: parseInt(elements.cursorEffectSize.value),
        cursorEffectColor: elements.cursorEffectColor.value,
        minimapPosition: elements.minimapPosition.value
    };
    chrome.storage.local.set(settings, () => {
        console.log('Settings saved.');
    });
}

function restoreOptions() {
    chrome.storage.local.get({
        enableDragScroll: true,
        holdDuration: 250,
        dragThreshold: 5, // Not exposed in options, but part of default
        scrollSpeed: 1.0,
        linkOpenHoldDuration: 2000,
        enableMinimap: true,
        minimapWidth: 40,
        minimapOpacity: 0.03,
        minimapHoverOpacity: 0.15,
        thumbOpacity: 0.2,
        thumbHoverOpacity: 0.5,
        cursorEffectColor: '0,123,255',
        cursorEffectSize: 40,
        minimapPosition: 'right'
    }, (items) => {
        elements.enableDragScroll.checked = items.enableDragScroll;
        elements.holdDuration.value = items.holdDuration;
        elements.holdDurationValue.textContent = items.holdDuration;
        elements.scrollSpeed.value = items.scrollSpeed;
        elements.scrollSpeedValue.textContent = items.scrollSpeed;
        elements.linkOpenHoldDuration.value = items.linkOpenHoldDuration;
        elements.linkOpenHoldDurationValue.textContent = items.linkOpenHoldDuration;
        elements.enableMinimap.checked = items.enableMinimap;
        elements.minimapWidth.value = items.minimapWidth;
        elements.minimapWidthValue.textContent = items.minimapWidth;
        elements.minimapOpacity.value = items.minimapOpacity;
        elements.minimapOpacityValue.textContent = items.minimapOpacity;
        elements.minimapHoverOpacity.value = items.minimapHoverOpacity;
        elements.minimapHoverOpacityValue.textContent = items.minimapHoverOpacity;
        elements.thumbOpacity.value = items.thumbOpacity;
        elements.thumbOpacityValue.textContent = items.thumbOpacity;
        elements.thumbHoverOpacity.value = items.thumbHoverOpacity;
        elements.thumbHoverOpacityValue.textContent = items.thumbHoverOpacity;
        elements.cursorEffectSize.value = items.cursorEffectSize;
        elements.cursorEffectSizeValue.textContent = items.cursorEffectSize;
        elements.cursorEffectColor.value = items.cursorEffectColor;
        elements.colorPreview.style.backgroundColor = `rgb(${items.cursorEffectColor})`;
        elements.minimapPosition.value = items.minimapPosition;
    });
}

// Add event listeners for all input changes
for (const key in elements) {
    if (elements[key] && typeof elements[key].addEventListener === 'function') {
        const inputElement = elements[key];
        const updateValueDisplay = (id) => {
            if (elements[id + 'Value']) {
                elements[id + 'Value'].textContent = inputElement.value;
            }
        };

        if (inputElement.type === 'checkbox' || inputElement.tagName === 'SELECT') {
            inputElement.addEventListener('change', saveOptions);
        } else {
            inputElement.addEventListener('input', () => {
                updateValueDisplay(inputElement.id);
                if (inputElement.id === 'cursorEffectColor') {
                    const rgb = inputElement.value;
                    const parts = rgb.split(',').map(Number);
                    if (parts.length === 3 && parts.every(p => p >= 0 && p <= 255)) {
                        elements.colorPreview.style.backgroundColor = `rgb(${rgb})`;
                    } else {
                        elements.colorPreview.style.backgroundColor = `transparent`;
                    }
                }
            });
            inputElement.addEventListener('change', saveOptions);
        }
    }
}

// Ensure color preview updates when page loads or color input is changed
elements.cursorEffectColor.addEventListener('input', () => {
    try {
        const rgb = elements.cursorEffectColor.value;
        const parts = rgb.split(',').map(Number);
        if (parts.length === 3 && parts.every(p => p >= 0 && p <= 255)) {
            elements.colorPreview.style.backgroundColor = `rgb(${rgb})`;
        } else {
            elements.colorPreview.style.backgroundColor = `transparent`; // Invalid color
        }
    } catch (e) {
        elements.colorPreview.style.backgroundColor = `transparent`;
    }
});
