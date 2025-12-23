import * as THREE from 'three'
import Experience from './Experience.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export default class Camera {
    constructor() {
        this.experience = new Experience()
        this.sizes = this.experience.sizes
        this.scene = this.experience.scene
        this.canvas = this.experience.canvas

        this.setInstance()
        this.setControls()
    }

    setInstance() {
        this.instance = new THREE.PerspectiveCamera(35, this.sizes.width / this.sizes.height, 0.1, 100)
        this.instance.position.set(6, 4, 12)
        this.scene.add(this.instance)
    }

    setControls() {
        this.controls = new OrbitControls(this.instance, this.canvas)
        this.controls.enableDamping = true

        // Custom Gesture Logic:
        // Default: Zoom Enabled.
        // We only DISABLE it if we detect a "Vertical Swipe" that is NOT a Pinch.
        this.controls.enableZoom = true

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault() // prevent page scroll just in case

            const isPinch = e.ctrlKey || e.metaKey
            const isVertical = Math.abs(e.deltaY) > Math.abs(e.deltaX)

            if (!isPinch && isVertical) {
                // Block Zoom for Vertical Swipes
                this.controls.enableZoom = false
            } else {
                // Allow Zoom for Pinch or minor movements
                this.controls.enableZoom = true
            }
        }, { capture: true })

        // Safari Gesture Support (Pinch)
        this.canvas.addEventListener('gesturestart', (e) => {
            e.preventDefault()
            this.controls.enableZoom = true
        })
        this.canvas.addEventListener('gesturechange', (e) => {
            e.preventDefault()
        })
        this.canvas.addEventListener('gestureend', (e) => {
            this.controls.enableZoom = true
        })
    }

    resize() {
        this.instance.aspect = this.sizes.width / this.sizes.height
        this.instance.updateProjectionMatrix()
    }

    update() {
        this.controls.update()
    }
}
