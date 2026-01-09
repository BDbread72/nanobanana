document.addEventListener('DOMContentLoaded', () => {
    // Initial setup
    const accessKeyInput = document.getElementById('access-key');
    
    // Auth listeners
    accessKeyInput.addEventListener('change', loadModels);
    accessKeyInput.addEventListener('blur', loadModels);
    
    // Format Toggles
    document.querySelectorAll('input[name="prompt-format"]').forEach(radio => {
        radio.addEventListener('change', handleFormatChange);
    });

    // JSON Builder
    document.getElementById('add-json-row-btn').addEventListener('click', () => addJsonRow());

    // Prompt Management
    document.getElementById('model-select').addEventListener('change', handleModelChange);
    document.getElementById('save-prompt-btn').addEventListener('click', savePrompt);
    document.getElementById('saved-prompts-select').addEventListener('change', loadSelectedPrompt);
    document.getElementById('delete-prompt-btn').addEventListener('click', deletePrompt);

    // Generation
    document.getElementById('generate-btn').addEventListener('click', generateImage);
});

// State
let currentFormat = 'text';
let timerInterval;

function getAccessKey() {
    return document.getElementById('access-key').value;
}

async function loadModels() {
    const accessKey = getAccessKey();
    const modelSelect = document.getElementById('model-select');
    
    if (!accessKey) return;

    try {
        const response = await fetch('/api/models', {
            headers: { 'x-site-access-key': accessKey }
        });

        if (response.ok) {
            const models = await response.json();
            modelSelect.innerHTML = '<option value="" disabled selected>Select a Model</option>';
            
            models.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.name;
                modelSelect.appendChild(option);
            });
        } else {
            console.error('Failed to load models');
            modelSelect.innerHTML = '<option disabled>Failed (Check Key)</option>';
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

function handleModelChange() {
    const modelId = document.getElementById('model-select').value;
    if (!modelId) return;
    renderPromptsList(modelId);
}

// --- LocalStorage Prompt Management ---

function getLocalPrompts(modelId) {
    const allPrompts = JSON.parse(localStorage.getItem('aier_prompts') || '{}');
    return allPrompts[modelId] || [];
}

function saveLocalPrompts(modelId, prompts) {
    const allPrompts = JSON.parse(localStorage.getItem('aier_prompts') || '{}');
    allPrompts[modelId] = prompts;
    localStorage.setItem('aier_prompts', JSON.stringify(allPrompts));
}

function renderPromptsList(modelId) {
    const savedSelect = document.getElementById('saved-prompts-select');
    const prompts = getLocalPrompts(modelId);
    
    savedSelect.innerHTML = '<option value="">-- New Prompt --</option>';
    
    prompts.forEach((p, index) => {
        const option = document.createElement('option');
        option.value = index; 
        option.textContent = p.name;
        savedSelect.appendChild(option);
    });
    
    window.currentModelPrompts = prompts; 
    savedSelect.disabled = false;
}

function loadSelectedPrompt() {
    const select = document.getElementById('saved-prompts-select');
    const index = select.value;
    const deleteBtn = document.getElementById('delete-prompt-btn');
    
    if (index === "") {
        document.getElementById('prompt-save-name').value = "";
        deleteBtn.disabled = true;
        return;
    }

    const promptData = window.currentModelPrompts[index];
    if (!promptData) return;

    document.getElementById('prompt-save-name').value = promptData.name;
    deleteBtn.disabled = false;

    const format = promptData.format || 'text';
    const radios = document.getElementsByName('prompt-format');
    for (let r of radios) {
        if (r.value === format) {
            r.checked = true;
            handleFormatChange({ target: r });
            break;
        }
    }

    if (format === 'text') {
        document.getElementById('prompt-input-text').value = promptData.content;
    } else {
        renderJsonRows(promptData.content);
    }
}

function savePrompt() {
    const modelId = document.getElementById('model-select').value;
    const name = document.getElementById('prompt-save-name').value;
    
    if (!modelId || !name) {
        alert('Please select a model and enter a prompt name.');
        return;
    }

    const content = getPromptContent();
    if (!content) {
        alert('Prompt content is empty.');
        return;
    }

    const prompts = getLocalPrompts(modelId);
    const newPrompt = {
        name,
        content,
        format: currentFormat,
        timestamp: new Date().toISOString()
    };

    const existingIndex = prompts.findIndex(p => p.name === name);
    if (existingIndex >= 0) {
        prompts[existingIndex] = newPrompt;
    } else {
        prompts.push(newPrompt);
    }

    saveLocalPrompts(modelId, prompts);
    alert('Prompt saved to browser!');
    renderPromptsList(modelId);
}

function deletePrompt() {
    const modelId = document.getElementById('model-select').value;
    const name = document.getElementById('prompt-save-name').value;

    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    let prompts = getLocalPrompts(modelId);
    prompts = prompts.filter(p => p.name !== name);
    
    saveLocalPrompts(modelId, prompts);
    document.getElementById('prompt-save-name').value = "";
    renderPromptsList(modelId);
}

// --- Format Handling ---

function handleFormatChange(e) {
    currentFormat = e.target.value;
    const textInput = document.getElementById('prompt-input-text');
    const jsonInput = document.getElementById('prompt-input-json');

    if (currentFormat === 'text') {
        textInput.style.display = 'block';
        jsonInput.style.display = 'none';
    } else {
        textInput.style.display = 'none';
        jsonInput.style.display = 'block';
        if (document.getElementById('json-rows-container').children.length === 0) {
            addJsonRow();
        }
    }
}

function addJsonRow(key = '', value = '') {
    const container = document.getElementById('json-rows-container');
    const row = document.createElement('div');
    row.className = 'json-row';
    
    row.innerHTML = `
        <input type="text" class="json-key" placeholder="Key" value="${key}">
        <input type="text" class="json-value" placeholder="Value" value="${value}">
        <button class="icon-btn danger" onclick="this.parentElement.remove()">×</button>
    `;
    
    container.appendChild(row);
}

function renderJsonRows(contentObj) {
    const container = document.getElementById('json-rows-container');
    container.innerHTML = '';
    
    if (typeof contentObj === 'object' && contentObj !== null) {
        Object.entries(contentObj).forEach(([k, v]) => {
            addJsonRow(k, v);
        });
    } else {
        addJsonRow();
    }
}

function getPromptContent() {
    if (currentFormat === 'text') {
        return document.getElementById('prompt-input-text').value;
    } else {
        const rows = document.querySelectorAll('.json-row');
        const obj = {};
        rows.forEach(row => {
            const key = row.querySelector('.json-key').value.trim();
            const val = row.querySelector('.json-value').value; 
            if (key) {
                obj[key] = val;
            }
        });
        return obj;
    }
}

// --- Generation ---

function updateTimer(startTime) {
    const now = Date.now();
    const elapsed = Math.floor((now - startTime) / 1000);
    const msg = document.getElementById('status-message');
    msg.textContent = `Generating... (${elapsed}s)`;
}

async function generateImage() {
    const accessKey = getAccessKey();
    const model = document.getElementById('model-select').value;
    const statusMsg = document.getElementById('status-message');
    const resultContainer = document.getElementById('result-container');
    const btn = document.getElementById('generate-btn');

    if (!accessKey || !model) {
        statusMsg.textContent = 'Please check Access Key and Model selection.';
        statusMsg.className = 'error';
        return;
    }

    const content = getPromptContent();
    let finalPromptString = '';

    if (currentFormat === 'json') {
        if (Object.keys(content).length === 0) {
            statusMsg.textContent = 'Please add at least one Key-Value pair.';
            statusMsg.className = 'error';
            return;
        }
        finalPromptString = JSON.stringify(content);
    } else {
        finalPromptString = content;
        if (!finalPromptString.trim()) {
            statusMsg.textContent = 'Please enter a prompt.';
            statusMsg.className = 'error';
            return;
        }
    }

    // Reset UI & Start Timer
    const startTime = Date.now();
    statusMsg.textContent = 'Generating... (0s)';
    statusMsg.className = '';
    resultContainer.innerHTML = '';
    btn.disabled = true;
    
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => updateTimer(startTime), 1000);

    try {
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-site-access-key': accessKey
            },
            body: JSON.stringify({ model, prompt: finalPromptString })
        });

        clearInterval(timerInterval);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Server error');
        }

        if (data.type === 'base64') {
            const wrapper = document.createElement('div');
            wrapper.className = 'image-wrapper';

            const img = document.createElement('img');
            img.src = `data:${data.mimeType};base64,${data.data}`;
            
            const downloadBtn = document.createElement('button');
            downloadBtn.innerHTML = '⬇️ Download'; 
            downloadBtn.className = 'download-btn download-overlay';
            downloadBtn.onclick = () => downloadWithMetadata(data.data, finalPromptString, data.mimeType);
            
            wrapper.appendChild(downloadBtn);
            wrapper.appendChild(img);
            resultContainer.appendChild(wrapper);

            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            statusMsg.textContent = `Success! (${duration}s)`;
            statusMsg.className = 'success';
        } else if (data.type === 'text') {
             if (data.data.startsWith('http')) {
                const img = document.createElement('img');
                img.src = data.data;
                resultContainer.appendChild(img);
                statusMsg.textContent = `Success! (${((Date.now() - startTime) / 1000).toFixed(1)}s)`;
                statusMsg.className = 'success';
             } else {
                const p = document.createElement('p');
                p.textContent = data.data;
                resultContainer.appendChild(p);
                statusMsg.textContent = 'Result received';
             }
        }

    } catch (error) {
        clearInterval(timerInterval);
        statusMsg.textContent = `Error: ${error.message}`;
        statusMsg.className = 'error';
    } finally {
        btn.disabled = false;
    }
}

async function downloadWithMetadata(base64Data, prompt, mimeType) {
    try {
        const response = await fetch('/api/download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                imageData: base64Data,
                prompt: prompt,
                mimeType: mimeType
            })
        });

        if (!response.ok) throw new Error('Download failed');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nanobanana-${Date.now()}.${mimeType === 'image/jpeg' ? 'jpg' : 'png'}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (err) {
        console.error(err);
        alert('Failed to download image with metadata.');
    }
}