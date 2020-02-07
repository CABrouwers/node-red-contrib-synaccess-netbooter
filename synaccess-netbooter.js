module.exports = function (RED) {


    function NetbooterNode(config) {
        var fetch = require("node-fetch");
        var utils = require("./synaccess-utils.js")
        RED.nodes.createNode(this, config);
        var node = this;
        var queue = Promise.resolve();
        var preambule = "http://" + node.credentials.username + ":" + node.credentials.password + "@" + config.address + "/cmd.cgi?";

        var enforcing = config.enforce == true;
        var statenumber = parseInt(config.statenumber) == 16 ? 16 : 8;
        var simulationmode = config.simulation == true;
        var trueword = config.trueword.toUpperCase()
        var falseword = config.falseword.toUpperCase()
        if (trueword == "") { trueword = true }
        if (falseword == "") { falseword = false }
        const statetracker = (n, enforce) => {
            var me = new Object();
            var str = Array(n).fill(null);


            me.set = (num, val) => {
                if (Number.isInteger(num) && num > 0 && num <= statenumber) { str[num - 1] = val; }
            };
            me.string = () => {
                return str.map((v) => { return (v ? "1" : (v == false || simulationmode ? "0" : "X")) }).reverse().join("");
            }

            me.compare = (exStates) => {
                val = {}
                exStates.forEach((s, i) => {
                    if (s !== str[i]) {
                        if (str[i] == null || !enforce) { str[i] = s }
                        else { val[(i + 1).toString()] = str[i] }
                    }
                })
                return val;
            };

            return me;

        }


        states = statetracker(statenumber, enforcing);


        var labelstring = config.labels;
        var transtable = {};
        var reversetranstable = {}

        const getWord = (val) => { return val ? trueword : falseword }


        Object.entries(utils.pairify(labelstring)).forEach((p) => {
            let key = parseInt(p[0]);
            if ((p.length > 1) && (key > 0) && (key <= statenumber)) {
                transtable[p[1]] = key.toString();
                reversetranstable[key.toString()] = p[1];
            }
        })

        var lastpool = { success: false, error : "Pooled yet (code 4)" };



        myPacer = new utils.Pacer(250);


        const get = function (ending) {
            var callURL = preambule + ending;
            var prom = myPacer.do(() => { return fetch(callURL, { method: 'get' }) })
                .then(function (response) {
                    return new Promise((resolve) => {
                        response.text().then((t) => { updateStatus(t); resolve(t) })
                    })
                })
                .catch(function (fail) {
                    let err = "No response from " + callURL;
                    return err;
                })
            return (prom);
        }

        const getFakePoll = function () {

            return new Promise((resolve) => { updateStatus("$A0"); resolve("$A0," + states.string() + "," + (1 + Math.random()).toFixed(2) + "," + (80 + Math.random() * 10).toFixed(0)); })
        }

        const pool = function () {

            var prom

            if (simulationmode) { prom = getFakePoll() }
            else { prom = get("$A5") }

            prom = prom
                .then(function (txt) {
                    var res = txt.split(",");
                    if (res[0] !== "$A0") {
                        lastpool = { success: false, error: "Bad response (code 1)", text: txt, timestamp: new Date() };
                        return;
                    }
                    lastpool = {
                        success: true,
                        states: res[1].split("").map(x => (x == "1" ? true : false)).reverse(),
                        current: parseFloat(res[2]),
                        temperature: parseFloat(res[3]),
                        timestamp: new Date(),
                        text: res
                    };
                    if (simulationmode) { lastpool["simulation"] = true; }
                    return;
                })
                .catch(function (error) {
                    lastpool = { success: false, error: error + " (code 2)", timestamp: new Date() };
                    return;
                })
            return prom;
        };

        const getFakeSwitch = function () {
            return new Promise((resolve) => { updateStatus("$A0"); resolve("$A0,"); })
        }


        const setswitch = function (dest, state) {
            dest = dest - 1;

            try {
                if (state == null) {
                    return Promise.resolve();
                }
                if (state == "T") {
                    state = !lastpool["states"][dest]
                }
            }
            catch (e) { return Promise.resolve(); }
            let dd = "0" + (parseInt(dest) + 1).toString();
            dd = dd.substr(dd.length - 2, 2);
            states.set(dest + 1, state);
            var prom;
            if (simulationmode) {  prom = getFakeSwitch() }
            else { prom = get("$A3 " + dd + " " + (state ? 1 : 0).toString()); }
            prom = prom
                .then((t) => {
                    return;
                })
                .catch((error) => {
                    console.debug("Can't switch (code 3): ", dest, " to ", state);
                    return;
                })
            return prom;
        }

        const canonize = function (val) {
            try { val = val.toUpperCase(); }
            catch { }
            switch (val) {
                case 0:
                case false:
                case "0":
                case "OF":
                case "OFF":
                case "FALSE":
                case falseword:
                    return false;
                case 1:
                case true:
                case "1":
                case "ON":
                case "TRUE":
                case trueword:
                    return true
                case "T":
                case "TOG":
                case "TOGGLE":
                    return ["T"];
                default:
                    return null;
            };
        };

        const translate = function (key) {
            let val = transtable[key];
            return ((val == null) ? key : val);
        }

        node.translate = translate;

        const reversetranslate = function (key) {
            let val = reversetranstable[key];
            return ((val == null) ? key : val);
        }

        node.reversetranslate = reversetranslate;

        const setAll = function (entries) {



            let poolrequested = false;
            let stringentry = false;
            entries = utils.commandify(entries)

            let canonizedPairs = {};

            for (const key in entries) {
                let val = canonize(entries[key]);
                if (Array.isArray(val)) {
                    poolrequested = true;
                    val = val[0];
                }
                if (stringentry) { canonizedPairs[translate(parseInt(key) + 1)] = val; }
                else { canonizedPairs[translate(key)] = val; }
            }




            let prereq = Promise.resolve();
            if (poolrequested) {
                prereq = pool();
            }
            let promiseArray = [];
            let prom = prereq
                .then(() => {

                    for (const key in canonizedPairs) {
                        promiseArray.push(setswitch(key, canonizedPairs[key]))

                    }
                    return Promise.all(promiseArray)
                })
            return prom


        }

        const GetValList = function () {
            let tmplist = {}
            try {
                let tmp = lastpool["states"];
                if (tmp !== null) {
                    for (i = 0; i < tmp.length; i++) {
                        tmplist[reversetranslate(i + 1)] = getWord(tmp[i]);
                    }
                }

                tmp = lastpool["temperature"];
                if (tmp !== null) {
                    if (config.labeltemp == null || config.labeltemp == "") {
                        tmplist["temperature"] = tmp;
                    }
                    else {
                        tmplist[config.labeltemp] = tmp;
                    }
                }
                tmp = lastpool["current"];
                if (tmp !== null) {
                    if (config.labelamp == null || config.labelamp == "") {
                        tmplist["current"] = tmp;
                    }
                    else {
                        tmplist[config.labelamp] = tmp;
                    }
                }
            }
            catch (e) {}
            return tmplist;
        }

        const TryCommand = (cmd, enf) => {
            return new Promise((resolve) => {
                setAll(cmd)
                    .then(pool)
                    .then(() => {
                        if (enf) {
                            let res = states.compare(lastpool.states);
                            if (Object.keys(res).length > 0) {
                                TryCommand(cmd, false)
                                    .then(() => { resolve(); })
                                return;
                            }
                        }
                        resolve();
                        return;
                    })
            })
        }

        const processMessage = function (cmd) {
            queue = queue
                .then(() => {
                    TryCommand(cmd, enforcing)
                        .then(function () {
                            broadcaster.repeat(lastpool);
                            colorbroadcaster.repeat(GetValList())
                        })
                })
        };

        var statusCounter
        var unitiliazedStatus = true



        const updateStatus = function (resp) {


            if (resp.startsWith("$A0")) {
                if (unitiliazedStatus) {
                    statusCounter = 5;
                }
                else { statusCounter = Math.max(0, statusCounter - 1) }
            }
            else {
                if (unitiliazedStatus) {
                    statusCounter = 0;
                }
                else { statusCounter = Math.min(5, statusCounter + 1) }
            }
            if (statusCounter = 0) {
                statusBroadcaster.repeat({fill: "red", shape: "ring", text: "problem" })
            }
            else if (statusCounter = 5) {
                statusBroadcaster.repeat({ fill: "green", shape: "ring", text: "OK" })
            }
            else {
                statusBroadcaster.repeat({ fill: "yellow", shape: "ring", text: "errors" })
            }

        }


        var broadcaster = utils.cycle();

        var colorbroadcaster = utils.cycle();

        var receiver = utils.cycle();

        var listener = receiver.thenagain(processMessage);

        var statusBroadcaster = utils.cycle();

        statusBroadcaster.repeat({ fill: "grey", shape: "ring", text: "idle" });

        node.getBroadcaster = () => { return broadcaster };
        node.getColorBroadcaster = () => { return colorbroadcaster };
        node.getStatusBroadcaster = () => { return statusBroadcaster };
        node.getReceiver = () => { return receiver };

        node.on('input', function (msg, send, done) {
            done();
        });

        node.on('close', function () {
            if (listener) { listener.resolve(); }
        });
    }


    RED.nodes.registerType("netbooter", NetbooterNode, {
        credentials: {
            username: { type: "text" },
            password: { type: "password" }
        }
    })



}