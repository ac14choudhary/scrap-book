import * as THREE from 'three'
import Experience from '../Experience.js'
import gsap from 'gsap'

export default class Book {
    constructor() {
        this.experience = new Experience()
        this.scene = this.experience.scene
        this.time = this.experience.time

        // Parameters for Spiral Notebook
        this.params = {
            width: 3.5,
            height: 5,
            coverThickness: 0.05,
            pageThickness: 0.005,
            spiralRadius: 0.2,
            spiralSpacing: 0.25,
            wireThickness: 0.025,
            holeRadius: 0.08,
            holeMargin: 0.15,
            isOpen: false
        }

        this.group = new THREE.Group()
        this.scene.add(this.group)

        this.setMaterials()
        this.setMesh()
        this.userHasInteracted = false
        this.setupGestures()

        // Auto-Flip to First Page after 3 seconds (Only if no interaction)
        setTimeout(() => {
            if (!this.userHasInteracted) {
                this.turnNext()
            }
        }, 3000)
    }

    setMaterials() {
        const textures = {}
        if (this.experience.resources.items.coverTexture) {
            textures.cover = this.experience.resources.items.coverTexture
            textures.cover.colorSpace = THREE.SRGBColorSpace
            textures.cover.wrapS = THREE.RepeatWrapping
            textures.cover.wrapT = THREE.RepeatWrapping
        }

        if (this.experience.resources.items.pageTexture) {
            textures.page = this.experience.resources.items.pageTexture
            textures.page.colorSpace = THREE.SRGBColorSpace
            textures.page.wrapS = THREE.RepeatWrapping
            textures.page.wrapT = THREE.RepeatWrapping
            textures.page.repeat.set(1, 1)
            textures.page.anisotropy = this.experience.renderer.instance.capabilities.getMaxAnisotropy()
        }

        this.coverMaterial = new THREE.MeshStandardMaterial({
            map: textures.cover || null,
            color: '#d4a373',
            roughness: 0.7,
            side: THREE.DoubleSide
        })

        this.pageMaterial = new THREE.MeshStandardMaterial({
            map: null,
            bumpMap: textures.page || null,
            bumpScale: 0.05,
            color: '#ffffff',
            roughness: 0.9,
            metalness: 0,
            side: THREE.DoubleSide
        })

        // --- CHECK LOCAL STORAGE FOR OVERRIDES ---
        // Cover Front
        const savedFront = localStorage.getItem('texture_cover-front')
        if (savedFront) {
            const tex = new THREE.TextureLoader().load(savedFront)
            tex.colorSpace = THREE.SRGBColorSpace
            tex.wrapS = THREE.RepeatWrapping
            tex.wrapT = THREE.RepeatWrapping
            this.coverMaterial.map = tex
            this.coverMaterial.needsUpdate = true
        }

        // We need unique materials for pages if they have unique textures
        // Currently all pages share `this.pageMaterial`. 
        // We will need to clone materials for specific pages in `setMesh`.

        this.spiralMaterial = new THREE.MeshStandardMaterial({
            color: '#333333',
            metalness: 0.6,
            roughness: 0.4
        })
    }

    createContentPlane(width, height) {
        // Create a plane that fits within the page margins (avoiding the holes)
        const geometry = new THREE.PlaneGeometry(width, height)
        // Center it
        // geometry.translate(width / 2, 0, 0)
        return geometry
    }

