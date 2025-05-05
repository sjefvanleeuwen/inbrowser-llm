# In-Browser LLM Chat

This application allows you to run large language models (LLMs) directly in your browser using [Web-LLM](https://github.com/mlc-ai/web-llm/).

## Features

- Run LLMs completely in the browser - no server required
- Choose from multiple models
- Simple chat interface
- Conversation history (memory) within a session
- Progress display during model loading
- No API keys needed

## Getting Started

1. Clone this repository
2. Serve the files with a local web server (due to CORS restrictions)

   ```bash
   # Using Python
   python -m http.server
   
   # Using Node.js
   npx serve
   ```

3. Open your browser and navigate to `http://localhost:8000` (or the URL provided by your server)
4. Select a model and click "Load Model"
5. Wait for the model to download and initialize (this may take some time depending on the model size)
6. Start chatting!

## Model Information

The application uses models from Web-LLM. The first time you use a model, it will be downloaded to your browser's cache. Subsequent uses will be faster as the model is loaded from the cache.

## System Requirements

- A modern web browser (Chrome, Firefox, Safari, Edge)
- Sufficient RAM (8GB minimum recommended, more for larger models)
- For mobile devices, the smaller models are recommended

## Notes

- The first model load may take some time as the model needs to be downloaded. Progress will be shown.
- All computation happens locally in your browser - your conversations are private
- Models are compressed to be efficient for browser usage
- Conversation history is maintained for the current session but is reset when changing models or reloading the page.
