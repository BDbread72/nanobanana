const NanobananaProvider = require('./providers/nanobanana');

class ModelManager {
    constructor() {
        this.providers = {};
        this.models = [];
    }

    initialize() {
        // Initialize Providers
        const nanobananaApiKey = process.env.NANOBANANA_API_KEY;
        
        if (nanobananaApiKey) {
            const nanoProvider = new NanobananaProvider(nanobananaApiKey);
            this.registerProvider('nanobanana', nanoProvider);

            // Register Models
            // Gemini Image Models
            this.registerModel({
                id: 'gemini-2.5-flash-image',
                name: 'Gemini Flash Image',
                provider: 'nanobanana',
                description: 'Fast generation with Gemini 2.5 Flash'
            });

            this.registerModel({
                id: 'gemini-3-pro-image-preview',
                name: 'Gemini Pro Image (Preview)',
                provider: 'nanobanana',
                description: 'High quality with Gemini 3 Pro'
            });

            // Imagen Models
            this.registerModel({
                id: 'imagen-4.0-fast-generate-001',
                name: 'Imagen 4 Fast',
                provider: 'nanobanana',
                description: 'Ultra fast Imagen 4 generation'
            });

            this.registerModel({
                id: 'imagen-4.0-generate-001',
                name: 'Imagen 4 Standard',
                provider: 'nanobanana',
                description: 'Standard quality Imagen 4'
            });
        } else {
            console.warn('Warning: NANOBANANA_API_KEY is missing. Nanobanana models will be unavailable.');
        }

        // Example: In the future, add OpenAI here
        // if (process.env.OPENAI_API_KEY) { ... }
    }

    registerProvider(name, instance) {
        this.providers[name] = instance;
    }

    registerModel(modelConfig) {
        this.models.push(modelConfig);
    }

    getModels() {
        return this.models.map(m => ({
            id: m.id,
            name: m.name,
            description: m.description
        }));
    }

    async generateImage(modelId, prompt, options) {
        const modelConfig = this.models.find(m => m.id === modelId);
        if (!modelConfig) {
            throw new Error(`Model '${modelId}' not found.`);
        }

        const provider = this.providers[modelConfig.provider];
        if (!provider) {
            throw new Error(`Provider '${modelConfig.provider}' is not initialized.`);
        }

        return await provider.generate(modelId, prompt, options);
    }
}

// Export a singleton instance
const manager = new ModelManager();
module.exports = manager;
