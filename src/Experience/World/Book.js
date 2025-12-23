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

        this.spiralMaterial = new THREE.MeshStandardMaterial({
            color: '#333333',
            metalness: 0.6,
            roughness: 0.4
        })
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
        const pageCount = 15
        const angularSpacing = 0.08

        let currentAngle = -((pageCount + 2) * angularSpacing) / 2

        this.frontCoverPivot = new THREE.Group()
        this.frontCoverPivot.position.set(0, 0, 0)
        this.frontCoverPivot.rotation.y = currentAngle
        this.bookContainer.add(this.frontCoverPivot)

        this.frontCover = new THREE.Mesh(coverGeo, this.coverMaterial)
        this.frontCover.position.set(r, 0, 0)
        this.frontCoverPivot.add(this.frontCover)

        // userData to identify
        this.frontCover.userData = { isCover: true, isFront: true, pivot: this.frontCoverPivot }
        this.frontCoverPivot.userData = { isTurned: false, baseAngle: currentAngle }

        currentAngle += angularSpacing * 1.5

        // Pages
        this.pages = []
        for (let i = 0; i < pageCount; i++) {
            const pPivot = new THREE.Group()
            pPivot.position.set(0, 0, 0)
            pPivot.rotation.y = currentAngle
            this.bookContainer.add(pPivot)

            const pMesh = new THREE.Mesh(pageGeo, this.pageMaterial)
            pMesh.position.set(r, 0, 0)
            pPivot.add(pMesh)

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
        this.backCoverPivot.position.set(0, 0, 0)
        this.backCoverPivot.rotation.y = currentAngle
        this.bookContainer.add(this.backCoverPivot)

        this.backCover = new THREE.Mesh(coverGeo, this.coverMaterial)
        this.backCover.position.set(r, 0, 0)
        this.backCoverPivot.add(this.backCover)
        this.backCover.userData = { isCover: true, isBack: true }
    }

    interact(intersect) {
        if (!intersect || !intersect.object) return

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
            const targetAngle = -Math.PI + 0.1
            gsap.to(pivot.rotation, {
                duration: 1.5,
                y: targetAngle,
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
            pivot.userData.isTurned = false
        }
    }

    turnPage(pivot) {
        const index = pivot.userData.index
        const isTurned = pivot.userData.isTurned

        // Revised Open Angle to keep it "in spiral"
        const openAngleBase = -Math.PI + 0.25

        if (!isTurned) {
            // Turning LEFT (Opening)
            // stack: Cover -> 0 -> 1 -> ... -> N
            // 0 is Top.
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

            const targetAngle = openAngleBase + (index * 0.005)

            gsap.to(pivot.rotation, {
                duration: 1.2,
                y: targetAngle,
                ease: 'power2.inOut'
            })
            pivot.userData.isTurned = true

        } else {
            // Turning RIGHT (Closing)
            // Stack Left: N -> ... -> 1 -> 0 -> Cover
            // N is Bottom Left. 0 is Top Left?
            // If I turned 0, then 1, then 2.
            // 0 is at bottom of left stack?
            // "Open Angle Base".
            // 0: base + offset.
            // 1: base + smaller offset.
            // So 0 is "more negative" (Left).
            // 2 is "less negative" (Right/Top of Left Stack).
            // So on Left Stack: High Index is Top.
            // So to close, I must close Top first. (High Index).
            // So to close 'index', 'index + 1' must NOT be turned?
            // If 2 is turned. I want to close 1.
            // 2 is on top of 1.
            // So I must close 2 first.
            // So if (index+1) is Turned, I cannot close 'index'.

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
            pivot.userData.isTurned = false
        }
    }

    update() {
        if (!this.isOpen) {
            this.group.position.y = Math.sin(this.time.elapsed * 0.001) * 0.1
            this.group.rotation.y = Math.sin(this.time.elapsed * 0.0005) * 0.1
        }
    }
}
