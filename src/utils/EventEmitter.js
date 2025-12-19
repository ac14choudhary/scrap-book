export default class EventEmitter {
    constructor() {
        this.callbacks = {};
        this.callbacks.base = {};
    }

    on(_names, callback) {
        // Errors
        if (typeof _names === 'undefined' || _names === '') {
            console.warn('wrong names');
            return false;
        }

        if (typeof callback === 'undefined') {
            console.warn('wrong callback');
            return false;
        }

        // Resolve names
        const names = _names.split(' ');

        names.forEach((_name) => {
            const name = _name.split('.');
            const value = name[0];
            const namespace = name[1] || 'base';

            // Create namespace if not exist
            if (!(this.callbacks[namespace] instanceof Object))
                this.callbacks[namespace] = {};

            // Create callback if not exist
            if (!(this.callbacks[namespace][value] instanceof Array))
                this.callbacks[namespace][value] = [];

            // Add callback
            this.callbacks[namespace][value].push(callback);
        });

        return this;
    }

    off(_names) {
        // Errors
        if (typeof _names === 'undefined' || _names === '') {
            console.warn('wrong names');
            return false;
        }

        // Resolve names
        const names = _names.split(' ');

        names.forEach((_name) => {
            const name = _name.split('.');
            const value = name[0];
            const namespace = name[1] || 'base';

            if (value !== '' && this.callbacks[namespace] && this.callbacks[namespace][value]) {
                delete this.callbacks[namespace][value];

                if (Object.keys(this.callbacks[namespace]).length === 0)
                    delete this.callbacks[namespace];
            } else if (value === '' && this.callbacks[namespace]) {
                delete this.callbacks[namespace];
            }
        });

        return this;
    }

    trigger(_name, _args) {
        // Errors
        if (typeof _name === 'undefined' || _name === '') {
            console.warn('wrong name');
            return false;
        }

        let finalResult = null;
        let result = null;

        // Resolve names
        const args = !(_args instanceof Array) ? [_args] : _args;
        let name = _name.split('.');
        let value = name[0];
        let namespace = name[1] || 'base';

        // Resolve callback
        const callCallacks = (namespace, value) => {
            if (this.callbacks[namespace] && this.callbacks[namespace][value]) {
                this.callbacks[namespace][value].forEach((callback) => {
                    result = callback.apply(this, args);

                    if (typeof finalResult === 'undefined') {
                        finalResult = result;
                    }
                });
            }
        };

        if (namespace === 'base') {
            for (const namespace in this.callbacks) {
                if (this.callbacks[namespace] instanceof Object && namespace !== 'base') {
                    callCallacks(namespace, value);
                }
            }
        }

        callCallacks(namespace, value);

        return finalResult;
    }
}
