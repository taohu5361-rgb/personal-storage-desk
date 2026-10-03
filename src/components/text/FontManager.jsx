import { useState } from "react";
import { FilePlus2, Trash2 } from "lucide-react";
import { call, id } from "../../data/database";
import "./textBlocks.css";

const supported = ".ttf、.otf、.woff、.woff2";

export function FontManager({ fonts = [], reload }) {
  const [busy, setBusy] = useState(false);
  const [busyFontId, setBusyFontId] = useState("");
  const [status, setStatus] = useState("");

  const importFont = async () => {
    setBusy(true);
    setStatus("");
    try {
      const font = await call("import_custom_font", { fontId: id("font") });
      if (font) {
        await reload();
        setStatus("已导入“" + font.name + "”，文字块中可直接选择。");
      }
    } catch (error) {
      setStatus("导入失败：" + String(error));
    } finally {
      setBusy(false);
    }
  };

  const deleteFont = async (font) => {
    if (
      !window.confirm(
        "删除“" +
          font.name +
          "”？使用该字体的文字块会自动回退到系统默认字体。",
      )
    ) {
      return;
    }
    setBusyFontId(font.id);
    setStatus("");
    try {
      await call("delete_custom_font", { fontId: font.id });
      await reload();
      setStatus("已删除“" + font.name + "”，相关文字块已回退到系统默认字体。");
    } catch (error) {
      setStatus("删除失败：" + String(error));
    } finally {
      setBusyFontId("");
    }
  };

  return (
    <section className="font-manager" aria-label="字体管理">
      <header className="font-manager-header">
        <div>
          <h2>字体管理</h2>
          <p>导入字体后仅在本应用中使用。支持 {supported}，文件保存在应用数据目录。</p>
        </div>
        <button className="primary" disabled={busy} onClick={importFont}>
          <FilePlus2 size={15} />
          {busy ? "正在导入…" : "导入字体"}
        </button>
      </header>
      {fonts.length ? (
        <ul className="font-manager-list">
          {fonts.map((font) => (
            <li key={font.id}>
              <span className="font-manager-sample" style={{ fontFamily: '"' + font.family + '"' }}>
                Aa
              </span>
              <span className="font-manager-info">
                <strong>{font.name}</strong>
                <small>{font.format.toUpperCase()} · 文字块专用</small>
              </span>
              <button
                className="secondary small danger"
                disabled={busyFontId === font.id}
                aria-label={"删除字体 " + font.name}
                onClick={() => deleteFont(font)}
              >
                <Trash2 size={14} />
                {busyFontId === font.id ? "删除中…" : "删除"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-manager-empty">尚未导入自定义字体。</p>
      )}
      {status && <p className="font-manager-status" role="status">{status}</p>}
    </section>
  );
}
