const axios = require('axios');

class NanobananaProvider {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
    }

    async generate(modelId, prompt, options = {}) {
        const apiUrl = `${this.baseUrl}/${modelId}:generateContent?key=${this.apiKey}`;
        
        const payload = {
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                // Future config like aspect ratio can go here
            }
        };

        console.log(`[Nanobanana] Requesting ${modelId}...`);
        
        try {
            const response = await axios.post(apiUrl, payload);
            return this.normalizeResponse(response.data);
        } catch (error) {
            console.error('[Nanobanana] Error:', error.response ? error.response.data : error.message);
            throw new Error(`Nanobanana API Error: ${error.message}`);
        }
    }

    // Convert API specific response to a standard format for our frontend
    normalizeResponse(data) {
        const candidate = data.candidates?.[0];
        const part = candidate?.content?.parts?.[0];

        if (part?.inlineData) {
            return {
                type: 'base64',
                mimeType: part.inlineData.mimeType,
                data: part.inlineData.data
            };
        } else if (part?.text) {
             // Sometimes image APIs return a URL in text, or just text if failed
            return {
                type: 'text',
                data: part.text
            };
        }
        
        throw new Error('Unknown response format from Nanobanana');
    }
}

module.exports = NanobananaProvider;
