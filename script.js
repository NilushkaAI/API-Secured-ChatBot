document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const chatBox = document.getElementById('chatBox');
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');
    const voiceModeButton = document.getElementById('voiceModeButton');
    const transcribeVoiceButton = document.getElementById('transcribeVoiceButton');
    const documentUploadInput = document.getElementById('documentUpload');
    const uploadStatus = document.getElementById('uploadStatus');
    const voiceStatus = document.getElementById('voiceStatus');
    const messageBox = document.getElementById('messageBox');
    const themeToggleButton = document.getElementById('themeToggleButton');
    const languageSelect = document.getElementById('languageSelect');
    const newChatButton = document.getElementById('newChatButton');
    const assistantVoiceSelect = document.getElementById('assistantVoiceSelect');
    const uploadedFilesPreview = document.getElementById('uploadedFilesPreview');

    // --- Gemini API Configuration ---
    // The API key is now securely handled on the backend.
    const API_URL = `/api/generateContent`; // Updated to a relative URL for the backend proxy

    let currentChatHistory = [];
    let voiceModeRecognition;
    let transcribeRecognition;
    let isVoiceModeListening = false;
    let isTranscribeListening = false;
    let uploadedFileContent = null; // Stores combined text content
    let uploadedFilesMetadata = []; // Stores {name, iconClass, content} for display and eventual sending
    let currentChatSessionId = null;

    // --- Language to BCP-47 Tag Mapping for Speech Recognition & Synthesis ---
    const languageMap = {
        'English': { speechRecognition: 'en-US', speechSynthesis: 'en-US' },
        'Sinhala': { speechRecognition: 'si-LK', speechSynthesis: 'si-LK' },
        'Tamil': { speechRecognition: 'ta-LK', speechSynthesis: 'ta-LK' }
    };

    // --- File Icon Mapping ---
    const fileIconMap = {
        'pdf': 'fa-file-pdf',
        'doc': 'fa-file-word',
        'docx': 'fa-file-word',
        'xls': 'fa-file-excel',
        'xlsx': 'fa-file-excel',
        'ppt': 'fa-file-powerpoint',
        'pptx': 'fa-file-powerpoint',
        'txt': 'fa-file-alt',
        'csv': 'fa-file-csv',
        'json': 'fa-file-code',
        'xml': 'fa-file-code',
        'html': 'fa-file-code',
        'css': 'fa-file-code',
        'js': 'fa-file-code',
        'py': 'fa-file-code',
        'c': 'fa-file-code',
        'cpp': 'fa-file-code',
        'java': 'fa-file-code',
        'jpg': 'fa-file-image',
        'jpeg': 'fa-file-image',
        'png': 'fa-file-image',
        'gif': 'fa-file-image',
        'zip': 'fa-file-archive',
        'rar': 'fa-file-archive',
        '7z': 'fa-file-archive',
        'mp3': 'fa-file-audio',
        'wav': 'fa-file-audio',
        'mp4': 'fa-file-video',
        'mov': 'fa-file-video',
        // Default fallback
        'default': 'fa-file'
    };

    function getFileIconClass(fileName) {
        const ext = fileName.split('.').pop().toLowerCase();
        return fileIconMap[ext] || fileIconMap['default'];
    }

    // --- Initial Setup ---
    initializeChatSession();

    // --- Theme Toggle ---
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        themeToggleButton.querySelector('i').classList.replace('fa-moon', 'fa-sun');
    } else {
        themeToggleButton.querySelector('i').classList.replace('fa-sun', 'fa-moon');
    }

    themeToggleButton.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const icon = themeToggleButton.querySelector('i');
        if (document.body.classList.contains('dark-mode')) {
            localStorage.setItem('theme', 'dark');
            icon.classList.replace('fa-moon', 'fa-sun');
        } else {
            localStorage.setItem('theme', 'light');
            icon.classList.replace('fa-sun', 'fa-moon');
        }
    });

    // --- Message Display Utility ---
    function appendMessage(text, sender, files = []) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', `${sender}-message`);

        // Add file icons if present
        if (files.length > 0 && sender === 'user') { // Only show uploaded files in user's message
            const filesHtml = files.map(file => `
                <div class="message-file-tag">
                    <i class="fas ${file.iconClass} file-icon"></i>
                    <span class="file-name">${file.name}</span>
                </div>
            `).join('');
            const filesContainer = document.createElement('div');
            filesContainer.classList.add('message-files-container');
            filesContainer.innerHTML = filesHtml;
            messageElement.appendChild(filesContainer);
        }

        const textParagraph = document.createElement('p');
        // IMPORTANT CHANGE: Parse Markdown for bot messages
        if (sender === 'bot') {
            textParagraph.innerHTML = marked.parse(text); // Use marked.parse for bot responses
        } else {
            textParagraph.textContent = text; // For user messages, just use textContent
        }
        
        messageElement.appendChild(textParagraph);

        chatBox.appendChild(messageElement);
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function displayStatusMessage(message, type = 'info') {
        messageBox.textContent = message;
        messageBox.className = `message-box ${type}`;
        messageBox.style.display = 'block';
        setTimeout(() => {
            messageBox.style.display = 'none';
            messageBox.textContent = '';
            messageBox.className = 'message-box';
        }, 3000);
    }

    // --- Chat Session Management ---
    function generateUniqueId() {
        return 'chat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    }

    function initializeChatSession() {
        chatBox.innerHTML = ''; // Always clear chat display on initialization

        // Explicitly clear all chat history from localStorage
        localStorage.removeItem('chatSessions');
        currentChatSessionId = generateUniqueId();
        currentChatHistory = [];
        uploadedFilesMetadata = []; // Clear any pending uploaded files
        uploadedFileContent = null;
        uploadedFilesPreview.innerHTML = ''; // Clear preview area
        uploadedFilesPreview.classList.remove('has-files'); // Remove border class
        uploadStatus.style.display = 'none'; // Hide upload status

        displayStatusMessage('Starting new chat.', 'info');

        setTimeout(() => {
            appendMessage("Hello, I am UD Ai Assistant.<br>ආයුබෝවන් ! How can I help you today?", 'bot');
            speakResponse("Hello, I am UD Ai Assistant. How can I help you today?");
        }, 500);
    }

    newChatButton.addEventListener('click', () => {
        if (confirm('Are you sure you want to start a new chat? All previous chat history will be cleared.')) {
            initializeChatSession();
            displayStatusMessage('New chat started. All previous history cleared.', 'info');
        }
    });


    // --- Speech Synthesis (Text-to-Speech) ---
    let speechSynth = window.speechSynthesis;
    let voices = [];

    speechSynth.onvoiceschanged = () => {
        voices = speechSynth.getVoices();
        populateVoiceSelection();
        console.log("Available voices:", voices);
    };

    function populateVoiceSelection() {
        assistantVoiceSelect.innerHTML = `
            <option value="default">Default Voice</option>
            <option value="male">Male Voice</option>
            <option value="female">Female Voice</option>
        `;
        const currentLangTag = languageMap[languageSelect.value]?.speechSynthesis || 'en-US';

        if (!currentLangTag.startsWith('en')) {
            voices.filter(voice => voice.lang === currentLangTag || voice.lang.startsWith(currentLangTag.split('-')[0]))
                  .forEach(voice => {
                    const option = document.createElement('option');
                    option.value = voice.name;
                    option.textContent = `${voice.name} (${voice.lang})`;
                    assistantVoiceSelect.appendChild(option);
                });
        }

        const savedVoice = localStorage.getItem('selectedAssistantVoice');
        if (savedVoice && Array.from(assistantVoiceSelect.options).some(opt => opt.value === savedVoice)) {
            assistantVoiceSelect.value = savedVoice;
        } else if (assistantVoiceSelect.options.length > 0) {
            assistantVoiceSelect.value = 'default';
        }
    }

    assistantVoiceSelect.addEventListener('change', () => {
        localStorage.setItem('selectedAssistantVoice', assistantVoiceSelect.value);
        displayStatusMessage(`Assistant voice set to: ${assistantVoiceSelect.value}`, 'info');
    });

    languageSelect.addEventListener('change', () => {
        populateVoiceSelection();
        stopAllVoiceRecognition();
        displayStatusMessage(`Language set to: ${languageSelect.value}`, 'info');
    });

    function speakResponse(text) {
        if (!speechSynth) {
            displayStatusMessage('Text-to-speech not supported by your browser.', 'error');
            return;
        }
        if (speechSynth.speaking) {
            speechSynth.cancel();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        const selectedLanguage = languageSelect.value;
        const targetLangTag = languageMap[selectedLanguage]?.speechSynthesis || 'en-US';
        const selectedVoicePreference = assistantVoiceSelect.value;

        let selectedVoice = null;

        if (selectedVoicePreference !== 'default') {
            if (selectedVoicePreference === 'male') {
                selectedVoice = voices.find(voice =>
                    (voice.lang === targetLangTag || voice.lang.startsWith(targetLangTag.split('-')[0])) &&
                    (voice.name.toLowerCase().includes('male') || voice.name.toLowerCase().includes('david') || voice.name.toLowerCase().includes('thomas') || voice.name.toLowerCase().includes('peter') || voice.name.toLowerCase().includes('jonas') || voice.name.toLowerCase().includes('us english male') || voice.name.toLowerCase().includes('en-us') || voice.name.toLowerCase().includes('google'))
                );
            } else if (selectedVoicePreference === 'female') {
                selectedVoice = voices.find(voice =>
                    (voice.lang === targetLangTag || voice.lang.startsWith(targetLangTag.split('-')[0])) &&
                    (voice.name.toLowerCase().includes('female') || voice.name.toLowerCase().includes('zira') || voice.name.toLowerCase().includes('sara') || voice.name.toLowerCase().includes('jenna') || voice.name.toLowerCase().includes('eva') || voice.name.toLowerCase().includes('us english female') || voice.name.toLowerCase().includes('en-us') || voice.name.toLowerCase().includes('google'))
                );
            } else {
                selectedVoice = voices.find(voice => voice.name === selectedVoicePreference);
            }
        }

        if (!selectedVoice) {
            selectedVoice = voices.find(voice => voice.lang === targetLangTag && voice.name.includes('Google'));
        }
        if (!selectedVoice) {
            selectedVoice = voices.find(voice => voice.lang === targetLangTag);
        }
        if (!selectedVoice) {
            selectedVoice = voices.find(voice => voice.lang.startsWith(targetLangTag.split('-')[0]));
        }

        if (selectedVoice) {
            utterance.voice = selectedVoice;
            console.log("Using voice:", selectedVoice.name, selectedVoice.lang);
        } else {
            console.warn(`No suitable voice found for language ${selectedLanguage} and preference ${selectedVoicePreference}. Using browser default.`);
            displayStatusMessage(`No specific voice found for ${selectedLanguage}. Using default browser voice.`, 'info');
        }

        utterance.lang = targetLangTag;
        speechSynth.speak(utterance);
    }

    // --- Chat Logic (Send Message) ---
    async function sendMessage(userMessage, fileContent = null, language = 'English') {
        const userDisplayMessage = userMessage;

        let promptForAPI = userMessage;
        let filesForDisplay = []; // To store file metadata for displaying in chat bubble

        if (fileContent) {
            promptForAPI = `Here is some document content: "${fileContent}".\n\nBased on this and my request, please respond in ${language}: ${userMessage}`;
            filesForDisplay = [...uploadedFilesMetadata]; // Copy for this message bubble
            uploadedFileContent = null; // Clear content after use
            uploadedFilesMetadata = []; // Clear metadata after use
            documentUploadInput.value = ''; // Clear file input element
            uploadedFilesPreview.innerHTML = ''; // Clear preview area
            uploadedFilesPreview.classList.remove('has-files'); // Remove border class
            uploadStatus.style.display = 'none';
        } else {
            promptForAPI = `Please respond in ${language}: ${userMessage}`;
        }

        // Pass filesForDisplay to appendMessage for the user's bubble
        appendMessage(userDisplayMessage, 'user', filesForDisplay);
        userInput.value = '';

        const loadingIndicator = document.createElement('div');
        loadingIndicator.classList.add('message', 'bot-message', 'loading-indicator-wrapper');
        loadingIndicator.innerHTML = `
            <div class="loading-indicator">
                <span></span><span></span><span></span>
            </div>
        `;
        chatBox.appendChild(loadingIndicator);
        chatBox.scrollTop = chatBox.scrollHeight;

        try {
            currentChatHistory.push({ role: "user", parts: [{ text: userDisplayMessage }] });

            const apiCallContents = [...currentChatHistory];
            apiCallContents[apiCallContents.length - 1] = { role: "user", parts: [{ text: promptForAPI }] };

            const payload = {
                contents: apiCallContents,
            };

            // Call the backend API proxy instead of the Gemini API directly
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('API Error:', errorData);
                throw new Error(`API returned ${response.status}: ${errorData.error?.message || response.statusText}`);
            }

            const result = await response.json();
            console.log('Gemini API Response:', result);

            let botResponseText = 'No response from bot.';
            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                botResponseText = result.candidates[0].content.parts[0].text;
            } else {
                botResponseText = 'I apologize, I could not generate a response. Please try again.';
            }

            chatBox.removeChild(loadingIndicator);

            appendMessage(botResponseText, 'bot');
            speakResponse(botResponseText);
            currentChatHistory.push({ role: "model", parts: [{ text: botResponseText }] });

        } catch (error) {
            console.error('Failed to send message:', error);
            if (chatBox.contains(loadingIndicator)) {
                chatBox.removeChild(loadingIndicator);
            }
            const errorMessage = `Error: ${error.message}. Please check your API key or network connection.`;
            appendMessage(errorMessage, 'bot');
            displayStatusMessage(errorMessage, 'error');
            speakResponse("I'm sorry, I encountered an error. Please try again.");
        } finally {
            adjustTextareaHeight();
        }
    }

    // --- Input Area Functionality ---
    function adjustTextareaHeight() {
        userInput.style.height = 'auto';
        userInput.style.height = (userInput.scrollHeight) + 'px';
    }
    userInput.addEventListener('input', adjustTextareaHeight);

    sendButton.addEventListener('click', () => {
        stopAllVoiceRecognition();

        const message = userInput.value.trim();
        const selectedLanguage = languageSelect.value;
        if (message || uploadedFileContent) {
            sendMessage(message, uploadedFileContent, selectedLanguage);
        } else {
            displayStatusMessage('Please type a message or upload a document.', 'info');
        }
    });

    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendButton.click();
        }
    });

    // --- Centralized Voice Recognition Stop Function ---
    function stopAllVoiceRecognition() {
        if (isVoiceModeListening) {
            voiceModeRecognition.stop();
            isVoiceModeListening = false;
            voiceModeButton.classList.remove('listening');
            voiceModeButton.querySelector('i').classList.replace('fa-stop-circle', 'fa-headset');
        }
        if (isTranscribeListening) {
            transcribeRecognition.stop();
            isTranscribeListening = false;
            transcribeVoiceButton.classList.remove('listening');
            transcribeVoiceButton.querySelector('i').classList.replace('fa-stop-circle', 'fa-microphone');
        }
        voiceStatus.classList.remove('active');
        voiceStatus.textContent = '';
        if (speechSynth.speaking) {
            speechSynth.cancel();
        }
    }


    // --- Voice Command Functionality (Web Speech API) ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
        // --- Voice Mode Recognition (Speak & Get Voice Response) ---
        voiceModeRecognition = new SpeechRecognition();
        voiceModeRecognition.continuous = true;
        voiceModeRecognition.interimResults = true;
        voiceModeRecognition.lang = languageMap[languageSelect.value]?.speechRecognition || 'en-US';

        voiceModeRecognition.onstart = () => {
            isVoiceModeListening = true;
            voiceModeButton.classList.add('listening');
            voiceModeButton.querySelector('i').classList.replace('fa-headset', 'fa-stop-circle');
            voiceStatus.textContent = 'Voice Mode: Listening... Speak now.';
            voiceStatus.classList.add('active');
            displayStatusMessage('Voice Mode activated. Will send automatically.', 'info');
            userInput.value = '';
        };

        voiceModeRecognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            userInput.value = finalTranscript + interimTranscript;
            adjustTextareaHeight();

            if (finalTranscript) {
                const tempIsListening = isVoiceModeListening;
                isVoiceModeListening = false;
                voiceModeRecognition.stop();

                setTimeout(() => {
                    sendButton.click();
                    if (tempIsListening) {
                        setTimeout(() => {
                            if (!isVoiceModeListening) {
                                voiceModeRecognition.start();
                                isVoiceModeListening = true;
                                voiceModeButton.classList.add('listening');
                                voiceModeButton.querySelector('i').classList.replace('fa-headset', 'fa-stop-circle');
                            }
                        }, 500);
                    }
                }, 50);
            }
        };

        voiceModeRecognition.onerror = (event) => {
            console.error('Voice Mode recognition error:', event.error);
            voiceStatus.textContent = `Voice Mode Error: ${event.error}`;
            voiceStatus.classList.add('error');
            displayStatusMessage(`Voice Mode error: ${event.error}`, 'error');
            isVoiceModeListening = false;
            voiceModeButton.classList.remove('listening');
            voiceModeButton.querySelector('i').classList.replace('fa-stop-circle', 'fa-headset');
            if (event.error !== 'not-allowed' && event.error !== 'permission-denied') {
                if (voiceModeButton.classList.contains('listening')) {
                    voiceModeRecognition.start();
                }
            }
        };

        voiceModeRecognition.onend = () => {
            if (isVoiceModeListening && voiceModeButton.classList.contains('listening')) {
                voiceModeRecognition.start();
            } else {
                voiceModeButton.classList.remove('listening');
                voiceModeButton.querySelector('i').classList.replace('fa-stop-circle', 'fa-headset');
                voiceStatus.classList.remove('active');
                voiceStatus.textContent = '';
                displayStatusMessage('Voice Mode ended.', 'info');
            }
        };

        voiceModeButton.addEventListener('click', () => {
            if (isVoiceModeListening) {
                voiceModeRecognition.stop();
                isVoiceModeListening = false;
                voiceModeButton.classList.remove('listening');
                voiceModeButton.querySelector('i').classList.replace('fa-stop-circle', 'fa-headset');
                displayStatusMessage('Voice Mode stopped by user.', 'info');
            } else {
                stopAllVoiceRecognition();
                voiceModeRecognition.lang = languageMap[languageSelect.value]?.speechRecognition || 'en-US';
                voiceModeRecognition.start();
            }
        });

        // --- Transcribe Voice Recognition (Type to Chatbox) ---
        transcribeRecognition = new SpeechRecognition();
        transcribeRecognition.continuous = true;
        transcribeRecognition.interimResults = true;
        transcribeRecognition.lang = languageMap[languageSelect.value]?.speechRecognition || 'en-US';

        let fullTranscribedText = '';

        transcribeRecognition.onstart = () => {
            isTranscribeListening = true;
            transcribeVoiceButton.classList.add('listening');
            transcribeVoiceButton.querySelector('i').classList.replace('fa-microphone', 'fa-stop-circle');
            voiceStatus.textContent = 'Transcribe Mode: Listening... Speak now.';
            voiceStatus.classList.add('active');
            displayStatusMessage('Transcribe Mode activated. Speak continuously, click to stop.', 'info');
            fullTranscribedText = userInput.value;
        };

        transcribeRecognition.onresult = (event) => {
            let interimTranscript = '';
            let currentFinalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    currentFinalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            fullTranscribedText += currentFinalTranscript;
            userInput.value = fullTranscribedText + interimTranscript;
            adjustTextareaHeight();
        };

        transcribeRecognition.onerror = (event) => {
            console.error('Transcribe recognition error:', event.error);
            voiceStatus.textContent = `Transcribe Error: ${event.error}`;
            voiceStatus.classList.add('error');
            displayStatusMessage(`Transcribe error: ${event.error}`, 'error');
            isTranscribeListening = false;
            transcribeVoiceButton.classList.remove('listening');
            transcribeVoiceButton.querySelector('i').classList.replace('fa-stop-circle', 'fa-microphone');
            if (event.error !== 'not-allowed' && event.error !== 'permission-denied') {
                 if (transcribeVoiceButton.classList.contains('listening')) {
                    transcribeRecognition.start();
                 }
            }
        };

        transcribeRecognition.onend = () => {
            if (isTranscribeListening && transcribeVoiceButton.classList.contains('listening')) {
                transcribeRecognition.start();
            } else {
                transcribeVoiceButton.classList.remove('listening');
                transcribeVoiceButton.querySelector('i').classList.replace('fa-stop-circle', 'fa-microphone');
                voiceStatus.classList.remove('active');
                voiceStatus.textContent = '';
                displayStatusMessage('Transcribe Mode ended. Click Send manually to submit.', 'info');
                fullTranscribedText = '';
            }
        };

        transcribeVoiceButton.addEventListener('click', () => {
            if (isTranscribeListening) {
                transcribeRecognition.stop();
                isTranscribeListening = false;
                transcribeVoiceButton.classList.remove('listening');
                transcribeVoiceButton.querySelector('i').classList.replace('fa-stop-circle', 'fa-microphone');
                displayStatusMessage('Transcribe Mode stopped by user.', 'info');
                fullTranscribedText = '';
            } else {
                stopAllVoiceRecognition();
                transcribeRecognition.lang = languageMap[languageSelect.value]?.speechRecognition || 'en-US';
                transcribeRecognition.start();
            }
        });

        languageSelect.addEventListener('change', () => {
            stopAllVoiceRecognition();
            const selectedLangTag = languageMap[languageSelect.value]?.speechRecognition || 'en-US';
            voiceModeRecognition.lang = selectedLangTag;
            transcribeRecognition.lang = selectedLangTag;
            displayStatusMessage(`Voice recognition language set to: ${languageSelect.value}`, 'info');
        });

    } else {
        voiceModeButton.disabled = true;
        voiceModeButton.title = "Voice mode not supported by your browser.";
        transcribeVoiceButton.disabled = true;
        transcribeVoiceButton.title = "Transcribe voice not supported by your browser.";
        displayStatusMessage('Voice commands are not supported by this browser. Please use Chrome or Edge.', 'error');
    }

    // --- Document Upload Functionality (Multiple Files) ---
    documentUploadInput.addEventListener('change', async (event) => {
        const files = event.target.files;
        if (files.length > 0) {
            let combinedContent = "";
            let fileReadPromises = [];
            uploadedFilesMetadata = []; // Reset for new selection

            displayStatusMessage('Reading files...', 'info');
            uploadedFilesPreview.innerHTML = ''; // Clear previous preview
            uploadedFilesPreview.classList.remove('has-files');

            for (const file of files) {
                fileReadPromises.push(new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const fileMetadata = {
                            name: file.name,
                            iconClass: getFileIconClass(file.name),
                            content: e.target.result,
                            id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 9)}` // Unique ID for removal
                        };
                        resolve(fileMetadata);
                    };
                    reader.onerror = (err) => {
                        console.error(`Error reading file ${file.name}:`, err);
                        reject(`Could not read file: ${file.name}. It might be binary or corrupted.`);
                    };
                    reader.readAsText(file);
                }));
            }

            try {
                const results = await Promise.all(fileReadPromises);
                results.forEach(fileMetadata => {
                    uploadedFilesMetadata.push(fileMetadata); // Store metadata
                    combinedContent += `--- Start of ${fileMetadata.name} ---\n${fileMetadata.content}\n--- End of ${fileMetadata.name} ---\n\n`;

                    // Create file tag for preview
                    const fileTag = document.createElement('div');
                    fileTag.classList.add('file-tag');
                    fileTag.setAttribute('data-file-id', fileMetadata.id);
                    fileTag.innerHTML = `
                        <i class="fas ${fileMetadata.iconClass} file-icon"></i>
                        <span class="file-name">${fileMetadata.name}</span>
                        <i class="fas fa-times-circle remove-file"></i>
                    `;
                    uploadedFilesPreview.appendChild(fileTag);

                    // Add event listener to remove button
                    fileTag.querySelector('.remove-file').addEventListener('click', () => {
                        removeUploadedFile(fileMetadata.id);
                    });
                });

                uploadedFileContent = combinedContent.trim(); // Store combined text content
                uploadedFilesPreview.classList.add('has-files'); // Add class to show border/styling

                let totalSize = 0;
                for(const file of files) {
                    totalSize += file.size;
                }

                uploadStatus.textContent = `Loaded ${files.length} file(s). Total size: ${(totalSize / 1024).toFixed(2)} KB. Content will be sent with your next message.`;
                uploadStatus.classList.add('active');
                displayStatusMessage('Documents uploaded. Type your query.', 'success');
                userInput.focus();
            } catch (error) {
                uploadedFileContent = null;
                uploadedFilesMetadata = [];
                uploadedFilesPreview.innerHTML = '';
                uploadedFilesPreview.classList.remove('has-files');
                uploadStatus.textContent = `Error: ${error}`;
                uploadStatus.classList.add('error');
                displayStatusMessage(`Error processing documents: ${error}`, 'error');
            }
        } else {
            uploadedFileContent = null;
            uploadedFilesMetadata = [];
            uploadedFilesPreview.innerHTML = '';
            uploadedFilesPreview.classList.remove('has-files');
            uploadStatus.style.display = 'none';
        }
    });

    function removeUploadedFile(fileIdToRemove) {
        uploadedFilesMetadata = uploadedFilesMetadata.filter(file => file.id !== fileIdToRemove);
        const fileTagToRemove = uploadedFilesPreview.querySelector(`[data-file-id="${fileIdToRemove}"]`);
        if (fileTagToRemove) {
            uploadedFilesPreview.removeChild(fileTagToRemove);
        }

        // Re-combine content if any files remain
        if (uploadedFilesMetadata.length > 0) {
            uploadedFileContent = uploadedFilesMetadata.map(file => `--- Start of ${file.name} ---\n${file.content}\n--- End of ${file.name} ---`).join('\n\n');
            uploadedFilesPreview.classList.add('has-files');
            displayStatusMessage(`Removed file. ${uploadedFilesMetadata.length} file(s) remaining.`, 'info');
        } else {
            uploadedFileContent = null;
            uploadedFilesPreview.classList.remove('has-files');
            uploadedFilesPreview.innerHTML = ''; // Ensure div is empty
            uploadStatus.style.display = 'none';
            displayStatusMessage('All uploaded files removed.', 'info');
        }
    }


    // --- Initial setup calls ---
    adjustTextareaHeight();
    if (speechSynth) {
        if (speechSynth.getVoices().length === 0) {
            speechSynth.onvoiceschanged = () => {
                voices = speechSynth.getVoices();
                populateVoiceSelection();
                console.log("Voices loaded asynchronously.");
            };
        } else {
            voices = speechSynth.getVoices();
            populateVoiceSelection();
        }
    }
});