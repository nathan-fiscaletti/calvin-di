function createModule(name, dependencies, factory) {
    if (typeof factory !== 'function') {
        if (factory.length > 0) {
            throw new Error(`Cannot register instance module ${name} with dependencies. You must use a factory for your module if you wish to provide dependencies.`);
        }

        return {
            factory: () => factory,
            dependencies: []
        };
    }

    if (factory.length !== dependencies.length) {
        throw new Error(`The number of parameters in factory implementation of module ${name} does not match number of passed dependencies.`);
    }

    return {
        factory,
        dependencies,
        started: false
    };
}

function createContainer() {
    return {
        registered: {},
        instantiated: {},

        register: function (name, dependencies, factory) {
            if (this.registered[name] !== undefined) {
                throw new Error(`Attempting to register module ${name}, but it has already been registered. See replace().`);
            }
            
            const module = createModule(name, dependencies, factory);
            this.registered[name] = module;
        },

        get: function (name) {
            if (this.instantiated[name]) {
                return this.instantiated[name];
            }

            if (this.registered[name] === undefined) {
                throw new Error(`Attempting to retrieve Module ${name} but no module by that name has been registered.`);
            }

            const module = this.registered[name];
            const dependencies = [];
            module.dependencies.forEach(dependencyName => {
                if (dependencyName == name) {
                    throw new Error(`Module ${name} cannot depend on itself.`);
                }
                const childModule = this.get(dependencyName);
                dependencies.push(childModule);
            });

            const instance = module.factory(...dependencies);

            if (instance === undefined) {
                throw new Error(`Failed to instantiate module ${name}.`);
            }

            this.instantiated[name] = instance;
            return instance;
        },

        clear: function (name) {
            if (this.registered[name] === undefined) {
                return;
            }

            if (this.instantiated[name]) {
                throw new Error(`Module ${name} was already instantiated, cannot clear.`);
            }

            delete this.registered[name];
        },

        swap: function (name, dependencies, factory) {
            this.clear(name);
            this.register(name, dependencies, factory);
        },

        reset: function() {
            this.registered = {};
            this.instantiated = {};
        },

        start: function(name, startFunc='start') {
            if (this.registered[name] === undefined) {
                throw new Error(`Attempting to start module ${name} but no module by that name has been registered.`);
            }

            const module = this.registered[name];
            if (module.started) {
                if (this.instantiated[name] === undefined) {
                    throw new Error(`Module ${name} indicates that it has already been started but no instance for it could be found. This is a critical error and should be reported to the maintainers of this project.`);
                }

                return this.instantiated[name];
            }

            const instance = this.get(name);
            if (typeof instance[startFunc] !== 'function') {
                throw new Error(`Cannot start module ${name}, start function '${startFunc}()' not found.`);
            }

            try {
                return Promise.resolve(instance[startFunc]()).then(() => {
                    module.started = true;
                    return instance;
                });
            } catch (err) {
                throw new Error(`Module ${name} failed to start: ${err}`);
            }
        }
    };
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

const OtherUserService = () => ({
    register: () => console.log('it different')
});

const UserService = () => ({
    register: () => console.log('registered user')
});

const PlatformService = (US) => ({
    run: () => US.register()
});

const TestService = (PS, US, https) => ({
    do: () => PS.run(),
    start: () => {
        console.log(https.Server);
        console.log('started TestService');
    }
});

const https = require(`https`);

const container = createContainer();
container.register('UserService', [], UserService);
container.register('OtherUserService', [], OtherUserService);
container.register('PlatformService', ['OtherUserService'], PlatformService);
container.register('TestService', ['PlatformService', 'UserService', 'https'], TestService);
container.register('https', [], https);

console.log('starting TestService');
container.start('TestService').then(() => console.log('start returned'));
console.log('TestService start called');

// ctx.getDependency('TestService').do();