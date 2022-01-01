const { container } = require(`.`);

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

const deps = container();
deps.register('UserService', UserService);
deps.register('OtherUserService',OtherUserService);
deps.register('PlatformService', PlatformService, {}, ['UserService']);
// container.register('TestService', TestService, {}, ['PlatformService', 'UserService', 'https']);
deps.registerComplex({
    name: 'TestService',
    factory: TestService,
    dependencies: ['PlatformService', 'UserService', 'https']
});
deps.register('https', https);

// container.reset();

try {
    deps.getInstance('TestService2').do();
} catch (err) {
    console.log(err);
}