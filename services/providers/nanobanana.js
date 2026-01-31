const axios = require('axios');

class NanobananaProvider {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
    }

    async generate(modelId, prompt, options = {}) {
        const isImagenModel = modelId.startsWith('imagen-');

        console.log(`[Nanobanana] Requesting ${modelId} (${isImagenModel ? 'Imagen' : 'Gemini'} API)...`);

        try {
            if (isImagenModel) {
                return await this.generateWithImagen(modelId, prompt, options);
            } else {
                return await this.generateWithGemini(modelId, prompt, options);
            }
        } catch (error) {
            const errorDetails = error.response?.data?.error?.message || error.message;
            console.error('[Nanobanana] Error:', error.response?.data || error.message);
            throw new Error(`Nanobanana API Error: ${errorDetails}`);
        }
    }

    // Imagen API (imagen-4.0-generate-001, etc.)
    async generateWithImagen(modelId, prompt, options = {}) {
        const apiUrl = `${this.baseUrl}/${modelId}:predict?key=${this.apiKey}`;

        const payload = {
            instances: [{ prompt }],
            parameters: {
                sampleCount: 1,
                aspectRatio: options.aspectRatio || '1:1'
            }
        };

        const response = await axios.post(apiUrl, payload);
        return this.normalizeImagenResponse(response.data);
    }

    // Gemini Image API (gemini-2.5-flash-image, etc.)
    async generateWithGemini(modelId, prompt, options = {}) {
        const apiUrl = `${this.baseUrl}/${modelId}:generateContent?key=${this.apiKey}`;

        const payload = {
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                responseModalities: ["IMAGE", "TEXT"]
            }
        };

        const response = await axios.post(apiUrl, payload);
        return this.normalizeGeminiResponse(response.data);
    }

    // Normalize Imagen API response
    normalizeImagenResponse(data) {
        const prediction = data.predictions?.[0];

        if (prediction?.bytesBase64Encoded) {
            return {
                type: 'base64',
                mimeType: prediction.mimeType || 'image/png',
                data: prediction.bytesBase64Encoded
            };
        }

        throw new Error('No image data in Imagen response');
    }

    // Normalize Gemini API response
    normalizeGeminiResponse(data) {
        const candidate = data.candidates?.[0];
        const part = candidate?.content?.parts?.[0];

        if (part?.inlineData) {
            return {
                type: 'base64',
                mimeType: part.inlineData.mimeType,
                data: part.inlineData.data
            };
        } else if (part?.text) {
            return {
                type: 'text',
                data: part.text
            };
        }

        throw new Error('Unknown response format from Gemini');
    }
}

module.exports = NanobananaProvider;
