import './style.css'

console.log('CMS Application Started')

// --- STATE MANAGEMENT ---
const DEFAULT_PAGE_COUNT = 15
let pageCount = DEFAULT_PAGE_COUNT

function loadConfig() {
    const saved = localStorage.getItem('book_config')
    if (saved) {
        const config = JSON.parse(saved)
        pageCount = config.pageCount || DEFAULT_PAGE_COUNT
    } else {
        saveConfig() // Init defaults
    }
}

function saveConfig() {
    const config = { pageCount }
    localStorage.setItem('book_config', JSON.stringify(config))
}

function getPages() {
    // Generate pages array based on current count
    return [
        { id: 'cover-front', name: 'Front Cover' },
        ...Array.from({ length: pageCount }, (_, i) => ({ id: `page-${i + 1}`, name: `Page ${i + 1}` })),
        { id: 'cover-back', name: 'Back Cover' }
    ]
}

// --- APP INIT ---
loadConfig()
let pages = getPages()

const app = document.querySelector('#cms-app')

// Initial Layout
app.innerHTML = `
    <div class="cms-container">
        <aside class="cms-sidebar">
            <div class="cms-header-row">
                <div class="cms-logo">Scrapbook</div>
                <div class="badge">CMS</div>
            </div>
            
            <div class="sidebar-actions">
                <button id="btn-add-page" class="action-btn">
                    <span>+</span> Add Page
                </button>
                <button id="btn-remove-page" class="action-btn danger">
                    <span>-</span> Pop Last
                </button>
            </div>

            <nav class="cms-nav" id="page-list">
                <!-- Injected via JS -->
            </nav>
            
            <div class="sidebar-footer">
                <span id="page-count-display">${pageCount} Pages</span>
            </div>
        </aside>
        <main class="cms-content">
            <header class="cms-header">
                <h2 id="page-title">Dashboard</h2>
            </header>
            <div class="cms-workspace" id="workspace">
                <div class="empty-state">
                    <h3>Select a Page</h3>
                    <p>Choose a page from the sidebar to manage its content.</p>
                </div>
            </div>
        </main>
    </div>
`

const pageListEl = document.getElementById('page-list')
const pageTitleEl = document.getElementById('page-title')
const workspaceEl = document.getElementById('workspace')
const btnAdd = document.getElementById('btn-add-page')
const btnRemove = document.getElementById('btn-remove-page')
const countDisplay = document.getElementById('page-count-display')

function updateFooter() {
    countDisplay.textContent = `${pageCount} Pages`
}

// --- LOGIC ---

function deletePageLogic(idToDelete) {
    if (!idToDelete.startsWith('page-')) {
        alert("Cannot delete covers.")
        return
    }

    const index = parseInt(idToDelete.replace('page-', ''))
    if (isNaN(index)) return

    if (!confirm(`Are you sure you want to delete Page ${index}? This will shift all subsequent pages down.`)) return

    // 1. Shift Keys Down
    for (let i = index; i < pageCount; i++) {
        const currentId = `page-${i}`
        const nextId = `page-${i + 1}`

        // Shift Front
        const splitFront = localStorage.getItem(`texture_${nextId}-front`)
        if (splitFront) {
            localStorage.setItem(`texture_${currentId}-front`, splitFront)
        } else {
            localStorage.removeItem(`texture_${currentId}-front`)
        }

        // Shift Back
        const splitBack = localStorage.getItem(`texture_${nextId}-back`)
        if (splitBack) {
            localStorage.setItem(`texture_${currentId}-back`, splitBack)
        } else {
            localStorage.removeItem(`texture_${currentId}-back`)
        }
    }

    // 2. Remove last page's keys
    const lastId = `page-${pageCount}`
    localStorage.removeItem(`texture_${lastId}-front`)
    localStorage.removeItem(`texture_${lastId}-back`)

    // 3. Update Count
    pageCount--
    saveConfig()

    // 4. Refresh
    pages = getPages()
    let newIndex = Math.min(index, pageCount)
    if (newIndex < 1) newIndex = 1

    renderPageList()

    if (pageCount > 0) {
        // Select the page that is now at this index (or nearest)
        const newId = `page-${newIndex}`
        // Force selection state
        const newItem = document.querySelector(`.nav-item[data-id="${newId}"]`)
        if (newItem) {
            newItem.classList.add('active')
            selectPage(newId)
        }
    } else {
        workspaceEl.innerHTML = '<p class="placeholder">No pages left. Add one!</p>'
    }
    updateFooter()
}

