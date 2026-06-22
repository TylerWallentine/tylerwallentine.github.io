// project-editor.js

// Each ProjectPhaseEditor manages one phase in a project
class ProjectPhaseEditor {
  constructor(container, projectId, phaseId = null, data = {}) {
    this.container = container;  // wrapper div
    this.projectId = projectId;
    this.phaseId = phaseId;      // null if new phase
    this.data = data;

    this.render();
    this.initEditor();
  }

  render() {
    this.container.innerHTML = `
      <div class="phase-block">
        <input type="text" class="phase-title" placeholder="Phase Title" value="${this.data.title || ''}">
        <div class="phase-editor" id="phase-editor-${this.phaseId || Date.now()}"></div>
        <button class="save-phase-btn">💾 Save Phase</button>
      </div>
    `;
  }

  initEditor() {
    const editorEl = this.container.querySelector(".phase-editor");
    this.editor = new PostEditor();   // ✅ reuses your editor.js class
    this.editor.editor = editorEl;
    editorEl.contentEditable = "true";

    if (this.data.content) {
      editorEl.innerHTML = this.data.content;
    }

    const saveBtn = this.container.querySelector(".save-phase-btn");
    saveBtn.addEventListener("click", () => this.savePhase());
  }

  async savePhase() {
    const title = this.container.querySelector(".phase-title").value.trim();
    const content = this.editor.editor.innerHTML;

    const db = window.firestoreDb;
    const phasesRef = window.fsCollection(db, "projects", this.projectId, "phases");

    if (this.phaseId) {
      // Update existing
      const phaseRef = window.fsDoc(phasesRef, this.phaseId);
      await window.fsUpdateDoc(phaseRef, {
        title,
        content,
        updatedAt: new Date()
      });
      console.log("Updated phase:", this.phaseId);
    } else {
      // New phase
      const docRef = await window.fsAddDoc(phasesRef, {
        title,
        content,
        createdAt: new Date()
      });
      this.phaseId = docRef.id;
      console.log("Created new phase:", this.phaseId);
    }
  }
}


document.addEventListener("DOMContentLoaded", () => {
  const addPhaseBtn = document.getElementById("add-phase-btn");
  const phasesContainer = document.getElementById("phases-container");

  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get("id");

  if (!projectId) {
    console.error("No projectId provided in URL (e.g. ?id=abc123)");
    return;
  }

  addPhaseBtn.addEventListener("click", () => {
    const phaseBlock = document.createElement("div");
    phaseBlock.classList.add("phase-block");
    phaseBlock.innerHTML = `
      <h3>New Phase</h3>
      <input type="text" placeholder="Phase Title" class="phase-title">

      <div class="editor-container">
        <div class="toolbar">
          <button class="toolbar-btn" data-action="bold"><b>B</b></button>
          <button class="toolbar-btn" data-action="italic"><i>I</i></button>
          <button class="toolbar-btn" data-action="underline"><u>U</u></button>
        </div>
        <div class="editor" contenteditable="true"></div>
        <div class="preview" style="display:none"></div>
        <div class="stats">
          <span class="word-count">Words: 0</span>
          <span class="char-count">Characters: 0</span>
          <span class="mode-indicator">Rich Text Mode</span>
        </div>
      </div>

      <button class="save-phase-btn">Save Phase</button>
    `;

    phasesContainer.appendChild(phaseBlock);

    // Use ProjectPhaseEditor instead of PostEditor
    const editorContainer = phaseBlock.querySelector(".editor-container");
    const editor = new ProjectPhaseEditor(editorContainer);

    const saveBtn = phaseBlock.querySelector(".save-phase-btn");
    saveBtn.addEventListener("click", async () => {
      const title = phaseBlock.querySelector(".phase-title").value.trim();
      const content = editor.editor.innerHTML;

      if (!title) {
        alert("Phase title required");
        return;
      }

      try {
        const db = window.firestoreDb;
        const phasesRef = window.fsCollection(db, "projects", projectId, "phases");
        await window.fsAddDoc(phasesRef, {
          title,
          content,
          createdAt: new Date()
        });

        alert("Phase saved!");
      } catch (err) {
        console.error("Error saving phase:", err);
        alert("Failed to save phase.");
      }
    });
  });
});
