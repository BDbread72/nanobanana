require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const multer = require('multer');
const exifReader = require('exif-reader'); // Added
const modelManager = require('./services/modelManager');
const storageManager = require('./services/storageManager');

const app = express();
const PORT = process.env.PORT || 3000;

// Logging Utility
const LOG_FILE = path.join(__dirname, 'data/logs/server.log');
const logToFile = (type, message, details = {}) => {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${type}] ${message} | ${JSON.stringify(details)}\n`;
    
    // Ensure dir exists (simple check)
    const dir = path.dirname(LOG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.appendFile(LOG_FILE, logEntry, (err) => {
        if (err) console.error('Logging failed:', err);
    });
    console.log(`[${type}] ${message}`); // Also log to console
};

// Multer Config (Memory Storage for inspection)
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Initialize Managers
modelManager.initialize();
storageManager.initialize();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
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
    
    const reqId = Date.now().toString();
    logToFile('REQ_GENERATE', 'Generate request received', { reqId, model, promptLength: prompt?.length, ip: req.ip });

    if (!prompt) {
        logToFile('ERR_GENERATE', 'Missing prompt', { reqId });
        return res.status(400).json({ error: 'Prompt is required' });
    }
    if (!model) {
        logToFile('ERR_GENERATE', 'Missing model ID', { reqId });
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
        
        logToFile('SUC_GENERATE', 'Image generated successfully', { reqId, model, delivery: deliveryResults });

        // Response with delivery info
        res.json({
            ...result,
            delivery: deliveryResults
        });
    } catch (error) {
        logToFile('ERR_GENERATE', 'Generation failed', { reqId, error: error.message });
        console.error('Generation Error:', error.message);
        res.status(500).json({ 
            error: 'Failed to generate image', 
            details: error.message 
        });
    }
});

// 4. Metadata & Tools
// Serve Watch Page
app.get('/watch', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/watch.html'));
});

// Download with Metadata (Embeds Prompt)
app.post('/api/download', async (req, res) => {
    const { imageData, prompt, mimeType } = req.body;

    if (!imageData || !prompt) {
        logToFile('ERR_DOWNLOAD', 'Missing data for download');
        return res.status(400).json({ error: 'Missing image data or prompt' });
    }

    try {
        const buffer = Buffer.from(imageData, 'base64');
        const promptString = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
        let outputBuffer;

        const exifData = {
            IFD0: {
                ImageDescription: promptString,
                XPComment: promptString, // Windows specific
                UserComment: promptString // Common
            }
        };

        if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
            outputBuffer = await sharp(buffer)
                .withMetadata({ exif: exifData })
                .toBuffer();
            
            const filename = `nanobanana-${Date.now()}.jpg`;
            res.set('Content-Type', 'image/jpeg');
            res.set('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(outputBuffer);

        } else {
            // PNG: Write both Text Chunks (for Web/SD) AND EXIF (for OS)
            outputBuffer = await sharp(buffer)
                .png()
                .withMetadata({
                    exif: exifData,
                    text: {
                        parameters: promptString, // Standard SD
                        description: promptString
                    }
                })
                .toBuffer();

            const filename = `nanobanana-${Date.now()}.png`;
            res.set('Content-Type', 'image/png');
            res.set('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(outputBuffer);
        }

        logToFile('SUC_DOWNLOAD', 'Processed download with metadata');

    } catch (error) {
        logToFile('ERR_DOWNLOAD', 'Download processing failed', { error: error.message });
        console.error('Download Error:', error);
        res.status(500).json({ error: 'Failed to process image download' });
    }
});

// Inspect Image (Extract Metadata)
app.post('/api/inspect', upload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No image uploaded' });
    }

    try {
        const metadata = await sharp(req.file.buffer).metadata();
        let foundPrompt = null;

        // 1. Check EXIF (Parsed via exif-reader)
        if (metadata.exif) {
            try {
                const parsedExif = exifReader(metadata.exif);
                if (parsedExif.image && parsedExif.image.ImageDescription) {
                    foundPrompt = parsedExif.image.ImageDescription;
                } else if (parsedExif.image && parsedExif.image.XPComment) {
                     // XPComment is often a buffer of UCS-2 chars, might need decoding if not handled by reader
                     // But exif-reader often returns buffer for unknown tags or complex ones.
                     // Let's stick to ImageDescription as primary.
                     if (Buffer.isBuffer(parsedExif.image.XPComment)) {
                         foundPrompt = parsedExif.image.XPComment.toString('utf16le').replace(/\0/g, '');
                     } else {
                         foundPrompt = parsedExif.image.XPComment;
                     }
                } else if (parsedExif.exif && parsedExif.exif.UserComment) {
                    // UserComment often has a header like 'ASCII\0\0\0'
                    const uc = parsedExif.exif.UserComment;
                    if (Buffer.isBuffer(uc)) {
                        foundPrompt = uc.toString('utf8').replace(/^ASCII\0\0\0/, '');
                    } else {
                        foundPrompt = uc;
                    }
                }
            } catch (exifErr) {
                console.warn('EXIF parsing error:', exifErr.message);
            }
        }

        // 2. Check PNG Text Chunks (If EXIF didn't yield result or it's just text)
        if (!foundPrompt && metadata.text) {
             if (metadata.text.parameters) foundPrompt = metadata.text.parameters;
             else if (metadata.text.description) foundPrompt = metadata.text.description;
             else if (Object.keys(metadata.text).length > 0) {
                 foundPrompt = Object.values(metadata.text).join('\n');
             }
        }

        logToFile('REQ_INSPECT', 'Image inspection', { found: !!foundPrompt, format: metadata.format });

        res.json({
            format: metadata.format,
            width: metadata.width,
            height: metadata.height,
            prompt: foundPrompt || 'No embedded prompt found.'
        });

    } catch (error) {
        logToFile('ERR_INSPECT', 'Inspection failed', { error: error.message });
        console.error('Inspect Error:', error);
        res.status(500).json({ error: 'Failed to inspect image' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Loaded models: ${modelManager.getModels().length}`);
});