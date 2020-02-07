module.exports = function (RED) {


    function dataInNode(config) {

        RED.nodes.createNode(this, config);
        var node = this;
        var server = RED.nodes.getNode(config.netbooter);
        var broadcaster = null;
        var broadcasting = null;
        var statusBroadcasting = null;
        var statusVal = { fill: "grey", shape: "ring", text: "idle" };
        var statusResetter = null;

        if (server) {
            var sender = server.getBroadcaster();
            var statusSender = server.getStatusBroadcaster();

            broadcasting = sender.thenagain(
                (pl) => {
                    let msg = { payload: pl };
                    setStatus(true);
                    node.send(msg);
                })

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

        node.on('input', function (msg, send, done) {

            send(msg);
            done()

        })


        node.on('close', function () {
            if (broadcasting) { broadcasting.resolve(); }
            if (statusBroadcasting) { broadcstatusBroadcastingasting.resolve(); }
        });
    }

    RED.nodes.registerType("data in", dataInNode, {
        credentials: {
            username: { type: "text" },
            password: { type: "password" }
        }
    })

}
