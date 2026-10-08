import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronRight, MousePointer2, PanelBottomClose, PanelBottomOpen, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { resolvePropertyPanelLayout } from '../propertyPanelLayout';
import { useResizablePanel } from '../hooks/useResizablePanel';
import { PanelSplitter } from './ui/PanelSplitter';
import '../styles/canvas-inspector.css';

const InspectorContext = createContext(null);
const PanelLayoutContext = createContext('right');
const stopCanvasEvent = event => event.stopPropagation();

export function CanvasPanelLayoutProvider({ value, children }) {
  return <PanelLayoutContext.Provider value={resolvePropertyPanelLayout(value)}>{children}</PanelLayoutContext.Provider>;
}

export function useCanvasInspector() {
  return useContext(InspectorContext);
}

// The host is a stable DOM node. Tools keep their existing owner, selection and
// persistence callbacks while their controls live outside the scrollable canvas.
export function CanvasInspectorPortal({ children, section = 'properties' }) {
  const inspector = useCanvasInspector();
  if (!inspector) return children;
  if (!inspector.host || !children) return null;
  return createPortal(
    <section
      className="ui-inspector-section"
      data-section={section}
      onPointerDown={stopCanvasEvent}
      onClick={stopCanvasEvent}
      onDoubleClick={stopCanvasEvent}
      onContextMenu={stopCanvasEvent}
      onWheel={stopCanvasEvent}
      onKeyDown={stopCanvasEvent}
      onKeyUp={stopCanvasEvent}
    >
      {children}
    </section>,
    inspector.host,
  );
}

export function CanvasEditorLayout({ children, surface = 'inner', layout }) {
  const preference = useContext(PanelLayoutContext);
  const placement = resolvePropertyPanelLayout(layout ?? preference);
  const layoutRef = useRef(null);
  const [host, setHost] = useState(null);
  const [open, setOpen] = useState(true);
  const [more,setMore] = useState({down:false,right:false});
  const [narrow,setNarrow] = useState(false);
  const [hasSelection,setHasSelection] = useState(false);
  const rightPanel = useResizablePanel({ storageKey:'creative-cloth.panel-size.inspector.right', defaultSize:280, minSize:220, maxSize:520, minContentSize:narrow?32:280, axis:'x', direction:-1, containerRef:layoutRef });
  const bottomPanel = useResizablePanel({ storageKey:'creative-cloth.panel-size.inspector.bottom', defaultSize:hasSelection?156:96, minSize:64, maxSize:520, minContentSize:narrow?56:160, axis:'y', direction:-1, containerRef:layoutRef });
  const panel = placement === 'bottom' ? bottomPanel : rightPanel;
  const panelId = useId();
  const setHostNode = useCallback(node => setHost(previous => previous === node ? previous : node), []);
  const context = useMemo(() => ({ host, surface, placement }), [host, surface, placement]);
  const CloseIcon = placement === 'bottom' ? PanelBottomClose : PanelRightClose;
  const OpenIcon = placement === 'bottom' ? PanelBottomOpen : PanelRightOpen;

  useEffect(() => {
    if (!host || !open) return;
    const measure = () => {
      setHasSelection(!!host.querySelector('.canvas-arrange-toolbar[data-selection-count]:not([data-selection-count="0"]), .text-style-toolbar'));
      const next = {down:host.scrollHeight-host.clientHeight-host.scrollTop > 2,right:host.scrollWidth-host.clientWidth-host.scrollLeft > 2};
      setMore(previous => previous.down === next.down && previous.right === next.right ? previous : next);
    };
    const resize = new ResizeObserver(measure);
    const mutation = new MutationObserver(measure);
    resize.observe(host);
    mutation.observe(host,{childList:true,subtree:true,attributes:true,attributeFilter:['open','hidden','class','data-selection-count']});
    host.addEventListener('scroll',measure);
    measure();
    return () => {resize.disconnect();mutation.disconnect();host.removeEventListener('scroll',measure);};
  },[host,open,placement]);

  useEffect(() => {
    const layout = layoutRef.current;
    let wasNarrow = false;
    const resize = () => {
      const nextNarrow = layout.clientWidth <= 760;
      setNarrow(nextNarrow);
      if (nextNarrow && !wasNarrow) setOpen(false);
      wasNarrow = nextNarrow;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(layout);
    resize();
    return () => observer.disconnect();
  }, []);

  return (
    <InspectorContext.Provider value={context}>
      <div ref={layoutRef} className="ui-editor-layout" style={{'--inspector-width':`${rightPanel.size}px`,'--inspector-height':`${bottomPanel.size}px`}} data-surface={surface} data-panel-layout={placement} data-inspector-open={open} data-selection={hasSelection}>
        <div className="ui-editor-stage" data-editor-scroll={surface === 'standard' ? 'true' : undefined}>
          {children}
        </div>
        <aside id={panelId} className="ui-inspector" aria-label="属性面板" hidden={!open} onPointerDown={stopCanvasEvent}>
          <header className="ui-inspector-header">
            <h2>属性</h2><span className="ui-inspector-placement">{placement === 'bottom' ? '底部面板' : '右侧面板'}</span>
            {(more.down || more.right) && <button type="button" className="ui-inspector-more" aria-label="查看更多属性" title={more.down ? '向下滚动查看完整属性' : '向右滚动查看完整属性'} onClick={() => host?.scrollBy({top:more.down ? host.clientHeight * .7 : 0,left:more.right ? host.clientWidth * .7 : 0,behavior:'auto'})}>更多属性{more.down ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</button>}
            <button type="button" className="ui-icon-button" aria-label="收起属性面板" title="收起属性面板" aria-controls={panelId} aria-expanded={open} onClick={() => setOpen(false)}>
              <CloseIcon size={17} />
            </button>
          </header>
          <div ref={setHostNode} className="ui-inspector-body">
            <div className="ui-inspector-empty">
              <MousePointer2 size={20} aria-hidden="true" />
              <strong>选择一个对象</strong>
              <p>点击文字可调整字体、颜色和容器样式。</p>
              <p>{surface === 'standard' ? '使用“定位文字”快速找到详情中的文字块。' : '拖动空白处框选；按住空格或中键平移；滚轮缩放。'}</p>
            </div>
          </div>
        </aside>
        {open && <PanelSplitter className="ui-inspector-splitter" label={placement === 'bottom' ? '调整底部属性面板高度' : '调整右侧属性面板宽度'} axis={placement === 'bottom' ? 'y' : 'x'} aria-controls={panelId} {...panel.splitterProps} />}
        {!open && <button type="button" className="ui-inspector-open ui-icon-button" aria-label="展开属性面板" title="展开属性面板" aria-controls={panelId} aria-expanded={open} onClick={() => setOpen(true)}>
          <OpenIcon size={17} />
        </button>}
      </div>
    </InspectorContext.Provider>
  );
}
