require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const modelManager = require('./services/modelManager');
const storageManager = require('./services/storageManager');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Managers
modelManager.initialize();
storageManager.initialize();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configuration
const SITE_ACCESS_KEY = process.env.SITE_ACCESS_KEY || 'default-secret-key';

// Middleware for Site Access Key
const verifyAccessKey = (req, res, next) => {
    const userAuthKey = req.headers['x-site-access-key'];
    if (userAuthKey !== SITE_ACCESS_KEY) {
        return res.status(403).json({ error: 'Invalid Site Access Key' });
    }
    next();
};

// --- Routes ---

// 1. Get Available Models
app.get('/api/models', verifyAccessKey, (req, res) => {
    const models = modelManager.getModels();
    res.json(models);
});

// 2. Generate Image
app.post('/api/generate', verifyAccessKey, async (req, res) => {
    const { prompt, model, width, height } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }
    if (!model) {
        return res.status(400).json({ error: 'Model ID is required' });
    }

    try {
        const result = await modelManager.generateImage(model, prompt, { width, height });
        
        // Collect Metadata
        const metadata = {
            ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
            userAgent: req.get('User-Agent'),
            timestamp: new Date().toISOString(),
            model: model,
            prompt: prompt
        };

        // --- Delivery Logic (B2, Webhook) ---
        const deliveryResults = await storageManager.processDelivery(result, prompt, metadata);
        
        // Response with delivery info
        res.json({
            ...result,
            delivery: deliveryResults
        });
    } catch (error) {
        console.error('Generation Error:', error.message);
        res.status(500).json({ 
            error: 'Failed to generate image', 
            details: error.message 
        });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Loaded models: ${modelManager.getModels().length}`);
});