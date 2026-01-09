document.addEventListener('DOMContentLoaded', function() {
    // === TAB LOGIC ===
    const tabSingle = document.getElementById('tabSingle');
    const tabContext = document.getElementById('tabContext');
    const singleTab = document.getElementById('singleTab');
    const contextTab = document.getElementById('contextTab');
    
    tabSingle.addEventListener('click', () => {
        tabSingle.classList.add('active');
        tabContext.classList.remove('active');
        singleTab.style.display = 'block';
        contextTab.style.display = 'none';
    });
    
    tabContext.addEventListener('click', () => {
        tabContext.classList.add('active');
        tabSingle.classList.remove('active');
        contextTab.style.display = 'block';
        singleTab.style.display = 'none';
    });
    
    // === SINGLE TEXT DETOX ===
    const detoxifyBtn = document.getElementById('detoxify');
    const copyBtn = document.getElementById('copyBtn');
    const inputText = document.getElementById('inputText');
    const resultDiv = document.getElementById('result');
    const outputText = document.getElementById('outputText');
    const scoreSpan = document.getElementById('score');
    const contextSpan = document.getElementById('context');
    const rulesSpan = document.getElementById('rules');
    const rulesContainer = document.getElementById('rulesContainer');

    // Beispieltext für Tab 1
    inputText.value = "Du bist ein totaler Idiot! Was für eine dumme Idee.";

    detoxifyBtn.addEventListener('click', async () => {
        await detoxifySingleText();
    });

    async function detoxifySingleText() {
        const text = inputText.value.trim();
        
        if (!text) {
            alert('Bitte Text eingeben!');
            return;
        }

        try {
            detoxifyBtn.textContent = '⏳ Verarbeite...';
            detoxifyBtn.disabled = true;

            const response = await fetch('http://localhost:5267/api/detoxify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ Text: text })
            });

            if (!response.ok) {
                throw new Error(`Backend Fehler: ${response.status}`);
            }

            const result = await response.json();
            
            outputText.textContent = result.detoxified;
            scoreSpan.textContent = result.toxicityScore;
            contextSpan.textContent = result.context;
            
            if (result.toxicityScore > 0) {
                scoreSpan.className = 'toxicity-badge';
            }
            
            if (result.appliedRules && result.appliedRules.length > 0) {
                rulesSpan.innerHTML = result.appliedRules
                    .map(rule => `<span class="rule-tag">${rule}</span>`)
                    .join('');
                rulesContainer.style.display = 'block';
            } else {
                rulesContainer.style.display = 'none';
            }
            
            resultDiv.style.display = 'block';
            
        } catch (error) {
            console.error('Fehler:', error);
            alert('Fehler: ' + error.message + 
                  '\n\n1. Backend läuft? (Visual Studio F5 gedrückt?)' +
                  '\n2. Port korrekt? Aktuell: http://localhost:5267');
        } finally {
            detoxifyBtn.textContent = '🚀 Text neutralisieren';
            detoxifyBtn.disabled = false;
        }
    }

    // Kopier-Button Tab 1
    copyBtn.addEventListener('click', () => {
        const textToCopy = outputText.textContent;
        navigator.clipboard.writeText(textToCopy).then(() => {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = '✅ Kopiert!';
            setTimeout(() => {
                copyBtn.textContent = originalText;
            }, 2000);
        });
    });

    // === CONTEXT ANALYSIS ===
    const analyzeContextBtn = document.getElementById('analyzeContext');
    const previousMessagesInput = document.getElementById('previousMessages');
    const toxicMessageInput = document.getElementById('toxicMessage');
    const contextResultDiv = document.getElementById('contextResult');
    const detectedTopicSpan = document.getElementById('detectedTopic');
    const contextToxicitySpan = document.getElementById('contextToxicity');
    const messageCountSpan = document.getElementById('messageCount');
    const contextSuggestionP = document.getElementById('contextSuggestion');
    const copyContextBtn = document.getElementById('copyContextBtn');

    // Beispiel für Tab 2
    previousMessagesInput.value = "Wir sollten mehr in Schulen investieren, um die Kinder besser zu integrieren\nWir sollten mal das Geld besser für unsere eigenen Kinder nutzen";
    toxicMessageInput.value = "Drecksnazi!";

    analyzeContextBtn.addEventListener('click', async () => {
        const previousMessages = previousMessagesInput.value
            .split('\n')
            .filter(msg => msg.trim() !== '');
        const toxicMessage = toxicMessageInput.value.trim();
        
        if (previousMessages.length === 0 || !toxicMessage) {
            alert('Bitte vorherige Nachrichten UND eine toxische Nachricht eingeben!');
            return;
        }

        try {
            analyzeContextBtn.textContent = '🔍 Analysiere...';
            analyzeContextBtn.disabled = true;

            const requestBody = {
                LastMessage: toxicMessage,
                PreviousMessages: previousMessages
            };

            const response = await fetch('http://localhost:5267/api/analyze-context', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error(`Backend Fehler: ${response.status}`);
            }

            const result = await response.json();
            
            // Ergebnisse anzeigen
            detectedTopicSpan.textContent = result.topic;
            contextToxicitySpan.textContent = result.toxicityScore;
            messageCountSpan.textContent = result.messageCount;
            contextSuggestionP.textContent = result.suggestion;
            
            // Toxicity farblich markieren
            if (result.toxicityScore > 0) {
                contextToxicitySpan.style.color = '#ff6b6b';
                contextToxicitySpan.style.fontWeight = 'bold';
            }
            
            contextResultDiv.style.display = 'block';
            
        } catch (error) {
            console.error('Fehler:', error);
            alert('Fehler bei Kontext-Analyse: ' + error.message);
        } finally {
            analyzeContextBtn.textContent = '🔍 Kontext analysieren';
            analyzeContextBtn.disabled = false;
        }
    });

    // Kopier-Button Tab 2
    copyContextBtn.addEventListener('click', () => {
        const textToCopy = contextSuggestionP.textContent;
        navigator.clipboard.writeText(textToCopy).then(() => {
            const originalText = copyContextBtn.textContent;
            copyContextBtn.textContent = '✅ Kopiert!';
            setTimeout(() => {
                copyContextBtn.textContent = originalText;
            }, 2000);
        });
    });

    // Enter-Taste für Texteingaben
    inputText.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            detoxifySingleText();
        }
    });
    
    toxicMessageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            analyzeContextBtn.click();
        }
    });
});