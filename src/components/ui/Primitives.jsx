import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X } from 'lucide-react';

export function Button({ variant = 'secondary', className = '', children, ...props }) {
  return <button type="button" className={`ui-button ${className}`} data-variant={variant} {...props}>{children}</button>;
}

const focusable = 'button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]';

export function Dialog({ title, description, children, canSubmit = true, onSubmit, onCancel, submitLabel = '保存', danger = false, protectDraft = true }) {
  const titleId = useId();
  const descriptionId = useId();
  const formRef = useRef(null);
  const dirty = useRef(false);
  const initialValues = useRef('');
  const formValues = () => JSON.stringify([...(formRef.current?.querySelectorAll('input,textarea,select') || [])].map(node => [node.value, node.checked]));
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [discard, setDiscard] = useState(false);
  const pendingRef = useRef(false);
  pendingRef.current = pending;
  const requestClose = () => {
    if (pendingRef.current) return;
    if (protectDraft && (dirty.current || formValues() !== initialValues.current)) setDiscard(true);
    else cancelRef.current?.();
  };
  const closeRef = useRef(requestClose);
  closeRef.current = requestClose;
  useEffect(() => {
    const previous = document.activeElement;
    const form = formRef.current;
    const hidden = [...document.body.children].filter(node => node !== form?.parentElement && !node.contains(form));
    const inert = hidden.map(node => [node, node.inert]);
    hidden.forEach(node => { node.inert = true; });
    initialValues.current = formValues();
    const first = form?.querySelector('input:not(:disabled):not([readonly]),textarea:not(:disabled),select:not(:disabled)') || form?.querySelector(focusable);
    first?.focus();
    const keydown = event => {
      if (event.isComposing) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeRef.current(); }
      if (event.key === 'Tab') {
        const nodes = [...(form?.querySelectorAll(focusable) || [])].filter(node => node.getClientRects().length);
        if (!nodes.length) { event.preventDefault(); form?.focus(); return; }
        const firstNode = nodes[0], lastNode = nodes[nodes.length - 1];
        if (event.shiftKey && (document.activeElement === firstNode || !form.contains(document.activeElement))) { event.preventDefault(); lastNode.focus(); }
        if (!event.shiftKey && (document.activeElement === lastNode || !form.contains(document.activeElement))) { event.preventDefault(); firstNode.focus(); }
      }
    };
    document.addEventListener('keydown', keydown, true);
    return () => {
      document.removeEventListener('keydown', keydown, true);
      inert.forEach(([node, value]) => { node.inert = value; });
      if (previous?.isConnected && !previous.inert) previous.focus();
    };
  }, []);
  return createPortal(<div className="dialog-backdrop ui-dialog-backdrop" onPointerDown={event => { if (event.target === event.currentTarget) requestClose(); }}>
    <form ref={formRef} className="category-dialog wide ui-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} aria-busy={pending} tabIndex={-1}
      onInput={() => { dirty.current = true; }} onChange={() => { dirty.current = true; }}
      onSubmit={async event => { event.preventDefault(); if (!canSubmit || pendingRef.current) return; pendingRef.current = true; setPending(true); setError(''); try { await onSubmit?.(); dirty.current = false; } catch (reason) { setError(String(reason)); } finally { pendingRef.current = false; setPending(false); } }}>
      <header className="ui-dialog-heading"><div><h2 id={titleId}>{title}</h2>{description && <p id={descriptionId}>{description}</p>}</div><button type="button" className="ui-icon-button" aria-label="关闭对话框" disabled={pending} onClick={requestClose}><X size={17}/></button></header>
      <fieldset className="dialog-fields ui-dialog-body" disabled={pending}>{children}</fieldset>
      {error && <div className="form-error" role="alert">{error}</div>}
      {discard && <div className="ui-draft-warning" role="alert"><p>还有未保存的修改，是否放弃？</p><div className="button-row"><Button onClick={() => setDiscard(false)}>继续编辑</Button><Button variant="danger" onClick={() => { dirty.current = false; cancelRef.current?.(); }}>放弃修改</Button></div></div>}
      <footer className="ui-dialog-footer"><span className="ui-status" role="status">{pending ? '正在保存…' : ''}</span><button type="button" className="secondary ui-button" disabled={pending} onClick={requestClose}>取消</button><button className={`${danger ? 'danger-button' : 'primary'} ui-button`} data-variant={danger ? 'danger' : 'primary'} disabled={!canSubmit || pending}>{pending ? '处理中…' : submitLabel}</button></footer>
    </form>
  </div>, document.body);
}

export function Confirm({ title, text, disabled, onCancel, onConfirm }) {
  return <Dialog title={title} canSubmit={!disabled} onCancel={onCancel} onSubmit={onConfirm} submitLabel="删除" danger protectDraft={false}><p className="confirm-copy">{text}</p></Dialog>;
}

export function Empty({ icon: Icon, title, text, action, onAction }) {
  return <div className="empty-state ui-empty-state">{Icon && <Icon size={28} aria-hidden="true"/>}<h2>{title}</h2>{text && <p>{text}</p>}{action && <Button variant="primary" className="primary" onClick={onAction}><Plus size={16}/>{action}</Button>}</div>;
}

export function Field({ label, children }) {
  return <label className="field ui-field"><span>{label}</span>{children}</label>;
}

export function promptTypeLabel(type) {
  return ({ 'positive-negative': '正负提示词', natural: '自然语言', 'five-point': '五点式', none: '无提示词' })[type] || '提示词';
}

export function PromptReadOnly({ label, value, muted = false, onCopy }) {
  return <div className={`prompt-readonly ${muted ? 'muted' : ''}`}><div className="prompt-readonly-label"><strong>{label}</strong><button type="button" className="copy-button ui-button" disabled={!value?.trim()} onClick={onCopy}>复制</button></div><p>{value || '未填写'}</p></div>;
}
