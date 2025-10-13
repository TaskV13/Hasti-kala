const apiKey = "";
const thesisApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
const ttsApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;

const MAX_RETRIES = 5;
const INITIAL_DELAY_MS = 1000;

/**
 * Executes a fetch request with exponential backoff for resilience.
 */
async function fetchWithRetry(url, options, retries = 0) {
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response;
    } catch (error) {
        if (retries < MAX_RETRIES) {
            const delay = INITIAL_DELAY_MS * (2 ** retries) + Math.random() * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithRetry(url, options, retries + 1);
        }
        console.error("Fetch failed after multiple retries:", error);
        throw error;
    }
}

// --- Investment Thesis Generation (Gemini API) ---

async function generateInvestmentThesis(amount) {
    const outputDiv = document.getElementById('thesisOutput');
    const button = document.getElementById('generateThesisBtn');
    const loading = document.getElementById('thesisLoading');
    
    if (amount < 1 || isNaN(amount)) {
        outputDiv.innerHTML = '<p class="text-red-600">Please enter a valid investment amount (₹1 Crore minimum).</p>';
        return;
    }

    button.disabled = true;
    loading.classList.remove('hidden');
    document.getElementById('thesisText').textContent = 'Generating...';
    outputDiv.innerHTML = '<p class="text-center text-gray-500">Synthesizing data points and social impact...</p>';

    const systemPrompt = `You are a world-class impact investor and financial analyst writing a thesis for Hasti Kala, an ethical marketplace connecting Indian artisans directly to consumers. The company is seeking an investment of ₹${amount} Crore. Based on the following facts, write a concise, compelling 3-sentence investment thesis.
    Facts:
    1. Market: Indian Handicrafts Market is massive and rapidly digitizing, valued at over ₹37,000 Crore and growing at 7%+ CAGR.
    2. Problem: Artisans are exploited by middlemen, receiving only 40-60% of the retail price.
    3. Solution: Hasti Kala takes a low 10-15% commission, ensuring 30% higher net income for artisans while making products cheaper for consumers.
    4. Breakeven: Requires ~3,334 orders/month.
    5. Mission: Preserving cultural heritage and lifting families out of poverty.`;

    const userQuery = `Write the investment thesis for a ₹${amount} Crore capital injection into Hasti Kala. Sentence 1: Focus on market size and disruption. Sentence 2: Focus on the immediate social impact and ROI. Sentence 3: State the final call to action.`;

    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
    };

    try {
        const response = await fetchWithRetry(thesisApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

        if (text) {
            outputDiv.innerHTML = `<p>${text}</p>`;
        } else {
            outputDiv.innerHTML = '<p class="text-red-600">Error: Could not generate thesis. Please try again.</p>';
        }
    } catch (error) {
        outputDiv.innerHTML = `<p class="text-red-600">API Error: Failed to connect to the server.</p>`;
        console.error("Gemini API call failed:", error);
    } finally {
        button.disabled = false;
        loading.classList.add('hidden');
        document.getElementById('thesisText').textContent = 'Generate Thesis ✨';
    }
}

// --- TTS Utility Functions ---

/**
 * Converts a base64 string to an ArrayBuffer.
 */
function base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

/**
 * Creates a WAV Blob from raw PCM data.
 */
