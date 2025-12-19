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
            pageThickness: 0.02,
            spiralRadius: 0.2,
            spiralSpacing: 0.25,
            wireThickness: 0.025,
            holeRadius: 0.08,
            holeMargin: 0.2,
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
        }

        this.coverMaterial = new THREE.MeshStandardMaterial({
            map: textures.cover || null,
            color: '#d4a373',
            roughness: 0.7,
            side: THREE.DoubleSide
        })

        this.pageMaterial = new THREE.MeshStandardMaterial({
            map: textures.page || null,
            color: '#ffffff',
            roughness: 0.6,
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
        const pageCount = 5
        const angularSpacing = 0.08

        let currentAngle = -((pageCount + 2) * angularSpacing) / 2

        this.frontCoverPivot = new THREE.Group()
        this.frontCoverPivot.position.set(0, 0, 0)
        this.frontCoverPivot.rotation.y = currentAngle
        this.bookContainer.add(this.frontCoverPivot)

        this.frontCover = new THREE.Mesh(coverGeo, this.coverMaterial)
        this.frontCover.position.set(r, 0, 0)
        this.frontCoverPivot.add(this.frontCover)

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
    }

    // REMOVED helper methods for content

    open() {
        if (this.isOpen) return
        this.isOpen = true

        const tl = gsap.timeline()
        const openAngle = -Math.PI + 0.1

        // 1. Flip Front Cover
        tl.to(this.frontCoverPivot.rotation, {
            duration: 1.5,
            y: openAngle,
            ease: 'power2.inOut'
        }, 'start')

        // 2. Camera Move
        tl.to(this.group.rotation, {
            duration: 1.5,
            x: -Math.PI / 4 + 0.2,
            y: 0,
            ease: 'power2.out'
        }, 'start')

        // 3. Flip Pages
        this.pages.forEach((p, i) => {
            if (i < this.pages.length / 2) {
                const targetAngle = openAngle + ((this.pages.length / 2 - i) * 0.08) + 0.1

                tl.to(p.rotation, {
                    duration: 1.0,
                    y: targetAngle,
                    ease: 'power2.inOut'
                }, '>-0.8')
            }
        })
    }

    update() {
        if (!this.isOpen) {
            this.group.position.y = Math.sin(this.time.elapsed * 0.001) * 0.1
            this.group.rotation.y = Math.sin(this.time.elapsed * 0.0005) * 0.1
        }
    }
}
