// Advanced Post Editor JavaScript - scripts.js

class ProjectPostEditor {
    constructor(container, initialContent = "", options = {}) {
        if (!container) throw new Error("ProjectPostEditor needs a container element");
        this.container = container;
        // Optional hook: called with the image URL when the user marks an image
        // as the project's preview image. Lets a parent editor persist it.
        this.onPreviewImageSet = options.onPreviewImageSet || null;
        // Storage location for inline images: <storageFolder>/<storageId>/<file>.
        // Defaults keep old behaviour if a caller doesn't specify them.
        this.storageFolder = options.storageFolder || 'projectImages';
        this.storageId = options.storageId || 'misc';
        this.container.innerHTML = ` ... `;

        this.container.innerHTML = `
        <div class="toolbar">
            <div class="toolbar-group">
                <button class="toolbar-btn" data-action="bold" title="Bold (Ctrl+B)">
                    <strong>B</strong>
                </button>
                <button class="toolbar-btn" data-action="italic" title="Italic (Ctrl+I)">
                    <em>I</em>
                </button>
                <button class="toolbar-btn" data-action="underline" title="Underline (Ctrl+U)">
                    <u>U</u>
                </button>
            </div>
            
            <div class="toolbar-group">
                <select class="font-family" title="Font Family">
                    <option value="Arial">Arial</option>
                    <option value="Georgia">Georgia</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Courier New">Courier New</option>
                    <option value="Helvetica">Helvetica</option>
                </select>
                
                <input type="color" class="color-picker" title="Text Color" value="#000000">
            </div>
            
            <div class="toolbar-group">
                <button class="toolbar-btn" data-action="bulletList" title="Bullet List">
                    • List
                </button>
                <button class="toolbar-btn" data-action="numberedList" title="Numbered List">
                    1. List
                </button>
            </div>
            
            <div class="toolbar-group">
                <button class="toolbar-btn" data-action="link" title="Insert Link">
                    🔗 Link
                </button>
                <button class="toolbar-btn" data-action="image" title="Upload Image">
                    📷 Image
                </button>
            </div>
            
            <div class="toolbar-group">
                <button class="toolbar-btn" data-action="latex" title="Insert LaTeX">
                    ∑ LaTeX
                </button>
            </div>

            
        </div>

        <div class="modal" id="linkModal">
            <div class="modal-content">
                <h3>Insert Link</h3>
                <input type="text" id="linkText" placeholder="Link text">
                <input type="url" id="linkUrl" placeholder="https://example.com">
                <div class="modal-buttons">
                    <button id="insertLink">Insert</button>
                    <button id="cancelLink">Cancel</button>
                </div>
            </div>
        </div>

        <!-- LaTeX Modal -->
        <div class="modal" id="latexModal">
            <div class="modal-content">
                <h3>Insert LaTeX</h3>
                <textarea id="latexInput" placeholder="Enter LaTeX expression (e.g., x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a})"></textarea>
                <div class="latex-preview" id="latexPreview"></div>
                <div class="modal-buttons">
                    <button id="insertLatex">Insert</button>
                    <button id="cancelLatex">Cancel</button>
                </div>
            </div>
        </div>

        <div class="editor" contenteditable="true"></div>
        <div class="preview" style="display:none"></div>
        <div class="stats">

            <span class="mode-indicator"></span>
        </div>
        <input type="file" class="imageUpload" accept="image/*" style="display:none">
        `;

        console.log("editor exists?", this.container.querySelector('.editor'));

        // scoped references
        this.editor = this.container.querySelector('.editor');
        this.preview = this.container.querySelector('.preview');
        this.wordCount = this.container.querySelector('.word-count');
        this.charCount = this.container.querySelector('.char-count');
        this.modeIndicator = this.container.querySelector('.mode-indicator');
        this.imageUpload = this.container.querySelector('.imageUpload');

        this.editor.innerHTML = initialContent;

        this.isMarkdownMode = false;
        this.isPreviewMode = false;
        this.selectedImage = null;
        this.resizing = false;

        this.init();
    }
    init() {
    this.setupToolbar();
    this.setupEditor();
    this.setupImageHandling();
    this.setupModals();
    this.setupKeyboardShortcuts();
    this.setupLatexEditing(); // Add this line
    }
    
    setupToolbar() {
        const toolbar = this.container.querySelector('.toolbar');
        
        toolbar.addEventListener('click', (e) => {
            if (e.target.classList.contains('toolbar-btn')) {
                const action = e.target.dataset.action;
                this.handleToolbarAction(action, e.target);
            }
        });
        
        // Font family change
        const fontFamily = this.container.querySelector('.font-family');
        fontFamily.addEventListener('change', (e) => {
            this.applyStyle('fontFamily', e.target.value);
        });
        
        // Color picker
        const colorPicker = this.container.querySelector('.color-picker');
        colorPicker.addEventListener('change', (e) => {
            this.applyStyle('color', e.target.value);
        });
    }

