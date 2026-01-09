const fs = require('fs');
const path = require('path');

const PROMPTS_FILE = path.join(__dirname, '../data/prompts.json');

class PromptManager {
    constructor() {
        this.prompts = {}; // { modelId: [ { name, content, format } ] }
        this.ensureDataDir();
        this.load();
    }

    ensureDataDir() {
        const dir = path.dirname(PROMPTS_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    load() {
        if (fs.existsSync(PROMPTS_FILE)) {
            try {
                const data = fs.readFileSync(PROMPTS_FILE, 'utf-8');
                this.prompts = JSON.parse(data);
            } catch (err) {
                console.error('Error loading prompts:', err);
                this.prompts = {};
            }
        }
    }

    save() {
        try {
            fs.writeFileSync(PROMPTS_FILE, JSON.stringify(this.prompts, null, 2));
        } catch (err) {
            console.error('Error saving prompts:', err);
        }
    }

    getPrompts(modelId) {
        return this.prompts[modelId] || [];
    }

    savePrompt(modelId, name, content, format) {
        if (!this.prompts[modelId]) {
            this.prompts[modelId] = [];
        }

        // Check if a prompt with the same name exists, update it if so
        const existingIndex = this.prompts[modelId].findIndex(p => p.name === name);
        const newPrompt = { name, content, format, timestamp: new Date().toISOString() };

        if (existingIndex >= 0) {
            this.prompts[modelId][existingIndex] = newPrompt;
        } else {
            this.prompts[modelId].push(newPrompt);
        }

        this.save();
        return newPrompt;
    }

    deletePrompt(modelId, name) {
        if (this.prompts[modelId]) {
            this.prompts[modelId] = this.prompts[modelId].filter(p => p.name !== name);
            this.save();
            return true;
        }
        return false;
    }
}

const manager = new PromptManager();
module.exports = manager;