    createPageNumberMesh(number) {
        const canvas = document.createElement('canvas')
        canvas.width = 128
        canvas.height = 128
        const ctx = canvas.getContext('2d')

        // Clear (Transparent)
        ctx.clearRect(0, 0, 128, 128)

        // Text Style
        ctx.fillStyle = '#555555'
        ctx.font = '300 24px "Futura", "Century Gothic", "Tw Cen MT", "Arial", sans-serif' // Light Geometric
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        // Draw Number
        ctx.fillText(number.toString(), 64, 64)

        const tex = new THREE.CanvasTexture(canvas)
        tex.colorSpace = THREE.SRGBColorSpace

        const mat = new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            side: THREE.FrontSide
        })

        const geo = new THREE.PlaneGeometry(0.5, 0.5)
        const mesh = new THREE.Mesh(geo, mat)

        return mesh
    }

    createHoleyGeometry(width, height, thickness, holeCount, holeRadius, holeMargin) {
        const shape = new THREE.Shape()

        // Draw Rectangle around center
        shape.moveTo(0, -height / 2)
        shape.lineTo(width, -height / 2)
        shape.lineTo(width, height / 2)
        shape.lineTo(0, height / 2)
        shape.lineTo(0, -height / 2)

        // Create Holes
        const totalH = (holeCount - 1) * this.params.spiralSpacing
        const startY = -totalH / 2

        for (let i = 0; i < holeCount; i++) {
            const y = startY + (i * this.params.spiralSpacing)
            const holePath = new THREE.Path()
            holePath.absarc(holeMargin, y, holeRadius, 0, Math.PI * 2, true)
            shape.holes.push(holePath)
        }

        const extrudeSettings = {
            steps: 1,
            depth: thickness,
            bevelEnabled: false
        }

        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings)

        // Normalize: Place Holes Center at (0,0,0) locally
        geometry.translate(-holeMargin, 0, -thickness / 2)

        return geometry
    }

    setMesh() {
        this.bookContainer = new THREE.Group()
        this.group.add(this.bookContainer)

        const count = Math.floor(this.params.height / this.params.spiralSpacing)

        // --- SPIRAL RINGS ---
        const spiralGroup = new THREE.Group()
        this.bookContainer.add(spiralGroup)

        const ringGeo = new THREE.TorusGeometry(
            this.params.spiralRadius,
            this.params.wireThickness,
            16,
            32
        )

        for (let i = 0; i < count; i++) {
            const ring = new THREE.Mesh(ringGeo, this.spiralMaterial)
            const totalH = (count - 1) * this.params.spiralSpacing
            const yPos = (i * this.params.spiralSpacing) - (totalH / 2)

            ring.position.set(0, yPos, 0)
            ring.rotation.x = Math.PI / 2
            ring.rotation.y = -0.25
            spiralGroup.add(ring)
        }

        // --- GEOMETRIES ---
        const coverGeo = this.createHoleyGeometry(
            this.params.width,
            this.params.height,
            this.params.coverThickness,
            count,
            this.params.holeRadius,
            this.params.holeMargin
        )

        const pageGeo = this.createHoleyGeometry(
            this.params.width - 0.1,
            this.params.height - 0.1,
            this.params.pageThickness,
            count,
            this.params.holeRadius,
            this.params.holeMargin
        )

        // --- STACKING VIA ROTATION ONLY ---
        const r = this.params.spiralRadius

        // Dynamic Page Count
        let pageCount = 15
        try {
            const config = JSON.parse(localStorage.getItem('book_config'))
            if (config && config.pageCount) {
                pageCount = config.pageCount
            }
        } catch (e) {
            console.warn('Could not load book config, defaulting to 15 pages.')
        }

        const angularSpacing = 0 // CLOSED COMPLETELY (Flat)

        let currentAngle = -((pageCount + 2) * angularSpacing) / 2

        this.frontCoverPivot = new THREE.Group()
        // Revert static offset: Start at natural 0 position
        this.frontCoverPivot.position.set(0, 0, 0)
        this.frontCoverPivot.rotation.y = currentAngle
        this.bookContainer.add(this.frontCoverPivot)

        this.frontCover = new THREE.Mesh(coverGeo, this.coverMaterial)
        this.frontCover.position.set(r, 0, 0)
        this.frontCoverPivot.add(this.frontCover)

        // --- FRONT COVER CONTENT PLANES ---
        const cWidth = this.params.width - this.params.holeMargin
        const cHeight = this.params.height
        const planeGeo = this.createContentPlane(cWidth, cHeight)

        // Front (Outside) 
        const frontMat = new THREE.MeshBasicMaterial({
            color: 0xffffff, transparent: true, opacity: 0, side: THREE.FrontSide
        })
        const frontPlane = new THREE.Mesh(planeGeo, frontMat)
        // Z = coverThickness/2 + epsilon
        frontPlane.position.set(r + (cWidth / 2), 0, (this.params.coverThickness / 2) + 0.0005)
        // Raycast Fix:
        frontPlane.userData = { isCover: true, isFront: true, pivot: this.frontCoverPivot }
        this.frontCoverPivot.add(frontPlane)

        // Back (Inside)
        const backMat = new THREE.MeshBasicMaterial({
            color: 0xffffff, transparent: true, opacity: 0, side: THREE.FrontSide
        })
        const backPlane = new THREE.Mesh(planeGeo, backMat)
        backPlane.rotation.y = Math.PI
        backPlane.position.set(r + (cWidth / 2), 0, -(this.params.coverThickness / 2) - 0.0005)
        // Raycast Fix:
        backPlane.userData = { isCover: true, isFront: true, pivot: this.frontCoverPivot }
        this.frontCoverPivot.add(backPlane)

        // Load Textures
        const id = 'cover-front'
        const savedFront = localStorage.getItem(`texture_${id}-front`)
        const savedBack = localStorage.getItem(`texture_${id}-back`)

        if (savedFront) {
            const tex = new THREE.TextureLoader().load(savedFront)
            tex.colorSpace = THREE.SRGBColorSpace
            frontMat.map = tex
            frontMat.opacity = 1
            frontMat.needsUpdate = true
        }

        if (savedBack) {
            const tex = new THREE.TextureLoader().load(savedBack)
            tex.colorSpace = THREE.SRGBColorSpace
            backMat.map = tex
            backMat.opacity = 1
            backMat.needsUpdate = true
        }

        // userData to identify
        this.frontCover.userData = { isCover: true, isFront: true, pivot: this.frontCoverPivot }
        this.frontCoverPivot.userData = { isTurned: false, baseAngle: currentAngle }

        currentAngle += angularSpacing * 1.5

        // Pages
        this.pages = []

        // Stacking Calculation (NEGATIVE Z)
        // Cover is at 0 (From -thick/2 to +thick/2)
        // We want pages BEHIND the cover (Negative Z) so when flipped they come ON TOP.
        // Start from -coverThickness/2
        let currentZ = -this.params.coverThickness / 2

        for (let i = 0; i < pageCount; i++) {
            const pPivot = new THREE.Group()

            // Offset Z to stack pages physically (Negative direction)
            // Offset Z to stack pages physically (Negative direction)
            const pZ = currentZ - (this.params.pageThickness / 2)
            pPivot.position.set(0, 0, pZ)
            pPivot.rotation.y = currentAngle
            this.bookContainer.add(pPivot)

            currentZ -= this.params.pageThickness

            // 1. BASE PAPER MESH
            const pMesh = new THREE.Mesh(pageGeo, this.pageMaterial)
            pMesh.position.set(r, 0, 0)
            pPivot.add(pMesh)

            // 2. CONTENT PLANES (Dual Sided)
            // Printable area: width - margin. Height - margin
            const cWidth = this.params.width - 0.1 - this.params.holeMargin
            const cHeight = this.params.height - 0.1
            const planeGeo = this.createContentPlane(cWidth, cHeight)

            // Front Content (Offset +Z)
            const frontMat = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0,
                side: THREE.FrontSide
            })
            const frontPlane = new THREE.Mesh(planeGeo, frontMat)
            // Center X = r + (cWidth/2). Z = Thickness/2 + epsilon
            frontPlane.position.set(r + (cWidth / 2), 0, (this.params.pageThickness / 2) + 0.0005)
            // Raycast Fix:
            frontPlane.userData = { parentPivot: pPivot }
            pPivot.add(frontPlane)

            // Back Content (Offset -Z, Flipped)
            const backMat = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0,
                side: THREE.FrontSide
            })
            const backPlane = new THREE.Mesh(planeGeo, backMat)
            backPlane.rotation.y = Math.PI // Flip for back reading
            backPlane.position.set(r + (cWidth / 2), 0, -(this.params.pageThickness / 2) - 0.0005)
            // Raycast Fix:
            backPlane.userData = { parentPivot: pPivot }
            pPivot.add(backPlane)

            // LOAD TEXTURES
            const id = `page-${i + 1}`
            const savedFront = localStorage.getItem(`texture_${id}-front`)
            const savedBack = localStorage.getItem(`texture_${id}-back`)

            if (savedFront) {
                const tex = new THREE.TextureLoader().load(savedFront)
                tex.colorSpace = THREE.SRGBColorSpace
                frontMat.map = tex
                frontMat.opacity = 1
                frontMat.needsUpdate = true
            }

            if (savedBack) {
                const tex = new THREE.TextureLoader().load(savedBack)
                tex.colorSpace = THREE.SRGBColorSpace
                backMat.map = tex
                backMat.opacity = 1
                backMat.needsUpdate = true
            }

            // --- PAGE NUMBERS ---
            // Front Page Number (Odd: 1, 3, 5...)
            // Bottom Right (Outer Edge)
            const numFront = (i * 2) + 1
            const numFrontMesh = this.createPageNumberMesh(numFront)

            // X: Start + Width - margin. Y: Bottom - margin
            numFrontMesh.position.set(r + cWidth - 0.25, -(this.params.height / 2) + 0.25, (this.params.pageThickness / 2) + 0.001)

            numFrontMesh.userData = { parentPivot: pPivot }
            pPivot.add(numFrontMesh)

            // Back Page Number (Even: 2, 4, 6...)
            // Bottom Left (Outer Edge) when viewed from back
            const numBack = (i * 2) + 2
            const numBackMesh = this.createPageNumberMesh(numBack)
            numBackMesh.rotation.y = Math.PI

            // X: Outer Edge.
            numBackMesh.position.set(r + cWidth - 0.25, -(this.params.height / 2) + 0.25, -(this.params.pageThickness / 2) - 0.001)

            numBackMesh.userData = { parentPivot: pPivot }
            pPivot.add(numBackMesh)

            // Setup state
            pPivot.userData = {
                isPage: true,
                isTurned: false,
                index: i,
                baseAngle: currentAngle
            }
            pMesh.userData = { parentPivot: pPivot }

            this.pages.push(pPivot)

            // NO CONTENT ADDED HERE

            currentAngle += angularSpacing
        }

        currentAngle += angularSpacing * 0.5

        // Back Cover
        this.backCoverPivot = new THREE.Group()

        // Back Cover sits BEHIND the last page
        const backCoverZ = currentZ - (this.params.coverThickness / 2)
        this.backCoverPivot.position.set(0, 0, backCoverZ)

        this.backCoverPivot.rotation.y = currentAngle
        this.bookContainer.add(this.backCoverPivot)

        this.backCover = new THREE.Mesh(coverGeo, this.coverMaterial)
        this.backCover.position.set(r, 0, 0)
        this.backCoverPivot.add(this.backCover)

        // --- BACK COVER CONTENT PLANES ---
        const bWidth = this.params.width - this.params.holeMargin
        const bHeight = this.params.height
        const bPlaneGeo = this.createContentPlane(bWidth, bHeight)

        // Front (Inside the Book)
        const bFrontMat = new THREE.MeshBasicMaterial({
            color: 0xffffff, transparent: true, opacity: 0, side: THREE.FrontSide
        })
        const bFrontPlane = new THREE.Mesh(bPlaneGeo, bFrontMat)
        // Z = coverThickness/2 + epsilon
        bFrontPlane.position.set(r + (bWidth / 2), 0, (this.params.coverThickness / 2) + 0.0005)
        // Raycast Fix: Note use of isBack: true
        bFrontPlane.userData = { isCover: true, isBack: true, pivot: this.backCoverPivot }
        this.backCoverPivot.add(bFrontPlane)

        // Back (Outside Back Cover)
        const bBackMat = new THREE.MeshBasicMaterial({
            color: 0xffffff, transparent: true, opacity: 0, side: THREE.FrontSide
        })
        const bBackPlane = new THREE.Mesh(bPlaneGeo, bBackMat)
        bBackPlane.rotation.y = Math.PI
        bBackPlane.position.set(r + (bWidth / 2), 0, -(this.params.coverThickness / 2) - 0.0005)
        // Raycast Fix:
        bBackPlane.userData = { isCover: true, isBack: true, pivot: this.backCoverPivot }
        this.backCoverPivot.add(bBackPlane)

        // LOAD TEXTURES
        const bId = 'cover-back'
        const bSavedFront = localStorage.getItem(`texture_${bId}-front`)
        const bSavedBack = localStorage.getItem(`texture_${bId}-back`)

        // Legacy fallback
        const bLegacy = localStorage.getItem(`texture_${bId}`)

        if (bSavedFront || (bLegacy && !bSavedFront)) {
            const tex = new THREE.TextureLoader().load(bSavedFront || bLegacy)
            tex.colorSpace = THREE.SRGBColorSpace
            bFrontMat.map = tex
            bFrontMat.opacity = 1
            bFrontMat.needsUpdate = true
        }

        if (bSavedBack) {
            const tex = new THREE.TextureLoader().load(bSavedBack)
            tex.colorSpace = THREE.SRGBColorSpace
            bBackMat.map = tex
            bBackMat.opacity = 1
            bBackMat.needsUpdate = true
        }

        this.backCover.userData = { isCover: true, isBack: true }
    }

    interact(intersect) {
        if (!intersect || !intersect.object) return

        this.userHasInteracted = true // Cancel Auto-Flip

        const obj = intersect.object
        const parentPivot = obj.userData.parentPivot || (obj.userData.isCover ? obj.userData.pivot : null)

        // Handle Front Cover
        if (obj.userData.isFront) {
            this.turnCover(this.frontCoverPivot)
            return
        }

        // Handle Pages
        if (parentPivot && parentPivot.userData.isPage) {
            this.turnPage(parentPivot)
        }
    }

    turnCover(pivot) {
        const isTurned = pivot.userData.isTurned

        if (!isTurned) {
            // Opening cover
            // Use a wider angle to ensure pages don't clip through
            const openAngle = -Math.PI - 0.2

            // Rotate Cover
            gsap.to(pivot.rotation, {
                duration: 1.5,
                y: openAngle,
                ease: 'power2.inOut'
            })

            // Dynamic Offset: Move Pivot DOWN/BACK to clear pages when open
            gsap.to(pivot.position, {
                duration: 1.5,
                z: -0.1, // Move to requested offset
                ease: 'power2.inOut'
            })

            pivot.userData.isTurned = true

            // Animate camera
            gsap.to(this.group.rotation, {
                duration: 1.5,
                x: -Math.PI / 4 + 0.2,
                y: 0,
                ease: 'power2.out'
            })
        } else {
            // Closing cover - Check if pages are open
            const anyPageTurned = this.pages.some(p => p.userData.isTurned)
            if (anyPageTurned) {
                return
            }

            gsap.to(pivot.rotation, {
                duration: 1.5,
                y: pivot.userData.baseAngle,
                ease: 'power2.inOut'
            })

            // Reset Position
            gsap.to(pivot.position, {
                duration: 1.5,
                z: 0,
                ease: 'power2.inOut'
            })

            pivot.userData.isTurned = false
        }
    }

    turnPage(pivot) {
        const index = pivot.userData.index
        const isTurned = pivot.userData.isTurned

        const openAngleBase = -Math.PI - 0.2 // SAME as cover

        if (!isTurned) {
            // Turning LEFT (Opening)
            // stack: Cover -> 0 -> 1 -> ... -> N

            // Constraint: Can only turn 'index' if 'index - 1' is already turned.
            if (index > 0) {
                const prevPage = this.pages[index - 1]
                if (!prevPage.userData.isTurned) {
                    return // Block: Must turn previous page first
                }
            } else {
                // Index 0: Check Cover
                if (!this.frontCoverPivot.userData.isTurned) {
                    return
                }
            }

            // Very tiny offset to prevent z-fighting, or 0 if desired.
            const targetAngle = openAngleBase + (index * 0.001)

            gsap.to(pivot.rotation, {
                duration: 1.2,
                y: targetAngle,
                ease: 'power2.inOut'
            })

            // Re-stack Z for Left Side
            // On Right: Z is negative increasing (0 -> -0.05)
            // On Left: We want them to stack UP relative to Cover?
            // Page 0 should be at Z=0 (on top of cover). Page 1 at Z=0.005.
            // Let's bring them to Positive Z to sit on top of the rotated cover.
            const newZ = (index + 1) * 0.005 // Simple stacking

            gsap.to(pivot.position, {
                duration: 1.2,
                z: newZ,
                ease: 'power2.inOut'
            })

            pivot.userData.isTurned = true

        } else {
            // Turning RIGHT (Closing)
            if (index < this.pages.length - 1) {
                const nextPage = this.pages[index + 1]
                if (nextPage.userData.isTurned) {
                    return // Block: Page above me (Left) is still here.
                }
            }

            gsap.to(pivot.rotation, {
                duration: 1.2,
                y: pivot.userData.baseAngle,
                ease: 'power2.inOut'
            })

            // Restore Original Z (Negative Stacking)
            // We need to calculate what the original Z was.
            // It was: -coverThickness/2 - (index * pageThickness) - pageThickness/2
            // Simplest is to store it in userData or recalculate.
            // Recalculating:
            // startZ = -0.025 - 0.0025 = -0.0275
            // index 0: -0.0275
            // index 1: -0.0325
            const originalZ = -(this.params.coverThickness / 2) - (this.params.pageThickness / 2) - (index * this.params.pageThickness)

            gsap.to(pivot.position, {
                duration: 1.2,
                z: originalZ,
                ease: 'power2.inOut'
            })

            pivot.userData.isTurned = false
        }
    }

    // --- GESTURES ---

    turnNext() {
        if (this.frontCoverPivot.userData.isAnimating || this.pages.some(p => p.userData.isAnimating)) return

        // 1. Cover
        if (!this.frontCoverPivot.userData.isTurned) {
            this.turnCover(this.frontCoverPivot)
            return
        }

        // 2. Pages
        // Find first page that is NOT turned
        const pageToTurn = this.pages.find(p => !p.userData.isTurned)
        if (pageToTurn) {
            this.turnPage(pageToTurn)
        }
    }

    turnPrev() {
        if (this.frontCoverPivot.userData.isAnimating || this.pages.some(p => p.userData.isAnimating)) return

        // 1. Pages
        // Find last page that IS turned
        const reversed = [...this.pages].reverse()
        const pageToTurnBack = reversed.find(p => p.userData.isTurned)

        if (pageToTurnBack) {
            this.turnPage(pageToTurnBack)
            return
        }

        // 2. Cover
        if (this.frontCoverPivot.userData.isTurned) {
            this.turnCover(this.frontCoverPivot)
        }
    }

    setupGestures() {
        let lastScroll = 0
        const cooldown = 800 // ms

        window.addEventListener('wheel', (e) => {
            const now = Date.now()
            if (now - lastScroll < cooldown) return

            // Horizontal Swipe
            // Trackpad: Two fingers LEFT (Scroll Right) -> deltaX > 0 -> Next Page
            // Trackpad: Two fingers RIGHT (Scroll Left) -> deltaX < 0 -> Prev Page

            if (Math.abs(e.deltaX) > 20) { // Threshold
                this.userHasInteracted = true // Cancel Auto-Flip

                if (e.deltaX > 0) {
                    this.turnNext()
                } else {
                    this.turnPrev()
                }
                lastScroll = now
            }
        }, { passive: true })
    }

    update() {
        if (!this.isOpen) {
            this.group.position.y = Math.sin(this.time.elapsed * 0.001) * 0.1
            this.group.rotation.y = Math.sin(this.time.elapsed * 0.0005) * 0.1
        }
    }
}
