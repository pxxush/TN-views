import { Plugin, parseYaml, TFile, MarkdownRenderer, Component } from "obsidian";

interface TNViewFilter {
  project?: string;
  status?: string;
  scheduled?: string;
  due?: string;
  tags?: string[];
}

interface TaskNote {
  file: TFile;
  title: string;
  status?: string;
  scheduled?: string;
  due?: string;
  projects?: string[];
}

export default class TNViewPlugin extends Plugin {
  async onload() {
    this.registerMarkdownCodeBlockProcessor("tn-view", async (source, el, ctx) => {
      try {
        const filter: TNViewFilter = parseYaml(source) || {};
        const tasks = await this.getFilteredTasks(filter);
        await this.renderAsInline(tasks, el, filter, ctx.sourcePath);
      } catch (e) {
        el.createEl("div", { text: "TN-View: Invalid filter syntax" });
      }
    });
  }

  async getFilteredTasks(filter: TNViewFilter): Promise<TaskNote[]> {
    const files = this.app.vault.getMarkdownFiles();
    const tasks: TaskNote[] = [];
    const today = new Date().toISOString().split("T")[0];
    const weekLater = new Date();
    weekLater.setDate(weekLater.getDate() + 7);
    const weekStr = weekLater.toISOString().split("T")[0];

    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      if (!cache?.frontmatter) continue;
      const fm = cache.frontmatter;
      if (!fm.status) continue;

      if (filter.status && fm.status !== filter.status) continue;

      if (filter.project) {
        const raw = fm.projects;
        if (!raw) continue;
        const projects = Array.isArray(raw) ? raw : [raw];
        const needle = filter.project.toLowerCase().replace(/\[\[|\]\]/g, "").trim();
        const match = projects.some((p: string) =>
          p?.toLowerCase().replace(/\[\[|\]\]/g, "").trim().includes(needle)
        );
        if (!match) continue;
      }

      if (filter.scheduled) {
        const s = fm.scheduled;
        if (filter.scheduled === "today" && s !== today) continue;
        if (filter.scheduled === "week" && (!s || s < today || s > weekStr)) continue;
        if (filter.scheduled.startsWith("before:") && (!s || s >= filter.scheduled.replace("before:", "").trim())) continue;
        if (filter.scheduled.startsWith("after:") && (!s || s <= filter.scheduled.replace("after:", "").trim())) continue;
      }

      if (filter.due) {
        const d = fm.due;
        if (filter.due === "today" && d !== today) continue;
        if (filter.due === "week" && (!d || d < today || d > weekStr)) continue;
        if (filter.due.startsWith("before:") && (!d || d >= filter.due.replace("before:", "").trim())) continue;
        if (filter.due.startsWith("after:") && (!d || d <= filter.due.replace("after:", "").trim())) continue;
      }

      if (filter.tags && filter.tags.length > 0) {
        const fileTags = cache.tags?.map(t => t.tag.replace("#", "")) || [];
        if (!filter.tags.some(tag => fileTags.includes(tag))) continue;
      }

      tasks.push({
        file,
        title: fm.title || file.basename,
        status: fm.status,
        scheduled: fm.scheduled,
        due: fm.due,
        projects: fm.projects ? (Array.isArray(fm.projects) ? fm.projects : [fm.projects]) : [],
      });
    }

    tasks.sort((a, b) => {
      if (!a.scheduled) return 1;
      if (!b.scheduled) return -1;
      return a.scheduled.localeCompare(b.scheduled);
    });

    return tasks;
  }

  async renderAsInline(tasks: TaskNote[], el: HTMLElement, filter: TNViewFilter, sourcePath: string) {
    el.addClass("tn-view-container");

    if (tasks.length === 0) {
      el.createEl("div", { text: "No tasks found.", cls: "tn-view-empty" });
      return;
    }

    // If filtering by project, show project title on top
    if (filter.project) {
      const projectName = filter.project.replace(/\[\[|\]\]/g, "").trim();
      const projectFile = this.app.metadataCache.getFirstLinkpathDest(projectName, sourcePath);

      const titleEl = el.createEl("div", { cls: "tn-view-project-title" });

      if (projectFile) {
        const link = titleEl.createEl("a", {
          text: projectName,
          cls: "internal-link tn-view-project-link"
        });
        link.addEventListener("click", () => {
          this.app.workspace.openLinkText(projectName, sourcePath, false);
        });
      } else {
        titleEl.createEl("span", { text: projectName });
      }
    }

    // Render each task as a wikilink so TaskNotes renders its inline card
    const component = new Component();
    component.load();

    for (const task of tasks) {
      const taskEl = el.createEl("div", { cls: "tn-view-task-row" });
      const linkText = `[[${task.file.basename}]]`;
      await MarkdownRenderer.render(
        this.app,
        linkText,
        taskEl,
        sourcePath,
        component
      );
    }

    component.unload();
  }

  onunload() {}
}
