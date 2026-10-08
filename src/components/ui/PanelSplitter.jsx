import './panelSplitter.css';

export function PanelSplitter({ label, axis='x', className='', resizing=false, ...props }) {
  return <div {...props} role="separator" tabIndex={0} aria-label={label} aria-orientation={axis==='x'?'vertical':'horizontal'} aria-valuetext={`${props['aria-valuenow']} 像素`} className={`ui-panel-splitter ${className}`} data-axis={axis} data-resizing={resizing} title={`${label}；拖动调整，双击恢复默认，方向键微调`}><span aria-hidden="true" /></div>;
}