// --- EVENT HANDLERS ---
btnAdd.addEventListener('click', () => {
    pageCount++
    saveConfig()
    pages = getPages()
    renderPageList()
    updateFooter()
})

btnRemove.addEventListener('click', () => {
    // Legacy support: Pop last
    if (pageCount > 1) {
        pageCount--
        saveConfig()
        pages = getPages()
        renderPageList()
        updateFooter()
    } else {
        alert("Cannot have fewer than 1 page.")
    }
})

function renderPageList(activeId = null) {
    pageListEl.innerHTML = pages.map(page => `
        <div class="nav-item ${page.id === activeId ? 'active' : ''}" data-id="${page.id}">
            <span class="nav-text">${page.name}</span>
        </div>
    `).join('')

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'))
            item.classList.add('active')
            selectPage(item.dataset.id)
        })
    })
}

function selectPage(id) {
    const page = pages.find(p => p.id === id)
    if (!page) return

    pageTitleEl.textContent = page.name

    const isDeletable = id.startsWith('page-')

    // Helper to create side HTML
    const renderSide = (sideKey, label) => {
        const storageKey = `texture_${id}-${sideKey}`
        const hasImage = !!localStorage.getItem(storageKey)

        return `
        <div class="side-block" id="block-${sideKey}">
            <div class="side-header">
                <div class="side-title">${label}</div>
            </div>
            <div class="preview-area">
                <div class="preview-box">
                     <div class="img-container">
                        ${hasImage
                ? `<img src="${localStorage.getItem(storageKey)}" class="preview-img">`
                : `<span class="placeholder-text">No Texture</span>`
            }
                     </div>
                </div>
            </div>
            <div class="action-area">
                 ${hasImage ? `
                    <div class="btn-group">
                        <label class="btn-action btn-replace">
                            Replace
                            <input type="file" accept="image/*" hidden class="input-file" data-side="${sideKey}">
                        </label>
                        <button class="btn-action btn-delete-img" data-side="${sideKey}">Delete</button>
                    </div>
                 ` : `
                    <label class="btn-upload">
                        Upload Image
                        <input type="file" accept="image/*" hidden class="input-file" data-side="${sideKey}">
                    </label>
                 `}
            </div>
        </div>
    `}

    workspaceEl.innerHTML = `
        <div class="editor-container">
            ${isDeletable ? `
            <div class="editor-header-actions">
                <button id="btn-delete-current-page" class="action-btn danger-outline">
                    Delete This Page
                </button>
            </div>` : ''}
            
            <div class="sides-grid">
                ${renderSide('front', isDeletable ? 'Front (Recto)' : 'Outside')}
                ${renderSide('back', isDeletable ? 'Back (Verso)' : 'Inside')}
            </div>
        </div>
    `

    // Wire up Delete Page
    if (isDeletable) {
        document.getElementById('btn-delete-current-page').addEventListener('click', () => {
            deletePageLogic(id)
        })
    }

    // Wiring up Images
    const wireUp = (sideKey) => {
        const container = document.getElementById(`block-${sideKey}`)
        if (!container) return

        const storageKey = `texture_${id}-${sideKey}`

        // Direct binding for Inputs
        const fileInput = container.querySelector('.input-file')
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0]
                if (file) {
                    const reader = new FileReader()
                    reader.onload = (ev) => {
                        const result = ev.target.result
                        try {
                            localStorage.setItem(storageKey, result)
                            selectPage(id)
                        } catch (err) {
                            console.error(err)
                            alert('Image too large. Try smaller file.')
                        }
                    }
                    reader.readAsDataURL(file)
                }
            })
        }

        // Direct binding for Delete Button
        const deleteBtn = container.querySelector('.btn-delete-img')
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.preventDefault() // Prevent bubbling issues
                if (confirm('Remove this image?')) {
                    localStorage.removeItem(storageKey)
                    selectPage(id)
                }
            })
        }
    }

    wireUp('front')
    wireUp('back')
}

renderPageList()
