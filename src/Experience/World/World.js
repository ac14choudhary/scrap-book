import Experience from '../Experience.js'
import Environment from './Environment.js'
import Book from './Book.js'

export default class World {
    constructor() {
        this.experience = new Experience()
        this.scene = this.experience.scene
        this.resources = this.experience.resources

        // Wait for resources
        this.resources.on('ready', () => {
            // Setup
            this.environment = new Environment()
            this.book = new Book()
        })
    }

    update() {
        if (this.book)
            this.book.update()

        if (this.environment) {
            // this.environment.update() 
        }
    }
}