function pcmToWav(pcmData, sampleRate) {
    const buffer = new ArrayBuffer(44 + pcmData.length * 2);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + pcmData.length * 2, true);
    writeString(view, 8, 'WAVE');

    // FMT sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // chunkSize
    view.setUint16(20, 1, true);  // wFormatTag (1 = PCM)
    view.setUint16(22, 1, true);  // nChannels
    view.setUint32(24, sampleRate, true); // nSamplesPerSec
    view.setUint32(28, sampleRate * 2, true); // nAvgBytePerSec
    view.setUint16(32, 2, true);  // nBlockAlign
    view.setUint16(34, 16, true); // wBitsPerSample

    // DATA sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, pcmData.length * 2, true);

    // Write the PCM samples
    let offset = 44;
    for (let i = 0; i < pcmData.length; i++, offset += 2) {
        view.setInt16(offset, pcmData[i], true);
    }

    return new Blob([view], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

// --- TTS Main Function (Gemini API) ---

async function generateTtsAudio(text) {
    const ttsButton = document.getElementById('ttsButton');
    const ttsLoading = document.getElementById('ttsLoading');
    const ttsTextSpan = document.getElementById('ttsText');
    const ttsAudioPlayer = document.getElementById('ttsAudioPlayer');

    ttsButton.disabled = true;
    ttsLoading.classList.remove('hidden');
    ttsTextSpan.textContent = 'Synthesizing Audio...';
    ttsAudioPlayer.classList.add('hidden');
    ttsAudioPlayer.pause();
    ttsAudioPlayer.removeAttribute('src');

    const systemPrompt = "Speak the user's input with a clear, warm, and authentic Indian English accent. The tone should convey genuine gratitude and resilience.";
    
    const payload = {
        contents: [{ parts: [{ text: text }] }],
        generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
                voiceConfig: {
                    // Achird voice is specified for a friendly, authentic sound
                    prebuiltVoiceConfig: { voiceName: "Achird" },
                    languageCode: "en-IN" 
                }
            }
        },
        model: "gemini-2.5-flash-preview-tts",
        systemInstruction: { parts: [{ text: systemPrompt }] }
    };

    try {
        const response = await fetchWithRetry(ttsApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        const part = result?.candidates?.[0]?.content?.parts?.[0];
        const audioData = part?.inlineData?.data;
        const mimeType = part?.inlineData?.mimeType;

        if (audioData && mimeType && mimeType.startsWith("audio/L16")) {
            const sampleRateMatch = mimeType.match(/rate=(\d+)/);
            const sampleRate = sampleRateMatch ? parseInt(sampleRateMatch[1], 10) : 24000;
            
            const pcmData = base64ToArrayBuffer(audioData);
            const pcm16 = new Int16Array(pcmData);
            const wavBlob = pcmToWav(pcm16, sampleRate);
            const audioUrl = URL.createObjectURL(wavBlob);
            
            ttsAudioPlayer.src = audioUrl;
            ttsAudioPlayer.classList.remove('hidden');
            ttsAudioPlayer.play();

        } else {
             ttsTextSpan.textContent = 'Audio Error: Invalid response.';
             console.error("TTS API returned invalid data structure or MIME type:", mimeType, result);
        }

    } catch (error) {
        ttsTextSpan.textContent = 'Audio Error: Failed to synthesize.';
        console.error("TTS API call failed:", error);
    } finally {
        ttsButton.disabled = false;
        ttsLoading.classList.add('hidden');
        if (ttsTextSpan.textContent === 'Synthesizing Audio...') {
            ttsTextSpan.textContent = 'Hear the Story ✨';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {

    // --- Chart.js Initialization ---
    
    // Market Growth Chart
    const marketGrowthData = {
        labels: ['2024', '2025', '2026', '2027', '2028', '2029', '2030', '2031', '2032', '2033'],
        datasets: [{
            label: 'Indian Handicrafts Market Size (in Crore ₹)',
            data: [37911, 40294, 42818, 45492, 48325, 51327, 54508, 57880, 61455, 68060],
            backgroundColor: 'rgba(216, 122, 96, 0.2)',
            borderColor: 'rgba(216, 122, 96, 1)',
            borderWidth: 2,
            borderRadius: 5,
            tension: 0.1
        }]
    };

    const marketGrowthCtx = document.getElementById('marketGrowthChart').getContext('2d');
    new Chart(marketGrowthCtx, {
        type: 'bar',
        data: marketGrowthData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: function(value, index, values) {
                            return '₹' + (value / 1000).toFixed(1) + 'k Cr';
                        }
                    }
                },
                 x: {
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                     callbacks: {
                        label: function(context) {
                            return `Market Size: ₹${context.parsed.y.toLocaleString('en-IN')} Crore`;
                        }
                    }
                }
            }
        }
    });

    // Pricing Model Chart
    const pricingModelData = {
        labels: ['Artisan Cost', 'Middleman Margin', 'Hasti Kala Fee', 'Logistics'],
        hastiKala: {
            data: [830, 0, 125, 166], // Total: 1121
            backgroundColor: ['#60A5FA', '#FECACA', '#D87A60', '#9CA3AF'],
            total: 1121
        },
        traditional: {
            data: [830, 830, 0, 166], // Total: 1826 (Middleman takes 50% of ₹1660 margin)
            backgroundColor: ['#60A5FA', '#EF4444', '#FECACA', '#9CA3AF'],
            total: 1826
        }
    };
    
    const pricingModelCtx = document.getElementById('pricingModelChart').getContext('2d');
    const pricingModelChart = new Chart(pricingModelCtx, {
        type: 'bar',
        data: {
            labels: pricingModelData.labels,
            datasets: [{
                label: 'Cost Breakdown',
                data: pricingModelData.hastiKala.data,
                backgroundColor: pricingModelData.hastiKala.backgroundColor,
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: true, grid: { display: false }, ticks: { display: false } },
                y: { stacked: true, grid: { display: false } }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ₹${context.parsed.x.toLocaleString('en-IN')}`;
                        }
                    }
                },
                title: {
                    display: true,
                    text: 'Final Price to Customer: ₹1,121',
                    position: 'top',
                    font: { size: 16 }
                }
            }
        }
    });

    // Pricing Model Toggle Logic
    const hastiKalaBtn = document.getElementById('hastiKalaBtn');
    const traditionalBtn = document.getElementById('traditionalBtn');

    hastiKalaBtn.addEventListener('click', () => {
        pricingModelChart.data.datasets[0].data = pricingModelData.hastiKala.data;
        pricingModelChart.data.datasets[0].backgroundColor = pricingModelData.hastiKala.backgroundColor;
        pricingModelChart.options.plugins.title.text = `Final Price to Customer: ₹${pricingModelData.hastiKala.total.toLocaleString('en-IN')}`;
        hastiKalaBtn.classList.add('bg-primary', 'text-white');
        traditionalBtn.classList.remove('bg-primary', 'text-white');
        traditionalBtn.classList.add('bg-white', 'text-gray-900');
        pricingModelChart.update();
    });

    traditionalBtn.addEventListener('click', () => {
        pricingModelChart.data.datasets[0].data = pricingModelData.traditional.data;
        pricingModelChart.data.datasets[0].backgroundColor = pricingModelData.traditional.backgroundColor;
        pricingModelChart.options.plugins.title.text = `Final Price to Customer: ₹${pricingModelData.traditional.total.toLocaleString('en-IN')}`;
        traditionalBtn.classList.add('bg-primary', 'text-white');
        hastiKalaBtn.classList.remove('bg-primary', 'text-white');
        hastiKalaBtn.classList.add('bg-white', 'text-gray-900');
        pricingModelChart.update();
    });
    
    // Problem Card Interaction
    const problemCards = document.querySelectorAll('.problem-card');
    problemCards.forEach(card => {
        card.addEventListener('click', () => {
            card.classList.toggle('open');
        });
    });
    
    // Tabbed Interface Logic
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            const tabId = button.getAttribute('data-tab');
            tabPanes.forEach(pane => {
                if (pane.id === tabId) {
                    pane.classList.remove('hidden');
                } else {
                    pane.classList.add('hidden');
                }
            });
        });
    });

    // Sticky Navigation / Scroll Spy Logic
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('section[id]');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href').substring(1) === entry.target.id) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }, { rootMargin: '-30% 0px -70% 0px' });

    sections.forEach(section => {
        observer.observe(section);
    });
    
    // --- LLM Feature Listeners ---

    // TTS Event Listener
    const ttsButton = document.getElementById('ttsButton');
    const ttsStoryText = `"Before Hasti Kala, I barely made enough to send my children to school. Now, I feel respected, and my craft is valued by the world. It means dignity, not just income." - Anjali, Weaver`;
    if (ttsButton) {
        ttsButton.disabled = false; // Enable button once logic is attached
        ttsButton.addEventListener('click', () => {
            generateTtsAudio(ttsStoryText);
        });
    }

    // Investment Thesis Event Listener
    const generateThesisBtn = document.getElementById('generateThesisBtn');
    const investmentAmountInput = document.getElementById('investmentAmount');
    if (generateThesisBtn) {
        generateThesisBtn.addEventListener('click', () => {
            const amount = parseFloat(investmentAmountInput.value);
            generateInvestmentThesis(amount);
        });
    }
});
