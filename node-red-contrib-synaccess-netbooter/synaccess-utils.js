


const defer = () => {
    var res, rej;

    var promise = new Promise((resolve, reject) => {
        res = resolve;
        rej = reject;
    });

    promise.resolve = res;
    promise.reject = rej;

    return promise;
}



const incycle = () => {


    var promise = defer();

    promise.repeat = (pl) => {
        promise.successor = incycle();
        promise.resolve(pl)
        return promise.successor
    }



    promise.reset = (pl, f, obj, st) => {

        if (promise.successor == null) {
            obj.lastwill()
            return null;
        }

        if (obj.killswitch) {
            if (st) { obj.lastwill(pl) }
            else { obj.lastwill() }
            return null;
        }
        if (st) { f(pl) };

        promise.successor
            .then((pl) => {
                promise.successor.reset(pl, f, obj, true);
            })
            .catch((pl) => {
                promise.successor.reset(pl, f, obj, false);
            })
    }

    promise.thenagain = (f, g = null) => {

        let obj = defer();
        obj.killswitch = false
        obj.then(() => { obj.killswitch = true })
        obj.lastwill = () => { };
        obj.finalize = (g) => { obj.lastwill = g }

        promise
            .then((pl) => {
                promise.reset(pl, f, obj, true);
            })
            .catch((pl) => {
                promise.reset(pl, f, obj, false);
            })




        return obj
    }



    return promise;
}

const cycle = () => {

    var handle = new Object();

    var promise = incycle();

    handle.repeat = (pl) => {
        promise = promise.repeat(pl)
        return handle
    }

    handle.thenagain = (f) => {
        return promise.thenagain(f)
    }

    handle.resolve = (pl) => {
        return promise.resolve(pl);
    }
    return handle;
}


const pairify = (stringIn) => {

    if (typeof stringIn !== 'string' && !(stringIn instanceof String)) {
        if (stringIn == null) { return {} }
        return stringIn;
    }
    let pairs = {};
    let i = 0;
    stringIn = stringIn.replace(/'|"|\{|\}/g, '');

    if (stringIn.length > 0) {
        stringIn.split(",").forEach((s) => {
            let pair = s.split(":");
            if (pair.length > 0) {
                key = pair[0].replace(/^\s+|\s+$/g, '');
                if (pair.length > 1) {
                    val = pair[1].replace(/^\s+|\s+$/g, '');
                }
                else {
                    val = null;
                }
                pairs[key] = val
            }
        })

    };
    return pairs;
}

const tablify = (stringIn) => {
    if (typeof stringIn !== 'string' && !(stringIn instanceof String)) {
        if (Array.isArray(stringIn)) { stringIn }
        if (stringIn == null) { return [] }
        stringIn = stringIn.toString();
    }
    stringIn = stringIn.replace(/'|"|\{|^\s+|\s+$}/g, '')
    if (stringIn.length == 0) { return [] }
    return (stringIn.split(",").map((e) => { return e.replace(/^\s+|\s+$/g, '') }))
}
const pseudoParify = (stringIn) => {

    return tablify(stringIn).map((entry) => {
        if (typeof stringIn !== 'string' && !(stringIn instanceof String)) { entry = entry.toString() }
        entry = entry.split(":");
        if (entry.length < 0) { return [null, null] }
        let key = entry[0]
        return [(entry.length > 0) ? entry[0] : null, (entry.length > 1) ? entry[1] : null]
    })
}


const commandify = (stringIn) => {
    if (typeof stringIn !== 'string' && !(stringIn instanceof String)) {
        if (stringIn == null) { return {} }
        return stringIn;
    }
    let result = {}
    stringIn = stringIn.replace(/'|"|\{|\}|^\s+|\s+$/g, '');
    let stringIn2 = stringIn.replace(/0|1|T|X|t|x|\s/g, '')
    if (stringIn2.length == 0) {
        stringIn.split("").forEach((s, i) => { result[(i + 1).toString()] = s })
        return result;
    }

    return pairify(stringIn);

}

const wait = (f, delay) => {
    return new Promise((resolve) => {
        setTimeout(() => { f(); resolve() }, delay)
    })
}



function Pacer(spacing) {
    var time = 0;
    this.do = (f) => {
        var d = new Date()
        var now = d.getTime()
        var delay = Math.max(time + spacing - now, 0)
        time = now + delay
        return new Promise((resolve) => {
            setTimeout(() => { resolve(f()) }, Math.max(delay, 0))
        })
    }
}





module.exports = {
    defer,
    cycle,
    pairify,
    tablify,
    pseudoParify,
    commandify,
    wait,
    Pacer
}