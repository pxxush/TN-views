import { Plugin, parseYaml, TFile, MarkdownRenderer, Component } from "obsidian";

interface TNViewFilter {
  name?: string;
  project?: string;
  status?: string;
  scheduled?: string;
  due?: string;
  tags?: string[];
  match?: string;
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
    const matchAny = filter.match?.toLowerCase() === "any";

    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      if (!cache?.frontmatter) continue;
      const fm = cache.frontmatter;
      if (!fm.status) continue;

      const results: boolean[] = [];

      // Status
      if (filter.status) {
        results.push(fm.status === filter.status);
      }

      // Project
      if (filter.project) {
        const raw = fm.projects;
        if (!raw) {
          results.push(false);
        } else {
          const projects = Array.isArray(raw) ? raw : [raw];
          const needle = filter.project.toLowerCase().replace(/\[\[|\]\]/g, "").trim();
          results.push(projects.some((p: string) =>
            p?.toLowerCase().replace(/\[\[|\]\]/g, "").trim().includes(needle)
          ));
        }
      }

      // Scheduled
      if (filter.scheduled) {
        const s = fm.scheduled;
        let pass = false;
        if (filter.scheduled === "today") pass = s === today;
        else if (filter.scheduled === "week") pass = !!s && s >= today && s <= weekStr;
        else if (filter.scheduled.startsWith("before:")) pass = !!s && s < filter.scheduled.replace("before:", "").trim();
        else if (filter.scheduled.startsWith("after:")) pass = !!s && s > filter.scheduled.replace("after:", "").trim();
        results.push(pass);
      }

      // Due
      if (filter.due) {
        const d = fm.due;
        let pass = false;
        if (filter.due === "today") pass = d === today;
        else if (filter.due === "week") pass = !!d && d >= today && d <= weekStr;
        else if (filter.due.startsWith("before:")) pass = !!d && d < filter.due.replace("before:", "").trim();
        else if (filter.due.startsWith("after:")) pass = !!d && d > filter.due.replace("after:", "").trim();
        results.push(pass);
      }

      // Tags
      if (filter.tags && filter.tags.length > 0) {
        const fm_tags: string[] = [];
        if (fm.tags) {
          const raw = Array.isArray(fm.tags) ? fm.tags : [fm.tags];
          raw.forEach((t: string) => fm_tags.push(t.replace("#", "").trim()));
        }
        const body_tags = cache.tags?.map(t => t.tag.replace("#", "")) || [];
        const allTags = [...new Set([...fm_tags, ...body_tags])];
        results.push(filter.tags.some(tag => allTags.includes(tag.replace("#", "").trim())));
      }

      // Apply match logic
      if (results.length === 0) continue;
      const passed = matchAny
        ? results.some(r => r)
        : results.every(r => r);

      if (!passed) continue;

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

  async renderView(tasks: TaskNote[], el: HTMLElement, filter: TNViewFilter, sourcePath: string) {
    el.addClass("tn-view-container");

    const component = new Component();
    component.load();

    const hasName = filter.name && filter.name.trim().length > 0;
    const isWikilink = hasName && filter.name!.trim().startsWith("[[");

    if (hasName) {
      const titleRow = el.createEl("div", { cls: "tn-view-title-row" });
      if (isWikilink) {
        await MarkdownRenderer.render(
          this.app,
          filter.name!.trim(),
          titleRow,
          sourcePath,
          component
        );
      } else {
        titleRow.createEl("span", {
          text: filter.name!.trim(),
          cls: "tn-view-heading"
        });
      }
    }

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

    component.unload();
  }

  onunload() {}
}
