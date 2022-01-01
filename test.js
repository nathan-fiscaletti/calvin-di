function test() {
    return "nathan1";
}

async function test2() {
    return "nathan2";
}

function test3() {
    return new Promise((resolve, reject) => {
        reject("nathan3");
    });
}

async function run() {
    // console.log(await test());
    // console.log(await test2());
    try {
        console.log(await test3());
    } catch (err) {
        console.log(`err: ${err}`);
    }
    // Promise.resolve(test()).then(val => console.log(val));
    // Promise.resolve(test2()).then(val => console.log(val));
    // Promise.resolve(test3()).then(val => console.log(val));
}

run();