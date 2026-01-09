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
            this.registerModel({
                id: 'gemini-2.5-flash-image',
                name: 'Nano Banana (Speed)',
                provider: 'nanobanana',
                description: 'Fast generation using Flash model'
            });
            
            this.registerModel({
                id: 'gemini-3-pro-image-preview',
                name: 'Nano Banana Pro (Quality)',
                provider: 'nanobanana',
                description: 'High quality generation using Pro model'
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
