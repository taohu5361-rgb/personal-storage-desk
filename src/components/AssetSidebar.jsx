import { Box, CirclePlus, MoreHorizontal, Search } from 'lucide-react'

export function AssetSidebar({ active, search, onSearch, onSelect, onAdd, categories = [], menuCategoryId, onToggleMenu, onEdit, onDelete }) {
  return (
    <aside className="asset-sidebar">
      <label className="search-box">
        <Search size={16} /><span className="sr-only">搜索资产</span>
        <input data-shortcut-search value={search} onChange={(e) => onSearch(e.target.value)} placeholder="搜索资产" />
      </label>
      <nav className="side-nav" aria-label="资产分类">
        {categories.map((category) => <div className={`asset-category-row ${active === category.id ? 'active' : ''}`} key={category.id}>
          <button className="asset-category-select" onClick={() => onSelect(category.id)}><Box size={17} /><span>{category.name}</span></button>
          <button className="asset-category-more" aria-label={`管理分类 ${category.name}`} onClick={() => onToggleMenu(menuCategoryId === category.id ? '' : category.id)}><MoreHorizontal size={17} /></button>
          {menuCategoryId === category.id && <div className="asset-category-menu" role="menu"><button role="menuitem" onClick={() => onEdit(category)}>编辑分类</button><button role="menuitem" className="danger" onClick={() => onDelete(category)}>删除分类</button></div>}
        </div>)}
      </nav>
      <button type="button" className="add-category" onClick={onAdd}><CirclePlus size={17} />新增分类</button>
    </aside>
  )
}
