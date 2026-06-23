class ProjectEditor {
  constructor(projectId) {
    this.projectId = projectId;
    this.db = window.firestoreDb;
    this.projectRef = window.fsDoc(this.db, "projects", this.projectId);
    this.phasesRef = window.fsCollection(this.projectRef, "phases");

    this.titleInput = document.getElementById("project-title");
    this.excerptInput = document.getElementById("project-excerpt");
    this.tagsInput = document.getElementById("project-tags");
    this.featuredCheckbox = document.getElementById("project-featured");
    this.saveStatus = document.getElementById("save-status");
    this.phasesContainer = document.getElementById("phases-container");
    this.addPhaseBtn = document.getElementById("add-phase-btn");

    this.tags = [];
    this.init();
  }

async init() {
  // 🧹 Check for unfinished draft deletion request
  const draftId = localStorage.getItem("deleteDraft");
  if (draftId && draftId === this.projectId) {
    console.log("🗑️ Cleaning up unfinished draft:", draftId);
    try {
      await window.fsDeleteDoc(window.fsDoc(window.firestoreDb, "projects", draftId));
      console.log("✅ Draft deleted successfully.");
    } catch (err) {
      console.warn("⚠️ Draft cleanup failed:", err);
    }
    localStorage.removeItem("deleteDraft");
  }

    await this.loadProject();
    await this.loadPhases();

    // Save metadata on change
    this.titleInput.addEventListener("input", () => this.updateMetadata());
    this.excerptInput.addEventListener("input", () => this.updateMetadata());
    this.tagsInput.addEventListener("input", () => this.updateMetadata());
    this.featuredCheckbox.addEventListener("change", () => this.updateMetadata());

    this.setupTagInput();
    // Add new phase
    this.addPhaseBtn.addEventListener("click", () => this.addPhase());

    const saveBtn = document.getElementById("save-project-btn");
    const publishBtn = document.getElementById("publish-project-btn");

    if (saveBtn) saveBtn.addEventListener("click", () => this.saveProject());
    if (publishBtn) publishBtn.addEventListener("click", () => this.publishProject());

    [this.titleInput, this.excerptInput, this.featuredCheckbox].forEach(el => {
      if (el) el.addEventListener("input", () => this.hasUnsavedChanges = true);
    });

    this.setupUnloadWarning();
  }

  async loadProject() {
    const snap = await window.fsGetDoc(this.projectRef);
    if (snap.exists()) {
      const data = snap.data();
      this.titleInput.value = data.title || "";
      this.excerptInput.value = data.excerpt || "";
      this.tagsInput.value = (data.tags || []).join(", ");
      this.featuredCheckbox.checked = !!data.featured;
    }
  }

  updateMetadata() {
    if (!this.hasUnsavedChanges) {
      console.log("🟡 Metadata changed - marking unsaved.");
    }
    this.hasUnsavedChanges = true;
  }


  async loadPhases() {
    const snap = await window.fsGetDocs(this.phasesRef);
    snap.forEach(doc => {
      this.renderPhase(doc.id, doc.data());
    });
  }

  async addPhase() {
    const docRef = await window.fsAddDoc(this.phasesRef, {
      title: "Untitled Phase",
      content: "",
      createdAt: new Date()
    });
    this.renderPhase(docRef.id, { title: "Untitled Phase", content: "" });
  }

renderPhase(phaseId, data) {
    const phaseDiv = document.createElement("div");
    phaseDiv.className = "phase";

    // Phase title (outside box)
    const titleEl = document.createElement("h3");
    titleEl.className = "phase-title";
    titleEl.textContent = data.title || "Untitled Phase";
    titleEl.contentEditable = false; // locked by default
    phaseDiv.appendChild(titleEl);

    // Editor container
    const editorContainer = document.createElement("div");
    editorContainer.className = "phase-editor";

    // Button row
    const buttonRow = document.createElement("div");
    buttonRow.className = "phase-buttons";

    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.className = "edit-btn";

    const saveBtn = document.createElement("button");
    saveBtn.textContent = "Save";
    saveBtn.className = "save-btn";
    saveBtn.style.display = "none"; // hidden by default

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.className = "delete-btn";

    buttonRow.appendChild(editBtn);
    buttonRow.appendChild(saveBtn);
    buttonRow.appendChild(deleteBtn);

    buttonRow.appendChild(editBtn);
    buttonRow.appendChild(saveBtn);

    phaseDiv.appendChild(editorContainer);
    phaseDiv.appendChild(buttonRow);
    this.phasesContainer.appendChild(phaseDiv);

    // Attach editor
    const postEditor = new ProjectPostEditor(editorContainer, data.content || "");

    // --- Shared edit/save helpers ---
    const enterEditMode = () => {
      titleEl.contentEditable = true;
      titleEl.classList.add("editable-title");

      postEditor.editor.contentEditable = true;
      const toolbar = postEditor.container.querySelector(".toolbar");
      toolbar.style.display = "flex"; // restore flex layout
      editBtn.style.display = "none";
      saveBtn.style.display = "inline-block";
    };

    const exitEditMode = async () => {
      const phaseRef = window.fsDoc(this.phasesRef, phaseId);
      const content = postEditor.editor.innerHTML;
      const title = titleEl.textContent;

      try {
        await window.fsUpdateDoc(phaseRef, { content, title });
        this.showSaveStatus(`Saved: ${title}`);
      } catch (err) {
        console.error("Error saving phase:", err);
        this.showSaveStatus("Save failed", true);
      }

      titleEl.contentEditable = false;
      titleEl.classList.remove("editable-title");
      postEditor.editor.contentEditable = false;
      postEditor.container.querySelector(".toolbar").style.display = "none";
      saveBtn.style.display = "none";
      editBtn.style.display = "inline-block";
    };

    // Buttons
    editBtn.addEventListener("click", enterEditMode);
    saveBtn.addEventListener("click", exitEditMode);


    // Start locked
    postEditor.editor.contentEditable = false;
    postEditor.container.querySelector(".toolbar").style.display = "none";

    editBtn.addEventListener("click", () => {
      // enable title editing too
      titleEl.contentEditable = true;
      titleEl.classList.add("editable-title");

      postEditor.editor.contentEditable = true;
      postEditor.container.querySelector(".toolbar").style.display = "block";
      editBtn.style.display = "none";
      saveBtn.style.display = "inline-block";

      const toolbar = postEditor.container.querySelector(".toolbar");
      toolbar.style.display = "flex"; // ✅ restore flex layout
  });

  deleteBtn.addEventListener("click", async () => {
  if (!confirm(`Delete phase "${titleEl.textContent}"? This cannot be undone.`)) return;

  try {
    await window.fsDeleteDoc(window.fsDoc(this.phasesRef, phaseId));
    phaseDiv.remove(); // remove from DOM
    this.showSaveStatus(`Deleted: ${titleEl.textContent}`);
  } catch (err) {
    console.error("Error deleting phase:", err);
    this.showSaveStatus("Delete failed", true);
  }
});


    // --- Allow double-click to enter edit mode ---
  titleEl.addEventListener("dblclick", () => {
    if (postEditor.editor.contentEditable === "false") {
      enterEditMode();
    }
  });

  postEditor.editor.addEventListener("dblclick", () => {
    if (postEditor.editor.contentEditable === "false") {
      enterEditMode();
    }
  });


  saveBtn.addEventListener("click", async () => {
    const phaseRef = window.fsDoc(this.phasesRef, phaseId);
    const content = postEditor.editor.innerHTML;
    const title = titleEl.textContent;

    try {
      await window.fsUpdateDoc(phaseRef, { content, title });
      this.showSaveStatus(`Saved: ${title}`);
    } catch (err) {
      console.error("Error saving phase:", err);
      this.showSaveStatus("Save failed", true);
    }

    // lock both title and content again
    titleEl.contentEditable = false;
    titleEl.classList.remove("editable-title");

    postEditor.editor.contentEditable = false;
    postEditor.container.querySelector(".toolbar").style.display = "none";
    saveBtn.style.display = "none";
    editBtn.style.display = "inline-block";
  });

  }



  showSaveStatus(message, isError = false) {
    console.log(this.saveStatus)
    this.saveStatus.textContent = message;
    this.saveStatus.style.color = isError ? "red" : "green";
    setTimeout(() => (this.saveStatus.textContent = ""), 2000);
  }
  setupTagInput() {
    const input = document.getElementById("project-tags");
    const addButton = document.getElementById("add-tag-btn");

    if (!input || !addButton) return;

    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.addTag(input);
      }
    });

    addButton.addEventListener("click", () => this.addTag(input));
  }

  addTag(input) {
    const tag = input.value.trim();
    if (tag && !this.tags.includes(tag)) {
      this.tags.push(tag);
      this.updateTagsDisplay();
      input.value = "";
    }
  }

  removeTag(tag) {
    this.tags = this.tags.filter((t) => t !== tag);
    this.updateTagsDisplay();
  }

  updateTagsDisplay() {
    const display = document.getElementById("project-tags-display");
    display.innerHTML = this.tags
      .map(
        (tag) => `
      <span class="tag-item">
        ${tag}
        <span class="tag-remove" onclick="window.projectEditor.removeTag('${tag}')">×</span>
      </span>`
      )
      .join("");
  }

  async saveProject() {
    const title = this.titleInput.value.trim() || "Untitled Project";
    const excerpt = this.excerptInput.value.trim();
    const featured = this.featuredCheckbox.checked;
    const tags = this.tags;

    try {
      const user = window.firebaseAuth.currentUser;
      if (!user) throw new Error("Not logged in");

      if (!this.projectId) {
        // 🆕 First save → create the project directly in Firestore
        const projectsRef = window.fsCollection(window.firestoreDb, "projects");
        const docRef = await window.fsAddDoc(projectsRef, {
          title,
          excerpt,
          tags,
          featured,
          owner: user.uid,
          confirmed: true,
          published: false,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        this.projectId = docRef.id;
        this.projectRef = docRef;
        this.showSaveStatus("✅ Project created and saved!");
      } else {
        // 📝 Update existing project (publish state is managed by publishProject)
        await window.fsUpdateDoc(this.projectRef, {
          title,
          excerpt,
          tags,
          featured,
          confirmed: true,
          updatedAt: new Date()
        });
        this.showSaveStatus("💾 Project updated!");
      }

      this.hasUnsavedChanges = false;
    } catch (err) {
      console.error("Error saving project:", err);
      this.showSaveStatus("❌ Failed to save project: " + (err.code || err.message || err), true);
    }
  }

  setupUnloadWarning() {
  window.addEventListener("beforeunload", (e) => {
    console.log("⚠️ beforeunload triggered");

    if (!this.projectRef) return;

    const isConfirmed = this.confirmed ?? false;
    const hasUnsaved = this.hasUnsavedChanges ?? false;

    // 🔹 1️⃣ Case: new (unconfirmed) project with unsaved changes
    if (!isConfirmed && hasUnsaved) {
      console.log("⚠️ Unconfirmed project with unsaved changes - prompting user.");

      // ✅ mark for deletion on next load
      localStorage.setItem("deleteDraft", this.projectId);

      // ✅ trigger browser warning dialog
      e.preventDefault();
      e.returnValue = ""; // required for dialog to appear

      return;
    }

    // 🔹 2️⃣ Case: confirmed project but unsaved edits
    if (hasUnsaved) {
      console.log("⚠️ Confirmed project with unsaved edits - prompting user.");
      e.preventDefault();
      e.returnValue = "";
      return;
    }

    // 🔹 3️⃣ Safe exit
    console.log("✅ Safe to exit - no unsaved changes.");
  });
  }



async publishProject() {
    if (!this.projectRef) {
      alert("Please save the project before publishing.");
      return;
    }

    try {
      await window.fsUpdateDoc(this.projectRef, {
        published: true,
        updatedAt: new Date()
      });

      this.showSaveStatus("🚀 Project published!");
    } catch (err) {
      console.error("Error publishing project:", err);
      this.showSaveStatus("❌ Failed to publish project.", true);
    }
  }
}
// Initialize when DOM ready
document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get("id");
  if (projectId) {
    new ProjectEditor(projectId);
  } else {
    console.error("No project ID provided in URL");
  }
});