    toggleToolbarButtons(disabled) {
    const buttons = this.container.querySelectorAll('.toolbar-btn:not([data-action="preview"]):not([data-action="export"])');
    const inputs = this.container.querySelectorAll('.font-family, .color-picker');
    
    buttons.forEach(btn => {
        btn.disabled = disabled;
        btn.style.opacity = disabled ? '0.5' : '1';
        btn.style.pointerEvents = disabled ? 'none' : 'auto';
    });
    
    inputs.forEach(input => {
        input.disabled = disabled;
        input.style.opacity = disabled ? '0.5' : '1';
    });
    }
    
    setupEditor() {
        this.editor.addEventListener('input', () => {
            if (this.isPreviewMode) {
                this.updatePreview();
            }
        });
        
        this.editor.addEventListener('paste', (e) => {
            this.handlePaste(e);
        });
        
        this.editor.addEventListener('click', (e) => {
            if (e.target.classList.contains('editor-image')) {
                this.selectImage(e.target.closest('.image-container'));

                // Add preview option
                if (confirm("Set this image as the preview image?")) {
                    this.previewImage = e.target.src;   // ✅ save the preview image src
                    // Notify the parent editor (project editor) so it can persist it.
                    if (typeof this.onPreviewImageSet === "function") {
                        this.onPreviewImageSet(e.target.src);
                    }
                    this.showNotification("Preview image set!");
                }
            } else if (!e.target.closest('.image-container') && !e.target.closest('.resize-handle')) {
                this.deselectImage();
            }
        });

        
        // Add global click handler to deselect when clicking outside editor
        document.addEventListener('click', (e) => {
            if (!this.editor.contains(e.target) && !e.target.closest('.resize-handle')) {
                this.deselectImage();
            }
        });
    }
    setupImageHandling() {
        this.imageUpload.addEventListener('change', (e) => {
            this.handleImageUpload(e.target.files);
        });
        
        document.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('resize-handle')) {
                this.startResize(e);
            }
        });
        
        document.addEventListener('mousemove', (e) => {
            if (this.resizing) {
                this.doResize(e);
            }
        });
        
        document.addEventListener('mouseup', () => {
            this.endResize();
        });
    }
    
    setupModals() {
        // Link modal
        const linkModal = document.getElementById('linkModal');
        const insertLink = document.getElementById('insertLink');
        const cancelLink = document.getElementById('cancelLink');
        
        insertLink.addEventListener('click', () => {
            const text = document.getElementById('linkText').value;
            const url = document.getElementById('linkUrl').value;
            if (text && url) {
                this.insertLink(text, url);
                this.closeModal('linkModal');
            }
        });
        
        cancelLink.addEventListener('click', () => {
            this.closeModal('linkModal');
        });
        
        // LaTeX modal
        const latexModal = document.getElementById('latexModal');
        const latexInput = document.getElementById('latexInput');
        const latexPreview = document.getElementById('latexPreview');
        const insertLatex = document.getElementById('insertLatex');
        const cancelLatex = document.getElementById('cancelLatex');
        
        latexInput.addEventListener('input', () => {
            this.previewLatex(latexInput.value, latexPreview);
        });
        
        insertLatex.addEventListener('click', () => {
            const latex = latexInput.value;
            if (latex) {
                this.insertLatex(latex);
                this.closeModal('latexModal');
            }
        });
        
        cancelLatex.addEventListener('click', () => {
            this.closeModal('latexModal');
        });
        
        // Close modals when clicking outside
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });
    }
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'b':
                        e.preventDefault();
                        this.handleToolbarAction('bold');
                        break;
                    case 'i':
                        e.preventDefault();
                        this.handleToolbarAction('italic');
                        break;
                    case 'u':
                        e.preventDefault();
                        this.handleToolbarAction('underline');
                        break;
                    case 'k':
                        e.preventDefault();
                        this.openModal('linkModal');
                        break;
                    case 'p':
                        e.preventDefault();
                        this.handleToolbarAction('preview');
                        break;
                }
            }
        });
    }
    
    handleToolbarAction(action, button = null) {
        switch (action) {
            case 'bold':
                this.applyFormatting('bold');
                break;
            case 'italic':
                this.applyFormatting('italic');
                break;
            case 'underline':
                this.applyFormatting('underline');
                break;
            case 'bulletList':
                this.createList('ul');
                break;
            case 'numberedList':
                this.createList('ol');
                break;
            case 'link':
                this.saveSelection(); // Save selection before opening modal
                this.openModal('linkModal');
                break;
            case 'image':
                this.imageUpload.click();
                break;
            case 'markdown':
                this.toggleMarkdown(button);
                break;
            case 'preview':
                this.togglePreview(button);
                break;
            case 'export':
                this.exportContent();
                break;
            case 'latex':
                this.saveSelection(); // Add this line
                this.openModal('latexModal');
                break;
        }
    }
    
    applyFormatting(command) {
        document.execCommand(command, false, null);
        this.editor.focus();
    }
    
    applyStyle(property, value) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const span = document.createElement('span');
            span.style[property] = value;
            
            try {
                range.surroundContents(span);
            } catch (e) {
                // If we can't surround, apply to the whole selection
                document.execCommand('styleWithCSS', false, true);
                document.execCommand(property, false, value);
            }
        }
        this.editor.focus();
    }
    
    createList(listType) {
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        
        const list = document.createElement(listType);
        const listItem = document.createElement('li');
        
        if (selection.toString()) {
            listItem.textContent = selection.toString();
            range.deleteContents();
        } else {
            listItem.innerHTML = '&nbsp;';
        }
        
        list.appendChild(listItem);
        range.insertNode(list);
        
        // Position cursor in the list item
        const newRange = document.createRange();
        newRange.setStart(listItem, 0);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
        
        this.editor.focus();
    }
    // Add this method to save selection before opening modal
    saveSelection() {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            this.savedRange = selection.getRangeAt(0).cloneRange();
        }
    }

    // Add this method to restore selection and insert node
    restoreSelectionAndInsert(node) {
        this.editor.focus();
        
        const selection = window.getSelection();
        let range;
        
        if (this.savedRange) {
            // Restore the saved range
            range = this.savedRange;
            selection.removeAllRanges();
            selection.addRange(range);
        } else if (selection.rangeCount > 0) {
            range = selection.getRangeAt(0);
        } else {
            // No selection, create one at the end of the editor
            range = document.createRange();
            range.selectNodeContents(this.editor);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
        }
        
        range.deleteContents();
        range.insertNode(node);
        range.setStartAfter(node);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        
        // Clear saved range
        this.savedRange = null;
    }

    async handlePaste(e) {
        const clipboardData = e.clipboardData || window.clipboardData;
        
        // Handle image paste
        const items = Array.from(clipboardData.items);
        const imageItem = items.find(item => item.type.startsWith('image/'));
        
        if (imageItem) {
            e.preventDefault();
            const file = imageItem.getAsFile();
            await this.insertImage(file);
            return;
        }
        
        // Handle text paste in markdown mode
        if (this.isMarkdownMode) {
            e.preventDefault();
            const text = clipboardData.getData('text/plain');
            this.insertTextAtCursor(text);
        }
    }
    
    async handleImageUpload(files) {
        for (const file of files) {
            if (file.type.startsWith('image/')) {
                await this.insertImage(file);
            }
        }
    }
    
    async insertImage(file) {
        // Build the image + container up front so we can show it while uploading.
        const img = document.createElement('img');
        img.className = 'editor-image';
        img.style.maxWidth = '100%';
        img.style.height = 'auto';

        const container = document.createElement('div');
        container.className = 'image-container';
        container.appendChild(img);

        // Add resize handles
        const handles = document.createElement('div');
        handles.className = 'resize-handles';
        handles.innerHTML = `
            <div class="resize-handle nw"></div>
            <div class="resize-handle ne"></div>
            <div class="resize-handle sw"></div>
            <div class="resize-handle se"></div>
        `;
        container.appendChild(handles);

        // Show a temporary local preview while the upload runs.
        const localPreview = URL.createObjectURL(file);
        img.src = localPreview;
        img.setAttribute('data-uploading', 'true');
        img.style.opacity = '0.6';

        // Insert at cursor position immediately.
        this.insertNodeAtCursor(container);
        this.selectImage(container);

        // Upload the ORIGINAL file to Firebase Storage (not base64 in the DB),
        // then swap the <img> src for the hosted download URL.
        try {
            const { getStorage, ref, uploadBytes, getDownloadURL } = await import(
                "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js"
            );
            const storage = getStorage(window.firebaseApp);
            const ext = ((file.type.split('/')[1]) || 'png').replace('jpeg', 'jpg');
            // Each project keeps its images in its own folder: projectImages/<projectId>/
            const path = `${this.storageFolder}/${this.storageId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
            const imageRef = ref(storage, path);

            await uploadBytes(imageRef, file, { contentType: file.type || 'image/png' });
            const url = await getDownloadURL(imageRef);

            img.src = url;                       // hosted URL replaces the local blob
            img.removeAttribute('data-uploading');
            img.style.opacity = '';
        } catch (err) {
            console.error("Image upload failed:", err);
            alert("Image upload failed: " + (err.code || err.message || err));
            container.remove();                  // don't leave a broken/blob image behind
        } finally {
            URL.revokeObjectURL(localPreview);
        }
    }
    
    selectImage(container) {
    this.deselectImage();
    this.selectedImage = container;
    container.classList.add('selected');
    
    // Show resize handles
    const handles = container.querySelector('.resize-handles');
    if (handles) {
        handles.style.display = 'block';
    }
    }
    deselectImage() {
    if (this.selectedImage) {
        this.selectedImage.classList.remove('selected');
        
        // Hide resize handles by setting display to none
        const handles = this.selectedImage.querySelector('.resize-handles');
        if (handles) {
            handles.style.display = 'none';
        }
        
        this.selectedImage = null;
    }
    }
    
    startResize(e) {
        if (!this.selectedImage) return;
        
        this.resizing = {
            element: this.selectedImage.querySelector('img'),
            handle: e.target.className.split(' ')[1],
            startX: e.clientX,
            startY: e.clientY,
            startWidth: this.selectedImage.querySelector('img').clientWidth,
            startHeight: this.selectedImage.querySelector('img').clientHeight
        };
        
        e.preventDefault();
    }
    
    doResize(e) {
        if (!this.resizing) return;
        
        const deltaX = e.clientX - this.resizing.startX;
        const deltaY = e.clientY - this.resizing.startY;
        
        let newWidth = this.resizing.startWidth;
        let newHeight = this.resizing.startHeight;
        
        // Calculate new dimensions based on handle
        switch (this.resizing.handle) {
            case 'nw':
                newWidth = this.resizing.startWidth - deltaX;
                break;
            case 'ne':
            case 'se':
                newWidth = this.resizing.startWidth + deltaX;
                break;
            case 'sw':
                newWidth = this.resizing.startWidth - deltaX;
                break;
        }
        
        // Maintain aspect ratio
        const aspectRatio = this.resizing.startWidth / this.resizing.startHeight;
        newHeight = newWidth / aspectRatio;
        
        // Apply constraints
        newWidth = Math.max(50, Math.min(newWidth, this.editor.clientWidth - 40));
        newHeight = newWidth / aspectRatio;
        
        this.resizing.element.style.width = newWidth + 'px';
        this.resizing.element.style.height = newHeight + 'px';
    }
    
    endResize() {
        this.resizing = false;
    }
    
    insertTextAtCursor(text) {
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(text));
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    }
    
    insertNodeAtCursor(node) {
    const selection = window.getSelection();
    let range;
    
    if (selection.rangeCount > 0) {
        range = selection.getRangeAt(0);
    } else {
        // No selection, create one at the end of the editor
        range = document.createRange();
        range.selectNodeContents(this.editor);
        range.collapse(false);
    }
    
    range.deleteContents();
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    
    // Focus the editor
    this.editor.focus();
    }
    
    insertLink(text, url) {
    const link = document.createElement('a');
    link.href = url;
    link.textContent = text;
    link.target = '_blank';
    
    // Use the same selection restoration as LaTeX
    this.restoreSelectionAndInsert(link);
    
    // Clear the form
    document.getElementById('linkText').value = '';
    document.getElementById('linkUrl').value = '';
    }
    setupLatexEditing() {
    // Use event delegation to handle clicks on LaTeX containers
    this.editor.addEventListener('click', (e) => {
        if (e.target.closest('.latex-container')) {
            const container = e.target.closest('.latex-container');
            this.editLatex(container);
            e.stopPropagation(); // Prevent other click handlers
        }
    });
    }

    editLatex(container) {
    const currentLatex = container.getAttribute('data-latex');
    
    // Pre-fill the modal with current LaTeX
    document.getElementById('latexInput').value = currentLatex;
    this.previewLatex(currentLatex, document.getElementById('latexPreview'));
    
    // Store reference to the container being edited
    this.editingLatexContainer = container;
    
    // Open the modal
    this.openModal('latexModal');
    }

    insertLatex(latex) {
    try {
        if (this.editingLatexContainer) {
            // We're editing an existing LaTeX container
            this.editingLatexContainer.setAttribute('data-latex', latex);
            
            // Re-render the LaTeX in place
            katex.render(latex, this.editingLatexContainer, {
                throwOnError: false,
                displayMode: latex.includes('\\begin') || latex.includes('\\displaystyle')
            });
            
            // Clear the editing reference
            this.editingLatexContainer = null;
        } else {
            // Creating new LaTeX container
            const container = document.createElement('span');
            container.className = 'latex-container';
            container.setAttribute('data-latex', latex);
            container.contentEditable = false;
            
            // Render the LaTeX
            katex.render(latex, container, {
                throwOnError: false,
                displayMode: latex.includes('\\begin') || latex.includes('\\displaystyle')
            });
            
            // Use the restored selection method
            this.restoreSelectionAndInsert(container);
        }
        
        // Clear the form
        document.getElementById('latexInput').value = '';
        document.getElementById('latexPreview').innerHTML = '';
        
        console.log('LaTeX processed:', latex);
    } catch (error) {
        console.error('LaTeX processing error:', error);
        alert('Error rendering LaTeX: ' + error.message);
    }
    }
    
    previewLatex(latex, previewElement) {
        if (!latex.trim()) {
            previewElement.innerHTML = '';
            return;
        }
        
        try {
            katex.render(latex, previewElement, {
                throwOnError: false,
                displayMode: latex.includes('\\begin') || latex.includes('\\displaystyle')
            });
        } catch (error) {
            previewElement.innerHTML = '<span style="color: red;">Error: ' + error.message + '</span>';
        }
    }
    
    toggleMarkdown(button) {
    this.isMarkdownMode = !this.isMarkdownMode;
    
    if (this.isMarkdownMode) {
        button.classList.add('active');
        this.modeIndicator.textContent = 'Markdown Mode';
        this.editor.setAttribute('placeholder', 'Write in Markdown... # Heading, **bold**, *italic*, [link](url)');
        
        // Don't convert content - just change the mode indicator
        // Content stays exactly as is
    } else {
        button.classList.remove('active');
        this.modeIndicator.textContent = 'Rich Text Mode';
        this.editor.setAttribute('placeholder', 'Start writing... You can paste images directly with Ctrl+V!');
        
        // Don't convert content - just change the mode indicator  
        // Content stays exactly as is
    }
    }

    togglePreview(button) {
    this.isPreviewMode = !this.isPreviewMode;
    
    if (this.isPreviewMode) {
        button.classList.add('active');
        this.updatePreview();
        this.editor.style.display = 'none';
        this.preview.style.display = 'block';
        this.modeIndicator.textContent = 'Preview Mode';
        this.toggleToolbarButtons(true); // Disable buttons
    } else {
        button.classList.remove('active');
        this.editor.style.display = 'block';
        this.preview.style.display = 'none';
        this.modeIndicator.textContent = this.isMarkdownMode ? 'Markdown Mode' : 'Rich Text Mode';
        this.toggleToolbarButtons(false); // Enable buttons
    }
    }
    
    updatePreview() {
    let content = this.editor.innerHTML;
    
    if (this.isMarkdownMode) {
        // Get the raw text content (preserving line breaks)
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        
        // Preserve line breaks by converting <br> and <div> to newlines
        tempDiv.innerHTML = tempDiv.innerHTML.replace(/<br\s*\/?>/gi, '\n');
        tempDiv.innerHTML = tempDiv.innerHTML.replace(/<\/div><div>/gi, '\n');
        tempDiv.innerHTML = tempDiv.innerHTML.replace(/<div>/gi, '\n');
        tempDiv.innerHTML = tempDiv.innerHTML.replace(/<\/div>/gi, '');
        
        const textContent = tempDiv.textContent || tempDiv.innerText || '';
        
        // Only render markdown in preview, don't modify original content
        content = marked.parse(textContent);
    }
    
    // Process LaTeX in preview
    content = this.processLatexInPreview(content);
    
    this.preview.innerHTML = content;
    }
    
    processLatexInPreview(html) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // Find all LaTeX containers
        const latexContainers = tempDiv.querySelectorAll('.latex-container');
        latexContainers.forEach(container => {
            const latex = container.getAttribute('data-latex');
            if (latex) {
                try {
                    katex.render(latex, container, {
                        throwOnError: false,
                        displayMode: latex.includes('\\begin') || latex.includes('\\displaystyle')
                    });
                } catch (error) {
                    container.innerHTML = '<span style="color: red;">LaTeX Error</span>';
                }
            }
        });
        
        return tempDiv.innerHTML;
    }
    
    updateStats() {
        const text = this.editor.textContent || this.editor.innerText || '';
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        const chars = text.length;
        
        this.wordCount.textContent = `Words: ${words}`;
        this.charCount.textContent = `Characters: ${chars}`;
    }
    
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.style.display = 'block';
        
        // Focus first input
        const firstInput = modal.querySelector('input, textarea');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 100);
        }
    }
    
    closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.style.display = 'none';
    
    // Clear form fields
    const inputs = modal.querySelectorAll('input, textarea');
    inputs.forEach(input => input.value = '');
    
    // Clear preview
    const preview = modal.querySelector('.latex-preview');
    if (preview) preview.innerHTML = '';
    
    // Clear editing reference
    if (modalId === 'latexModal') {
        this.editingLatexContainer = null;
    }
    }
    
    exportContent() {
        const content = this.getContentForExport();
        const blob = new Blob([content.html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'post-content.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Also copy to clipboard if possible
        if (navigator.clipboard) {
            navigator.clipboard.writeText(content.text).then(() => {
                this.showNotification('Content copied to clipboard and downloaded!');
            }).catch(() => {
                this.showNotification('Content downloaded!');
            });
        } else {
            this.showNotification('Content downloaded!');
        }
    }
    
    getContentForExport() {
        let html = this.editor.innerHTML;
        let text = this.editor.textContent || this.editor.innerText || '';
        
        // If in markdown mode, also provide markdown
        if (this.isMarkdownMode) {
            const markdown = this.convertHtmlToMarkdown(html);
            return {
                html: html,
                text: text,
                markdown: markdown
            };
        }
        
        return {
            html: html,
            text: text
        };
    }
    
    convertHtmlToMarkdown(html) {
        // Basic HTML to Markdown conversion
        let markdown = html;
        
        // Convert common elements
        markdown = markdown.replace(/<strong>(.*?)<\/strong>/g, '**$1**');
        markdown = markdown.replace(/<b>(.*?)<\/b>/g, '**$1**');
        markdown = markdown.replace(/<em>(.*?)<\/em>/g, '*$1*');
        markdown = markdown.replace(/<i>(.*?)<\/i>/g, '*$1*');
        markdown = markdown.replace(/<u>(.*?)<\/u>/g, '_$1_');
        markdown = markdown.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/g, '[$2]($1)');
        markdown = markdown.replace(/<h([1-6])>(.*?)<\/h[1-6]>/g, (match, level, text) => {
            return '#'.repeat(parseInt(level)) + ' ' + text;
        });
        
        // Convert lists
        markdown = markdown.replace(/<ul>(.*?)<\/ul>/gs, (match, content) => {
            return content.replace(/<li>(.*?)<\/li>/g, '- $1\n');
        });
        markdown = markdown.replace(/<ol>(.*?)<\/ol>/gs, (match, content) => {
            let counter = 1;
            return content.replace(/<li>(.*?)<\/li>/g, () => `${counter++}. $1\n`);
        });
        
        // Remove remaining HTML tags
        markdown = markdown.replace(/<[^>]*>/g, '');
        
        // Clean up
        markdown = markdown.replace(/\n\s*\n/g, '\n\n');
        markdown = markdown.trim();
        
        return markdown;
    }
    
    showNotification(message) {
        // Create a simple notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #007bff;
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            z-index: 10000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            animation: slideInRight 0.3s ease;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
    
    // Utility method to save content to localStorage
    saveToLocalStorage() {
        const content = {
            html: this.editor.innerHTML,
            isMarkdownMode: this.isMarkdownMode,
            timestamp: new Date().toISOString()
        };
        
        try {
            localStorage.setItem('postEditorContent', JSON.stringify(content));
        } catch (error) {
            console.warn('Could not save to localStorage:', error);
        }
    }
    
    // Utility method to load content from localStorage
    loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem('postEditorContent');
            if (saved) {
                const content = JSON.parse(saved);
                this.editor.innerHTML = content.html;
                
                if (content.isMarkdownMode) {
                    const markdownBtn = this.container.querySelector('[data-action="markdown"]');
                    this.toggleMarkdown(markdownBtn);
                }
                
                return true;
            }
        } catch (error) {
            console.warn('Could not load from localStorage:', error);
        }
        return false;
    }
    
    // Auto-save functionality
    setupAutoSave() {
        let saveTimeout;
        
        this.editor.addEventListener('input', () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                this.saveToLocalStorage();
            }, 2000); // Save after 2 seconds of inactivity
        });

        
    }

    onChange(callback) {
  if (!this.editor) return;
    this.editor.addEventListener("input", () => {
        callback({
            html: this.editor.innerHTML,
            text: this.editor.textContent,
            wordCount: this.wordCount?.textContent,
            charCount: this.charCount?.textContent
        });
    });
}

}

// Yeah
// Add this code to your j-posting.js file after the PostEditor class definition

// Firebase integration for saving posts
class PostFirebaseIntegration {
    constructor(editor) {
        this.editor = editor;
        this.postId = null; // For editing existing posts
        this.setupSaveButton();
        this.checkForEditMode();
    }
    
    setupSaveButton() {
        // Add save button to toolbar
        const toolbar = this.container.querySelector('.toolbar');
        if (!toolbar) return;
        
        // Create save button group
        const saveGroup = document.createElement('div');
        saveGroup.className = 'toolbar-group';
        saveGroup.innerHTML = `
            <button class="toolbar-btn save-post-btn" title="Save Post">
                💾 Save Post
            </button>
            <button class="toolbar-btn publish-post-btn" title="Publish Post">
                📤 Publish
            </button>
        `;
        
        
        // Insert before the last toolbar group (export/preview group)
        const lastGroup = toolbar.lastElementChild;
        toolbar.insertBefore(saveGroup, lastGroup);
        
        // Add event listeners
        saveGroup.querySelector('.save-post-btn').addEventListener('click', () => this.savePost(false));
        saveGroup.querySelector('.publish-post-btn').addEventListener('click', () => this.savePost(true));
        
        // Add post metadata form before editor
        this.addMetadataForm();
    }
    
    addMetadataForm() {
        const editorContainer = document.querySelector('.editor-container');
        const metadataForm = document.createElement('div');
        metadataForm.className = 'post-metadata';
        metadataForm.innerHTML = `
            <style>
                .post-metadata {
                    padding: 20px;
                    background: #f8f9fa;
                    border-bottom: 2px solid #dee2e6;
                }
                .metadata-group {
                    margin-bottom: 15px;
                }
                .metadata-group label {
                    display: block;
                    margin-bottom: 5px;
                    font-weight: 600;
                    font-size: 14px;
                    color: #333;
                }
                .metadata-group input, .metadata-group textarea {
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    font-size: 14px;
                    font-family: inherit;
                }
                .metadata-group textarea {
                    resize: vertical;
                    min-height: 60px;
                }
                .tags-input-container {
                    display: flex;
                    gap: 10px;
                    align-items: center;
                }
                .tags-display {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-top: 10px;
                }
                .tag-item {
                    background: #022d33;
                    color: white;
                    padding: 4px 10px;
                    border-radius: 15px;
                    font-size: 12px;
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                }
                .tag-remove {
                    cursor: pointer;
                    font-weight: bold;
                }
                .featured-checkbox {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .save-status {
                    padding: 10px;
                    margin-top: 10px;
                    border-radius: 4px;
                    display: none;
                }
                .save-status.success {
                    background: #d4edda;
                    color: #155724;
                    border: 1px solid #c3e6cb;
                }
                .save-status.error {
                    background: #f8d7da;
                    color: #721c24;
                    border: 1px solid #f5c6cb;
                }
            </style>
            
            <div class="metadata-group">
                <label for="post-title">Post Title *</label>
                <input type="text" id="post-title" placeholder="Enter your post title..." required>
            </div>
            
            <div class="metadata-group">
                <label for="post-excerpt">Excerpt (Brief description)</label>
                <textarea id="post-excerpt" placeholder="Write a brief summary of your post..."></textarea>
            </div>
            
            <div class="metadata-group">
                <label for="post-tags">Tags</label>
                <div class="tags-input-container">
                    <input type="text" id="post-tags" placeholder="Add tags (press Enter)">
                    <button type="button" onclick="postIntegration.addTag()">Add Tag</button>
                </div>
                <div class="tags-display" id="tags-display"></div>
            </div>
            
            <div class="metadata-group">
                <label class="featured-checkbox">
                    <input type="checkbox" id="post-featured">
                    <span>Mark as Featured Post</span>
                </label>
            </div>
            
            <div class="save-status" id="save-status"></div>
        `;
        
        // Insert at the beginning of editor container
        editorContainer.insertBefore(metadataForm, editorContainer.firstChild);
        
        // Setup tag input
        document.getElementById('post-tags').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.addTag();
            }
        });
        
        this.tags = [];
    }
    
    addTag() {
        const input = document.getElementById('post-tags');
        const tag = input.value.trim();
        
        if (tag && !this.tags.includes(tag)) {
            this.tags.push(tag);
            this.updateTagsDisplay();
            input.value = '';
        }
    }
    
    removeTag(tag) {
        this.tags = this.tags.filter(t => t !== tag);
        this.updateTagsDisplay();
    }
    
    updateTagsDisplay() {
        const display = document.getElementById('tags-display');
        display.innerHTML = this.tags.map(tag => `
            <span class="tag-item">
                ${tag}
                <span class="tag-remove" onclick="postIntegration.removeTag('${tag}')">×</span>
            </span>
        `).join('');
    }
    
    async savePost(publish = false) {
        // Check if user is authenticated
        if (!window.firebaseAuth || !window.firebaseAuth.currentUser) {
            this.showStatus('You must be logged in to save posts.', 'error');

            return;
        }
        
        // Get metadata
        let  title = document.getElementById('post-title').value.trim();
        const excerpt = document.getElementById('post-excerpt').value.trim();
        const featured = document.getElementById('post-featured').checked;
        
        if (!title) {
            title = "No Title";
        }
        
        // Get content from editor
        const content = this.editor.editor.innerHTML;
        let plainText = this.editor.editor.textContent || this.editor.editor.innerText || '';
        
        if (!plainText.trim()) {
            plainText = "No Text"
            return;
        }
        
        // Build display name from Firestore user profile
        let displayName = window.firebaseAuth.currentUser.email; // fallback
        try {
            const db = window.firestoreDb;
            const userRef = window.fsDoc(db, "users", window.firebaseAuth.currentUser.uid);
            const userSnap = await window.fsGetDoc(userRef);

            if (userSnap.exists()) {
                const userData = userSnap.data();
                const firstName = userData.firstName || "";
                const middleInitial = userData.middleInitial || "";
                const lastName = userData.lastName || "";

                if (firstName && lastName) {
                    displayName = middleInitial
                        ? `${firstName} ${middleInitial}. ${lastName}`
                        : `${firstName} ${lastName}`;
                }
            }
        } catch (err) {
            console.warn("Could not fetch display name, falling back to email:", err);
        }

        let previewImageUrl = null;
        if (this.previewImage && this.previewImage.startsWith("data:")) {
            try {
                const { getStorage, ref, uploadString, getDownloadURL } = await import(
                    "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js"
                );
                const storage = getStorage(window.firebaseApp);

                const imageRef = ref(storage, `previewImages/${Date.now()}_${window.firebaseAuth.currentUser.uid}.png`);
                await uploadString(imageRef, this.previewImage, "data_url");
                previewImageUrl = await getDownloadURL(imageRef);
            } catch (err) {
                console.error("Error uploading preview image:", err);
                this.showStatus("Failed to upload preview image.", "error");
            }
        }

        // Prepare post data
        // Prepare base post data
        const postData = {
            title,
            content,
            plainText,
            excerpt: excerpt || plainText.substring(0, 200) + "...",
            tags: this.tags,
            featured,
            author: displayName,
            authorId: window.firebaseAuth.currentUser.uid,
            wordCount: plainText.trim().split(/\s+/).length,
            lastModified: new Date(),
            previewImage: previewImageUrl || this.editor.previewImage || null,
            confirmed: false,
            published: publish || false, // if `publish` is true (from your button), set it; else false
        };



        // Add createdAt only if this is a NEW post
        if (!this.postId) {
            postData.createdAt = new Date();
        }


        
        try {
            // Show saving status
            this.showStatus('Saving post...', 'info');
            
            // Import Firestore functions
            const auth = window.firebaseAuth;
            const db = window.firestoreDb;

            
            let savedPostId;
            
            if (this.postId) {
                // Update existing post
                const postRef = window.fsDoc(db, 'posts', this.postId);
                await window.fsUpdateDoc(postRef, postData);

                savedPostId = this.postId;
            } else {
                // Create new post
                const postsRef = window.fsCollection(db, 'posts');
                const docRef = await window.fsAddDoc(postsRef, postData);
                savedPostId = docRef.id;
                this.postId = savedPostId; // Save for future updates
            }
            
            // Update user's post count if this is a new published post
            if (publish && !this.postId) {
                await this.updateUserPostCount();
            }
            
            const statusMessage = publish 
                ? 'Post published successfully!' 
                : 'Post saved as draft!';
            
            this.showStatus(statusMessage, 'success');

        } catch (error) {
            console.error('Error saving post:', error);
            this.showStatus('Error saving post. Please try again.', 'error');
        }
        
    }
    
    async updateUserPostCount() {
        try {
            const { getFirestore, doc, updateDoc, increment } = await import(
                'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'
            );
            
            const db = getFirestore(window.firebaseApp);
            const userId = window.firebaseAuth.currentUser.uid;
            const userRef = doc(db, 'users', userId);
            
            await updateDoc(userRef, {
                posts: increment(1)
            });
        } catch (error) {
            console.error('Error updating post count:', error);
        }
    }
    
    checkForEditMode() {
        // Check if we're editing an existing post (via URL parameter)
        const urlParams = new URLSearchParams(window.location.search);
        const postId = urlParams.get('edit');
        
        if (postId) {
            this.loadPostForEditing(postId);
        }
    }
    
    async loadPostForEditing(postId) {
    try {
        const db = window.firestoreDb; // ✅ use the shared Firestore instance
        const postRef = window.fsDoc(db, "posts", postId); // ✅ use global doc()
        const postSnap = await window.fsGetDoc(postRef);

        if (postSnap.exists()) {
            const post = postSnap.data();

            // Populate fields
            document.getElementById('post-title').value = post.title || '';
            document.getElementById('post-excerpt').value = post.excerpt || '';
            document.getElementById('post-featured').checked = post.featured || false;

            // Tags
            this.tags = post.tags || [];
            this.updateTagsDisplay();

            // Content
            this.editor.editor.innerHTML = post.content || '';

            this.postId = postId;
            this.showStatus("Post loaded for editing.", "success");
        } else {
            this.showStatus("Post not found.", "error");
        }
    } catch (err) {
        console.error("Error loading post:", err);
        this.showStatus("Error loading post.", "error");
    }
    }

    
    showStatus(message, type) {
        const statusDiv = document.getElementById('save-status');
        statusDiv.textContent = message;
        statusDiv.className = `save-status ${type}`;
        statusDiv.style.display = 'block';
        
        if (type !== 'info') {
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 5000);
        }
    }
}
