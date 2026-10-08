import { Box, CirclePlus, MoreHorizontal, Search } from 'lucide-react'
import {useRef} from 'react'
import { SidebarToggle } from './SidebarToggle'
import {PopupMenu} from './ui/PopupMenu'

export function AssetSidebar({ active, search, onSearch, onSelect, onAdd, categories = [], menuCategoryId, onToggleMenu, onEdit, onDelete, searchRef, expanded, onToggleSidebar }) {
  const anchors=useRef(new Map());
  const menuCategory=categories.find(item=>item.id===menuCategoryId);
  return (
    <aside className="asset-sidebar ui-sidebar">
      <div className="sidebar-topbar asset-sidebar-topbar">
      <label className="search-box">
        <Search size={16} /><span className="sr-only">搜索当前分类</span>
        <input ref={searchRef} data-shortcut-search value={search} onChange={(e) => onSearch(e.target.value)} placeholder="搜索当前分类" />
      </label>
      <SidebarToggle expanded={expanded} onToggle={onToggleSidebar} controls="asset-sidebar" showLabel />
      </div>
      <nav className="side-nav" aria-label="资产分类">
        {categories.map((category) => <div className={`asset-category-row ${active === category.id ? 'active' : ''}`} key={category.id}>
          <button className="asset-category-select" aria-current={active === category.id ? 'page' : undefined} onClick={() => onSelect(category.id)}><Box size={17} /><span>{category.name}</span></button>
          <button ref={node=>{if(node)anchors.current.set(category.id,node);else anchors.current.delete(category.id)}} className="asset-category-more" aria-label={`管理分类 ${category.name}`} aria-haspopup="menu" aria-expanded={menuCategoryId === category.id} onClick={() => onToggleMenu(menuCategoryId === category.id ? '' : category.id)}><MoreHorizontal size={17} /></button>
        </div>)}
      </nav>
      <button type="button" className="add-category" onClick={onAdd}><CirclePlus size={17} />新增分类</button>
      {menuCategory && <PopupMenu anchor={anchors.current.get(menuCategory.id)} label={`管理分类 ${menuCategory.name}`} onClose={()=>onToggleMenu('')}><button role="menuitem" onClick={()=>{onToggleMenu('');onEdit(menuCategory)}}>编辑分类</button><button role="menuitem" className="danger" onClick={()=>{onToggleMenu('');onDelete(menuCategory)}}>删除分类</button></PopupMenu>}
    </aside>
  )
}
