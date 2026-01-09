// == De-Tox Content Script ==
// Wird auf Webseiten ausgeführt und scannt nach Hassrede

console.log('🛡️ De-Tox Content Script geladen');

class DeToxPageAnalyzer {
    constructor() {
        this.backendUrl = 'http://localhost:5267'; // Dein Backend Port
        this.currentPlatform = this.detectPlatform();
        this.isEnabled = true;
        this.setupObservers();
        this.scanPage();
        
        // Kommunikation mit Popup
        this.setupMessageListener();
        
        console.log(`De-Tox aktiv für: ${this.currentPlatform}`);
    }
    
    detectPlatform() {
        const hostname = window.location.hostname;
        const path = window.location.pathname;
        
        if (hostname.includes('twitter.com') || hostname.includes('x.com')) return 'twitter';
        if (hostname.includes('youtube.com') && path.includes('/watch')) return 'youtube';
        if (hostname.includes('reddit.com') && (path.includes('/comments/') || path.includes('/r/'))) return 'reddit';
        if (hostname.includes('facebook.com') && path.includes('/posts/')) return 'facebook';
        if (hostname.includes('instagram.com')) return 'instagram';
        return 'generic';
    }
    
    setupObservers() {
        // Beobachte DOM-Änderungen für dynamische Inhalte
        const observer = new MutationObserver((mutations) => {
            if (!this.isEnabled) return;
            
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length > 0) {
                    this.scanNewNodes(mutation.addedNodes);
                }
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Auch für Attribute-Änderungen (z.B. bei Lazy Loading)
        const attrObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.target.textContent) {
                    this.checkElement(mutation.target);
                }
            });
        });
        
        attrObserver.observe(document.body, {
            attributes: true,
            attributeFilter: ['data-text', 'innerText', 'textContent'],
            subtree: true
        });
    }
    
    setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'toggle') {
                this.isEnabled = request.enabled;
                if (this.isEnabled) {
                    this.scanPage();
                } else {
                    this.removeAllHighlights();
                }
                sendResponse({ success: true });
            }
            return true;
        });
    }
    
    scanPage() {
        if (!this.isEnabled) return;
        
        console.log('De-Tox: Scanne Seite...');
        
        // Plattform-spezifische Elemente finden
        const elements = this.findCommentElements();
        
        elements.forEach(element => {
            this.checkElement(element);
        });
    }
    
    scanNewNodes(nodes) {
        nodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                // Direkt prüfen
                this.checkElement(node);
                
                // Und Kinder prüfen
                const childElements = node.querySelectorAll('*');
                childElements.forEach(child => this.checkElement(child));
            }
        });
    }
    
    findCommentElements() {
        // Plattform-spezifische Selektoren
        const platformSelectors = {
            twitter: [
                '[data-testid="tweet"] [data-testid="tweetText"]',
                '[data-testid="tweet"] [lang]',
                'article [data-testid="tweetText"]'
            ],
            youtube: [
                '#content-text',
                '#content',
                '#content-text span',
                'yt-formatted-string.content-text'
            ],
            reddit: [
                '[data-testid="comment"]',
                '.Comment',
                '.entry .usertext-body'
            ],
            facebook: [
                '[data-ad-preview="message"]',
                '.userContent',
                '[data-commentid]'
            ],
            generic: [
                'p',
                'div',
                'span',
                'article',
                '.comment',
                '.message',
                '.text'
            ]
        };
        
        const selectors = platformSelectors[this.currentPlatform] || platformSelectors.generic;
        let elements = [];
        
        selectors.forEach(selector => {
            try {
                const found = document.querySelectorAll(selector);
                found.forEach(el => {
                    if (!elements.includes(el)) {
                        elements.push(el);
                    }
                });
            } catch (e) {
                console.warn('De-Tox: Selector fehlerhaft:', selector, e);
            }
        });
        
        return elements.filter(el => {
            const text = this.getCleanText(el);
            return text.length >= 10 && text.length <= 1000;
        });
    }
    
    checkElement(element) {
        if (!this.isEnabled) return;
        if (element.classList.contains('detox-processed')) return;
        
        const text = this.getCleanText(element);
        if (!text) return;
        
        // Einfache Toxicity-Erkennung (kann später durch KI ersetzt werden)
        const isToxic = this.checkForToxicity(text);
        
        if (isToxic) {
            this.highlightToxicElement(element, text);
            element.classList.add('detox-processed');
        }
    }
    
    getCleanText(element) {
        // Holt Text und entfernt überflüssige Whitespaces
        let text = element.textContent || element.innerText || '';
        
        // Entferne überflüssige Leerzeichen
        text = text.replace(/\s+/g, ' ').trim();
        
        // Entferne URLs
        text = text.replace(/https?:\/\/[^\s]+/g, '');
        
        // Entferne @mentions und #hashtags für bessere Analyse
        text = text.replace(/[@#][^\s]+/g, '');
        
        return text.trim();
    }
    
    checkForToxicity(text) {
        // Einfache Heuristik - später durch KI ersetzen!
        const toxicPatterns = [
            /\b(dumm|blöd|idiot|depp|trottel|spasti)\b/i,
            /\b(schei[ßs]e|mist|verdammt|kacke)\b/i,
            /\b(arsch|hure|nutte|wichser|fotze)\b/i,
            /\b(nazi|hitler|juden|ausländer)\s+(freund|lieb|gut)/i,
            /\b(verpiss\s+dich|halt\s+die\s+fresse|fick\s+dich)\b/i,
            /\b(kill|töte|umbringen)\s+(dich|euch)\b/i,
            /^.{0,5}$/ // Zu kurze Nachrichten ignorieren
        ];
        
        const minLength = 10;
        const maxLength = 500;
        
        if (text.length < minLength || text.length > maxLength) {
            return false;
        }
        
        // Prüfe auf Toxische Muster
        for (const pattern of toxicPatterns) {
            if (pattern.test(text)) {
                console.log('De-Tox: Toxischer Text erkannt:', text.substring(0, 50) + '...');
                return true;
            }
        }
        
        // Prüfe auf CAPS LOCK (SCHREIEN)
        const capsRatio = (text.match(/[A-ZÄÖÜ]/g) || []).length / text.length;
        if (capsRatio > 0.7 && text.length > 20) {
            console.log('De-Tox: CAPS LOCK erkannt');
            return true;
        }
        
        return false;
    }
    
    highlightToxicElement(element, text) {
        // Visuelle Hervorhebung
        element.classList.add('detox-highlight');
        
        // "De-Tox" Button hinzufügen
        this.addDeToxButton(element, text);
    }
    
    addDeToxButton(element, text) {
        // Prüfen ob schon ein Button existiert
        if (element.querySelector('.detox-button')) return;
        
        // Finde den besten Platz für den Button
        const container = this.findButtonContainer(element);
        if (!container) return;
        
        // Button erstellen
        const button = document.createElement('button');
        button.className = 'detox-button';
        button.innerHTML = '<span class="detox-icon">🛡️</span> De-Tox';
        button.title = 'Hassrede entschärfen';
        
        // Klick-Event
        button.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            button.innerHTML = '<span class="detox-loading"></span> Verarbeite...';
            button.disabled = true;
            
            try {
                // Kontext sammeln
                const context = this.collectContext(element);
                
                // An Backend senden
                const result = await this.analyzeWithBackend(text, context);
                
                if (result && result.suggestion) {
                    this.showSuggestionPopup(element, text, result.suggestion, result);
                } else {
                    alert('De-Tox: Backend nicht erreichbar. Starte dein C# Backend!');
                }
            } catch (error) {
                console.error('De-Tox Fehler:', error);
                alert('Fehler bei der Verarbeitung. Überprüfe die Console.');
            } finally {
                button.innerHTML = '<span class="detox-icon">🛡️</span> De-Tox';
                button.disabled = false;
            }
        });
        
        // Button einfügen
        container.style.position = 'relative';
        container.appendChild(button);
    }
    
    findButtonContainer(element) {
        // Versuche verschiedene Container
        const containers = [
            element.parentElement,
            element.closest('div, p, article, section, li'),
            element
        ];
        
        for (const container of containers) {
            if (container && container.nodeType === Node.ELEMENT_NODE) {
                return container;
            }
        }
        
        return null;
    }
    
    collectContext(element) {
        const context = [];
        let current = element.previousElementSibling;
        
        // Sammle bis zu 3 vorherige Elemente
        for (let i = 0; i < 3 && current; i++) {
            const text = this.getCleanText(current);
            if (text.length >= 10) {
                context.unshift(text); // Älteste zuerst
            }
            current = current.previousElementSibling;
        }
        
        return context;
    }
    
    async analyzeWithBackend(text, context) {
        try {
            const response = await fetch(`${this.backendUrl}/api/analyze-context`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    LastMessage: text,
                    PreviousMessages: context
                })
            });
            
            if (!response.ok) {
                throw new Error(`Backend error: ${response.status}`);
            }
            
            return await response.json();
            
        } catch (error) {
            console.error('De-Tox Backend Error:', error);
            return null;
        }
    }
    
    showSuggestionPopup(element, originalText, suggestion, analysis) {
        // Entferne existierende Popups
        this.removeExistingPopups();
        
        // Popup erstellen
        const popup = document.createElement('div');
        popup.className = 'detox-tooltip';
        
        popup.innerHTML = `
            <div class="detox-tooltip-content">
                <div class="detox-tooltip-header">
                    <div class="detox-tooltip-icon">🛡️</div>
                    <div>
                        <strong>De-Tox Vorschlag</strong>
                        <div style="font-size: 12px; color: #666;">
                            Thema: ${analysis?.topic || 'Allgemein'} | 
                            Toxicity: ${analysis?.toxicityScore || '?'}/10
                        </div>
                    </div>
                </div>
                
                <div style="margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 4px;">
                    <div style="font-size: 12px; color: #999; margin-bottom: 4px;">Original:</div>
                    <div style="font-size: 13px; color: #666; font-style: italic;">
                        ${this.truncateText(originalText, 100)}
                    </div>
                </div>
                
                <div class="detox-tooltip-text">
                    ${this.escapeHtml(suggestion)}
                </div>
                
                <div class="detox-tooltip-buttons">
                    <button class="detox-replace-btn">Text ersetzen</button>
                    <button class="detox-copy-btn">Kopieren</button>
                    <button class="detox-close-btn">Schließen</button>
                </div>
            </div>
        `;
        
        // Positionierung
        const rect = element.getBoundingClientRect();
        popup.style.position = 'absolute';
        popup.style.top = `${rect.bottom + window.scrollY + 5}px`;
        popup.style.left = `${rect.left + window.scrollX}px`;
        
        document.body.appendChild(popup);
        
        // Event Listener
        const replaceBtn = popup.querySelector('.detox-replace-btn');
        const copyBtn = popup.querySelector('.detox-copy-btn');
        const closeBtn = popup.querySelector('.detox-close-btn');
        
        replaceBtn.addEventListener('click', () => {
            this.replaceText(element, suggestion);
            popup.remove();
        });
        
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(suggestion).then(() => {
                copyBtn.textContent = '✓ Kopiert!';
                setTimeout(() => {
                    copyBtn.textContent = 'Kopieren';
                }, 2000);
            });
        });
        
        closeBtn.addEventListener('click', () => {
            popup.remove();
        });
        
        // Klick außerhalb schließt
        setTimeout(() => {
            const closeOnOutsideClick = (e) => {
                if (!popup.contains(e.target)) {
                    popup.remove();
                    document.removeEventListener('click', closeOnOutsideClick);
                }
            };
            document.addEventListener('click', closeOnOutsideClick);
        }, 100);
    }
    
    replaceText(element, newText) {
        element.textContent = newText;
        element.classList.remove('detox-highlight');
        element.classList.add('detox-highlight-replaced');
        
        // Entferne den Button
        const button = element.querySelector('.detox-button');
        if (button) button.remove();
    }
    
    removeExistingPopups() {
        document.querySelectorAll('.detox-tooltip').forEach(popup => popup.remove());
    }
    
    removeAllHighlights() {
        document.querySelectorAll('.detox-highlight, .detox-highlight-replaced').forEach(el => {
            el.classList.remove('detox-highlight', 'detox-highlight-replaced');
        });
        
        document.querySelectorAll('.detox-button').forEach(button => button.remove());
        document.querySelectorAll('.detox-tooltip').forEach(popup => popup.remove());
    }
    
    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// == INITIALISIERUNG ==

// Warte bis DOM bereit
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.deTox = new DeToxPageAnalyzer();
    });
} else {
    window.deTox = new DeToxPageAnalyzer();
}

// Export für Debugging
console.log('De-Tox: Content Script initialisiert. Verwende window.deTox für Debugging.');