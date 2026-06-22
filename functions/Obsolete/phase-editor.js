// phase-editor.js

class ProjectPhaseEditor extends PostEditor {
  constructor(container) {
    super();
    this.container = container;

    // Instead of global lookups, bind to container's elements
    this.editor = this.container.querySelector('.editor');
    this.preview = this.container.querySelector('.preview');
    this.wordCount = this.container.querySelector('.word-count');
    this.charCount = this.container.querySelector('.char-count');
    this.modeIndicator = this.container.querySelector('.mode-indicator');
    this.imageUpload = this.container.querySelector('.imageUpload') || document.createElement("input");

    this.init();
  }
}

window.ProjectPhaseEditor = ProjectPhaseEditor;
