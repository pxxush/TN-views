import { Plugin, parseYaml, TFile, MarkdownRenderer, Component } from "obsidian";

interface TNViewFilter {
  name?: string;
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
        await this.renderView(tasks, el, filter, ctx.sourcePath);
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
        const fm_tags: string[] = [];

        // Read tags from frontmatter property
        if (fm.tags) {
          const raw = Array.isArray(fm.tags) ? fm.tags : [fm.tags];
          raw.forEach((t: string) => {
            fm_tags.push(t.replace("#", "").trim());
          });
        }

        // Also read from note body tags
        const body_tags = cache.tags?.map(t => t.tag.replace("#", "")) || [];
        const allTags = [...new Set([...fm_tags, ...body_tags])];

        if (!filter.tags.some(tag => allTags.includes(tag.replace("#", "").trim()))) continue;
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

  async renderView(tasks: TaskNote[], el: HTMLElement, filter: TNViewFilter, sourcePath: string) {
    el.addClass("tn-view-container");

    const component = new Component();
    component.load();

    const hasName = filter.name && filter.name.trim().length > 0;
    const isWikilink = hasName && filter.name!.trim().startsWith("[[");

    if (hasName) {
      // Title row
      const titleRow = el.createEl("div", { cls: "tn-view-title-row" });

      if (isWikilink) {
        // Render as inline TaskNotes card
        await MarkdownRenderer.render(
          this.app,
          filter.name!.trim(),
          titleRow,
          sourcePath,
          component
        );
      } else {
        // Plain text heading
        titleRow.createEl("span", {
          text: filter.name!.trim(),
          cls: "tn-view-heading"
        });
      }

      // Nested tasks container
      if (tasks.length === 0) {
        const emptyEl = el.createEl("div", { cls: "tn-view-nested tn-view-empty" });
        emptyEl.createEl("span", { text: "No tasks found." });
      } else {
        const nestedEl = el.createEl("div", { cls: "tn-view-nested" });
        for (const task of tasks) {
          const taskEl = nestedEl.createEl("div", { cls: "tn-view-task-row" });
          await MarkdownRenderer.render(
            this.app,
            `[[${task.file.basename}]]`,
            taskEl,
            sourcePath,
            component
          );
        }
      }

    } else {
      // Flat list — no title, no nesting
      if (tasks.length === 0) {
        el.createEl("div", { text: "No tasks found.", cls: "tn-view-empty" });
      } else {
        for (const task of tasks) {
          const taskEl = el.createEl("div", { cls: "tn-view-task-row" });
          await MarkdownRenderer.render(
            this.app,
            `[[${task.file.basename}]]`,
            taskEl,
            sourcePath,
            component
          );
        }
      }
    }

    component.unload();
  }

  onunload() {}
}
