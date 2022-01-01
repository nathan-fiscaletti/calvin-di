const container = (promise = Promise) => ({
    modules: {},

    registerComplex: function(module) {
        const required = ['name', 'factory'];

        required.forEach(requiredProperty => {
            if (!(requiredProperty in module)) {
                throw new ContainerError(`Attempting to register module with registerComplex() but it's definition is missing '${requiredProperty}' property.`);
            }
        });

        const name = module.name;
        const factory = module.factory;
        const properties = module.properties || {};
        const dependencies = module.dependencies || [];

        if (this.modules[name] !== undefined) {
            throw new ContainerError(`Attempting to register module '${name}', but it has already been registered. See replace().`);
        }

        if (typeof factory !== 'function') {
            if (factory.length > 0 || dependencies.length > 0) {
                throw new ContainerError(`Cannot register module '${name}' with dependencies. You must use a factory for your module if you wish to provide dependencies.`);
            }
    
            this.modules[name] = {
                name,
                factory: () => factory,
                dependencies,
                properties,
                instance: undefined,
                started: false
            };
            return;
        }
    
        if (factory.length !== dependencies.length) {
            throw new ContainerError(`The number of parameters in factory implementation of module '${name}' does not match number of passed dependencies.`);
        }

        this.modules[name] = {
            name,
            factory,
            dependencies,
            properties,
            instance: undefined,
            started: false
        };
    },

    replaceComplex: function(module) {
        const required = ['name', 'factory'];

        required.forEach(requiredProperty => {
            if (!(requiredProperty in module)) {
                throw new ContainerError(`Attempting to replace module with replaceComplex() but it's definition is missing '${requiredProperty}' property.`);
            }
        });

        const name = module.name;
        this.clear(name);

        this.registerComplex(module);
    },

    register: function (name, factory, properties={}, dependencies = []) {
        this.registerComplex({
            name,
            factory,
            dependencies,
            properties
        });
    },

    replace: function (name, factory, properties = {}, dependencies = []) {
        this.replaceComplex({
            name,
            factory,
            dependencies,
            properties
        });
    },

    getInstance: function (name) {
        if (this.modules[name] === undefined) {
            throw new ContainerError(`Attempting to retrieve module '${name}' but no module by that name has been registered.`);
        }

        if (this.modules[name].instance) {
            return this.modules[name].instance;
        }

        const module = this.modules[name];
        const dependencies = [];
        module.dependencies.forEach(dependencyName => {
            if (dependencyName == name) {
                throw new ContainerError(`Module '${name}' cannot depend on itself.`);
            }
            const childModule = this.modules[dependencyName];
            if (childModule.properties.startable) {
                throw new ContainerError(`Module '${name}' cannot depend on startable module '${dependencyName}'.`);
            }
            const childInstance = this.getInstance(dependencyName);
            dependencies.push(childInstance);
        });

        const instance = module.factory(...dependencies);

        if (instance === undefined) {
            throw new ContainerError(`Failed to instantiate module '${name}'.`);
        }

        this.modules[name].instance = instance;
        return instance;
    },

    clear: function (name) {
        if (this.modules[name] === undefined) {
            return;
        }

        if (this.modules[name].instance) {
            throw new ContainerError(`Module '${name}' was already instantiated, cannot modify.`);
        }

        delete this.modules[name];
    },

    reset: function() {
        const started = this.filteredModules({started: true});

        if (started.length > 0) {
            const startedModuleNames = started.map(module => module.name);
            throw new ContainerError(`Cannot reset container while one or more modules are running. Please use stop() or stopAll(). Started modules: ${startedModuleNames.join(', ')}`);
        }

        this.registered = {};
    },

    start: function(name, startFunc='start') {
        if (this.modules[name] === undefined) {
            throw new ContainerError(`Attempting to start module '${name}' but no module by that name has been registered.`);
        }

        const module = this.modules[name];
        if (!module.properties.startable) {
            throw new ContainerError(`Cannot start non-startable module '${name}'.`);
        }

        if (module.started) {
            if (this.modules[name].instance === undefined) {
                throw new ContainerError(`Module '${name}' indicates that it has already been started but no instance for it could be found. This is a critical error and should be reported to the maintainers of this project.`);
            }

            return this.modules[name].instance;
        }

        const instance = this.getInstance(name);
        if (typeof instance[startFunc] !== 'function') {
            throw new ContainerError(`Cannot start module '${name}', start function '${startFunc}()' not found.`);
        }

        try {
            return promise.resolve(instance[startFunc]()).then(() => {
                module.started = true;
                return instance;
            });
        } catch (err) {
            throw new ContainerError(`Module '${name}' failed to start: ${err}`);
        }
    },

    startAll: function() {
        const startable = this.filteredModules({started: false, properties: {startable: true}});
        
        if (startable.length < 1) {
            return promise.resolve();
        }
        
        const promises = [];
        for (const module of startable) {
            promises.push(this.start(module.name));
        }
        
        return promise.all(promises);
    },

    stop: function(name, stopFunc='stop') {
        if (this.modules[name] === undefined) {
            throw new ContainerError(`Attempting to stop module '${name}' but no module by that name has been registered.`);
        }

        const module = this.modules[name];
        if (!module.started) {
            throw new ContainerError(`Attempting to stop module '${name}' but it has not yet been started.`);
        }

        const instance = this.getInstance(name);
        if (typeof instance[stopFunc] !== 'function') {
            throw new ContainerError(`Cannot stop module '${name}', stop function '${stopFunc}()' not found.`);
        }

        return promise.resolve(instance[stopFunc]()).then(() => {
            module.instance = undefined;
            module.started = false;
        });
    },

    stopAll: function() {
        const stoppable = this.filteredModules({started: true});
        if (stoppable.length < 1) {
            return promise.resolve();
        }

        const promises = [];
        for (const module of stoppable) {
            promises.push(this.stop(module.name));
        }
        
        return promise.all(promises);
    },

    filteredModules: function(filter) {
        return filter(this.modules, filter);
    }
});

function filter(obj, filter) {
    let finalObj;
    if (Array.isArray(obj)) {
        finalObj = obj;
    } else {
        finalObj = Object.values(obj);
    }

    const isInFilter = (obj, f) => {
        let filterTermsMet = true;
        for (const filteredProp in f) {
            if (typeof filter[filteredProp] === 'object' && !Array.isArray(f[filteredProp])) {
                filterTermsMet = isInFilter(obj[filteredProp], f[filteredProp]);
            } else {
                filterTermsMet = obj[filteredProp] === f[filteredProp];
            }
    
            if (!filterTermsMet) {
                break;
            }
        }
    
        return filterTermsMet;
    }

    return finalObj.filter(prop => {
        return isInFilter(prop, filter);
    });
};

class ContainerError extends Error {
    constructor(message) {
        super(message);

        // Omit frames that originated in this file.
        const originalMessage = this.stack.split('\n')[0].replace('Error:', 'ContainerError:');
        const stackWithoutMessage = this.stack.split('\n').slice(1);
        const newStack = [];
        stackWithoutMessage.forEach(frame => {
            if (!frame.includes(__filename)) {
                newStack.push(frame);
            }
        })
        stackWithoutMessage.shift();
        this.stack = `${originalMessage}\n${newStack.join('\n')}`;
    }
}

module.exports = { container };