import { ArrowRight, FolderCode, Image } from "lucide-react";
import "../styles/pages-core.css";

export function Home({ go }) {
  return <section className="home-page ui-home">
    <header className="ui-home-heading"><h1>选择你的组织方式</h1></header>
    <div className="home-actions ui-home-actions">
      {[
        [FolderCode, "排列模式", "有序排列，分类整理你的内容", "scripts"],
        [Image, "画布模式", "自由布局，直观组织你的内容", "models"],
      ].map(([Icon, title, caption, path]) => <button type="button" className="entry-card ui-home-choice" key={path} onClick={() => go(path)}>
        <span className="entry-icon ui-home-icon"><Icon size={28} strokeWidth={1.6} aria-hidden="true"/></span>
        <span className="ui-home-copy"><strong>{title}</strong><small>{caption}</small></span>
        <ArrowRight className="entry-arrow" size={18} aria-hidden="true"/>
      </button>)}
    </div>
  </section>;
}
