let chatModule;
let isModelLoaded = false;
let conversationHistory = []; // Add global variable for conversation history
const MAX_HISTORY_LENGTH = 10; // Limit history size (adjust as needed)

// DOM Elements
const modelSelect = document.getElementById('model-select');
const loadModelBtn = document.getElementById('load-model');
const statusDiv = document.getElementById('status');
const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');

// Initialize the chat module
async function initChat() {
    try {
        // Check if webllm is available
        if (typeof window.webllm === 'undefined') {
            updateStatus('Waiting for Web-LLM to load...');
            // Wait a bit and retry
            setTimeout(initChat, 1000);
            return;
        }

        // Extract available models from webllm
        const availableModels = window.webllm.prebuiltAppConfig.model_list;
        console.log('Available models:', availableModels);
        
        // Clear and populate the model select dropdown
        modelSelect.innerHTML = '';
        
        // Filter for smaller models for better browser performance
        const preferredModels = availableModels.filter(model => 
            model.low_resource_required || 
            model.model_id.includes("TinyLlama") || 
            model.model_id.includes("Phi") ||
            model.model_id.includes("SmolLM")
        );
        
        // If no preferred models, use all models
        const modelsToShow = preferredModels.length > 0 ? preferredModels : availableModels;
        
        // Add models to select
        modelsToShow.forEach(model => {
            const option = document.createElement('option');
            option.value = model.model_id;
            option.textContent = `${model.model_id} (${Math.round(model.vram_required_MB / 1024 * 10) / 10} GB)`;
            modelSelect.appendChild(option);
        });

        // Initialize the MLCEngine with the first available model and the app config
        try {
            if (modelsToShow.length === 0) {
                throw new Error("No models available to initialize the engine.");
            }
            const initialModelId = modelsToShow[0].model_id; // Get the first model ID
            console.log(`Initializing MLCEngine with default model: ${initialModelId}`);
            
            // Disable load button until initialization is confirmed successful
            loadModelBtn.disabled = true; 
            
            // Pass the first model ID, app config, and progress callback
            chatModule = await window.webllm.CreateMLCEngine(
                initialModelId,
                { appConfig: window.webllm.prebuiltAppConfig }, // Engine options
                { progressCallback: handleProgress } // Chat options
            );

            // Initialize conversation history with system prompt
            conversationHistory = [{ role: "system", content: "You are a helpful assistant." }];

            // Update status to reflect the initially loaded model
            updateStatus(`MLCEngine initialized with ${initialModelId}. Ready to load selected model.`);
            // Mark the initial model as loaded
            isModelLoaded = true; 
            sendButton.disabled = false;
            // Re-enable load button now that initialization is successful
            loadModelBtn.disabled = false; 
            // Store the initially loaded model ID
            chatModule.currentModelId = initialModelId;

        } catch (error) {
            updateStatus(`Error initializing chat module: ${error.message}`, true);
            console.error('Error during initialization:', error);
            // Keep load button disabled if initialization failed
            loadModelBtn.disabled = true;
            sendButton.disabled = true; // Also disable send button
        }
    } catch (error) {
        updateStatus(`Error initializing: ${error.message}`, true);
        console.error('Error during initialization:', error);
        // Ensure buttons remain disabled on outer error
        loadModelBtn.disabled = true;
        sendButton.disabled = true;
    }
}

// Load the selected model
async function loadModel() {
    // This check should now only be reached if chatModule was successfully initialized
    if (!chatModule) {
        updateStatus("Error: Chat module is not available. Initialization might have failed.", true);
        console.error("loadModel called but chatModule is not initialized.");
        return; 
    }

    const modelName = modelSelect.value;
    // Check if the selected model is already loaded
    // Use optional chaining in case currentModelId wasn't set
    if (isModelLoaded && chatModule?.currentModelId === modelName) {
        updateStatus(`Model ${modelName} is already loaded.`);
        return;
    }
    
    updateStatus(`Loading model ${modelName}...`);
    // Disable buttons during load
    loadModelBtn.disabled = true;
    sendButton.disabled = true;
    
    try {
        // Use the reload method with the selected model ID and progress callback
        await chatModule.reload(modelName, { progressCallback: handleProgress });
        // Store the currently loaded model ID
        chatModule.currentModelId = modelName;

        // Reset conversation history when model changes
        conversationHistory = [{ role: "system", content: "You are a helpful assistant." }];
        chatMessages.innerHTML = ''; // Clear chat display
        appendMessage('system', 'Conversation history cleared for new model.'); // Inform user

        isModelLoaded = true;
        // Re-enable buttons after successful load
        sendButton.disabled = false; 
        loadModelBtn.disabled = false;
        updateStatus(`Model ${modelName} loaded successfully!`);
    } catch (error) {
        updateStatus(`Error loading model: ${error.message}`, true);
        console.error('Error loading model:', error);
        isModelLoaded = false; // Ensure model is marked as not loaded on error
        // Keep send button disabled, but re-enable load button to allow trying again
        sendButton.disabled = true;
        loadModelBtn.disabled = false; 
    }
}

