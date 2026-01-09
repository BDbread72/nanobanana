document.addEventListener('DOMContentLoaded', () => {
    // Initial setup
    const accessKeyInput = document.getElementById('access-key');
    
    // Try to load models if user already typed key (e.g. browser autofill)
    // or wait for them to type it.
    accessKeyInput.addEventListener('change', loadModels);
    accessKeyInput.addEventListener('blur', loadModels);
});

async function loadModels() {
    const accessKey = document.getElementById('access-key').value;
    const modelSelect = document.getElementById('model-select');
    
    if (!accessKey) return;

    try {
        const response = await fetch('/api/models', {
            headers: { 'x-site-access-key': accessKey }
        });

        if (response.ok) {
            const models = await response.json();
            modelSelect.innerHTML = ''; // Clear 'Loading...'
            
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.name;
                option.title = model.description;
                modelSelect.appendChild(option);
            });
        } else {
            console.error('Failed to load models:', response.status);
            modelSelect.innerHTML = '<option disabled>Failed to load models (Check Key)</option>';
        }
    } catch (err) {
        console.error('Error loading models:', err);
    }
}

document.getElementById('generate-btn').addEventListener('click', async () => {
    const accessKey = document.getElementById('access-key').value;
    const model = document.getElementById('model-select').value;
    const prompt = document.getElementById('prompt-input').value;
    const statusMsg = document.getElementById('status-message');
    const resultContainer = document.getElementById('result-container');
    const btn = document.getElementById('generate-btn');

    if (!accessKey) {
        statusMsg.textContent = 'Please enter the Site Access Key.';
        statusMsg.className = 'error';
        return;
    }
    if (!prompt) {
        statusMsg.textContent = 'Please enter a prompt.';
        statusMsg.className = 'error';
        return;
    }
    if (!model) {
        statusMsg.textContent = 'Please select a model (Enter key to load models).';
        statusMsg.className = 'error';
        return;
    }

    // Reset UI
    statusMsg.textContent = 'Generating image... (this may take a moment)';
    statusMsg.className = '';
    resultContainer.innerHTML = '';
    btn.disabled = true;

    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-site-access-key': accessKey
            },
            body: JSON.stringify({ model, prompt })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Server error');
        }

        console.log('API Response:', data);

        // Handle Standardized Response from Server
        if (data.type === 'base64') {
            const img = document.createElement('img');
            img.src = `data:${data.mimeType};base64,${data.data}`;
            resultContainer.appendChild(img);
            statusMsg.textContent = 'Image generated successfully!';
            statusMsg.className = 'success';
        } else if (data.type === 'text') {
             // Just text (e.g., "I cannot generate that") or URL
             if (data.data.startsWith('http')) {
                const img = document.createElement('img');
                img.src = data.data;
                resultContainer.appendChild(img);
                statusMsg.textContent = 'Image generated!';
                statusMsg.className = 'success';
             } else {
                const p = document.createElement('p');
                p.textContent = data.data;
                resultContainer.appendChild(p);
                statusMsg.textContent = 'Result received (Text)';
             }
        } else {
            statusMsg.textContent = 'Unknown response format.';
            statusMsg.className = 'error';
        }

    } catch (error) {
        console.error('Error:', error);
        statusMsg.textContent = `Error: ${error.message}`;
        statusMsg.className = 'error';
    } finally {
        btn.disabled = false;
    }
});