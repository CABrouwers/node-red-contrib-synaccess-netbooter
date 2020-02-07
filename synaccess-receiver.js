module.exports = function (RED) {


    function smartreceiverNode(config) {
        var utils = require("./synaccess-utils.js")
        RED.nodes.createNode(this, config);
        var node = this;

        var filterlist = utils.tablify(config.filter);
        var isfiltered = filterlist.length > 0;


        var lastValues = {}
        var notonlychanges = !config.onlychanges;


        var hasChanged = (key, val) => {
            if (val != val) {val = "Nan"}
            var ret = notonlychanges || lastValues[key] != val;
            lastValues[key] = val;
            return ret;
        }

        const sendIfChanged = (key, val) => {
            if (hasChanged(key, val)) {
                setStatus(true);
                node.send({ payload: { [key]: val } })
            }
        }

        var server = RED.nodes.getNode(config.netbooter);
        var sender = null;
        var broadcasting = null;
        var statusBroadcasting = null;
        var statusVal = { fill: "grey", shape: "ring", text: "idle" };
        var statusResetter = null;

        if (server) {
            var sender = server.getColorBroadcaster();
            var statusSender = server.getStatusBroadcaster();
            if (isfiltered) {
                broadcasting = sender.thenagain(

                    (pl) => {
                        filterlist.forEach((s) => {
                            let val = null;
                            if (s in pl) { val = pl[s]; }
                            else {
                                s = server.reversetranslate(s);
                                if (s in pl) { val = pl[s]; }
                                else { return; }
                            }
                            if (val !== null) {
                                sendIfChanged(s, val);
                            }
                        })
                    });
            }
            else {
                broadcasting = sender.thenagain(
                    (pl) => {
                        for (var entry of Object.entries(pl)) {
                            sendIfChanged(entry[0], entry[1]);
                        };
                    }
                );


            }
            statusBroadcasting = statusSender.thenagain(
                (st) => {
                    statusVal = st;
                })

        }

        const setStatus = (state) => {
            clearTimeout(statusResetter);
            if (state) {
                statusVal['shape'] = "dot";
                this.status(statusVal);
                statusResetter = setTimeout(() => { setStatus(false) }, 500)
            }
            else {
                statusVal['shape'] = "ring";
                this.status(statusVal);
            }
        }

        setStatus(false)

        node.on('input', function (msg, send, done) {

            send(msg);
            done()

        })

        node.on('close', function () {
            if (broadcasting) { broadcasting.resolve(); }
            if (statusBroadcasting) { statusBroadcasting.resolve(); }
        });
    }

    RED.nodes.registerType("receiver", smartreceiverNode, {
        credentials: {
            username: { type: "text" },
            password: { type: "password" }
        }
    })

}
