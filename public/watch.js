document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFile(e.target.files[0]);
        }
    });
});

async function handleFile(file) {
    // Show preview immediately
    const resultArea = document.getElementById('result-area');
    const img = document.getElementById('inspected-img');
    const text = document.getElementById('metadata-text');
    
    img.src = URL.createObjectURL(file);
    resultArea.style.display = 'flex';
    text.textContent = 'Scanning metadata...';

    const formData = new FormData();
    formData.append('image', file);

    try {
        const response = await fetch('/api/inspect', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const data = await response.json();
            text.textContent = data.prompt;
        } else {
            text.textContent = 'Failed to read metadata from server.';
        }
    } catch (err) {
        console.error(err);
        text.textContent = 'Error sending file to server.';
    }
}
