import { Plugin, MarkdownPostProcessorContext, TFile, parseYaml } from "obsidian";

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
}

export default class TNViewPlugin extends Plugin {
  async onload() {
    this.registerMarkdownCodeBlockProcessor("tn-view", async (source, el) => {
      try {
        const filter: TNViewFilter = parseYaml(source) || {};
        const tasks = await this.getFilteredTasks(filter);
        this.renderCards(tasks, el);
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
        const projects = Array.isArray(raw) ? raw : [raw];
        const needle = filter.project.toLowerCase().replace(/\[\[|\]\]/g, "");
        const match = projects.some((p: string) => p?.toLowerCase().includes(needle));
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
      });
    }

    tasks.sort((a, b) => {
      if (!a.scheduled) return 1;
      if (!b.scheduled) return -1;
      return a.scheduled.localeCompare(b.scheduled);
    });

    return tasks;
  }

  renderCards(tasks: TaskNote[], el: HTMLElement) {
    el.addClass("tn-view-container");

    if (tasks.length === 0) {
      el.createEl("div", { text: "No tasks found.", cls: "tn-view-empty" });
      return;
    }

    for (const task of tasks) {
      const card = el.createEl("div", { cls: "tn-view-card" });

      card.createEl("span", {
        text: task.status || "",
        cls: `tn-view-status tn-view-status-${task.status}`
      });

      const titleEl = card.createEl("span", {
        text: task.title,
        cls: "tn-view-title"
      });

      titleEl.addEventListener("click", () => {
        this.app.workspace.openLinkText(task.file.basename, "", false);
      });

      if (task.scheduled || task.due) {
        const dateEl = card.createEl("span", { cls: "tn-view-date" });
        if (task.scheduled) dateEl.createSpan({ text: "📅 " + task.scheduled });
        if (task.due) dateEl.createSpan({ text: " ⚑ " + task.due });
      }
    }
  }

  onunload() {}
}
