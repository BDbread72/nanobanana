const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const axios = require('axios');
const crypto = require('crypto');

class StorageManager {
    constructor() {
        this.s3Client = null;
        this.b2Enabled = false;
        this.webhookUrl = process.env.CUSTOM_SERVER_URL;
    }

    initialize() {
        // B2 Configuration (S3 Compatible)
        if (process.env.B2_APPLICATION_KEY_ID && process.env.B2_APPLICATION_KEY) {
            this.s3Client = new S3Client({
                endpoint: `https://${process.env.B2_ENDPOINT}`, 
                region: process.env.B2_REGION || 'us-west-004',
                credentials: {
                    accessKeyId: process.env.B2_APPLICATION_KEY_ID,
                    secretAccessKey: process.env.B2_APPLICATION_KEY,
                },
            });
            this.b2Enabled = true;
            console.log('[Storage] B2 Storage initialized.');
        } else {
            console.log('[Storage] B2 Storage is disabled (Keys missing).');
        }

        if (this.webhookUrl) {
            console.log(`[Storage] Custom server webhook set to: ${this.webhookUrl}`);
        } else {
            console.log('[Storage] Custom server webhook is disabled.');
        }
    }

    /**
     * @param {Object} imageData { type: 'base64', data: '...', mimeType: '...' }
     * @param {string} prompt
     * @param {Object} metadata { ip, userAgent, timestamp, model, ... }
     */
    async processDelivery(imageData, prompt, metadata) {
        const results = { b2: null, webhook: null };
        
        if (imageData.type !== 'base64') return results;

        // B2 Folder logic (simulated by slash in filename)
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
        const uniqueId = crypto.randomBytes(4).toString('hex');
        const folderName = `nanobanana/${dateStr}/${timeStr}-${uniqueId}`;

        const imageBuffer = Buffer.from(imageData.data, 'base64');
        const promptBuffer = Buffer.from(prompt, 'utf-8');
        const metadataBuffer = Buffer.from(JSON.stringify(metadata, null, 2), 'utf-8');

        // 1. Upload to Backblaze B2 (if enabled)
        if (this.b2Enabled) {
            try {
                const bucket = process.env.B2_BUCKET_NAME;
                const uploadFile = async (key, body, type) => {
                    await this.s3Client.send(new PutObjectCommand({
                        Bucket: bucket,
                        Key: key,
                        Body: body,
                        ContentType: type
                    }));
                };

                await Promise.all([
                    uploadFile(`${folderName}/image.jpg`, imageBuffer, imageData.mimeType),
                    uploadFile(`${folderName}/prompt.txt`, promptBuffer, 'text/plain'),
                    uploadFile(`${folderName}/metadata.json`, metadataBuffer, 'application/json')
                ]);

                results.b2 = `https://${bucket}.${process.env.B2_ENDPOINT}/${folderName}/`;
                console.log(`[Storage] Saved to B2: ${folderName}`);
            } catch (err) {
                console.error('[Storage] B2 Error:', err.message);
                results.b2 = 'error';
            }
        }

        // 2. Send to Custom Server (only if URL exists)
        if (this.webhookUrl) {
            try {
                await axios.post(this.webhookUrl, {
                    event: 'image_generated',
                    image_data: imageData.data,
                    mime_type: imageData.mimeType,
                    metadata: metadata,
                    b2_folder: results.b2 !== 'error' ? results.b2 : null
                });
                results.webhook = 'success';
            } catch (err) {
                console.error('[Storage] Webhook Error:', err.message);
                results.webhook = 'error';
            }
        }

        return results;
    }
}

const manager = new StorageManager();
module.exports = manager;
