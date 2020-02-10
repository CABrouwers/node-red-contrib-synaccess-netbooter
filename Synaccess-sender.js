module.exports = function (RED) {

    function senderNode(config) {
        var utils = require("./synaccess-utils.js")
        RED.nodes.createNode(this, config);
        var node = this;
        var server = RED.nodes.getNode(config.netbooter);
        var receiver = null;
        var statusBroadcasting = null;
        var statusVal = { fill: "grey", shape: "ring", text: "idle" };
        var statusResetter = null;
        if (server) {
            receiver = server.getReceiver();
            var statusSender = server.getStatusBroadcaster();
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

        setStatus(false);


        var signal = utils.pseudoParify(config.signal)
        var signaled = Object.keys(signal).length > 0
        if (signaled) {
            config.usetopic = false;
        }

        var recognizeTopic = config.usetopic;


        var filter = utils.tablify(config.filter)
        var filtered = Object.keys(filter).length > 0

        node.on('input', function (msg, send, done) {
            var inLoad;
            if (recognizeTopic && msg.topic) {
                inLoad = { [msg.topic]: msg.payload }
            }
            else {
                inLoad = msg.payload
            }



            if (receiver) {
                let cmd = {}
                if (signaled) {
                    let values = utils.tablify(inLoad)
                    signal.forEach((entry) => {
                        let key = entry[0]
                        let val = entry[1]
                        if (val == null && values.length > 0) {
                            val = values.shift();
                        }
                        if (val != null) {
                            cmd[key] = val;
                        }
                    })
                }
                else {

                    if (filtered) {

                        Object.entries(utils.commandify(inLoad)).forEach((entry) => {
                            let key = entry[0];
                            if (!filter.includes(server.translate(key))) { return }
                            let val = entry[1];
                            cmd[key] = val

                        })

                    }
                    else { cmd = utils.commandify(inLoad)}
                }
                setStatus(true);

                receiver.repeat(cmd);
            }
            done()

        })

        node.on('close', function () {
            if (statusBroadcasting) { broadcstatusBroadcastingasting.resolve(); }
        });
}

    RED.nodes.registerType("sender", senderNode, {
        credentials: {
            username: { type: "text" },
            password: { type: "password" }
        }
    })

}
