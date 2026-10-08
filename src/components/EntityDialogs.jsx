import { useState } from "react";
import { call, fileUrl, id } from "../data/database";
import { assetNameFromPath, now } from "../pages/pageUtils";
import { Dialog, Field } from "./ui/Primitives";
export function AssetDialog({
  settings,
  categories,
  currentCategoryId,
  initial,
  onCancel,
  onConfirm,
}) {
  const [form, setForm] = useState({
    name: initial?.name || "",
    description: initial?.description || "",
    categoryId: initial?.categoryId || currentCategoryId,
    storageMode: initial?.storageMode || settings.defaultImportMode,
    selectedFilePath: "",
    coverStorageMode: initial?.coverStorageMode || "managed",
    selectedCoverPath: "",
    useSourceAsCover: false,
    filePath: initial?.filePath || "",
    tags: (initial?.tags || []).join(", "),
    notes: initial?.notes || "",
  });
  // Existing assets already have a user-visible name.  Treat that value as
  // manual so choosing a replacement file cannot unexpectedly rename it.
  const [nameWasManuallyEdited, setNameWasManuallyEdited] = useState(
    Boolean(initial?.name),
  );
  const set = (k, v) => setForm((x) => ({ ...x, [k]: v }));
  return (
    <Dialog
      title={initial ? "编辑资产" : "新增资产"}
      canSubmit={Boolean(
        form.name.trim() && (initial || form.selectedFilePath),
      )}
      onCancel={onCancel}
      onSubmit={() =>
        onConfirm({
          ...initial,
          ...form,
          name: form.name.trim(),
          tags: form.tags
            .split(/[,，]/)
            .map((x) => x.trim())
            .filter(Boolean),
        })
      }
    >
      <div className="dialog-field-grid">
        <Field label="名称">
          <input
            autoFocus
            value={form.name}
            onChange={(e) => {
              const name = e.target.value;
              set("name", name);
              // Clearing a name deliberately re-enables file-name generation.
              setNameWasManuallyEdited(Boolean(name));
            }}
          />
        </Field>
        <Field label="所属分类">
          <select
            value={form.categoryId}
            onChange={(e) => set("categoryId", e.target.value)}
          >
            {categories.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="存储方式">
          <select
            value={form.storageMode}
            onChange={(e) => set("storageMode", e.target.value)}
          >
            <option value="managed">托管到资产库</option>
            <option value="reference">仅引用原文件</option>
          </select>
        </Field>
        <Field label="原始文件（任意格式）">
          <div className="path-row">
            <input
              readOnly
              value={
                form.selectedFilePath ||
                initial?.originalFilePath ||
                initial?.sourceFilePath ||
                ""
              }
            />
            <button
              type="button"
              className="secondary"
              onClick={async () => {
                const p = await call("pick_asset_file");
                if (p) {
                  const generatedName = assetNameFromPath(p);
                  setForm((current) => ({
                    ...current,
                    selectedFilePath: p,
                    name:
                      !current.name.trim() || !nameWasManuallyEdited
                        ? generatedName
                        : current.name,
                  }));
                }
              }}
            >
              选择
            </button>
          </div>
        </Field>
        <Field label="封面图片（可选）">
          <div className="path-row">
            <input
              readOnly
              value={
                form.selectedCoverPath ||
                initial?.coverOriginalPath ||
                initial?.coverSourcePath ||
                ""
              }
              placeholder="未选择时使用通用文件图标"
            />
            <button
              type="button"
              className="secondary"
              disabled={form.useSourceAsCover}
              onClick={async () => {
                const p = await call("pick_cover_image");
                if (p) set("selectedCoverPath", p);
              }}
            >
              选择图片
            </button>
          </div>
        </Field>
        <Field label="封面存储方式">
          <select
            value={form.coverStorageMode}
            onChange={(e) => set("coverStorageMode", e.target.value)}
            disabled={form.useSourceAsCover && form.storageMode === "managed"}
          >
            <option value="managed">托管封面</option>
            <option value="reference">引用封面原文件</option>
          </select>
        </Field>
        <label className="check-row dialog-check-row">
          <input
            type="checkbox"
            checked={form.useSourceAsCover}
            onChange={(e) => set("useSourceAsCover", e.target.checked)}
          />
          <span>使用原始资产文件作为封面（仅当原始文件是图片时）</span>
        </label>
        <Field label="简介">
          <textarea
            rows="3"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </Field>
        <Field label="标签">
          <input
            value={form.tags}
            onChange={(e) => set("tags", e.target.value)}
          />
        </Field>
        <Field label="备注">
          <textarea
            rows="3"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </Field>
      </div>
    </Dialog>
  );
}

export function ModelDialog({ title, model, onCancel, onConfirm }) {
  const [f, setF] = useState(() => ({
    name: model?.name || "",
    description: model?.description || "",
    coverPath: model?.coverPath || "",
    notes: model?.notes || "",
  }));
  return (
    <Dialog
      title={title}
      canSubmit={Boolean(f.name.trim())}
      onCancel={onCancel}
      onSubmit={() => onConfirm({ ...f, name: f.name.trim() })}
    >
      <Field label="模型名称">
        <input
          autoFocus
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
        />
      </Field>
      <Field label="简介">
        <textarea
          rows="3"
          value={f.description}
          onChange={(e) => setF({ ...f, description: e.target.value })}
        />
      </Field>
      <Field label="封面（可选）">
        <div className="path-row">
          <input readOnly value={f.coverPath} placeholder="未选择封面" />
          <button
            type="button"
            className="secondary"
            onClick={async () => {
              const coverPath = await call("pick_cover_image");
              if (coverPath) setF({ ...f, coverPath });
            }}
          >
            选择封面
          </button>
        </div>
        {f.coverPath && (
          <>
            <img
              className="model-cover-preview"
              src={fileUrl(f.coverPath)}
              alt="模型封面预览"
            />
            <button
              type="button"
              className="link-button"
              onClick={() => setF({ ...f, coverPath: "" })}
            >
              清除封面
            </button>
          </>
        )}
      </Field>
      <Field label="备注">
        <textarea
          rows="3"
          value={f.notes}
          onChange={(e) => setF({ ...f, notes: e.target.value })}
        />
      </Field>
    </Dialog>
  );
}

export function WorkspaceDeleteConfirm({
  workspace,
  categories,
  assets,
  onCancel,
  onConfirm,
}) {
  const [deleteManaged, setDeleteManaged] = useState(false);
  const managed = assets.filter((x) => x.storageMode === "managed").length;
  const empty = !categories.length && !assets.length;
  return (
    <Dialog title="删除模型" description="此操作会清理脚本集合器中的模型管理数据。" danger submitLabel="删除" protectDraft={false} onCancel={onCancel} onSubmit={() => onConfirm(deleteManaged)}>
        <div className="dialog-fields confirm-copy">
          <p>
            {empty
              ? `确定删除模型 “${workspace.name}” 吗？`
              : `该模型中包含：\n${categories.length} 个分类\n${assets.length} 个资产`}
          </p>
          {!empty && (
            <small>
              删除模型将同时删除这些分类、资产记录、提示词和画布布局。
            </small>
          )}
          {managed > 0 && (
            <div className="managed-delete-choice">
              <strong>其中有 {managed} 个托管模式资产</strong>
              <label>
                <input
                  type="radio"
                  checked={!deleteManaged}
                  onChange={() => setDeleteManaged(false)}
                />
                仅删除模型和数据库记录，保留托管文件
              </label>
              <label>
                <input
                  type="radio"
                  checked={deleteManaged}
                  onChange={() => setDeleteManaged(true)}
                />
                同时删除脚本集合器管理的托管文件
              </label>
            </div>
          )}
          <small>引用模式资产指向的用户硬盘原文件无论如何都不会删除。</small>
        </div>
    </Dialog>
  );
}

export function CategoryDialog({ title, category, onCancel, onConfirm }) {
  const [name, setName] = useState(category?.name || "");
  const [description, setDescription] = useState(category?.description || "");
  return (
    <Dialog
      title={title}
      canSubmit={Boolean(name.trim())}
      onCancel={onCancel}
      onSubmit={() =>
        onConfirm({ name: name.trim(), description: description.trim() })
      }
    >
      <Field label="分类名称">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label="分类简介（可选）">
        <textarea
          rows="3"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
    </Dialog>
  );
}

export function ScriptDialog({ script, onCancel, onConfirm }) {
  const [form, setForm] = useState({
    name: script?.name || "",
    description: script?.description || "",
    filePath: script?.filePath || "",
    launchCommand: script?.launchCommand || "",
    launchArgs: script?.launchArgs || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  return (
    <Dialog
      title={script ? "编辑脚本" : "新增脚本"}
      canSubmit={Boolean(
        !saving &&
        form.name.trim() &&
        (form.filePath.trim() || form.launchCommand.trim()),
      )}
      onCancel={onCancel}
      onSubmit={async () => {
        setSaving(true);
        setError("");
        try {
          await onConfirm({
            ...form,
            name: form.name.trim(),
            description: form.description.trim(),
            filePath: form.filePath.trim(),
            launchCommand: form.launchCommand.trim(),
            launchArgs: form.launchArgs.trim(),
          });
        } catch (reason) {
          setError(String(reason));
          setSaving(false);
        }
      }}
    >
      <Field label="脚本名称">
        <input
          autoFocus
          value={form.name}
          onChange={(event) => set("name", event.target.value)}
        />
      </Field>
      <Field label="脚本简介">
        <textarea
          rows="3"
          value={form.description}
          onChange={(event) => set("description", event.target.value)}
        />
      </Field>
      <Field label="脚本文件路径">
        <div className="path-row">
          <input
            value={form.filePath}
            onChange={(event) => set("filePath", event.target.value)}
            placeholder="选择 .ps1、.bat、.cmd、.py、.exe 或其他文件"
          />
          <button
            type="button"
            className="secondary"
            onClick={async () => {
              const path = await call("pick_script_file");
              if (!path) return;
              setForm((current) => ({
                ...current,
                filePath: path,
                name: current.name || assetNameFromPath(path),
              }));
            }}
          >
            浏览
          </button>
        </div>
      </Field>
      <Field label="启动文件 / 启动命令">
        <input
          value={form.launchCommand}
          onChange={(event) => set("launchCommand", event.target.value)}
          placeholder="可留空，默认直接启动上方文件"
        />
      </Field>
      <Field label="启动参数（可选）">
        <input
          value={form.launchArgs}
          onChange={(event) => set("launchArgs", event.target.value)}
          placeholder='例如：--port 8080 或 "D:\工作目录"'
        />
      </Field>
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {saving && <small className="dialog-status">正在保存…</small>}
    </Dialog>
  );
}
