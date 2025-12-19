import * as THREE from 'three'
import Sizes from '../utils/Sizes.js'
import Time from '../utils/Time.js'
import Resources from '../utils/Resources.js'
import Camera from './Camera.js'
import Renderer from './Renderer.js'
import World from './World/World.js'
import sources from './sources.js'

let instance = null

export default class Experience {
    constructor(canvas) {
        if (instance) {
            return instance
        }
        instance = this

        // Global access
        window.experience = this

        // Options
        this.canvas = canvas

        // Setup
        this.sizes = new Sizes()
        this.time = new Time()
        this.scene = new THREE.Scene()
        this.resources = new Resources(sources)
        this.camera = new Camera()
        this.renderer = new Renderer()
        this.world = new World()

        // Sizes resize event
        this.sizes.on('resize', () => {
            this.resize()
        })

        // Time tick event
        this.time.on('tick', () => {
            this.update()
        })

        // Raycaster
        this.raycaster = new THREE.Raycaster()
        this.mouse = new THREE.Vector2()

        window.addEventListener('mousemove', (event) => {
            this.mouse.x = (event.clientX / this.sizes.width) * 2 - 1
            this.mouse.y = -(event.clientY / this.sizes.height) * 2 + 1
        })

        window.addEventListener('click', () => {
            if (this.currentIntersect) {
                if (this.world.book)
                    this.world.book.open()
            }
        })
    }

    resize() {
        this.camera.resize()
        this.renderer.resize()
    }

    update() {
        this.camera.update()

        // Raycaster update
        if (this.camera.instance) {
            this.raycaster.setFromCamera(this.mouse, this.camera.instance)
        }

        if (this.world.book && this.world.book.group) {
            const intersects = this.raycaster.intersectObjects(this.world.book.group.children, true)

            if (intersects.length > 0) {
                this.currentIntersect = intersects[0]
                document.body.style.cursor = 'pointer'
            } else {
                this.currentIntersect = null
                document.body.style.cursor = 'default'
            }
        }

        this.world.update()
        this.renderer.update()
    }
}