// Send a message and get a response
async function sendMessage() {
    if (!isModelLoaded) {
        updateStatus('Please load a model first!', true);
        return;
    }
    
    const message = userInput.value.trim();
    if (!message) return;
    
    // Display user message
    appendMessage('user', message);
    userInput.value = '';
    sendButton.disabled = true;
    loadModelBtn.disabled = true; // Also disable load button during generation

    // Add user message to history
    conversationHistory.push({ role: "user", content: message });

    // Truncate history if it exceeds the limit (keeping system prompt + last N messages)
    if (conversationHistory.length > MAX_HISTORY_LENGTH + 1) { // +1 for system prompt
        // Keep the system prompt and the last MAX_HISTORY_LENGTH messages
        conversationHistory = [
            conversationHistory[0], // System prompt
            ...conversationHistory.slice(-(MAX_HISTORY_LENGTH))
        ];
        console.log("Truncated conversation history:", conversationHistory);
    }

    try {
        updateStatus('Generating response (non-streaming)...');
        console.log('Sending message to chatCompletion:', message);
        
        // Create a placeholder for the assistant's response
        const assistantMsgElement = appendMessage('assistant', '[Generating...]'); // Placeholder text
        
        // Use the current conversationHistory
        const messagesToSend = conversationHistory;
        console.log('Messages being sent:', messagesToSend);

        // Use chatCompletion method for MLCEngine - NON-STREAMING
        const response = await chatModule.chatCompletion({
            messages: messagesToSend, 
            stream: false // Request the full response at once
            // No onTokenStream callback needed
        });
        
        console.log('chatCompletion finished. Full response object:', response);
        
        // Log runtime stats after generation attempt
        try {
            const stats = await chatModule.runtimeStatsText();
            console.log("Runtime stats after generation:\n", stats);
        } catch (statsError) {
            console.error("Could not get runtime stats:", statsError);
        }

        // Extract the content from the non-streaming response
        if (response?.choices?.[0]?.message?.content) {
            const fullResponseText = response.choices[0].message.content;
            assistantMsgElement.textContent = fullResponseText; // Update placeholder with full response

            // Add assistant response to history
            conversationHistory.push({ role: "assistant", content: fullResponseText });

            chatMessages.scrollTop = chatMessages.scrollHeight;
            console.log("Received full response content:", fullResponseText);
            console.log("Updated conversation history:", conversationHistory);
        } else {
             console.warn("Could not extract content from non-streaming response object.");
             assistantMsgElement.textContent = "[No response content found]";
             // Do not add empty/failed response to history
        }
        
        updateStatus('Ready');
    } catch (error) {
        updateStatus(`Error generating response: ${error.message}`, true);
        console.error('Error generating response:', error);
        // Update placeholder on error
        const assistantMsgElement = chatMessages.querySelector('.message.assistant:last-child .content');
        if (assistantMsgElement) {
            assistantMsgElement.textContent = `[Error: ${error.message}]`; 
        }
        // Log stats even on error
        try {
            const stats = await chatModule.runtimeStatsText();
            console.log("Runtime stats after error:\n", stats);
        } catch (statsError) {
            console.error("Could not get runtime stats after error:", statsError);
        }
        // Do not add error message to history
    } finally {
        // Re-enable buttons
        sendButton.disabled = false;
        loadModelBtn.disabled = false; 
    }
}

// Helper function to update the status display
function updateStatus(message, isError = false, isProgress = false) {
    // If it's a progress update, display the message directly
    // Otherwise, prepend "Status: "
    statusDiv.textContent = isProgress ? message : `Status: ${message}`;
    statusDiv.className = isError ? 'error' : '';
}

// Helper function to handle progress updates
function handleProgress(report) {
    const progressPercentage = (report.progress * 100).toFixed(2);
    const message = `${report.text} (${progressPercentage}%)`;
    // Update status, marking it as a progress update
    updateStatus(message, false, true);
    console.log(message); // Also log progress to console
}

// Helper function to append a message to the chat
function appendMessage(role, content) {
    // Only display user and assistant messages visually
    if (role === 'system') {
        console.log(`System message: ${content}`); // Log system messages instead of displaying
        // Optionally, display system messages differently if needed
        // const messageDiv = document.createElement('div');
        // messageDiv.classList.add('message', 'system');
        // messageDiv.textContent = `System: ${content}`;
        // chatMessages.appendChild(messageDiv);
        // chatMessages.scrollTop = chatMessages.scrollHeight;
        return null; // Return null as there's no content element to update later
    }

    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', role);
    
    const roleLabel = document.createElement('div');
    roleLabel.classList.add('role-label');
    roleLabel.textContent = role === 'user' ? 'You' : 'Assistant';
    
    const messageContent = document.createElement('div');
    messageContent.classList.add('content');
    messageContent.textContent = content;
    
    messageDiv.appendChild(roleLabel);
    messageDiv.appendChild(messageContent);
    chatMessages.appendChild(messageDiv);
    
    // Auto scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    return messageContent; // Return the content element
}

// Event Listeners
loadModelBtn.addEventListener('click', loadModel);
sendButton.addEventListener('click', sendMessage);
userInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
});

// Initialize when the page loads
window.addEventListener('DOMContentLoaded', initChat);
