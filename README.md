# Calvin

Calvin is a simple dependency injection container for JavaScript.

## Example

```javascript
const calvin = require(`calvin`);

const TestService = (US) => ({
    action: () => console.log(`action performed by ${US.getUserName()}.`)
});

const UserService = () => ({
    getUserName: () => "nathan"
});

const Startable = (TS) => ({
    start: () => {
        TS.action();
    }
});

const container = calvin();

container.register('TestService', TestService, {}, ['UserService']);
container.register('UserService', UserService);
container.register('Startable', Startable, {startable: true}, ['TestService']);

container.startAll();
```

## Details

This is currently a pre-release library. Documentation and test suite forthcoming.

> This was modeled after [redradix/kontainer](https://github.com/redradix/kontainer), but written from scratch with a few added featuers and slightly more complete error handling. Give that original library some love if you like what you see here.