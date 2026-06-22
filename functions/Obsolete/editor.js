class PostEditor {
  constructor(container) {
    this.container = container;

    // Query INSIDE the container, not the whole document
    this.editor = container.querySelector('.editor');
    this.preview = container.querySelector('.preview');
    this.wordCount = container.querySelector('.word-count');
    this.charCount = container.querySelector('.char-count');
    this.modeIndicator = container.querySelector('.mode-indicator');
    this.imageUpload = container.querySelector('.imageUpload');

    this.isMarkdownMode = false;
    this.isPreviewMode = false;
    this.selectedImage = null;
    this.resizing = false;

    this.init();
  }

  init() {
    if (this.container.querySelector('.toolbar')) this.setupToolbar();
    if (this.editor) this.setupEditor();
    if (this.imageUpload) this.setupImageHandling();
    this.setupKeyboardShortcuts();
    this.updateStats();
  }

  setupToolbar() {
    const toolbar = this.container.querySelector('.toolbar');
    if (!toolbar) return;

    toolbar.addEventListener('click', (e) => {
      if (e.target.classList.contains('toolbar-btn')) {
        const action = e.target.dataset.action;
        this.handleToolbarAction(action, e.target);
      }
    });
  }

  setupEditor() {
    this.editor.addEventListener('input', () => {
      this.updateStats();
      if (this.isPreviewMode) this.updatePreview();
    });

    this.editor.addEventListener('paste', (e) => this.handlePaste(e));
  }

  updateStats() {
    if (!this.wordCount || !this.charCount) return;
    const text = this.editor.textContent || '';
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;

    this.wordCount.textContent = `Words: ${words}`;
    this.charCount.textContent = `Characters: ${chars}`;
  }

  updatePreview() {
    if (!this.preview || !this.editor) return;
    this.preview.innerHTML = this.editor.innerHTML;
  }

  handleToolbarAction(action) {
    if (!this.editor) return;
    switch (action) {
      case 'bold': document.execCommand('bold'); break;
      case 'italic': document.execCommand('italic'); break;
      case 'underline': document.execCommand('underline'); break;
    }
    this.editor.focus();
  }
}

window.PostEditor = PostEditor;
